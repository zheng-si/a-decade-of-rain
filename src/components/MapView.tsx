import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
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
  VOL_COARSE_SOURCE,
  VOL_FINE_SOURCE,
  gridDegrees,
  DOTS,
} from './volumeGrid'
import {
  addTrackLayers,
  TRACK_LAYER,
  TRACK_MARK_LAYER,
  TRACK_DIM_LAYER,
  TRACK_END_LAYER,
  TRACK_NIL_LAYER,
  setTrackHover,
  setHighlightByFeature,
  setTrackTaper,
  taperGradient,
  hitWidthRamp,
  hitMarkRamp,
  setTrackTime,
  setTrackAgents,
  setTrackDraw,
  setDrawProgress,
  setDrawVisible,
  setLayersVisible,
} from './trackLayers'
import { loadTracks, type TrackDataset } from '../data/tracks'
import LocationLookup, { type LookupState } from './LocationLookup'
import {
  queryLookup,
  circlePolygon,
  veilPolygon,
  loadGazetteer,
  type LookupHit,
  type GazPlace,
} from './lookup'
import { binTracks, resetTrackGrid } from './trackGrid'
import { computeScale } from './mapScale'
import ArchiveInspect, {
  fmtGallons,
  type Inspect,
  type CellInspect,
} from './ArchiveInspect'
import { applyLabelCuration } from './labelLayers'

/** The tuner is a development instrument — a panel for choosing label faces,
 *  dot sizes and zoom ranges, kept in the repo because the numbers it produces
 *  are the ones committed into the style. Nobody reading the Story or the
 *  Archive ever opens it, so it must not be in their download: `lazy` puts its
 *  ~48 kB of JS and ~8 kB of CSS in a chunk that is fetched only when the gate
 *  below opens.
 *
 *  The gate is written out here rather than imported from MapTuner, and that
 *  is the whole trick: importing `tunerEnabled` would be a static import of
 *  the module the lazy() is trying to split out, and rolldown would pull the
 *  panel straight back into the entry chunk. Measured — the naive version cost
 *  160 B in the entry and saved nothing. The duplication is four lines and it
 *  is what makes the split real. */
const MapTuner = lazy(() => import('./MapTuner'))

function tunerEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).has('tune')
  } catch {
    return false
  }
}

/** The Archive draws no military regions. Named rather than deleted so the
 *  decision is visible and reversible in one place; the Story still calls
 *  addMilitaryRegions directly. */
const SHOW_MILITARY_REGIONS = false
// SPIKE — Archive UI v2 (Geist, no radii, no strokes, near-flat shadows).
// Scoped under .map-wrap; delete both imports and the two files to revert.
import '../fontsGeist.css'
import '../ArchiveSkinV2.css'

/**
 * Draw the record as the lines it actually is.
 *
 * This was `?tracks=1` while the two encodings were being compared on one
 * deploy. The comparison is settled and lives in docs/methods.md, so the flag
 * is gone: the grids bin from the LINES, the near tier draws them, and there is
 * no URL that turns that off.
 *
 * The flag had to go rather than merely default to on. Left reachable, it was a
 * URL that makes the map put 58% of the volume in the wrong cell — and the one
 * thing this project has learned over and over is that a switch nobody
 * remembers is a switch that eventually gets flipped. The old reading is still
 * reproducible, from scripts/analyse-binning.mjs, where it is labelled.
 *
 * The constant stays because ~30 call sites read it, and a named constant is
 * where the decision is visible. TO REVERT: this file's `tracks` branch plus
 * src/components/trackLayers.ts and src/data/tracks.ts.
 */
const TRACKS = true

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

// ── location lookup plumbing ──────────────────────────────────────────────
const LOOKUP_VEIL_SRC = 'lookup-veil'
const LOOKUP_CIRCLE_SRC = 'lookup-circle'
const LOOKUP_HI_SRC = 'lookup-hi'
const LOOKUP_VEIL_LAYER = 'lookup-veil-fill'
const LOOKUP_CIRCLE_LAYER = 'lookup-circle-line'
const LOOKUP_HI_PT = 'lookup-hi-pt'
/** ONE STROKE LAYER PER AGENT COLOUR.
 *
 *  The hits are coloured by agent — that is what makes the "By Agent" bars in
 *  the answer legible on the map — and the fade is a `line-gradient`, which
 *  can read `line-progress` and nothing else: it cannot see which agent a
 *  stroke belongs to. So the split has to be a FILTER, exactly as it is for
 *  the record's stroke and its dim twin (see applyTrackColour). Four colours,
 *  four layers, decided once from the palette rather than rebuilt per lookup.
 *
 *  The last one is the catch-all rather than a fourth equality test: a run
 *  whose colour matched no layer would not fall back to flat, it would leave
 *  the map, which is worse than any colour. Every LineString is drawn by
 *  exactly one of these. */
const LOOKUP_HI_COLOURS = Array.from(new Set(mapConfig.agents.map((g) => g.color)))
const LOOKUP_HI_LINES = LOOKUP_HI_COLOURS.map((_, i) => `lookup-hi-line-${i}`)
/** The tiers that draw THE RECORD — the two grids, the raw dots and every
 *  track layer. A lookup hides them all and draws its hits itself. */
const GRID_TIERS = [VOL_COARSE_LAYER, VOL_FINE_LAYER, VOL_RAW_LAYER]
const RECORD_TIERS = [
  ...GRID_TIERS,
  TRACK_LAYER,
  TRACK_DIM_LAYER,
  TRACK_NIL_LAYER,
  TRACK_MARK_LAYER,
  TRACK_END_LAYER,
]
/** Hide the record's own tiers for a lookup, remembering what each one was. */
function hideRecordTiers(map: maplibregl.Map, saved: Map<string, string>) {
  for (const id of RECORD_TIERS) {
    if (!map.getLayer(id)) continue
    if (!saved.has(id))
      saved.set(id, (map.getLayoutProperty(id, 'visibility') as string) ?? 'visible')
    map.setLayoutProperty(id, 'visibility', 'none')
  }
}

/** Put them back as they were — except where "as they were" has since stopped
 *  being true.
 *
 *  A remembered value is only good while nobody else writes the thing it
 *  remembers, and one layer has an owner that does: the RAW dot tier steps
 *  aside for the tracks the moment spray-tracks.json lands (see the load
 *  callback). Open a lookup before that file arrives — which is every shared
 *  Location Lookup URL, since the deep link sets the circle on the first
 *  frame — and the snapshot records 'visible', the tracks arrive and set it
 *  to 'none', and clearing the circle puts 8,360 agent-coloured dots and
 *  rings back over the strokes. That is the "sometimes" in it: only the
 *  lookups that started before the record finished loading.
 *
 *  So the raw tier is asked of its owner rather than of the memory. The rule
 *  is one line in one place either way; the memory was a second copy of it
 *  that could go stale. */
function restoreRecordTiers(
  map: maplibregl.Map,
  saved: Map<string, string> | undefined,
  tracksOn: boolean,
) {
  if (!saved?.size) return
  for (const [id, vis] of saved) {
    if (!map.getLayer(id)) continue
    map.setLayoutProperty(id, 'visibility', id === VOL_RAW_LAYER && tracksOn ? 'none' : vis)
  }
  saved.clear()
}

