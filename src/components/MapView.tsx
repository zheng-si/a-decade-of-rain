import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadSpray, dayToDate, dateToDay, type SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'
import Timeline, { buildVolume, type VolumeChart } from './Timeline'
import ArchiveKey from './ArchiveKey'
import { buildAgentChoices, type AgentChoice } from './agentChoices'
import {
  resolveMapStyle,
  applyMapTheme,
  addHillshade,
  setHillshade,
  addMilitaryRegions,
  addIslandMarks,
} from './mapTheme'
import {
  addVolumeLayers,
  updateVolume,
  agentIndexColors,
  stampEventColors,
  quietBasemap,
  addVietnamLabel,
  cellDegAt,
  VOL_COARSE_LAYER,
  VOL_FINE_LAYER,
  VOL_RAW_LAYER,
} from './volumeGrid'
import ArchiveInspect, {
  fmtGallons,
  type Inspect,
  type CellInspect,
} from './ArchiveInspect'
import { applyLabelCuration } from './labelLayers'
// TEMPORARY — basemap colour tuner. See the header of MapTuner.tsx.
import MapTuner from './MapTuner'
// SPIKE — Archive UI v2 (Geist, no radii, no strokes, near-flat shadows).
// Scoped under .map-wrap; delete both imports and the two files to revert.
import '../fontsGeist.css'
import '../ArchiveSkinV2.css'

const SPRAY_SOURCE = 'spray'
const DEM_SOURCE = 'terrain-dem'
/** Relief strength: a whisper on the flat map, deeper once the map tilts. */
const RELIEF_FLAT = 0.28
const RELIEF_TILTED = 0.6

// Target wall-clock duration for a full 1961→1971 play-through.
const PLAY_DURATION_MS = 28_000

// The heatmap filter is re-applied at most once per this many simulated days,
// instead of every animation frame — re-tessellating 24k points at 60fps is
// what made playback drop the heatmap and lag on agent switches.
const FILTER_STEP_DAYS = 12

const monthLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

const dayLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

// Curated "Jump To" views — places the story dwells on, one ease away.
const PRESETS: { label: string; center: [number, number]; zoom: number }[] = [
  { label: 'A Sầu Valley', center: [107.3, 16.13], zoom: 10 },
  { label: 'Biên Hòa', center: [106.818, 10.972], zoom: 10.8 },
  { label: 'Đà Nẵng', center: [108.199, 16.044], zoom: 10.8 },
  { label: 'Phù Cát', center: [109.043, 13.952], zoom: 10.8 },
]

/** Full-record aggregates for one grid cell (ignores the playhead — the
 *  inspect card tells the place's whole story). */
function aggregateCell(
  data: SprayDataset,
  cx: number,
  cy: number,
  deg: number,
): CellInspect {
  const minX = cx - deg / 2
  const maxX = cx + deg / 2
  const minY = cy - deg / 2
  const maxY = cy + deg / 2
  let gallons = 0
  let runs = 0
  let missions = 0
  let firstDay = Infinity
  let lastDay = -Infinity
  const byGroup = [0, 0, 0, 0]
  const byYear = new Array(11).fill(0)
  for (const f of data.features.features) {
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates
    if (lng < minX || lng >= maxX || lat < minY || lat >= maxY) continue
    const p = f.properties as { day: number; gallons: number; gi?: number }
    runs++
    if (p.gallons > 0) {
      missions++
      gallons += p.gallons
      if (p.gi != null && p.gi >= 0) byGroup[p.gi] += p.gallons
      const y = dayToDate(p.day).getUTCFullYear() - 1961
      if (y >= 0 && y < 11) byYear[y] += p.gallons
    }
    if (p.day < firstDay) firstDay = p.day
    if (p.day > lastDay) lastDay = p.day
  }
  return {
    kind: 'cell',
    center: [cx, cy],
    cellKm: Math.round(deg * 111),
    gallons,
    runs,
    missions,
    firstDay,
    lastDay,
    byGroup,
    byYear,
  }
}

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
  home: Home | null,
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
    // The home camera is viewport-derived, so "unmoved" has to be measured
    // against the camera we actually applied — not against the fallback.
    const h = home ?? { center: mapConfig.view.center, zoom: mapConfig.view.zoom }
    const moved =
      Math.abs(c.lng - h.center[0]) > 0.02 ||
      Math.abs(c.lat - h.center[1]) > 0.02 ||
      Math.abs(map.getZoom() - h.zoom) > 0.05
    if (moved) q.set('cam', `${c.lng.toFixed(3)},${c.lat.toFixed(3)},${map.getZoom().toFixed(2)}`)
  }
  if (is3D) q.set('view', '3d')
  return q.toString()
}

