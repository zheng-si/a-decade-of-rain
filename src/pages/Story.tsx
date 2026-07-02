import { useEffect, useRef, useState } from 'react'
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
} from '../components/mapTheme'
import { FACTS_EVENTS } from '../content/facts/events'
import { HOOK } from '../content/facts/hook'
import { SOURCES } from '../content/sources'
import { TopBar } from '../App'
import LabelPanel from '../components/LabelPanel'
import RainCanvas from '../components/RainCanvas'
import TimelineRuler from '../components/TimelineRuler'
import { readLabelGroups, setGroupVisible, type LabelGroup } from '../components/labelLayers'
import './Story.css'

const SPRAY_SOURCE = 'spray'
const VN_SOURCE = 'vietnam'
const ISLAND_SOURCE = 'islands'
const DEM_SOURCE = 'terrain-dem'

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
  return { months, yearStart }
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
  const [active, setActive] = useState(0)
  const [started, setStarted] = useState(false)
  const [is3D, setIs3D] = useState(false)
  const [labelGroups, setLabelGroups] = useState<LabelGroup[]>([])
  const [monthlyCum, setMonthlyCum] = useState<number[]>([])
  const [yearStart, setYearStart] = useState(1961)

  function toggleLabelGroup(key: string) {
    const map = mapRef.current
    if (!map) return
    setLabelGroups((prev) =>
      prev.map((g) => {
        if (g.key !== key) return g
        const visible = !g.visible
        setGroupVisible(map, g.layerIds, visible)
        return { ...g, visible }
      }),
    )
  }

  function clearCrosses() {
    crossMarkersRef.current.forEach((m) => m.remove())
    crossMarkersRef.current = []
  }

  // Orange crosses mark pilot / test-spray sites where the volume is too small
  // to register as a heatmap. The pulse animates a CHILD element — MapLibre owns
  // the marker root's transform for positioning, so animating it would fling the
  // marker to the corner.
  function showCrosses(crosses: [number, number][] | undefined) {
    const map = mapRef.current
    if (!map) return
    clearCrosses()
    if (!crosses) return
    for (const [lng, lat] of crosses) {
      const el = document.createElement('div')
      el.className = 'pilot-cross'
      el.innerHTML = '<span class="pilot-cross-mark"></span>'
      crossMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map))
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

  // Keep framed content clear of the card (left on desktop, bottom on mobile).
  function framePadding(): maplibregl.PaddingOptions {
    return window.innerWidth > 640
      ? { left: 700, top: 70, right: 70, bottom: 70 }
      : { left: 24, right: 24, top: 48, bottom: 340 }
  }

  // Opening state: NO spray drawn yet (so nothing vanishes on the first scroll);
  // spray then builds from 1962.
  function setHookState() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : 0
    map.flyTo({ ...HOOK.camera, pitch, bearing: 0, padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 1200, essential: true })
    setStoryHeatVisible(map, true)
    setStoryHeatTime(map, 0) // before 1962 → nothing shown
    setSVVisible(true)
    clearCrosses()
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
    setStoryHeatTime(map, dateToDay(ev.date))
    setStoryHeatVisible(map, !isPilot)
    if (isPilot) showCrosses(ev.crosses)
    else clearCrosses()
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

      Promise.all([
        loadSpray(),
        fetch(`${import.meta.env.BASE_URL}data/vietnam.geojson`).then((r) => r.json()),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray, vnGeo]) => {
        if (!mapRef.current) return
        dataRef.current = spray
        const mc = monthlyCumulative(spray)
        setMonthlyCum(mc.months)
        setYearStart(mc.yearStart)
        applyMapTheme(map)

        // Enumerate label tiers; hide the granular ones (wards/hamlets/POI).
        const groups = readLabelGroups(map)
        groups.forEach((g) => {
          if (!g.visible) setGroupVisible(map, g.layerIds, false)
        })
        setLabelGroups(groups)

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

        // Vietnam national border (brand orange) + disputed-island labels.
        map.addSource(VN_SOURCE, { type: 'geojson', data: vnGeo })
        map.addLayer({
          id: 'vietnam-outline',
          type: 'line',
          source: VN_SOURCE,
          layout: { 'line-join': 'round' },
          paint: { 'line-color': '#ff5449', 'line-width': 1, 'line-opacity': 0.9 },
        })
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
        setHookState()
      })
    })

    return () => {
      cancelled = true
      clearCrosses()
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

  function toggle3D() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    is3DRef.current = next
    map.easeTo({ pitch: next ? mapConfig.view.pitch3d : 0, duration: 800 }) // always tilt
    if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
      try {
        map.setTerrain(next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null)
        setHillshade(map, next)
      } catch {
        /* terrain is optional */
      }
    }
  }

  return (
    <div className="story" ref={storyRef}>
      <TopBar>
        {started && (
          <>
            <button className="site-nav-link site-nav-btn" onClick={toggle3D}>
              {is3D ? 'Flat' : '3D'}
            </button>
            <LabelPanel groups={labelGroups} onToggle={toggleLabelGroup} />
          </>
        )}
      </TopBar>

      <div className="story-graphic">
        <div ref={containerRef} className="story-map" />
      </div>

      <TimelineRuler
        monthlyCum={monthlyCum}
        yearStart={yearStart}
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