/** requestIdleCallback with a setTimeout stand-in (Safari). The timeout cap
 *  matters: an idle callback on a busy map can starve, and a pre-bin that
 *  arrives after the reader has already crossed the hand-off did nothing. */
type IdleHandle = { ric: number } | { t: number }
const scheduleIdle = (fn: () => void): IdleHandle =>
  typeof window.requestIdleCallback === 'function'
    ? { ric: window.requestIdleCallback(fn, { timeout: 1500 }) }
    : { t: window.setTimeout(fn, 300) }
const cancelIdle = (h: IdleHandle) => {
  if ('ric' in h) window.cancelIdleCallback(h.ric)
  else window.clearTimeout(h.t)
}

const LOOKUP_EPOCH_MS = Date.UTC(1961, 0, 1)
/** 'YYYY-MM' → first/last day number of that month (day 1 = 1961-01-01). */
const monthToFirstDay = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return Math.floor((Date.UTC(y, mo - 1, 1) - LOOKUP_EPOCH_MS) / 86_400_000) + 1
}
const monthToLastDay = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return Math.floor((Date.UTC(y, mo, 0) - LOOKUP_EPOCH_MS) / 86_400_000) + 1
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
  cam?: { center: [number, number]; zoom: number; bearing: number; pitch: number }
  is3D?: boolean
  lookup?: { lng: number; lat: number; radiusKm: number; from: string; to: string }
}

function readUrlState(): UrlState {
  const q = new URLSearchParams(window.location.search)
  const out: UrlState = {}
  const t = q.get('t')
  // The shape test alone let "1969-99-99" through: dateToDay parses it to NaN,
  // and NaN survives the clamp at the apply site (Math.min(NaN, x) is NaN), so
  // the transport read INVALID DATE over a parked playhead. A date that does
  // not exist is a date that was not given.
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = dateToDay(t)
    if (Number.isFinite(d)) out.day = d
  }
  const agent = q.get('agent')
  if (agent) out.agent = agent
  // Three or five parts: lng,lat,zoom grew bearing,pitch so a rotated or
  // tilted camera survives sharing. Old three-part links parse as before, and
  // buildSearch omits the two when both are zero, so untouched cameras keep
  // the short form.
  const cam = (q.get('cam') ?? '').split(',').map(Number)
  if ((cam.length === 3 || cam.length === 5) && cam.every(Number.isFinite) && onEarth(cam[0], cam[1]))
    out.cam = {
      center: [cam[0], cam[1]],
      zoom: cam[2],
      bearing: cam.length === 5 ? cam[3] : 0,
      pitch: cam.length === 5 ? Math.min(Math.max(cam[4], 0), 85) : 0,
    }
  if (q.get('view') === '3d') out.is3D = true
  // Location lookup, per the brief's own parameter names: lat, lng, r, from, to.
  // Truthiness, not just presence: ?lat=&lng= gave Number('') = 0 twice, and
  // the page opened a real lookup on 0°N 0°E — then wrote the zeros back into
  // the URL for the next person to copy.
  if (q.get('lat') && q.get('lng')) {
    const lat = Number(q.get('lat'))
    const lng = Number(q.get('lng'))
    if (Number.isFinite(lat) && Number.isFinite(lng) && onEarth(lng, lat)) {
      const r = Number(q.get('r'))
      out.lookup = {
        lat,
        lng,
        radiusKm: [1, 2, 5, 10].includes(r) ? r : 5,
        from: '1961-01',
        to: '1971-12',
      }
    }
  }
  return out
}

/** Whether a pair of numbers is a place on Earth.
 *
 *  isFinite is not that test, and it was the only one here: ?lat=106.8&lng=10.9
 *  — the two swapped, which is the commonest way to mistype a coordinate —
 *  handed 106.8 to LngLat as a latitude, which throws, and the throw happened
 *  during render. #root ended up with zero children: a white page, no map, no
 *  panel, no message, no way back. A URL is untrusted input like any other; a
 *  bad one should cost the reader the deep link, not the site. */
const onEarth = (lng: number, lat: number) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180

/** Serialise the current view; defaults (full record, all agents, home camera,
 *  flat) are omitted so the canonical URL stays clean. */
function buildSearch(
  map: maplibregl.Map | null,
  home: Home | null,
  day: number,
  dayMax: number,
  agentKey: string,
  is3D: boolean,
  lookup: LookupState,
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
    const bearing = map.getBearing()
    const pitch = map.getPitch()
    const turned = Math.abs(bearing) > 0.5 || pitch > 0.5
    if (moved || turned)
      q.set(
        'cam',
        `${c.lng.toFixed(3)},${c.lat.toFixed(3)},${map.getZoom().toFixed(2)}` +
          (turned ? `,${bearing.toFixed(0)},${pitch.toFixed(0)}` : ''),
      )
  }
  if (is3D) q.set('view', '3d')
  if (lookup.center) {
    q.set('lat', lookup.center.lat.toFixed(4))
    q.set('lng', lookup.center.lng.toFixed(4))
    if (lookup.radiusKm !== 5) q.set('r', String(lookup.radiusKm))
  }
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

/** True below the phone breakpoint — the one place layout is decided in JS.
 *
 *  640px, the same number every phone rule on the site breaks at (App.css's
 *  sheet, index.css's rem scale, the Story's deck). It is read, not assumed:
 *  a reader who resizes across the breakpoint gets the lookup moved to the
 *  container that is actually on screen, rather than into a panel CSS has
 *  hidden. SSR-safe default (false) because the Archive is client-rendered and
 *  the desktop home is the common case. */
function useIsPhone(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = () => setPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}

/** What the highlight is currently pointing at: an identity for the no-op
 *  check, and the geometry to light.
 *
 *  It carries the FEATURES rather than an index because the two sources of a
 *  highlight light different amounts. A hover lights the leg under the
 *  pointer; a row opened from the lookup list lights the whole run, every leg
 *  and mark of it. Holding an index meant the pinned run collapsed to one leg
 *  the moment the reader moved the pointer back over the map — the highlight
 *  quietly shrinking to something they had not asked for. */
type Lit = { key: string; features: GeoJSON.Feature[] }

/** The single writer for the highlight — the map effect and the panel
 *  callbacks both go through it, so the key and the geometry can never
 *  disagree about what is lit. */
function paintLit(map: maplibregl.Map, lit: Lit | null) {
  setTrackHover(map, lit?.key ?? null, lit?.features ?? null)
}

/** Every piece of one hit, wrapped for the highlight. */
function litHit(tracks: TrackDataset | null | undefined, hit: LookupHit): Lit | null {
  if (!tracks) return null
  const features = [
    ...hit.lineIdx.map((i) => tracks.lines.features[i]),
    ...hit.markIdx.map((i) => tracks.marks.features[i]),
  ] as GeoJSON.Feature[]
  return features.length ? { key: `run:${hit.mission}|${hit.run}`, features } : null
}

/** One feature of the track tier, wrapped for the highlight. `mark` picks the
 *  set: id 41 in the lines is not id 41 in the marks. */