interface Home {
  center: [number, number]
  zoom: number
}

/**
 * The camera that frames the record in THIS viewport.
 *
 * A fixed center/zoom cannot do this: the record's box is 6.0° wide by 9.4°
 * tall, so a phone needs to pull out to ~z5.3 while a desktop can push in to
 * ~z6.2 and still hold all of it. Deriving the camera also gives us an honest
 * zoom floor — "as far out as the record needs" rather than a number someone
 * once typed.
 */
function homeCamera(map: maplibregl.Map): Home {
  const { recordBounds, center, zoom } = mapConfig.view
  try {
    const cam = map.cameraForBounds(recordBounds, { padding: fitPaddingFor(map) })
    if (cam?.center && cam.zoom != null) {
      const c = maplibregl.LngLat.convert(cam.center)
      return { center: [c.lng, c.lat], zoom: cam.zoom }
    }
  } catch {
    /* transform not ready — fall through to the declared fallback */
  }
  return { center, zoom }
}

/**
 * Fit padding that accounts for the panel sitting on top of the map.
 *
 * `cameraForBounds` centres on the whole canvas, but the explorer panel covers
 * the left ~450px of it — so a record centred on the canvas ends up tucked
 * under the panel with empty sea to its right. Reserving the panel's width on
 * the left centres the record in the part of the map the reader can actually
 * see. Skipped once the panel takes more than half the width (narrow screens),
 * where there is no clear area left to centre anything in.
 */
function fitPaddingFor(map: maplibregl.Map): maplibregl.PaddingOptions {
  const pad = mapConfig.view.fitPadding
  const box = { top: pad, bottom: pad, left: pad, right: pad }
  const panel = document.querySelector('.explorer-panel')
  if (!panel) return box
  const w = panel.getBoundingClientRect().width
  const canvas = map.getContainer().clientWidth
  if (!w || !canvas || w > canvas * 0.5) return box
  // 24px is the panel's own left offset; the rest is its width.
  return { ...box, left: pad + w + 24 }
}

/** Is the camera still sitting where we put it? Used to decide whether a
 *  viewport change may re-frame: re-framing is a correction when the reader
 *  has not moved, and theft of their position when they have. */
function isAtHome(map: maplibregl.Map, home: Home): boolean {
  const c = map.getCenter()
  return (
    Math.abs(c.lng - home.center[0]) < 0.05 &&
    Math.abs(c.lat - home.center[1]) < 0.05 &&
    Math.abs(map.getZoom() - home.zoom) < 0.05
  )
}

/** Enter/leave the tilted 3D terrain view (shared by the toggle button and the
 *  URL restore, which applies it without the fly-in). */
function applyView(map: maplibregl.Map, next: boolean, animate = true) {
  if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
    map.setTerrain(
      next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null,
    )
    // The relief stays visible in BOTH views — it is the flat map's ground,
    // not a 3D-only decoration. Toggling it off on the way back to flat is
    // what made the shading disappear for good after one 3D round-trip.
    // Only its strength changes: soft on the flat map, deeper under tilt.
    setHillshade(map, true, next ? RELIEF_TILTED : RELIEF_FLAT)
  }
  // Tilt; when entering 3D also zoom in a touch — terrain reads as 3D far
  // better up close than at the full-country overview.
  map.easeTo({
    pitch: next ? mapConfig.view.pitch3d : 0,
    ...(next && map.getZoom() < 6.6 ? { zoom: 6.6 } : {}),
    duration: animate ? 1000 : 0,
  })
}

