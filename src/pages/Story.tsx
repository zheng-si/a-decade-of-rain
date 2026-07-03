import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import scrollama from 'scrollama'
import { loadSpray, dateToDay, dayToDate, type SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'
import {
  resolveMapStyle,
  applyMapTheme,
  addStoryHeat,
  setStoryHeatTime,
  setStoryHeatVisible,
  addHillshade,
  setHillshade,
  STORY_HEAT_LAYER,
} from '../components/mapTheme'
import { FACTS_EVENTS, type StoryEvent } from '../content/facts/events'
import { HOOK } from '../content/facts/hook'
import { SOURCES } from '../content/sources'
import { TopBar } from '../App'
import RainCanvas from '../components/RainCanvas'
import TimelineRuler from '../components/TimelineRuler'
import MapKey from '../components/MapKey'
import { readLabelGroups, setGroupVisible, normalizePlaceLabels } from '../components/labelLayers'
import './Story.css'

const SPRAY_SOURCE = 'spray'
const ISLAND_SOURCE = 'islands'
const MR_SOURCE = 'military-regions'
const MRLABEL_SOURCE = 'military-region-labels'
const LANDMARK_SOURCE = 'landmark-boundary'
const DEM_SOURCE = 'terrain-dem'

// Empty polygon collection — the landmark-boundary source when no boundary is shown.
const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

// Neutral treatment: the offshore archipelagos are disputed (China, Vietnam,
// Taiwan et al.) and were never sprayed; shown as reference, no sovereignty
// assigned. Names use the common English forms + Vietnamese in parentheses.
const ISLANDS_FC: FeatureCollection<Point, { name: string }> = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Paracel Is. (Hoàng Sa) · disputed' }, geometry: { type: 'Point', coordinates: [112.0, 16.5] } },
    { type: 'Feature', properties: { name: 'Spratly Is. (Trường Sa) · disputed' }, geometry: { type: 'Point', coordinates: [114.0, 9.8] } },
  ],
}

// Cumulative gallons at the end of each month from January of the first data
// year — drives the timeline ruler's stacked bars and its scan-line readout.
function monthlyCumulative(spray: SprayDataset): { months: number[]; yearStart: number } {
  const yearStart = spray.yearMin
  const N = (spray.yearMax - yearStart + 1) * 12
  const months = new Array(N).fill(0)
  for (const f of spray.features.features) {
    const dt = dayToDate(f.properties.day)
    const mi = (dt.getUTCFullYear() - yearStart) * 12 + dt.getUTCMonth()
    if (mi >= 0 && mi < N) months[mi] += f.properties.gallons
  }
  for (let i = 1; i < N; i++) months[i] += months[i - 1]
  // Aggressive trim: cut the long near-flat tail. End the ruler at the first
  // month that reaches 99% of the grand total, and fold the remaining trickle
  // into that last month so the running total still reads the true ~19.5M.
  const total = months[N - 1]
  let cut = 0
  while (cut < N - 1 && months[cut] < 0.99 * total) cut++
  const kept = months.slice(0, cut + 1)
  kept[kept.length - 1] = total
  return { months: kept, yearStart }
}

