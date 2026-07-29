import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadSpray, dayToDate, dateToDay, type SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'
import Timeline, { buildVolume, type VolumeChart } from './Timeline'
import { buildAgentChoices, type AgentChoice } from './agentChoices'
import {
  resolveMapStyle,
  applyMapTheme,
  addHillshade,
  setHillshade,
  addMilitaryRegions,
  addIslandMarks,
  HILLSHADE_LAYER,
} from './mapTheme'
import {
  addVolumeLayers,
  updateVolume,
  agentIndexColors,
  stampEventColors,
  quietBasemap,
} from './volumeGrid'
import { applyLabelCuration } from './labelLayers'

const SPRAY_SOURCE = 'spray'
const DEM_SOURCE = 'terrain-dem'

// Target wall-clock duration for a full 1961→1971 play-through.
const PLAY_DURATION_MS = 28_000

// The heatmap filter is re-applied at most once per this many simulated days,
// instead of every animation frame — re-tessellating 24k points at 60fps is
// what made playback drop the heatmap and lag on agent switches.
const FILTER_STEP_DAYS = 12

const monthLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

// ── F1 · URL as state ─────────────────────────────────────────────────────
// /archive?t=1968-06-15&agent=O&cam=106.5,16.2,5.8&view=3d — every control's
// position mirrors into the query string (debounced replaceState), so any view
// can be bookmarked, shared, or deep-linked from the story.
interface UrlState {
  day?: number
  agent?: string
  cam?: { center: [number, number]; zoom: number }
  is3D?: boolean
}

function readUrlState(): UrlState {
  const q = new URLSearchParams(window.location.search)
  const out: UrlState = {}
  const t = q.get('t')
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) out.day = dateToDay(t)
  const agent = q.get('agent')
  if (agent) out.agent = agent
  const cam = (q.get('cam') ?? '').split(',').map(Number)
  if (cam.length === 3 && cam.every(Number.isFinite))
    out.cam = { center: [cam[0], cam[1]], zoom: cam[2] }
  if (q.get('view') === '3d') out.is3D = true
  return out
}

/** Serialise the current view; defaults (full record, all agents, home camera,
 *  flat) are omitted so the canonical URL stays clean. */
function buildSearch(
  map: maplibregl.Map | null,
  day: number,
  dayMax: number,
  agentKey: string,
  is3D: boolean,
): string {
  const q = new URLSearchParams()
  if (Math.round(day) < dayMax) q.set('t', dayToDate(day).toISOString().slice(0, 10))
  if (agentKey !== 'all') q.set('agent', agentKey)
  if (map) {
    const c = map.getCenter()
    const v = mapConfig.view
    const moved =
      Math.abs(c.lng - v.center[0]) > 0.02 ||
      Math.abs(c.lat - v.center[1]) > 0.02 ||
      Math.abs(map.getZoom() - v.zoom) > 0.05
    if (moved) q.set('cam', `${c.lng.toFixed(3)},${c.lat.toFixed(3)},${map.getZoom().toFixed(2)}`)
  }
  if (is3D) q.set('view', '3d')
  return q.toString()
}

/** Enter/leave the tilted 3D terrain view (shared by the toggle button and the
 *  URL restore, which applies it without the fly-in). */
function applyView(map: maplibregl.Map, next: boolean, animate = true) {
  if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
    map.setTerrain(
      next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null,
    )
    setHillshade(map, next) // shaded relief makes the elevation visible
  }
  // Tilt; when entering 3D also zoom in a touch — terrain reads as 3D far
  // better up close than at the full-country overview.
  map.easeTo({
    pitch: next ? mapConfig.view.pitch3d : 0,
    ...(next && map.getZoom() < 6.6 ? { zoom: 6.6 } : {}),
    duration: animate ? 1000 : 0,
  })
}