/** Cumulative missions, runs and gallons up to `day`, restricted to `indices`.
 *  HERBS records gallons at mission level (continuation legs read 0), so the
 *  gallons-bearing records double as the mission count. */
function cumulative(data: SprayDataset, day: number, indices: number[] | null) {
  let missions = 0
  let runs = 0
  let gallons = 0
  const set = indices ? new Set(indices) : null
  for (const f of data.features.features) {
    const p = f.properties
    if (p.day > day) continue // features are day-sorted, but cheap enough to scan
    if (set && !set.has(p.agent)) continue
    runs++
    if (p.gallons > 0) {
      missions++
      gallons += p.gallons
    }
  }
  return { missions, runs, gallons }
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
  const [stats, setStats] = useState({ missions: 0, runs: 0, gallons: 0 })
  const [volume, setVolume] = useState<VolumeChart | null>(null)
  const [inspect, setInspect] = useState<Inspect | null>(null)
  // Bumped on moveend so the URL mirror below sees camera changes.
  const [camTick, setCamTick] = useState(0)
  const [shared, setShared] = useState(false)
  const shareTimerRef = useRef(0)

  // Throttle key for the map filter: only re-apply when the day-bucket or the
  // agent selection actually changes.
  const appliedKeyRef = useRef('')

  // Refs mirror state for the animation loop to avoid stale closures.
  const homeRef = useRef<Home | null>(null)
  const refitRef = useRef<((animate: boolean) => void) | null>(null)

  // The first fit happens before the panel exists — Timeline renders it behind
  // the `ready` gate — so the reserved left margin has nothing to measure yet.
  // Re-fit once the chrome is up. A reader restored from a `cam` URL is not at
  // home, so applyHome leaves them alone.
  useEffect(() => {
    if (ready) refitRef.current?.(false)
  }, [ready])

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

      // Re-frame on the record now that the container has a real size, and set
      // the zoom floor from the same fit so "furthest out" means "the whole
      // record" instead of a hard-coded 5.6 that clipped the Mekong delta on
      // every laptop.
      const applyHome = (animate: boolean) => {
        const prev = homeRef.current
        const next = homeCamera(map)
        homeRef.current = next
        map.setMinZoom(next.zoom - mapConfig.view.minZoomMargin)
        // Only re-frame a reader who has not gone anywhere.
        if (prev && !isAtHome(map, prev)) return
        if (animate) map.easeTo({ ...next, duration: 300 })
        else map.jumpTo(next)
      }
      refitRef.current = applyHome
      applyHome(false)

      // A viewport change makes the old fit wrong, not stale — recompute it.
      let resizeTimer = 0
      map.on('resize', () => {
        window.clearTimeout(resizeTimer)
        resizeTimer = window.setTimeout(() => applyHome(true), 120)
      })
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
          setHillshade(map, true, RELIEF_FLAT)
        }

        const agentChoices = buildAgentChoices(spray.agents)
        // M2: gridded proportional symbols replace the heatmap — one
        // representational language (the dot) at every zoom, only the
        // aggregation cell size changes (docs/explorer-m2-plan.md).
        const colors = agentIndexColors(spray)
        colorsRef.current = colors
        const groups = agentChoices.filter((c) => c.indices && c.color)
        const groupOf: number[] = []
        groups.forEach((g, gi) => (g.indices as number[]).forEach((ai) => (groupOf[ai] = gi)))
        const groupLabels = groups.map((g) => g.label)
        stampEventColors(spray, colors, groupOf)
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        const bottomLayer = addVolumeLayers(map, SPRAY_SOURCE)
        // The one country label positron cannot place for itself (see
        // addVietnamLabel). Must follow the circles to draw above them, and
        // stays under the basemap's labels so it never costs a city its name.
        // Story does not carry this yet.
        addVietnamLabel(map)

        // ── M3 · hover + click ────────────────────────────────────────────
        // One tooltip follows the pointer over any symbol tier; clicking a
        // grid dot opens the cell's full-record inspect card, clicking a raw
        // event shows that single run. Empty clicks dismiss the card.
        const volLayers = [VOL_COARSE_LAYER, VOL_FINE_LAYER, VOL_RAW_LAYER]
        const hover = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'adr-popup adr-hover',
          offset: 12,
          maxWidth: '250px',
        })
        map.on('mousemove', (e) => {
          const feats = map.queryRenderedFeatures(e.point, { layers: volLayers })
          if (!feats.length) {
            hover.remove()
            map.getCanvas().style.cursor = ''
            return
          }
          map.getCanvas().style.cursor = 'pointer'
          const p = feats[0].properties as Record<string, number>
          let html: string
          if (p.gt != null) {
            html =
              `<strong><span class="n">${fmtGallons(p.gt)}</span> Gallons<span class="gap"></span><span class="n">${p.rt.toLocaleString()}</span> Runs</strong>` +
              `<span>Mostly ${groupLabels[p.dom] ?? '?'} · ${monthLabel(p.d0)} – ${monthLabel(p.d1)}</span>`
          } else {
            html =
              `<strong>${p.gallons > 0 ? `<span class="n">${fmtGallons(p.gallons)}</span> Gallons` : 'Continuation Leg'}</strong>` +
              `<span>${groupLabels[p.gi] ?? 'Unknown'} · ${dayLabel(p.day)}</span>`
          }
          hover.setLngLat(e.lngLat).setHTML(html).addTo(map)
        })
        map.on('click', (e) => {
          const feats = map.queryRenderedFeatures(e.point, { layers: volLayers })
          if (!feats.length) {
            setInspect(null)
            return
          }
          const f = feats[0]
          const p = f.properties as Record<string, number>
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
          if (p.gt != null) {
            const deg = cellDegAt(map.getZoom()) ?? 0.03
            if (dataRef.current) setInspect(aggregateCell(dataRef.current, coords[0], coords[1], deg))
          } else {
            setInspect({
              kind: 'run',
              coords,
              day: p.day,
              groupIndex: p.gi ?? -1,
              gallons: p.gallons,
            })
          }
        })

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
    if (dataRef.current)
      updateVolume(map, dataRef.current, day, activeIndices, choices.find((c) => c.key === agentKey)?.color ?? null)
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
      const search = buildSearch(mapRef.current, homeRef.current, day, bounds.max, agentKey, is3D)
      window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
    }, 300)
    return () => window.clearTimeout(id)
  }, [ready, day, agentKey, is3D, camTick, bounds.max])

  // Copy the canonical URL for the current view.
  function shareView() {
    const search = buildSearch(mapRef.current, homeRef.current, dayRef.current, bounds.max, agentKey, is3D)
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
        <ArchiveKey
          map={mapRef.current}
          ready={ready}
          is3D={is3D}
          onToggle3D={toggleView}
          onShare={shareView}
          shared={shared}
          tint={choices.find((c) => c.key === agentKey)?.color ?? '#ff5449'}
          filtered={agentKey !== 'all'}
        >
          {inspect && (
            <ArchiveInspect
              data={inspect}
              groups={choices
                .filter((c) => c.indices && c.color)
                .map((c) => ({ label: c.label, color: c.color! }))}
              onClose={() => setInspect(null)}
            />
          )}
        </ArchiveKey>
      )}
      {/* TEMPORARY basemap colour tuner — remove this element, the import, and
          MapTuner.tsx/.css when the palette is settled. */}
      {ready && <MapTuner map={mapRef.current} />}
      {ready && (
        <Timeline
          day={day}
          dayMin={bounds.min}
          dayMax={bounds.max}
          playing={playing}
          dateLabel={monthLabel(day)}
          missionCount={stats.missions}
          runCount={stats.runs}
          gallons={stats.gallons}
          agentChoices={choices}
          activeAgentKey={agentKey}
          volume={volume}
          onScrub={(d) => {
            setPlaying(false)
            setDay(d)
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onReset={() => {
            setPlaying(false)
            setDay(bounds.min)
          }}
          onSelectAgent={setAgentKey}
          flyToLabels={PRESETS.map((p) => p.label)}
          onFlyTo={(i) => {
            const p = PRESETS[i]
            mapRef.current?.easeTo({ center: p.center, zoom: p.zoom, duration: 1800 })
          }}
        />
      )}
    </div>
  )
}
