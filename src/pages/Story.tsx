import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Point, Polygon } from 'geojson'
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
  addSprayBars,
  setBarsVisible,
  STORY_HEAT_LAYER,
} from '../components/mapTheme'
import { FACTS_EVENTS } from '../content/facts/events'
import { HOOK } from '../content/facts/hook'
import { SOURCES } from '../content/sources'
import { TopBar } from '../App'
import RainCanvas from '../components/RainCanvas'
import TimelineRuler from '../components/TimelineRuler'
import { readLabelGroups, setGroupVisible } from '../components/labelLayers'
import './Story.css'

const SPRAY_SOURCE = 'spray'
const ISLAND_SOURCE = 'islands'
const PROV_SOURCE = 'provinces'
const MR_SOURCE = 'military-regions'
const MRLABEL_SOURCE = 'military-region-labels'
const BARS_SOURCE = 'spray-bars-src'
// 3D column grid resolution — finer cells read as slender columns.
const CELL_DEG = 0.03

// Bin spray points into CELL_DEG cells, summing cumulative gallons up to `day`.
// Each cell becomes a slightly-inset square (a column footprint).
function sprayGrid(spray: SprayDataset, day: number): FeatureCollection<Polygon, { gallons: number }> {
  const cells = new Map<string, number>()
  for (const f of spray.features.features) {
    if (f.properties.day > day || f.properties.gallons <= 0) continue
    const [lon, lat] = f.geometry.coordinates
    const cx = Math.floor(lon / CELL_DEG)
    const cy = Math.floor(lat / CELL_DEG)
    const k = `${cx}|${cy}`
    cells.set(k, (cells.get(k) || 0) + f.properties.gallons)
  }
  const pad = CELL_DEG * 0.12
  const features = [...cells].map(([k, gallons]) => {
    const [cx, cy] = k.split('|').map(Number)
    const x0 = cx * CELL_DEG + pad
    const y0 = cy * CELL_DEG + pad
    const x1 = (cx + 1) * CELL_DEG - pad
    const y1 = (cy + 1) * CELL_DEG - pad
    return {
      type: 'Feature' as const,
      properties: { gallons },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
      },
    }
  })
  return { type: 'FeatureCollection', features }
}

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

  // Rebuild the 3D column grid for the cumulative window up to `day`.
  function updateBars(day: number) {
    const map = mapRef.current
    const spray = dataRef.current
    if (!map || !spray) return
    const src = map.getSource(BARS_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(sprayGrid(spray, day))
  }
  const [active, setActive] = useState(0)
  const [started, setStarted] = useState(false)
  const [is3D, setIs3D] = useState(false)
  const [monthlyCum, setMonthlyCum] = useState<number[]>([])
  const [yearStart, setYearStart] = useState(1961)

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
  function showCrosses(crosses: { lng: number; lat: number; label: string }[] | undefined) {
    const map = mapRef.current
    if (!map) return
    clearCrosses()
    if (!crosses) return
    for (const c of crosses) {
      const el = document.createElement('div')
      el.className = 'pilot-dot'
      el.innerHTML =
        '<span class="pilot-dot-ring"></span><span class="pilot-dot-core"></span>' +
        `<span class="pilot-dot-label">${c.label}</span>`
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
    setStoryHeatVisible(map, !is3DRef.current)
    if (is3DRef.current) updateBars(0)
    setBarsVisible(map, is3DRef.current)
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
    const day = dateToDay(ev.date)
    dayRef.current = day
    setStoryHeatTime(map, day)
    if (is3DRef.current) {
      updateBars(day)
      setBarsVisible(map, true)
      setStoryHeatVisible(map, false)
    } else {
      setBarsVisible(map, false)
      setStoryHeatVisible(map, !isPilot)
    }
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

      const asset = (f: string) => fetch(`${import.meta.env.BASE_URL}${f}`).then((r) => r.json())
      Promise.all([
        loadSpray(),
        asset('data/provinces.geojson'),
        asset('data/military-regions.geojson'),
        asset('data/military-region-labels.geojson'),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray, provincesGeo, mrGeo, mrLabelsGeo]) => {
        if (!mapRef.current) return
        dataRef.current = spray
        const mc = monthlyCumulative(spray)
        setMonthlyCum(mc.months)
        setYearStart(mc.yearStart)
        applyMapTheme(map)

        // Curated labels: hide the noisy tiers (wards/hamlets, POIs, road names,
        // uncategorised) and, so provinces anchor the reader at the zoomed-out
        // overview, let the province labels appear from a low zoom.
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


        // One combined, brand-orange heatmap (all agents merged) — no muddy
        // per-agent overlap.
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        addStoryHeat(map, SPRAY_SOURCE, spray.dayMax)

        // 3D view: extruded columns, binned. Heights scale to the global max cell
        // so the columns grow through the decade. Hidden until the 3D toggle.
        map.addSource(BARS_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        let globalMax = 1
        for (const f of sprayGrid(spray, spray.dayMax).features) globalMax = Math.max(globalMax, f.properties.gallons)
        addSprayBars(map, BARS_SOURCE, globalMax)

        // Province outlines (thin) + the four Corps Tactical Zones / Military
        // Regions (bolder dashed) for orientation — kept under the spray heat.
        map.addSource(PROV_SOURCE, { type: 'geojson', data: provincesGeo })
        map.addLayer(
          {
            id: 'province-borders',
            type: 'line',
            source: PROV_SOURCE,
            paint: { 'line-color': 'rgba(33,53,40,0.26)', 'line-width': 0.6 },
          },
          STORY_HEAT_LAYER,
        )
        map.addSource(MR_SOURCE, { type: 'geojson', data: mrGeo })
        map.addLayer(
          {
            id: 'mr-borders',
            type: 'line',
            source: MR_SOURCE,
            layout: { 'line-join': 'round' },
            paint: { 'line-color': 'rgba(33,53,40,0.62)', 'line-width': 1.5, 'line-dasharray': [3, 2] },
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
            'text-size': 12,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.08,
          },
          paint: { 'text-color': '#2c3730', 'text-halo-color': 'rgba(250,249,244,0.92)', 'text-halo-width': 1.8 },
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

  // 3D view swaps the flat heatmap for extruded spray columns (no terrain).
  function toggle3D() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    is3DRef.current = next
    map.easeTo({ pitch: next ? mapConfig.view.pitch3d : 0, duration: 800 })
    if (next) {
      updateBars(dayRef.current)
      setBarsVisible(map, true)
      setStoryHeatVisible(map, false)
    } else {
      setBarsVisible(map, false)
      // Restore the flat heatmap unless we're on a pilot node (crosses only).
      const isPilot = !!FACTS_EVENTS[active]?.crosses
      setStoryHeatVisible(map, started ? !isPilot : true)
    }
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