function fmtGallons(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`
  return `${Math.round(v)}`
}

export default function Story() {
  const containerRef = useRef<HTMLDivElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dataRef = useRef<SprayDataset | null>(null)
  const readyRef = useRef(false)
  const crossMarkersRef = useRef<maplibregl.Marker[]>([])
  const is3DRef = useRef(false)
  const dayRef = useRef(0)
  const pulseRef = useRef<number | null>(null)
  const landmarksRef = useRef<FeatureCollection | null>(null)
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([])

  const [active, setActive] = useState(0)
  const [started, setStarted] = useState(false)
  const [is3D, setIs3D] = useState(false)
  const [monthlyCum, setMonthlyCum] = useState<number[]>([])
  const [yearStart, setYearStart] = useState(1961)
  const [mapReady, setMapReady] = useState(false)

  // Each node's position on the ruler (0–1), from its playhead date.
  const nodeFracs = useMemo(() => {
    const N = monthlyCum.length || 132
    return FACTS_EVENTS.map((ev) => {
      const dt = new Date(`${ev.date}T00:00:00Z`)
      const mi = (dt.getUTCFullYear() - yearStart) * 12 + dt.getUTCMonth()
      return Math.min(1, Math.max(0, (mi + 0.5) / N))
    })
  }, [monthlyCum.length, yearStart])

  function clearCrosses() {
    crossMarkersRef.current.forEach((m) => m.remove())
    crossMarkersRef.current = []
  }

  // Pilot / test-spray sites where the volume is too small to read as heat:
  // an orange dot with a periodically pulsing ring, plus a label. The pulse
  // animates CHILD elements — MapLibre owns the marker root's transform.
  function showCrosses(
    crosses: { lng: number; lat: number; label: string; below?: boolean; leader?: number }[] | undefined,
  ) {
    const map = mapRef.current
    if (!map) return
    clearCrosses()
    if (!crosses) return
    for (const c of crosses) {
      const el = document.createElement('div')
      el.className = c.leader ? 'map-dot map-dot--leader' : c.below ? 'map-dot map-dot--below' : 'map-dot'
      if (c.leader) el.style.setProperty('--leader', `${c.leader}px`)
      el.innerHTML =
        '<span class="map-dot-ring"></span><span class="map-dot-core"></span>' +
        `<span class="map-dot-label">${c.label}</span>`
      crossMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map))
    }
  }

  // Vietnam's border stays on throughout; only the disputed-island labels are
  // overview-only (they're off-screen once zoomed into the story anyway).
  function setSVVisible(on: boolean) {
    const map = mapRef.current
    if (!map) return
    for (const id of ['island-dot', 'island-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
  }

  // Pulse the boundary outline's opacity with a sine wave, so the highlighted
  // area gently breathes and draws the eye. Uses setPaintProperty per frame.
  function stopPulse() {
    if (pulseRef.current != null) {
      cancelAnimationFrame(pulseRef.current)
      pulseRef.current = null
    }
  }
  function startPulse() {
    const map = mapRef.current
    if (!map) return
    stopPulse()
    // Reduced motion: hold the outline steady instead of breathing.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t = 0
    const tick = () => {
      const m = mapRef.current
      if (!m || !m.getLayer('landmark-outline')) {
        pulseRef.current = null
        return
      }
      t += 0.045
      const s = (Math.sin(t) + 1) / 2 // 0..1
      try {
        m.setPaintProperty('landmark-outline', 'line-opacity', 0.5 + 0.45 * s)
      } catch {
        /* layer gone */
      }
      pulseRef.current = requestAnimationFrame(tick)
    }
    pulseRef.current = requestAnimationFrame(tick)
  }

  function clearLandmarkPoints() {
    landmarkMarkersRef.current.forEach((m) => m.remove())
    landmarkMarkersRef.current = []
  }

  // Highlight the node's representative references: real boundaries (Cà Mau,
  // A Lưới) get a pulsing orange outline + a floating label chip; point
  // landmarks with no authoritative boundary (War Zone C/D, the Iron Triangle,
  // Biên Hòa airbase) get a labelled orange ring marker. Hidden in 3D — a flat
  // outline would float over the tilted relief.
  function applyLandmarks(ev: StoryEvent | null) {
    const map = mapRef.current
    if (!map || !map.getSource(LANDMARK_SOURCE)) return
    const src = map.getSource(LANDMARK_SOURCE) as maplibregl.GeoJSONSource
    clearLandmarkPoints()
    const landmarks = ev && !is3DRef.current ? ev.landmarks : undefined
    if (!landmarks || !landmarks.length) {
      stopPulse()
      src.setData(EMPTY_FC)
      return
    }
    // Real boundary outlines, looked up in landmarks.geojson by id.
    const all = landmarksRef.current
    const feats = landmarks
      .filter((l) => l.boundaryId)
      .map((l) => all?.features.find((f) => (f.properties as { id?: string } | null)?.id === l.boundaryId))
      .filter((f): f is FeatureCollection['features'][number] => !!f)
    src.setData({ type: 'FeatureCollection', features: feats })
    if (feats.length) startPulse()
    else stopPulse()
    // Labels/markers — HTML chips (map glyphs lack Vietnamese diacritics).
    // Point landmarks use the same pulsing dot + pointer chip as test-spray
    // sites; boundary landmarks float a pointer-less chip (the pulsing outline
    // is the pointer).
    for (const l of landmarks) {
      if (!l.point) continue
      const el = document.createElement('div')
      if (l.boundaryId) {
        el.className = 'map-area-label'
        el.innerHTML = `<span class="map-dot-label">${l.name}</span>`
      } else {
        el.className = 'map-dot'
        el.innerHTML =
          '<span class="map-dot-ring"></span><span class="map-dot-core"></span>' +
          `<span class="map-dot-label">${l.name}</span>`
      }
      landmarkMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(l.point).addTo(map))
    }
  }

  // Keep framed content clear of the card (left on desktop, bottom on mobile).
  function framePadding(): maplibregl.PaddingOptions {
    return window.innerWidth > 640
      ? { left: 70, top: 70, right: 70, bottom: 70 }
      : { left: 24, right: 24, top: 48, bottom: 340 }
  }

  // Opening state: NO spray drawn yet (so nothing vanishes on the first scroll);
  // spray then builds from 1962.
  function setHookState() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : 0
    map.flyTo({ ...HOOK.camera, pitch, bearing: 0, padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 1200, essential: true })
    dayRef.current = 0
    setStoryHeatTime(map, 0) // before 1962 → nothing shown
    setStoryHeatVisible(map, true)
    setSVVisible(true)
    clearCrosses()
    applyLandmarks(null)
  }

  function applyStep(i: number) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const ev = FACTS_EVENTS[i]
    if (!ev) return
    const pad = framePadding()
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : ev.camera.pitch ?? 0
    if (ev.bbox) {
      map.fitBounds(
        [
          [ev.bbox[0], ev.bbox[1]],
          [ev.bbox[2], ev.bbox[3]],
        ],
        { padding: pad, maxZoom: 11, pitch, bearing: 0, duration: 1500, essential: true },
      )
    } else {
      map.flyTo({
        center: ev.camera.center,
        zoom: ev.camera.zoom,
        pitch,
        bearing: ev.camera.bearing ?? 0,
        padding: pad,
        duration: 1500,
        essential: true,
      })
    }
    // Pilot nodes show crosses instead of a (near-invisible) heatmap.
    const isPilot = !!ev.crosses
    const day = dateToDay(ev.date)
    dayRef.current = day
    setStoryHeatTime(map, day)
    setStoryHeatVisible(map, !isPilot)
    if (isPilot) showCrosses(ev.crosses)
    else clearCrosses()
    applyLandmarks(ev)
    setSVVisible(false)
  }

  // Create the map once; it's a passive stage driven by scroll.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    resolveMapStyle().then((style) => {
      if (cancelled || !containerRef.current) return
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: HOOK.camera.center,
        zoom: HOOK.camera.zoom,
        minZoom: mapConfig.view.minZoom,
        maxZoom: mapConfig.view.maxZoom,
        maxBounds: mapConfig.view.maxBounds,
        maxPitch: mapConfig.view.maxPitch,
        interactive: false,
        attributionControl: { compact: true },
      })
      mapRef.current = map

      const asset = (f: string) => fetch(`${import.meta.env.BASE_URL}${f}`).then((r) => r.json())
      Promise.all([
        loadSpray(),
        asset('data/military-region-dividers.geojson'),
        asset('data/military-region-labels.geojson'),
        asset('data/landmarks.geojson'),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray, mrGeo, mrLabelsGeo, landmarksGeo]) => {
        if (!mapRef.current) return
        dataRef.current = spray
        landmarksRef.current = landmarksGeo as FeatureCollection
        const mc = monthlyCumulative(spray)
        setMonthlyCum(mc.months)
        setYearStart(mc.yearStart)
        applyMapTheme(map)

        // Curated labels: hide the noisy tiers (wards/hamlets, POIs, road names,
        // uncategorised) and, so provinces anchor the reader at the zoomed-out
        // overview, let the province labels appear from a low zoom. Casing and
        // " Ward" suffixes are normalised so every place reads the same
        // (see docs/map-labels.md for the full tier spec).
        normalizePlaceLabels(map)
        for (const g of readLabelGroups(map)) {
          if (!g.visible) setGroupVisible(map, g.layerIds, false)
          if (g.key === 'state') {
            for (const id of g.layerIds) {
              try {
                map.setLayerZoomRange(id, 4, 22)
              } catch {
                /* layer may not accept a zoom-range override */
              }
            }
          }
        }


        // 3D view: real terrain relief (hidden until the 3D toggle). The DEM is
        // free AWS Terrarium tiles; a hillshade shades the slopes. Added first so
        // it sits beneath the spray heatmap.
        if (mapConfig.terrain && !map.getSource(DEM_SOURCE)) {
          map.addSource(DEM_SOURCE, {
            type: 'raster-dem',
            tiles: [mapConfig.terrain.demUrl],
            tileSize: 256,
            encoding: mapConfig.terrain.encoding,
            maxzoom: 15,
          })
          addHillshade(map, DEM_SOURCE)
        }

        // One combined, brand-orange heatmap (all agents merged) — no muddy
        // per-agent overlap.
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        addStoryHeat(map, SPRAY_SOURCE, spray.dayMax)

        // The four Corps Tactical Zones / Military Regions — only the three
        // INTERNAL dividers are drawn (bold orange dashed, kept under the spray
        // heat); the outer edges trace the national border / coast and would
        // clash with the basemap's own lines. Uppercase orange tags per region.
        map.addSource(MR_SOURCE, { type: 'geojson', data: mrGeo })
        map.addLayer(
          {
            id: 'mr-borders',
            type: 'line',
            source: MR_SOURCE,
            layout: { 'line-join': 'round' },
            paint: { 'line-color': '#e8443a', 'line-width': 2.2, 'line-opacity': 0.9, 'line-dasharray': [2.4, 1.8] },
          },
          STORY_HEAT_LAYER,
        )
        // Military-region tags — overview only (off once you zoom into a node).
        map.addSource(MRLABEL_SOURCE, { type: 'geojson', data: mrLabelsGeo })
        map.addLayer({
          id: 'mr-label',
          type: 'symbol',
          source: MRLABEL_SOURCE,
          maxzoom: 8.5,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Switzer Medium'],
            'text-size': 12.5,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.1,
          },
          paint: { 'text-color': '#cf3720', 'text-halo-color': 'rgba(250,249,244,0.95)', 'text-halo-width': 2 },
        })

        // Per-node landmark boundary: the active node's representative area
        // (Cà Mau, A Lưới) outlined in pulsing orange. Labels are HTML chips
        // (markers) — the self-hosted glyphs miss Vietnamese diacritics, so a
        // symbol layer would render "A LƯỚI" as "A LI".
        map.addSource(LANDMARK_SOURCE, { type: 'geojson', data: EMPTY_FC })
        map.addLayer({
          id: 'landmark-outline',
          type: 'line',
          source: LANDMARK_SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#e8443a', 'line-width': 3, 'line-opacity': 0.95 },
        })

        // Disputed-island labels (the basemap already draws the grey borders).
        map.addSource(ISLAND_SOURCE, { type: 'geojson', data: ISLANDS_FC })
        map.addLayer({
          id: 'island-dot',
          type: 'circle',
          source: ISLAND_SOURCE,
          paint: {
            'circle-radius': 4,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#8a8d85',
            'circle-stroke-width': 1.2,
          },
        })
        map.addLayer({
          id: 'island-label',
          type: 'symbol',
          source: ISLAND_SOURCE,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Switzer Medium'],
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
            'text-max-width': 9,
          },
          paint: { 'text-color': '#8a8d85', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
        })

        readyRef.current = true
        setMapReady(true)
        setHookState()
      })
    })

    return () => {
      cancelled = true
      stopPulse()
      clearCrosses()
      clearLandmarkPoints()
      mapRef.current?.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scrollama: each step drives the map.
  useEffect(() => {
    const scroller = scrollama()
    scroller
      .setup({ step: '.story-step', offset: 0.6 })
      .onStepEnter(({ index }: { index: number }) => {
        setStarted(true)
        setActive(index)
        applyStep(index)
      })
      .onStepExit(({ index, direction }: { index: number; direction: string }) => {
        if (index === 0 && direction === 'up') {
          setStarted(false)
          setHookState()
        }
      })
    const onResize = () => scroller.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      scroller.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3D view tilts the camera and turns on real terrain relief; the flat heatmap
  // drapes over it (no columns).
  function toggle3D() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    is3DRef.current = next
    map.easeTo({ pitch: next ? mapConfig.view.pitch3d : 0, duration: 800 })
    if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
      try {
        map.setTerrain(next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null)
        setHillshade(map, next)
      } catch {
        /* terrain is optional */
      }
    }
    // The flat outline would float over the tilted relief, so hide it in 3D.
    applyLandmarks(next ? null : started ? FACTS_EVENTS[active] : null)
  }

  return (
    <div className="story" ref={storyRef}>
      <TopBar>
        {started && (
          <button className="site-nav-link site-nav-btn" onClick={toggle3D}>
            {is3D ? 'Flat' : '3D'}
          </button>
        )}
      </TopBar>

      <div className="story-graphic">
        <div ref={containerRef} className="story-map" />
      </div>

      <MapKey map={mapRef.current} ready={mapReady} started={started} />

      <TimelineRuler
        monthlyCum={monthlyCum}
        yearStart={yearStart}
        nodeFracs={nodeFracs}
        fmt={fmtGallons}
        storyRef={storyRef}
        started={started}
      />

      <div className="story-scroll">
        <section className="story-hook">
          <div className="story-hook-blur" aria-hidden="true">
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
          <div className="story-hook-wash" aria-hidden="true" />
          <RainCanvas />
          <div className="story-hook-inner">
            <p className="story-hook-eyebrow">{HOOK.eyebrow}</p>
            <h1 className="story-hook-title">{HOOK.title}</h1>
            <p className="story-hook-dek">{HOOK.dek}</p>
            <p className="story-hook-cue">{HOOK.cue}</p>
          </div>
        </section>

        {FACTS_EVENTS.map((ev, i) => {
          const src = ev.quote ? SOURCES[ev.quote.sourceId] : undefined
          return (
            <section className="story-step" key={ev.id} data-index={i}>
              <article className={`story-card${i === active ? ' is-active' : ''}`}>
                <p className="story-eyebrow">{ev.period}</p>
                <h2 className="story-name">{ev.name}</h2>
                <p className="story-dek">{ev.dek}</p>
                <p className="story-body">{ev.body}</p>
                {ev.stat && (
                  <p className="story-stat">
                    <strong>{ev.stat.value}</strong> {ev.stat.label}
                  </p>
                )}
                {ev.quote && (
                  <blockquote className="story-quote">
                    <p>“{ev.quote.text}”</p>
                    <cite>
                      — {ev.quote.speaker}
                      {src && (
                        <>
                          {', '}
                          <a href={src.url} target="_blank" rel="noreferrer">
                            {src.publisher}
                          </a>
                        </>
                      )}
                    </cite>
                  </blockquote>
                )}
              </article>
            </section>
          )
        })}
      </div>
    </div>
  )
}