function litFeature(
  tracks: TrackDataset | null | undefined,
  id: number,
  mark: boolean,
): Lit | null {
  const f = tracks ? (mark ? tracks.marks : tracks.lines).features[id] : null
  return f ? { key: `${mark ? 'm' : 'l'}${id}`, features: [f as GeoJSON.Feature] } : null
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dataRef = useRef<SprayDataset | null>(null)

  const [ready, setReady] = useState(false)
  /** The basemap or the record failed to load. Deliberately NOT wired to
   *  `ready`: on a style rejection mapRef.current is null, and both MapTuner
   *  and Timeline take the map without null-checking it, so flipping `ready`
   *  in a catch would trade a blank page for a crash. */
  const [loadError, setLoadError] = useState(false)
  const [bounds, setBounds] = useState({ min: 0, max: 0 })
  const [choices, setChoices] = useState<AgentChoice[]>([])
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [agentKey, setAgentKey] = useState('all')
  const [is3D, setIs3D] = useState(false)
  const [stats, setStats] = useState({ missions: 0, runs: 0, gallons: 0 })
  const [volume, setVolume] = useState<VolumeChart | null>(null)
  const [inspect, setInspect] = useState<Inspect | null>(null)
  const isPhone = useIsPhone()
  /** The map's scale bar. maplibre's own control puts the figure ABOVE the
   *  rule, because it sets the element's width to the measured distance —
   *  so this draws it instead, from the same computeScale the key used to
   *  call, with the figure beside the rule where a map reader expects it. */
  const [scale, setScale] = useState<{ label: string; w: number }>({ label: '', w: 0 })
  // ── location lookup ──────────────────────────────────────────────────────
  const [lookup, setLookup] = useState<LookupState>({
    center: null,
    radiusKm: 5,
    from: '1961-01',
    to: '1971-12',
    picking: false,
  })
  const lookupPickRef = useRef(false)
  lookupPickRef.current = lookup.picking
  const [lookupResults, setLookupResults] = useState<LookupHit[] | null>(null)
  const [lookupMs, setLookupMs] = useState<number | null>(null)
  // Phone: the record card sits ON TOP of the control sheet, and the sheet
  // has two heights (peek / expanded) plus text that can rewrap — so the
  // card's bottom offset cannot be a constant. A ResizeObserver mirrors the
  // panel's live height into --panel-h on the wrap; the card's CSS rides it.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const wrap = wrapRef.current
    const panel = wrap?.querySelector('.explorer-panel')
    if (!wrap || !panel) return
    const ro = new ResizeObserver(() => {
      wrap.style.setProperty('--panel-h', `${(panel as HTMLElement).offsetHeight}px`)
    })
    ro.observe(panel)
    return () => ro.disconnect()
  }, [ready])
  // The credit's width, for the scale bar that sits to its left. Not a
  // constant and not a media query: the badge is 24px closed and 300-odd open,
  // and the reader flips between the two by pressing it. Measured, so the bar
  // moves when it moves.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !ready) return
    const attrib = wrap.querySelector('.maplibregl-ctrl-attrib')
    if (!attrib) return
    const ro = new ResizeObserver(() => {
      wrap.style.setProperty('--attrib-w', `${(attrib as HTMLElement).offsetWidth}px`)
    })
    ro.observe(attrib)
    return () => ro.disconnect()
  }, [ready])

  /** A NEW QUESTION CLOSES THE OLD ANSWER.
   *
   *  Searching a second place, or picking a second point, while a record card
   *  was open left the card up — a Bien Hoa run reading over a map that had
   *  already flown to Da Nang, with the panel offering "← Back to 4 results"
   *  and no answer at all, because the card's presence is what suppresses it.
   *  Every door into a new centre had to remember to close it; this is the one
   *  place that knows a centre changed. Opening a record from the list does
   *  not move the centre, so it does not trip this. */
  useEffect(() => {
    setInspect(null)
    pinnedRunRef.current = null
    if (mapRef.current) paintLit(mapRef.current, hoverRunRef.current)
  }, [lookup.center?.lng, lookup.center?.lat])

  /** The one way out of a lookup. Hoisted because there are now two doors
   *  onto it — the × in the search row and the Clear on the map's own hint —
   *  and two exits that do almost the same thing is how they drift apart. */
  const clearLookup = useCallback(
    () => setLookup((s) => ({ ...s, center: null, picking: false, place: undefined })),
    [],
  )

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
  /** The pending idle pre-bin, so a newer state can cancel an older one. */
  const prebinRef = useRef<IdleHandle | null>(null)
  /** The throttle key each grid TIER was last binned for, or '' if it was
   *  skipped because it was off screen. Per tier rather than one flag, because
   *  only one of the two is ever visible and binning the other is pure waste. */
  const gridTierKeyRef = useRef<Record<string, string>>({})
  /** The day the SETTLED track layers are filtered to. While playing it trails
   *  the playhead by one step, and the gap is exactly what the drawing layer
   *  holds. */
  const settledDayRef = useRef(0)
  /** Bumped to force the throttled day effect to run again after a zoom-out
   *  has found the grids stale. */
  const [gridEpoch, setGridEpoch] = useState(0)
  /** Which run the highlight is on, from two sources with one output.
   *
   *  Hover is transient and click PINS, because otherwise the inspect card
   *  names a run the map has stopped pointing at the moment the reader moves
   *  the mouse to read it — the card would be about "this one" with no "this"
   *  left on screen. Hover wins while it lasts, so the reader can still compare
   *  a neighbour against the pinned run without losing it. */
  const hoverRunRef = useRef<Lit | null>(null)
  /** The run the reader opened, lit until they close or open another. */
  const pinnedRunRef = useRef<Lit | null>(null)
  const dayRef = useRef(0)
  const colorsRef = useRef<string[] | null>(null)
  const playingRef = useRef(false)
  dayRef.current = day
  playingRef.current = playing

  // One-time map + data setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    const failed = (where: string) => (err: unknown) => {
      if (cancelled) return
      console.error(`archive map: ${where}`, err)
      setLoadError(true)
    }

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
        // Compact everywhere: the credit is a ⓘ badge until the reader asks
        // for it. The scale bar sits to its LEFT and follows it — pressing the
        // badge opens the credit line and slides the bar along with it (the
        // --attrib-w observer below is what makes that work).
        attributionControl: { compact: true },
      })
      mapRef.current = map

      // Re-frame on the record now that the container has a real size, and set
      // the zoom floor from the same fit so "furthest out" means "the whole
      // record" instead of a hard-coded 5.6 that clipped the Mekong delta on
      // every laptop.
      const applyHome = (animate: boolean) => {
        const prev = homeRef.current
        // The fit is computed either way, because the zoom FLOOR comes from it
        // even when the opening camera does not. A chosen home that sits above
        // the fit would otherwise take "pull out to the whole record" away.
        const fit = homeCamera(map)
        const next = mapConfig.view.archiveHome ?? fit
        homeRef.current = next
        map.setMinZoom(Math.min(next.zoom, fit.zoom) - mapConfig.view.minZoomMargin)
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
      //
      // It shares that corner with a tall place column, and where the column
      // reaches the bottom of the screen it draws over the +. Stepping the
      // pair left of the column fixes that and was tried; it put the buttons
      // in the middle of the map, which is worse than the collision. Left
      // where readers expect them.
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

      // Fold the credit to its ⓘ once, the way the Story already does.
      // MapLibre's compact attribution renders EXPANDED and folds on the map's
      // own `drag` — so the Archive sat with the full 351px line across the
      // corner until the reader happened to pan, which on a phone covered 90%
      // of the map's top edge, and here also parked the scale bar 327px left of
      // where it settles. The class is not there at load (it arrives when the
      // source's attribution resolves), so this watches for it rather than
      // guessing a moment, folds it, and disconnects: one add, one removal, and
      // the reader's own press on the ⓘ still works.
      const attribEl = map.getContainer().querySelector('.maplibregl-ctrl-attrib')
      if (attribEl) {
        const obs = new MutationObserver(() => {
          if (attribEl.classList.contains('maplibregl-compact-show')) {
            attribEl.classList.remove('maplibregl-compact-show')
            obs.disconnect()
          }
        })
        obs.observe(attribEl, { attributes: true, attributeFilter: ['class'] })
      }

      map.on('moveend', () => setCamTick((t) => t + 1))

      // The two military-region files are fetched ONLY when they will be drawn.
      // They used to sit in this Promise.all unconditionally, so every Archive
      // load blocked its first paint on two round trips for a layer that
      // SHOW_MILITARY_REGIONS has turned off — small files (5 KB and 0.5 KB),
      // but two serial waits in front of the map for nothing at all.
      // `r.ok` first — vercel.json rewrites unknown paths to index.html with a
      // 200, so a renamed data file arrives as HTML and dies inside the parser
      // with a SyntaxError naming neither the file nor the status.
      const asset = (f: string) =>
        fetch(`${import.meta.env.BASE_URL}${f}`).then((r) => {
          if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`)
          return r.json()
        })
      Promise.all([
        loadSpray(),
        SHOW_MILITARY_REGIONS ? asset('data/military-region-dividers.geojson') : null,
        SHOW_MILITARY_REGIONS ? asset('data/military-region-labels.geojson') : null,
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
        // The Story calls this too now, for the same collision.
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
        // The tracks are the mark the reader spends most of their time on now,
        // and until this they were the only mark on the map that answered
        // nothing when you pointed at it — the dots had a tooltip and a card
        // and the strokes had neither. Queried FIRST, because in their band the
        // grid tiers are already out and the raw dots are hidden, so anything
        // else under the pointer is the basemap.
        // TRACK_MARK_LAYER is in the list because the key names what it draws:
        // 2,829 runs are logged against ONE grid reference, the legend calls
        // them "Logged at One Point", and until this they were the only mark on
        // the map that answered nothing when you pointed at or clicked them.
        const trackLayers = () =>
          [TRACK_LAYER, TRACK_DIM_LAYER, TRACK_NIL_LAYER, TRACK_MARK_LAYER].filter((id) =>
            map.getLayer(id),
          )
        // While a lookup is up the record's tiers are hidden and the hits are
        // drawn on the lookup's own two layers — so those are where a pointer
        // finds a run. Without this the circle took the map's whole click
        // behaviour away with it: the runs were on screen, lit, and inert.
        const hitLayers = () =>
          [...LOOKUP_HI_LINES, LOOKUP_HI_PT].filter((id) => map.getLayer(id))
        const pickLayers = () => [...hitLayers(), ...trackLayers()]
        /** The run under the pointer, or null. Also the one place that knows a
         *  run is only pickable where it is actually drawn. */
        const trackAt = (pt: maplibregl.PointLike) => {
          const ids = pickLayers()
          if (!ids.length) return null
          // The playhead is a paint gate now, not a filter (see trackLayers),
          // and queryRenderedFeatures honours filters but not opacity — so
          // without this the reader could hover a run that has not happened yet
          // and read a 1970 date off a map showing 1963. Take the first hit
          // that the playhead has actually reached.
          for (const f of map.queryRenderedFeatures(pt, { layers: ids })) {
            const p = f.properties as Record<string, number>
            if (p.day <= dayRef.current) return f as unknown as maplibregl.MapGeoJSONFeature
          }
          return null
        }
        /** One writer for the highlight, fed by both sources.
         *
         *  It passes the run out of the LOADED dataset rather than the feature
         *  the hit test returned: queryRenderedFeatures hands back tile-clipped
         *  geometry, and a run cut by a tile boundary would light up in pieces.
         *  `generateId` numbers features in source order, so the rendered id is
         *  the index here — verified on the running page. */
        const paintHover = () => paintLit(map, hoverRunRef.current ?? pinnedRunRef.current)
        /** What a picked feature means. On the lookup's layers a feature is a
         *  piece of a HIT, and the hit knows all its own pieces; on the record's
         *  layers it is an index into one of the two feature sets. */
        const readPick = (t: maplibregl.MapGeoJSONFeature) => {
          const p = t.properties as Record<string, number>
          const onHitLayer =
            t.layer.id === LOOKUP_HI_PT || LOOKUP_HI_LINES.includes(t.layer.id)
          if (onHitLayer) {
            const hit = lookupResultsRef.current?.find(
              (h) => h.mission === p.mission && h.run === p.run,
            )
            return { hit, lit: hit ? litHit(tracksRef.current, hit) : null, mark: t.layer.id === LOOKUP_HI_PT }
          }
          const mark = t.layer.id === TRACK_MARK_LAYER
          return {
            hit: undefined,
            lit: typeof t.id === 'number' ? litFeature(tracksRef.current, t.id, mark) : null,
            mark,
          }
        }
        map.on('mousemove', (e) => {
          // While the reader is arming a lookup point the map is a target,
          // not a browsable record: hold the crosshair and mute the hovers.
          if (lookupPickRef.current) {
            map.getCanvas().style.cursor = 'crosshair'
            hover.remove()
            return
          }
          const t = trackAt(e.point)
          if (t) {
            const p = t.properties as Record<string, number>
            const pick = readPick(t)
            const isMark = pick.mark
            hoverRunRef.current = pick.lit
            paintHover()
            map.getCanvas().style.cursor = 'pointer'
            hover
              .setLngLat(e.lngLat)
              .setHTML(
                // The cell tooltip's grammar exactly: TWO figures on the bold
                // line, then one line of context. It had three lines with the
                // dose on its own, which made the same kind of object read as a
                // different kind of tooltip. The two figures are the two things
                // the stroke encodes — its colour and its width.
                `<strong>${
                  p.gallons > 0
                    ? `<span class="n">${fmtGallons(p.gallons)}</span> Gallons${
                        isMark
                          ? ''
                          : `<span class="gap"></span><span class="n">${Math.round(p.gpk).toLocaleString()}</span> Gal/km`
                      }`
                    : 'No Volume Logged'
                }</strong>` +
                  // A point has no length: `km` is absent on the marks, and
                  // printing "0.0 km" for a run whose extent the record simply
                  // does not give would be inventing a fact.
                  `<span>${groupLabels[p.gi] ?? 'Unknown'} · ${dayLabel(p.day)}${
                    isMark ? ' · Logged at one point' : ` · ${p.km.toFixed(1)} km`
                  }</span>`,
              )
              .addTo(map)
            return
          }
          hoverRunRef.current = null
          paintHover()
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
        // The pointer leaving the canvas has to clear both, or the last run the
        // reader passed over stays lit while they are looking somewhere else.
        map.on('mouseout', () => {
          hover.remove()
          map.getCanvas().style.cursor = ''
          hoverRunRef.current = null
          paintHover()
        })
        map.on('click', (e) => {
          if (lookupPickRef.current) {
            setLookup((s) => ({
              ...s,
              center: { lng: e.lngLat.lng, lat: e.lngLat.lat },
              picking: false,
              place: undefined,
            }))
            return
          }
          const t = trackAt(e.point)
          if (t) {
            const p = t.properties as Record<string, number>
            const pick = readPick(t)
            const isMark = pick.mark
            pinnedRunRef.current = pick.lit
            paintHover()
            // A hit clicked ON THE MAP has to say what the same hit says when
            // it is clicked in the LIST. The feature under the pointer is one
            // leg; the hit is the whole run, and its gallons and kilometres
            // are the run's. Reading the leg here would have given the same
            // record two different volumes depending on which way in the
            // reader took.
            if (pick.hit) {
              const hit = pick.hit
              const ts = tracksRef.current
              const kmTotal = ts
                ? hit.lineIdx.reduce((acc, i) => acc + ts.lines.features[i].properties.km, 0)
                : 0
              setInspect({
                kind: 'run',
                coords: [e.lngLat.lng, e.lngLat.lat],
                day: hit.day,
                groupIndex: hit.gi,
                gallons: hit.gallons,
                ...(kmTotal > 0
                  ? { km: Number(kmTotal.toFixed(1)), gpk: Number((hit.gallons / kmTotal).toFixed(1)) }
                  : {}),
                mission: hit.mission,
                run: hit.run,
                fwac: hit.fwac,
              })
              return
            }
            setInspect({
              kind: 'run',
              // Unused by the track card — a line has no single position — but
              // the shape wants it, and the click point is the honest answer to
              // "where did you point".
              coords: [e.lngLat.lng, e.lngLat.lat],
              day: p.day,
              groupIndex: p.gi ?? -1,
              gallons: p.gallons,
              // Absent on a single-point run, and ArchiveInspect reads their
              // presence as "this subject has an extent" — so omitting them is
              // what makes the card say point rather than line.
              ...(isMark ? {} : { km: p.km, gpk: p.gpk }),
              mission: p.mission,
              run: p.run,
              fwac: p.fwac,
            })
            return
          }
          // Any other click changes what the card is about, so the pin goes
          // with it — a pinned stroke under a cell card points at the wrong
          // subject.
          pinnedRunRef.current = null
          paintHover()
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
        if (urlState.cam)
          map.jumpTo({
            center: urlState.cam.center,
            zoom: urlState.cam.zoom,
            bearing: urlState.cam.bearing,
            pitch: urlState.cam.pitch,
          })
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
        if (urlState.lookup) {
          const lk = urlState.lookup
          setLookup((s) => ({
            ...s,
            center: { lng: lk.lng, lat: lk.lat },
            radiusKm: lk.radiusKm,
            from: lk.from,
            to: lk.to,
          }))
          // The sender searched "Bien Hoa Air Base"; the URL carries only the
          // rounded coordinates, so the recipient read "10.977°N 106.818°E" —
          // right counts, no identity. The coordinates are looked back up in
          // the gazetteer: lat/lng print at 4 decimals (≤55m of rounding) and
          // no two entries sit that close, so an exact-ish match IS the place.
          // Guarded against a centre that moved while the file loaded.
          loadGazetteer()
            .then((places) => {
              const hit = places.find(
                (pl) => Math.abs(pl.lat - lk.lat) < 5e-4 && Math.abs(pl.lng - lk.lng) < 5e-4,
              )
              if (!hit) return
              setLookup((s) =>
                s.center && Math.abs(s.center.lat - lk.lat) < 1e-9 && Math.abs(s.center.lng - lk.lng) < 1e-9
                  ? {
                      ...s,
                      place: {
                        name: hit.n,
                        coarse: hit.t === 'city' || hit.t === 'town',
                        low: hit.c === 'low',
                      },
                    }
                  : s,
              )
            })
            .catch(() => {})
        }
        setReady(true)
      }, failed('the record failed to load'))

      // Hotspot ring markers retired — the volume symbols carry the story.
    }, failed('the basemap failed to load'))

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
        const deg = gridDegrees()
        // Bin the tier that is ON SCREEN, not both. Only one of the two grid
        // tiers is ever drawn, and a full bin of the fine grid costs 43 ms — so
        // the opening view at z5.94, which draws the coarse tier alone, was
        // paying for a fine grid nobody could see on every agent switch and
        // every playhead step. A skipped tier is recorded as stale and re-binned
        // by the zoom watcher below the moment it becomes the visible one.
        const z = map.getZoom()
        const binTier = (layer: string, source: string, cellDeg: number) => {
          const l = map.getLayer(layer)
          const on = !!l && z >= (l.minzoom ?? 0) && z < (l.maxzoom ?? 24)
          if (!on) { gridTierKeyRef.current[layer] = ''; return }
          if (gridTierKeyRef.current[layer] === key) return
          gridTierKeyRef.current[layer] = key
          const src = map.getSource(source) as maplibregl.GeoJSONSource | undefined
          src?.setData(binTracks(tracksRef.current!, day, activeIndices, cellDeg, c))
        }
        binTier(VOL_COARSE_LAYER, VOL_COARSE_SOURCE, deg.coarse)
        binTier(VOL_FINE_LAYER, VOL_FINE_SOURCE, deg.fine)
      }
      gridsStaleRef.current = false
    } else {
      gridsStaleRef.current = true
    }

    // ── pre-bin the tiers the reader is ABOUT to see ──────────────────────
    // "Bin only the tier on screen" bought the playhead its frame budget and
    // sold the hand-off: one zoom click across the coarse-to-fine boundary
    // left the map with no spray record at all for up to ~1.7s — the old tier
    // past its maxzoom, the new one waiting for zoomend, a bin, and a worker
    // parse. So the hidden grid tiers are filled IN THE IDLE TIME after the
    // visible one settles, and marked with the same key the arrival check
    // compares against — by the time the camera crosses, the data is already
    // parsed in the source and the hand-off costs nothing. Playback keeps the
    // old economy: the gate below skips the work the optimization existed to
    // avoid, and the zoomend watcher still covers whatever idle never filled.
    if (TRACKS && tracksRef.current) {
      if (prebinRef.current != null) cancelIdle(prebinRef.current)
      prebinRef.current = scheduleIdle(() => {
        prebinRef.current = null
        const t = tracksRef.current
        if (!t || playingRef.current) return
        if (appliedKeyRef.current !== key) return
        const tint = choices.find((x) => x.key === agentKey)?.color ?? DOTS.tint
        const deg = gridDegrees()
        let filled = true
        for (const [layer, source, cellDeg] of [
          [VOL_FINE_LAYER, VOL_FINE_SOURCE, deg.fine],
          [VOL_COARSE_LAYER, VOL_COARSE_SOURCE, deg.coarse],
        ] as const) {
          if (gridTierKeyRef.current[layer] === key) continue
          if (!map.getLayer(layer)) { filled = false; continue }
          const src = map.getSource(source) as maplibregl.GeoJSONSource | undefined
          if (!src) { filled = false; continue }
          src.setData(binTracks(t, day, activeIndices, cellDeg, tint))
          gridTierKeyRef.current[layer] = key
        }
        // Both tiers current: coming back down from the track band needs no
        // catch-up re-bin either.
        if (filled) gridsStaleRef.current = false
      })
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

  // Spend the skipped bin the moment the grids become the visible tier again.
  // Without this the reader zooms out of the track band onto a grid still
  // binned for the agent or the day they left behind — a stale map is a worse
  // failure than a slow one, which is why the skip above has to be recorded.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !TRACKS) return
    const check = () => {
      const z = map.getZoom()
      const track = map.getLayer(TRACK_LAYER)
      const tracksOn = !!track && z >= (track.minzoom ?? 0)
      // A tier that is visible and was never binned for the current playhead —
      // either because the tracks owned the screen, or because it was the other
      // tier — has to be caught up before the reader sees it.
      const stale = [VOL_COARSE_LAYER, VOL_FINE_LAYER].some((id) => {
        const l = map.getLayer(id)
        if (!l || z < (l.minzoom ?? 0) || z >= (l.maxzoom ?? 24)) return false
        return gridTierKeyRef.current[id] !== appliedKeyRef.current
      })
      if (!tracksOn && !stale && !gridsStaleRef.current) return
      if (tracksOn) return
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
    // The console can change the cell size and both dot colours, and the
    // accumulated bins are keyed on exactly those. Throwing them away here is
    // what keeps "resumable" from meaning "stale": one owner clears the cache,
    // and it is the one that changed the thing the cache is keyed on.
    resetTrackGrid()
    gridTierKeyRef.current = {}
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
  // The taper is a line-gradient, and a line-gradient is a 256-step colour ramp
  // MapLibre re-renders per tile whenever the layer changes — which during
  // playback is every playhead step. Profiled at z9: median frame 733ms with it
  // against 250ms without, on the same data. So it is suspended while the
  // playhead moves and restored when it stops. Its own effect, not a line
  // inside the rAF setup, so a pause caused by anything at all restores it.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !TRACKS) return
    setTrackTaper(map, !playing)
  }, [ready, playing, tracksReady])

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

  // ── location lookup: query ───────────────────────────────────────────────
  useEffect(() => {
    const t = tracksRef.current
    if (!tracksReady || !t || !lookup.center) {
      lookupResultsRef.current = null
      setLookupResults(null)
      setLookupMs(null)
      return
    }
    const t0 = performance.now()
    const res = queryLookup(t, {
      lng: lookup.center.lng,
      lat: lookup.center.lat,
      radiusKm: lookup.radiusKm,
      dayFrom: monthToFirstDay(lookup.from),
      dayTo: monthToLastDay(lookup.to),
    })
    setLookupMs(performance.now() - t0)
    lookupResultsRef.current = res
    setLookupResults(res)
  }, [tracksReady, lookup])

  // ── location lookup: overlay ─────────────────────────────────────────────
  // A paper veil over everything OUTSIDE the circle, the circle itself, and
  // the hit runs redrawn at full strength above the veil — their own layers
  // with no minzoom, because a hit must be visible at ANY zoom while the base
  // track layers only exist near.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const update = () => setScale(computeScale(map))
    update()
    map.on('move', update)
    window.addEventListener('resize', update)
    return () => {
      map.off('move', update)
      window.removeEventListener('resize', update)
    }
  }, [ready])

  const lookupMarkerRef = useRef<maplibregl.Marker | null>(null)
  /** What each record tier's `visibility` was before a lookup hid it.
   *
   *  A snapshot, not a rule. The first version of this asked applyTracks to
   *  put the record back, on the reasoning that it owns which tiers are shown
   *  — but it only ever sets the three OPTIONAL ones (ends, nils, marks),
   *  because the main stroke layer and its dim twin are never hidden by
   *  anything. Hiding them here and handing the restore to a function that
   *  does not touch them turned every cleared lookup into a map with no
   *  flight tracks on it at all, back to dots at z11. Remembering beats
   *  inferring: whatever each layer was, that is what it goes back to. */
  const hiddenTiersRef = useRef<Map<string, string>>(new Map())
  /** The current hits, for the map handlers: while a lookup is up they are the
   *  only runs on screen, and clicking one has to find its whole record. */
  const lookupResultsRef = useRef<LookupHit[] | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const c = lookup.center
    // The highlight follows the hits' own colours while the circle is up: in
    // there a run is drawn per agent, and lighting a blue one in the brand red
    // produced a stroke that ran red at one end and blue at the other.
    setHighlightByFeature(map, c != null)
    if (!c) {
      restoreRecordTiers(map, hiddenTiersRef.current, tracksRef.current != null)
      for (const id of [
        LOOKUP_HI_PT,
        ...LOOKUP_HI_LINES,
        LOOKUP_CIRCLE_LAYER,
        LOOKUP_VEIL_LAYER,
      ])
        if (map.getLayer(id)) map.removeLayer(id)
      for (const id of [LOOKUP_HI_SRC, LOOKUP_CIRCLE_SRC, LOOKUP_VEIL_SRC])
        if (map.getSource(id)) map.removeSource(id)
      lookupMarkerRef.current?.remove()
      lookupMarkerRef.current = null
      return
    }
    const fc = (features: GeoJSON.Feature[]): GeoJSON.GeoJSON => ({
      type: 'FeatureCollection',
      features,
    })
    if (!map.getSource(LOOKUP_VEIL_SRC)) {
      map.addSource(LOOKUP_VEIL_SRC, { type: 'geojson', data: fc([]) })
      map.addSource(LOOKUP_CIRCLE_SRC, { type: 'geojson', data: fc([]) })
      // lineMetrics is what makes `line-progress` — and so the fade — possible,
      // the same reason the record's own source sets it. Without it the
      // gradient installs, reports itself set, and paints nothing.
      map.addSource(LOOKUP_HI_SRC, { type: 'geojson', data: fc([]), lineMetrics: true })
      map.addLayer({
        id: LOOKUP_VEIL_LAYER,
        type: 'fill',
        source: LOOKUP_VEIL_SRC,
        // Lighter than it was: with the record's own tiers hidden there is
        // nothing under this but the basemap, and 0.55 over bare paper reads as
        // a smudge rather than as a focus.
        paint: { 'fill-color': '#f7f3ec', 'fill-opacity': 0.32 },
      })
      map.addLayer({
        id: LOOKUP_CIRCLE_LAYER,
        type: 'line',
        source: LOOKUP_CIRCLE_SRC,
        paint: { 'line-color': '#213528', 'line-width': 1.4, 'line-dasharray': [3, 2] },
      })
      // WIDTH IS GALLONS PER KILOMETRE AND EACH RUN FADES FROM ITS FIRST
      // WAYPOINT — the key says both, three inches away, and a flat 2.4 in one
      // colour said neither. A lookup redraws the record's runs on its own
      // layers; drawing them there in a different language makes the circle
      // the one place on this map where the legend is wrong. Both the ramp and
      // the fade are taken from the record's own definitions rather than
      // rebuilt, so a console change to either reaches both.
      LOOKUP_HI_COLOURS.forEach((colour, i) => {
        const taper = taperGradient(colour)
        map.addLayer({
          id: LOOKUP_HI_LINES[i],
          type: 'line',
          source: LOOKUP_HI_SRC,
          filter:
            i === LOOKUP_HI_COLOURS.length - 1
              ? [
                  'all',
                  ['==', ['geometry-type'], 'LineString'],
                  ['!', ['in', ['get', 'c'], ['literal', LOOKUP_HI_COLOURS.slice(0, -1)]]],
                ]
              : ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'c'], colour]],
          layout: { 'line-cap': 'round' },
          paint: {
            // line-color stays set under the gradient for the same reason the
            // record leaves it alone: clearing it resets the property to its
            // spec default of BLACK, so a path where the gradient failed to
            // install would paint the hits black instead of flat colour.
            'line-color': colour,
            ...(taper ? { 'line-gradient': taper as never } : {}),
            'line-width': hitWidthRamp(1.2) as never,
          },
        })
      })
      map.addLayer({
        id: LOOKUP_HI_PT,
        type: 'circle',
        source: LOOKUP_HI_SRC,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': ['get', 'c'],
          // And AREA IS GALLONS for the single-point runs, the same as the
          // record's own marks — same reason as the strokes above.
          'circle-radius': hitMarkRamp(2.2) as never,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      })
    }
    ;(map.getSource(LOOKUP_VEIL_SRC) as maplibregl.GeoJSONSource).setData(
      fc([veilPolygon(c.lng, c.lat, lookup.radiusKm)]),
    )
    ;(map.getSource(LOOKUP_CIRCLE_SRC) as maplibregl.GeoJSONSource).setData(
      fc([circlePolygon(c.lng, c.lat, lookup.radiusKm)]),
    )
    const t = tracksRef.current
    const hi: GeoJSON.Feature[] = []
    if (t && lookupResults) {
      for (const h of lookupResults) {
        for (const i of h.lineIdx) hi.push(t.lines.features[i])
        for (const i of h.markIdx) hi.push(t.marks.features[i])
      }
    }
    ;(map.getSource(LOOKUP_HI_SRC) as maplibregl.GeoJSONSource).setData(fc(hi))

    // One record open: the other fifty-nine step back to a fifth. They are
    // still there — the reader chose this one OUT of them, and the answer is
    // partly the company it keeps — but they stop competing with it. Keyed on
    // mission and run rather than a feature id because a run is several
    // features and all of them belong to the same record.
    const sel = inspect?.kind === 'run' && inspect.mission != null ? inspect : null
    const fade = (base: number): maplibregl.ExpressionSpecification | number =>
      sel
        ? ([
            'case',
            ['all', ['==', ['get', 'mission'], sel.mission], ['==', ['get', 'run'], sel.run]],
            base,
            base * 0.2,
          ] as maplibregl.ExpressionSpecification)
        : base
    for (const id of LOOKUP_HI_LINES)
      if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', fade(1))
    if (map.getLayer(LOOKUP_HI_PT)) map.setPaintProperty(LOOKUP_HI_PT, 'circle-opacity', fade(1))

    // Everything outside the circle leaves the map. The veil alone was a 55%
    // paper wash over the record, which in the dense provinces is still a
    // thousand strokes showing through the answer — the reader was asked to
    // find sixty runs inside a field of them. The record tiers go dark and the
    // hit runs, drawn on the lookup's own layers, are what is left: the circle
    // stops being an annotation and becomes the view.
    hideRecordTiers(map, hiddenTiersRef.current)
    if (!lookupMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'lookup-center-pin'
      const m = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([c.lng, c.lat])
        .addTo(map)
      m.on('dragend', () => {
        const p = m.getLngLat()
        setLookup((s) => ({ ...s, center: { lng: p.lng, lat: p.lat }, place: undefined }))
      })
      lookupMarkerRef.current = m
    } else {
      lookupMarkerRef.current.setLngLat([c.lng, c.lat])
    }
  }, [ready, lookup.center, lookup.radiusKm, lookupResults, inspect])

  // Crosshair while arming a pick (the map handlers hold it during moves).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = lookup.picking ? 'crosshair' : ''
  }, [lookup.picking])

  /** Open one lookup result: frame the run's extent and put its card up. */
  function openLookupHit(hit: LookupHit) {
    const map = mapRef.current
    const t = tracksRef.current
    if (!map || !t) return
    // A second press on the open row folds it — the row is a disclosure now,
    // and a disclosure that only opens is a trap.
    if (inspect?.kind === 'run' && inspect.mission === hit.mission && inspect.run === hit.run) {
      setInspect(null)
      pinnedRunRef.current = null
      paintLit(map, hoverRunRef.current)
      return
    }
    const [w, sBound, e, n] = hit.bounds
    if (w <= e)
      map.fitBounds(
        [
          [w, sBound],
          [e, n],
        ],
        { padding: fitPaddingFor(map), maxZoom: 11.5, duration: 700 },
      )
    const line = hit.lineIdx.length ? t.lines.features[hit.lineIdx[0]] : null
    const mark = hit.markIdx.length ? t.marks.features[hit.markIdx[0]] : null
    const coords = (
      line ? line.geometry.coordinates[0] : mark!.geometry.coordinates
    ) as [number, number]
    // Fly AND light. The map answered a list click by moving, which on a
    // screen already full of strokes is not an answer: the reader arrives
    // somewhere plausible with nothing saying which of the forty lines under
    // the pin is the one they asked for. The whole run lights up, every
    // segment and mark of it, because a run cut into three legs is still one
    // flight — the same reason the hover highlight carries the whole geometry.
    const geom = [
      ...hit.lineIdx.map((i) => t.lines.features[i]),
      ...hit.markIdx.map((i) => t.marks.features[i]),
    ] as GeoJSON.Feature[]
    pinnedRunRef.current = geom.length ? { key: `run:${hit.mission}|${hit.run}`, features: geom } : null
    paintLit(map, pinnedRunRef.current)
    const kmTotal = hit.lineIdx.reduce((acc, i) => acc + t.lines.features[i].properties.km, 0)
    setInspect({
      kind: 'run',
      coords,
      day: hit.day,
      groupIndex: hit.gi,
      gallons: hit.gallons,
      ...(kmTotal > 0
        ? { km: Number(kmTotal.toFixed(1)), gpk: Number((hit.gallons / kmTotal).toFixed(1)) }
        : {}),
      mission: hit.mission,
      run: hit.run,
      fwac: hit.fwac,
    })
  }

  // A mode needs a way out that is not a second trip to the control that
  // opened it. Escape is the one every reader already tries.
  useEffect(() => {
    if (!lookup.picking) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLookup((s) => ({ ...s, picking: false }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lookup.picking])

  /** A place chosen from the search: center there, widen city-level queries
   *  to 10 km per the brief, and ease the map over so the circle is on
   *  screen — a search that answers off-screen answers nothing. */
  function handlePlace(pl: GazPlace) {
    const coarse = pl.t === 'city' || pl.t === 'town'
    setLookup((s) => ({
      ...s,
      center: { lng: pl.lng, lat: pl.lat },
      radiusKm: coarse ? 10 : s.radiusKm,
      picking: false,
      place: { name: pl.n, coarse, low: pl.c === 'low' },
    }))
    const map = mapRef.current
    if (map)
      map.easeTo({
        center: [pl.lng, pl.lat],
        zoom: Math.max(map.getZoom(), 8.6),
        duration: 700,
      })
  }

  // Mirror the current view into the query string, debounced. During playback
  // the timer keeps postponing, so the URL settles when the playhead does.
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => {
      const search = buildSearch(
        mapRef.current,
        homeRef.current,
        day,
        bounds.max,
        agentKey,
        is3D,
        lookup,
      )
      window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
    }, 300)
    return () => window.clearTimeout(id)
  }, [ready, day, agentKey, is3D, camTick, bounds.max, lookup])

  // ── where the lookup lives ──────────────────────────────────────────────
  // One element, two homes. On a desktop it belongs to the KEY panel, beside
  // the record card: a clicked dot, a clicked track and a drawn circle are
  // three ways of asking about one place, and all three answers belong in the
  // same column — the left panel reads as TIME, the right as PLACE. On a phone
  // the key panel is display:none until a record opens, so the query would
  // vanish with it; there it stays in the control sheet, where it began.
  //
  // A width test in JS, not two renders and a CSS hide: rendered twice, the
  // search box would carry two copies of its own state and the reader would be
  // typing into the hidden one half the time.
  /** The record belongs INSIDE the list when it is one of the list's own
   *  rows: same panel, same scroll, the reader's eye never leaves the column.
   *  Everything else — a dot, a run clicked with no circle up, the phone —
   *  keeps the standalone card. */
  const inlineHit =
    !isPhone &&
    inspect?.kind === 'run' &&
    inspect.mission != null &&
    lookup.center != null &&
    (lookupResults?.some((h) => h.mission === inspect.mission && h.run === inspect.run) ?? false)

  const lookupPanel = (
    <LocationLookup
      state={lookup}
      results={lookupResults}
      queryMs={lookupMs}
      groups={choices
        .filter((c) => c.indices && c.color)
        .map((c) => ({ label: c.label, color: c.color! }))}
      // Desktop opens records INLINE in the list (detailKey/detail below), so
      // the fold-to-a-back-link behaviour is the phone's alone — there the
      // record is its own sheet and the lookup lives in another.
      cardOpen={isPhone && inspect != null}
      detailKey={inlineHit ? `${inspect!.mission}|${inspect!.run}` : null}
      detail={
        inlineHit ? (
          <ArchiveInspect
            data={inspect!}
            showClose={false}
            groups={choices
              .filter((c) => c.indices && c.color)
              .map((c) => ({ label: c.label, color: c.color! }))}
            onClose={() => {
              setInspect(null)
              pinnedRunRef.current = null
              if (mapRef.current) paintLit(mapRef.current, hoverRunRef.current)
            }}
          />
        ) : null
      }
      onPickToggle={() => setLookup((s) => ({ ...s, picking: !s.picking }))}
      onRadius={(km) => setLookup((s) => ({ ...s, radiusKm: km }))}
      onClear={clearLookup}
      onOpen={openLookupHit}
      onPlace={handlePlace}
      onBack={() => {
        setInspect(null)
        pinnedRunRef.current = null
        if (mapRef.current) paintLit(mapRef.current, hoverRunRef.current)
      }}
    />
  )

  return (
    // `inspect-open` is for the phone layout: below 640px the key panel that
    // hosts the record card is display:none, so opening a record flips the
    // wrap into "inspect mode" — the control sheet drops to its peek and the
    // key panel returns as a card sitting ON TOP of the control sheet,
    // riding its height via --panel-h (the ResizeObserver above): peek under
    // the card by default, two stacked cards when the reader expands the
    // panel with the grab handle. Desktop CSS never reads the class.
    <div ref={wrapRef} className={inspect ? 'map-wrap inspect-open' : 'map-wrap'}>
      <div ref={containerRef} className="map-root" />
      {ready && scale.w > 0 && (
        <div className="map-scale" aria-hidden="true">
          <span>{scale.label}</span>
          <i className="map-scale-bar" style={{ width: `${scale.w}px` }} />
        </div>
      )}
      {/* Armed: the map is a target, and it says so over the map the reader is
          aiming at. In the panel this was a line of text appearing under the
          search box, which pushed the radius chips and the whole answer down a
          row the moment the pointer left for the map. */}
      {lookup.picking && (
        <p className="map-pick-hint" role="status">
          Click the map to set the point
          <button onClick={() => setLookup((s) => ({ ...s, picking: false }))}>Cancel</button>
        </p>
      )}
      {/* And the same sign for the state the circle leaves the map IN. A
          lookup hides every run outside it, which is most of the record, and
          the only thing on the map that said so was the dashed circle itself —
          the way out lived in a × in the panel, three hundred pixels from
          where the reader is looking. Same furniture as the pick hint above,
          because it is the same kind of fact: the map is in a mode, and here
          is how it ends. Never both at once: while picking, the pick hint is
          the one that matters. */}
      {ready && !lookup.picking && lookup.center && (
        <p className="map-pick-hint" role="status">
          Showing {lookup.radiusKm} km around {lookup.place ? lookup.place.name : 'this point'}
          <button onClick={clearLookup}>Clear</button>
        </p>
      )}
      {/* The Archive IS the map — there is no prose to fall back to — so when
          the basemap or the record cannot be fetched, saying so is the whole
          of what this surface can still do. Rendered outside the `ready` gate
          on purpose: `ready` mounts chrome that reads the map, and on a style
          rejection there is no map to read. */}
      {loadError && (
        <p className="map-load-error" role="status">
          The archive could not be loaded. Please try again.
        </p>
      )}
      {ready && (
        <aside className="archive-key" aria-label="Place">
          {/* The place column: what the reader asked, and the record they
              opened. `archive-key` is kept as the class because the phone
              still turns THIS box into the record sheet — the name is the
              container's, not the legend's, which now lives in the left
              panel. */}
          {isPhone ? null : lookupPanel}
          {inspect && !inlineHit && (
            <ArchiveInspect
              data={inspect}
              // The back link exists only where the lookup does, and only when
              // it has results to go back to.
              showClose={isPhone || !(lookup.center && lookupResults?.length)}
              groups={choices
                .filter((c) => c.indices && c.color)
                .map((c) => ({ label: c.label, color: c.color! }))}
              onClose={() => {
                setInspect(null)
                pinnedRunRef.current = null
                if (mapRef.current) paintLit(mapRef.current, hoverRunRef.current)
              }}
            />
          )}
        </aside>
      )}
      {/* Mounted only when the gate is open — dev, or ?tune on the URL. A
          reader on the live site never evaluates this branch, so the chunk is
          never requested and the fallback never shows. */}
      {ready && tunerEnabled() && (
        <Suspense fallback={null}>
          <MapTuner map={mapRef.current} onRegrid={regrid} />
        </Suspense>
      )}
      {ready && (
        <Timeline
          day={day}
          dayMin={bounds.min}
          dayMax={bounds.max}
          playing={playing}
          dateLabel={monthLabel(day)}
          missionCount={stats.missions}
          gallons={stats.gallons}
          agentChoices={choices}
          activeAgentKey={agentKey}
          volume={volume}
          is3D={is3D}
          onToggle3D={toggleView}
          inspectOpen={!!inspect}
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
          lookupSlot={isPhone ? lookupPanel : null}
          keySlot={
            isPhone ? null : (
              <ArchiveKey
                map={mapRef.current}
                ready={ready}
                is3D={is3D}
                onToggle3D={toggleView}
                tint={choices.find((c) => c.key === agentKey)?.color ?? '#ff5449'}
                filtered={agentKey !== 'all'}
                tracks={TRACKS}
              />
            )
          }
        />
      )}
    </div>
  )
}
