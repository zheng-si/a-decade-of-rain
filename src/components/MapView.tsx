import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadSpray, dayToDate, dateToDay, type SprayDataset } from '../data/spray'
import { mapConfig, Z_MID, Z_NEAR } from '../config/mapConfig'
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
  VOL_COARSE_SOURCE,
  VOL_FINE_SOURCE,
  gridDegrees,
  DOTS,
  applyDots,
  setDotMetric,
  type DotMetric,
} from './volumeGrid'
import {
  addTrackLayers,
  TRACK_LAYER,
  setTrackTime,
  setTrackAgents,
  setTrackDraw,
  setDrawProgress,
  setDrawVisible,
  setLayersVisible,
  setTrackStart,
  applyTracks,
} from './trackLayers'
import { loadTracks, type TrackDataset } from '../data/tracks'
import { binTracks } from './trackGrid'
import { buildLoadField, advanceLoad, loadFeatures, type LoadField } from '../data/decay'
import ArchiveInspect, {
  fmtGallons,
  type Inspect,
  type CellInspect,
} from './ArchiveInspect'
import { applyLabelCuration } from './labelLayers'
import MapTuner from './MapTuner'

/** The Archive draws no military regions. Named rather than deleted so the
 *  decision is visible and reversible in one place; the Story still calls
 *  addMilitaryRegions directly. */
const SHOW_MILITARY_REGIONS = false
// SPIKE — Archive UI v2 (Geist, no radii, no strokes, near-flat shadows).
// Scoped under .map-wrap; delete both imports and the two files to revert.
import '../fontsGeist.css'
import '../ArchiveSkinV2.css'

/** SPIKE A — draw the record as the lines it actually is (?tracks=1).
 *
 *  Behind a URL flag rather than a build flag so the two encodings can be
 *  compared on one deploy, and so the dot map — which three other things are
 *  tuned against — stays the default until the lines have earned it. */
function tracksEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('tracks')
  } catch {
    return false
  }
}
const TRACKS = tracksEnabled()

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

/** Whether the draw-on animation is wanted at all. Reads the shipped table
 *  rather than a second flag, so the console owns it like every other track
 *  parameter. */
const TRACKS_DRAW = TRACKS

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** The two decayed load fields, built once per cell size and kept.
 *
 *  Module-level rather than a ref because they are pure derivations of the
 *  track file, which does not change for the life of the page — and because
 *  rebuilding one would throw away the replay state that makes the reading
 *  incremental. Keyed by cell size so a console changing the grid gets a new
 *  field instead of a field binned to the wrong cell.
 */
const LOAD_FIELDS = new Map<number, LoadField>()
function loadFields(data: TrackDataset, deg: { coarse: number; fine: number }) {
  const get = (d: number) => {
    let f = LOAD_FIELDS.get(d)
    if (!f) {
      f = buildLoadField(data, d)
      LOAD_FIELDS.set(d, f)
    }
    return f
  }
  return { coarse: get(deg.coarse), fine: get(deg.fine) }
}

/**
 * The runs that arrived in (lo, hi] — the ones a playback step has just added.
 *
 * A linear scan of 8,753 features, which is a rounding error next to the
 * setData it feeds; the expensive thing about a GeoJSON source is handing
 * MapLibre the result, and the result here is a few dozen lines.
 *
 * Isolated agents are filtered OUT rather than drawn grey, because a layer has
 * one gradient and a gradient cannot ask which agent a stroke belongs to — the
 * same constraint that forced the dim twin. The consequence is small and worth
 * naming: with an agent isolated, the greyed runs land one step later than the
 * selected ones instead of being drawn on.
 */
function arriving(
  data: TrackDataset,
  lo: number,
  hi: number,
  indices: number[] | null,
): GeoJSON.FeatureCollection {
  const sel = indices ? new Set(indices) : null
  const features = data.lines.features.filter((f) => {
    const p = f.properties as { day: number; agent: number; gpk: number }
    if (p.day <= lo || p.day > hi) return false
    if (p.gpk <= 0) return false
    return !sel || sel.has(p.agent)
  })
  return { type: 'FeatureCollection', features }
}

const monthLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

const dayLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

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
type Padding = { top: number; right: number; bottom: number; left: number }

function fitPaddingFor(map: maplibregl.Map): Padding {
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
function applyView(map: maplibregl.Map, next: boolean, home: Home | null, animate = true) {
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
  // Tilt only. Entering 3D used to also force zoom 6.6 — "terrain reads
  // better up close" — and THAT is what cut the bottom off the record: at
  // z6.6 the frame's south edge sits at 9.27°N, well north of the delta tip
  // and Cà Mau at 8.3°N, which is the densest sprayed ground on the map.
  //
  // The tilt itself was not the cause, which is the opposite of what it looks
  // like. Pitch only ever ADDS ground coverage: measured on 1512×900 at the
  // same z5.94, the south edge sits at 7.98°N flat, 7.06°N at 55°, and 5.62°N
  // at 68°. Leaning the camera back shows more of the world, not less — so
  // holding the home zoom through the toggle is the whole fix.
  const pitch = next ? mapConfig.view.pitch3d : 0
  if (home && isAtHome(map, home)) {
    map.easeTo({ ...home, pitch, duration: animate ? 1000 : 0 })
  } else {
    // A reader who has gone somewhere keeps their place; only the tilt moves.
    map.easeTo({ pitch, duration: animate ? 1000 : 0 })
  }
}

/** Cumulative spray runs, track points and gallons up to `day`, restricted to
 *  `indices`.
 *
 *  HERBS records a spray run as a LINE — leg 1A, 1B, 1C … — and books the run's
 *  whole volume against 1A, so every later waypoint reads 0. That is why the
 *  gallons-bearing records double as the run count: one non-zero row per run.
 *
 *  It undercounts slightly, and knowingly: 2,913 of the source's 11,273 runs
 *  carry no volume anywhere, and with Mission/Run/Leg dropped by our ETL there
 *  is nothing in spray.json to group by, so those runs cannot be counted at
 *  all. Fixing that means re-running the ETL, not renaming a variable. */
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

  const tracksRef = useRef<TrackDataset | null>(null)
  /** Flips once the track file has landed. The day effect short-circuits on an
   *  unchanged throttle key, so without a dep that changes when the tracks
   *  arrive the grids would keep the point-binned data until the reader
   *  happened to scrub — the same class of "correct code, never runs" bug the
   *  tuner's once('idle') had. */
  const [tracksReady, setTracksReady] = useState(false)
  /** The grid tiers hold data for a day/agent that is no longer the current
   *  one, because the reader was past the hand-off when it changed.
   *
   *  Binning the two grids is the expensive thing this component does — it
   *  walks every segment of every run in sub-cell steps — and past the hand-off
   *  it produces features for layers that draw nothing. Measured at z10.2 with
   *  only the strokes on screen, one agent switch blocked the main thread for
   *  639 ms in a single task and 1,425 ms in total, all of it for tiers with
   *  zero rendered features. The tracks' own update is a filter and a paint
   *  expression and costs nothing.
   *
   *  So the bin is skipped and this is set instead, and the zoom watcher below
   *  spends it the moment the grids are the visible tier again. Skipping
   *  without recording it would be the real bug: the reader would zoom out onto
   *  a grid still showing the agent they had deselected. */
  const gridsStaleRef = useRef(false)
  /** The day the SETTLED track layers are filtered to. While playing it trails
   *  the playhead by one step, and the gap is exactly what the drawing layer
   *  holds. */
  const settledDayRef = useRef(0)
  /** Bumped to force the throttled day effect to run again after a zoom-out
   *  has found the grids stale. */
  const [gridEpoch, setGridEpoch] = useState(0)
  /** Which quantity the dots are sized by.
   *
   *  Gated on TRACKS because the pass count only exists when the grids are
   *  binned from the LINES — binGrid drops a run's whole volume into the one
   *  cell holding leg 1A and has no notion of a run crossing a cell, so a
   *  passes reading built on it would be counting run STARTS and calling them
   *  sprayings. Offering the switch without the lines would be offering a
   *  number the record cannot support. */
  const [metric, setMetric] = useState<DotMetric>('volume')
  /** How many cells the load field is holding right now.
   *
   *  Only so the key can say why the map is empty. At the default playhead —
   *  the end of the record — the honest answer is 8 cells nationwide, because
   *  spraying stopped and thirty-day decay finished the job in a season. That
   *  is the strongest sentence this reading has, and without a word on screen
   *  it reads as a broken layer instead. */
  const [loadCells, setLoadCells] = useState(-1)
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
        // The lines go in alongside the dots and one of the two is hidden, so
        // switching is a visibility change and both are always in a state the
        // other can be compared against.
        if (TRACKS) {
          loadTracks(colors, groupOf)
            .then((t) => {
              tracksRef.current = t
              addTrackLayers(map, t, dayRef.current, DOTS.tint)
              // Only the RAW dot tier steps aside — the two grid tiers keep
              // their dots and get re-binned from the lines below, so the
              // aggregate views gain the corrected geography without losing
              // the mark that suits an aggregate.
              setLayersVisible(map, [VOL_RAW_LAYER], false)
              setTracksReady(true)
            })
            .catch((e) => console.error('tracks failed to load', e))
        }
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
            if (dataRef.current) {
              const cell = aggregateCell(dataRef.current, coords[0], coords[1], deg)
              // Prefer the counts the FEATURE carries. binTracks measured them
              // by walking the lines; aggregateCell can only count run starts.
              // Only the line-binned grids have them, so the card falls back
              // rather than inventing a number the point data cannot support.
              setInspect(
                p.nt != null
                  ? // The headline gallons come from the feature too, so the
                    // three numbers on the card share one denominator. Left as
                    // they were, the card read "20K Gallons · 79 Sprayings"
                    // where the 20K was the gallons of runs STARTING in the
                    // cell and the 79 was runs CROSSING it — two different
                    // cells' worth of arithmetic printed side by side.
                    {
                      ...cell,
                      gallons: p.gt,
                      crossings: p.nt,
                      days: p.dt,
                      byGroup: [p.b0, p.b1, p.b2, p.b3],
                      ...(p.ld != null ? { load: p.ld } : {}),
                    }
                  : cell,
              )
            }
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

        // The military regions are OFF on the Archive — borders and tags both.
        // The record's own geography carries this map; four administrative
        // zones drawn over it were a second division competing with the one
        // the reader came for. The Story still draws them, where they are
        // narrated rather than ambient, so the function stays.
        if (SHOW_MILITARY_REGIONS) addMilitaryRegions(map, mrGeo, mrLabelsGeo, bottomLayer)
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
          applyView(map, true, homeRef.current, false)
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
    const key = `${Math.floor(day / FILTER_STEP_DAYS)}|${agentKey}|${atEnd}|${tracksReady}|${gridEpoch}`
    if (key === appliedKeyRef.current) return
    appliedKeyRef.current = key
    // Are the grid tiers the encoding on screen? Asked of the track layer's own
    // minzoom rather than of Z_NEAR, so that moving the hand-off from the
    // console moves this with it — the key already learned that lesson.
    const trackLayer = TRACKS ? map.getLayer(TRACK_LAYER) : null
    const gridsOn = !trackLayer || map.getZoom() < (trackLayer.minzoom ?? 0)

    if (gridsOn) {
      // updateVolume ONLY when the point bins are what the grids will show.
      //
      // Under TRACKS every one of its outputs is thrown away: it writes
      // point-binned features into the same two sources the track/load binning
      // overwrites two statements later, and its third tier — vol-raw — is
      // hidden at setup because the strokes replace it.
      //
      // Thrown away, but not for free, and not invisibly. Two setData calls
      // land on one source per step, MapLibre parses GeoJSON in a worker, and
      // the first payload can reach the screen before the second replaces it.
      // In the Residue reading the two payloads are wildly different sizes —
      // a decade of cumulative point bins against a decayed field — so the
      // map flickered through the whole of playback. Measured over 59 frames:
      // 21 frame-to-frame swings of more than 200 features, worst 500, the
      // count oscillating between 451 and 1,077.
      if (!TRACKS && dataRef.current)
        updateVolume(map, dataRef.current, day, activeIndices, choices.find((c) => c.key === agentKey)?.color ?? null)
      // The grids are re-binned from the TRACKS, so a run's gallons land in
      // every cell it crossed. Same feature shape as binGrid, same layers.
      if (TRACKS && tracksRef.current) {
        const c = choices.find((x) => x.key === agentKey)?.color ?? DOTS.tint
        const coarse = map.getSource(VOL_COARSE_SOURCE) as maplibregl.GeoJSONSource | undefined
        const fine = map.getSource(VOL_FINE_SOURCE) as maplibregl.GeoJSONSource | undefined
        const deg = gridDegrees()
        if (metric === 'load') {
          // The decayed field, not a re-bin. It is stateful — it steps forward
          // from where it was — so it cannot be rebuilt per frame the way the
          // other two readings are, and it must not be: replaying it is what
          // makes the surface fall as well as rise.
          const f = loadFields(tracksRef.current, deg)
          advanceLoad(f.coarse, day, activeIndices)
          advanceLoad(f.fine, day, activeIndices)
          const filtered = activeIndices != null
          const cf = loadFeatures(f.coarse, c, DOTS.dim, filtered)
          const ff = loadFeatures(f.fine, c, DOTS.dim, filtered)
          coarse?.setData(cf)
          fine?.setData(ff)
          setLoadCells(Math.max(cf.features.length, ff.features.length))
        } else {
          coarse?.setData(binTracks(tracksRef.current, day, activeIndices, deg.coarse, c))
          fine?.setData(binTracks(tracksRef.current, day, activeIndices, deg.fine, c))
        }
      }
      gridsStaleRef.current = false
    } else {
      gridsStaleRef.current = true
    }

    // The track LAYERS need no re-bin — the playhead is a filter and the
    // selection is a paint expression — so they update at every zoom, whether
    // or not the grids were spent on.
    if (TRACKS && tracksRef.current) {
      // Playing: hold the settled record one step back and hand the runs that
      // arrived in this step to the drawing layer, which the rAF loop wipes in.
      // The settled filter therefore lags by one step — about 92 ms of
      // playback — which is the whole reason a run can be seen to arrive at
      // all rather than appearing complete.
      const lo = settledDayRef.current
      const playingNow = playingRef.current && TRACKS_DRAW
      if (playingNow && lo < day) {
        setTrackTime(map, lo)
        setTrackDraw(map, arriving(tracksRef.current, lo, day, activeIndices))
        setDrawProgress(map, 0)
        setDrawVisible(map, true)
      } else {
        setTrackTime(map, day)
        setTrackDraw(map, EMPTY_FC)
        setDrawVisible(map, false)
      }
      settledDayRef.current = day
      setTrackAgents(
        map,
        activeIndices,
        choices.find((c) => c.key === agentKey)?.color ?? DOTS.tint,
        DOTS.dim,
      )
    }
    if (dataRef.current) setStats(cumulative(dataRef.current, day, activeIndices))
  }, [ready, day, agentKey, activeIndices, choices, bounds.max, tracksReady, gridEpoch])

  // Switching what the dots MEAN.
  //
  // The passes reading has no track tier: a track is one run, so "how many
  // times" is not a question a single stroke can answer — it is a question
  // about a place. So the switch does not hide the tracks as a special case,
  // it moves the hand-off to 24. The grids then own every zoom, the strokes
  // own none, and the one number that decides which encoding is on screen
  // stays the only one, exactly as it is in volume mode.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !TRACKS) return
    setDotMetric(metric)
    const hand = metric === 'volume' ? Z_NEAR : 24
    setTrackStart(hand)
    applyTracks(map)
    if (map.getLayer(VOL_FINE_LAYER)) map.setLayerZoomRange(VOL_FINE_LAYER, Z_MID, hand)
    applyDots(map)
    // The count lives in the binned features, not in paint, so the grids have
    // to be rebuilt — the same reason the tuner's colour pickers ask for a
    // re-bin rather than trusting a paint update.
    gridsStaleRef.current = false
    appliedKeyRef.current = ''
    setGridEpoch((n) => n + 1)
  }, [ready, metric])

  // Spend the skipped bin the moment the grids become the visible tier again.
  // Without this the reader zooms out of the track band onto a grid still
  // binned for the agent or the day they left behind — a stale map is a worse
  // failure than a slow one, which is why the skip above has to be recorded.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !TRACKS) return
    const check = () => {
      if (!gridsStaleRef.current) return
      const layer = map.getLayer(TRACK_LAYER)
      if (!layer || map.getZoom() >= (layer.minzoom ?? 0)) return
      gridsStaleRef.current = false
      appliedKeyRef.current = ''
      setGridEpoch((n) => n + 1)
    }
    map.on('zoomend', check)
    return () => {
      map.off('zoomend', check)
    }
  }, [ready])

  // Lets the tuner force a re-bin after changing something the bins bake in —
  // a cell size, or either of the two dot colours. The effect above
  // short-circuits on an unchanged throttle key, so clearing the key is the
  // whole trick.
  const regrid = useCallback(() => {
    const map = mapRef.current
    if (!map || !dataRef.current) return
    appliedKeyRef.current = ''
    // Clearing the key is what actually re-bins — the day effect runs next and
    // picks whichever binning the current reading calls for. This direct call
    // is the point-bin path only, and under TRACKS it is the same discarded
    // write that made playback flicker, so it is gated the same way.
    if (!TRACKS)
      updateVolume(
        map,
        dataRef.current,
        day,
        activeIndices,
        choices.find((c) => c.key === agentKey)?.color ?? null,
      )
    else setGridEpoch((n) => n + 1)
  }, [day, activeIndices, choices, agentKey])

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
      // Advance the drawing front. The wipe is driven by where the playhead
      // sits INSIDE its own filter step, not by a clock, so it finishes exactly
      // as the next step replaces it and can never queue up behind playback.
      // The write lands on the drawing layer's own small source — the record's
      // 8,753 lines are not touched by this.
      const m = mapRef.current
      if (m && TRACKS_DRAW) {
        const q = (next - settledDayRef.current) / FILTER_STEP_DAYS
        setDrawProgress(m, q < 0 ? 0 : q > 1 ? 1 : q)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, bounds.min, bounds.max])

  // Stopping mid-step would leave the last few runs half-drawn for good, so
  // pausing settles them: the drawing layer empties and the record's own filter
  // catches up to the playhead.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !TRACKS_DRAW || playing || !tracksReady) return
    setTrackTime(map, dayRef.current)
    setTrackDraw(map, EMPTY_FC)
    setDrawVisible(map, false)
    settledDayRef.current = dayRef.current
  }, [playing, tracksReady])

  // Switch between flat (top-down) and tilted 3D terrain.
  function toggleView() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    applyView(map, next, homeRef.current)
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

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-root" />
      {ready && (
        <ArchiveKey
          map={mapRef.current}
          ready={ready}
          is3D={is3D}
          onToggle3D={toggleView}
          tint={choices.find((c) => c.key === agentKey)?.color ?? '#ff5449'}
          filtered={agentKey !== 'all'}
          tracks={TRACKS}
          metric={TRACKS ? metric : undefined}
          onMetric={TRACKS ? setMetric : undefined}
          loadCells={metric === 'load' ? loadCells : undefined}
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
      {/* The tuner is UNMOUNTED — the palette and the label tiers are settled
          and live in mapTaxonomy.ts. The file and its styles are kept: putting
          the element back is this one line, and `?tune=1` still gates it. */}
      {ready && <MapTuner map={mapRef.current} onRegrid={regrid} />}
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
          tracks={TRACKS}
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
        />
      )}
    </div>
  )
}