/** Cumulative run count + gallons up to `day`, restricted to `indices`. */
function cumulative(data: SprayDataset, day: number, indices: number[] | null) {
  let runs = 0
  let gallons = 0
  const set = indices ? new Set(indices) : null
  for (const f of data.features.features) {
    const p = f.properties
    if (p.day > day) continue // features are day-sorted, but cheap enough to scan
    if (set && !set.has(p.agent)) continue
    runs++
    gallons += p.gallons
  }
  return { runs, gallons }
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dataRef = useRef<SprayDataset | null>(null)

  const [ready, setReady] = useState(false)
  const [bounds, setBounds] = useState({ min: 0, max: 0 })
  const [choices, setChoices] = useState<AgentChoice[]>([])
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [agentKey, setAgentKey] = useState('all')
  const [is3D, setIs3D] = useState(false)
  const [stats, setStats] = useState({ runs: 0, gallons: 0 })
  const [volume, setVolume] = useState<VolumeChart | null>(null)
  // Bumped on moveend so the URL mirror below sees camera changes.
  const [camTick, setCamTick] = useState(0)
  const [shared, setShared] = useState(false)
  const shareTimerRef = useRef(0)

  // Throttle key for the map filter: only re-apply when the day-bucket or the
  // agent selection actually changes.
  const appliedKeyRef = useRef('')

  // Refs mirror state for the animation loop to avoid stale closures.
  const dayRef = useRef(0)
  const colorsRef = useRef<string[] | null>(null)
  const playingRef = useRef(false)
  dayRef.current = day
  playingRef.current = playing

  // One-time map + data setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    resolveMapStyle().then((style) => {
      if (cancelled || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: mapConfig.view.center,
        zoom: mapConfig.view.zoom,
        minZoom: mapConfig.view.minZoom,
        maxZoom: mapConfig.view.maxZoom,
        maxBounds: mapConfig.view.maxBounds,
        maxPitch: mapConfig.view.maxPitch,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      // bottom-right keeps the top-right clear for the site nav.
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
      map.on('moveend', () => setCamTick((t) => t + 1))

      const asset = (f: string) => fetch(`${import.meta.env.BASE_URL}${f}`).then((r) => r.json())
      Promise.all([
        loadSpray(),
        asset('data/military-region-dividers.geojson'),
        asset('data/military-region-labels.geojson'),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray, mrGeo, mrLabelsGeo]) => {
        if (!mapRef.current) return
        dataRef.current = spray

        // Same cartography as the story: theme recolour + curated labels.
        applyMapTheme(map)
        applyLabelCuration(map)
        quietBasemap(map)

        // DEM source + hillshade for the 3D terrain (enabled on toggle).
        if (mapConfig.terrain && !map.getSource(DEM_SOURCE)) {
          map.addSource(DEM_SOURCE, {
            type: 'raster-dem',
            tiles: [mapConfig.terrain.demUrl],
            tileSize: 256,
            encoding: mapConfig.terrain.encoding,
            maxzoom: 15,
          })
          addHillshade(map, DEM_SOURCE)
          // CF-style ground: soft relief always on, not just in the 3D view.
          map.setLayoutProperty(HILLSHADE_LAYER, 'visibility', 'visible')
          map.setPaintProperty(HILLSHADE_LAYER, 'hillshade-exaggeration', 0.28)
        }

        const agentChoices = buildAgentChoices(spray.agents)
        // M2: gridded proportional symbols replace the heatmap — one
        // representational language (the dot) at every zoom, only the
        // aggregation cell size changes (docs/explorer-m2-plan.md).
        const colors = agentIndexColors(spray)
        colorsRef.current = colors
        stampEventColors(spray, colors)
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        const bottomLayer = addVolumeLayers(map, SPRAY_SOURCE)

        // Same reference overlays as the story: military-region dividers +
        // tags (under the spray symbols) and the disputed-island marks.
        addMilitaryRegions(map, mrGeo, mrLabelsGeo, bottomLayer)
        addIslandMarks(map)

        setChoices(agentChoices)
        setBounds({ min: spray.dayMin, max: spray.dayMax })
        setVolume(buildVolume(spray, agentChoices))

        // Restore a deep-linked view, else start showing the full record.
        const urlState = readUrlState()
        if (urlState.cam) map.jumpTo({ center: urlState.cam.center, zoom: urlState.cam.zoom })
        if (urlState.agent && agentChoices.some((c) => c.key === urlState.agent))
          setAgentKey(urlState.agent)
        setDay(
          urlState.day != null
            ? Math.min(Math.max(urlState.day, spray.dayMin), spray.dayMax)
            : spray.dayMax,
        )
        if (urlState.is3D) {
          setIs3D(true)
          applyView(map, true, false)
        }
        setReady(true)
      })

      // Hotspot ring markers retired — the volume symbols carry the story.
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  const activeIndices = choices.find((c) => c.key === agentKey)?.indices ?? null

  // Advance the cumulative time window + stats, throttled to day-buckets so a
  // 60fps playhead doesn't re-tessellate the heatmap every frame.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const atEnd = day >= bounds.max
    const key = `${Math.floor(day / FILTER_STEP_DAYS)}|${agentKey}|${atEnd}`
    if (key === appliedKeyRef.current) return
    appliedKeyRef.current = key
    if (dataRef.current && colorsRef.current)
      updateVolume(map, dataRef.current, colorsRef.current, day, activeIndices)
    if (dataRef.current) setStats(cumulative(dataRef.current, day, activeIndices))
  }, [ready, day, agentKey, activeIndices, choices, bounds.max])

  // Agent selection re-bins the grids and re-filters the raw tier (the
  // throttle key includes agentKey, so the day effect above handles it).

  // Animation loop: advance the playhead in real time while playing. The loop
  // tracks the playhead in a local — the first frame can fire before React
  // re-renders, so an end-of-record restart read via dayRef would still see
  // the old end value and stop the playback dead on its first tick.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let prev = performance.now()
    const span = bounds.max - bounds.min
    // If we're at (or past) the end, restart from the beginning.
    let cur = dayRef.current >= bounds.max ? bounds.min : dayRef.current
    if (cur !== dayRef.current) setDay(cur)

    const tick = (now: number) => {
      const dt = now - prev
      prev = now
      const next = cur + (span * dt) / PLAY_DURATION_MS
      if (next >= bounds.max) {
        setDay(bounds.max)
        setPlaying(false)
        return
      }
      cur = next
      setDay(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, bounds.min, bounds.max])

  // Switch between flat (top-down) and tilted 3D terrain.
  function toggleView() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    applyView(map, next)
  }

  // Mirror the current view into the query string, debounced. During playback
  // the timer keeps postponing, so the URL settles when the playhead does.
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => {
      const search = buildSearch(mapRef.current, day, bounds.max, agentKey, is3D)
      window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
    }, 300)
    return () => window.clearTimeout(id)
  }, [ready, day, agentKey, is3D, camTick, bounds.max])

  // Copy the canonical URL for the current view.
  function shareView() {
    const search = buildSearch(mapRef.current, dayRef.current, bounds.max, agentKey, is3D)
    const url = `${window.location.origin}${window.location.pathname}${search ? `?${search}` : ''}`
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setShared(true)
        window.clearTimeout(shareTimerRef.current)
        shareTimerRef.current = window.setTimeout(() => setShared(false), 1800)
      })
      .catch(() => window.prompt('Copy this link:', url))
  }

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-root" />
      {ready && (
        <div className="map-actions">
          <button className="view-toggle" onClick={toggleView} aria-pressed={is3D}>
            {is3D ? '▦ Flat view' : '⛰ 3D view'}
          </button>
          <button className="view-toggle" onClick={shareView} aria-live="polite">
            {shared ? '✓ Link copied' : '⧉ Share view'}
          </button>
        </div>
      )}
      {ready && (
        <Timeline
          day={day}
          dayMin={bounds.min}
          dayMax={bounds.max}
          playing={playing}
          dateLabel={monthLabel(day)}
          runCount={stats.runs}
          gallons={stats.gallons}
          agentChoices={choices}
          activeAgentKey={agentKey}
          volume={volume}
          onScrub={(d) => {
            setPlaying(false)
            setDay(d)
          }}
          onTogglePlay={() => setPlaying((p) => !p)}
          onSelectAgent={setAgentKey}
        />
      )}
    </div>
  )
}
