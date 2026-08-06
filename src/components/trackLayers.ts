// ── Spike A · the record drawn as lines ───────────────────────────────────
// A spray run is a track. See scripts/build-spray-tracks.mjs for the evidence.
//
// HYBRID, not replacement. The tracks own the NEAR tier only; the two grid
// tiers keep their dots, because at those zooms the data on screen is an
// aggregate and a cell total is a different kind of statement from a run. What
// changes is where the aggregate comes from: trackGrid bins the LINES, so a
// run's gallons land in every cell it crossed instead of piling into the one
// holding its first waypoint. Dots for summaries, tracks for events, and both
// telling the truth about position.
//
// WHAT ENCODES WHAT
//
//   width   gallons per km — the linear density the strip was dosed at.
//           Linear, not √: a line's ink is width × length, and volume is
//           gpk × length, so a linear width makes INK PROPORTIONAL TO VOLUME.
//           That is the same area-true principle the dots use, arrived at
//           through the other geometry.
//   colour  one hue for the whole record, an agent's own when isolated —
//           exactly the dot map's rule. Colouring by agent unconditionally was
//           tried first and turns "All" into a categorical map: four hues
//           competing for the eye when the question being asked is "where".
//   alpha   stacking. Ground flown twice darkens, which is the one thing the
//           point map could never show: repetition.
//
// Gallons per km is also the first quantity in this project that is comparable
// between runs. Total gallons is not — a 40 km run and a 2 km run carrying the
// same load did very different things to the ground under them.
//
// TO REMOVE: delete this file and src/data/tracks.ts, drop the `tracks` branch
// in MapView, and delete public/data/spray-tracks.json with its build script.
import type maplibregl from 'maplibre-gl'
import type { TrackDataset } from '../data/tracks'
import { Z_FAR, Z_NEAR } from '../config/mapConfig'
import { firstLabelLayerId } from './mapTheme'

export const TRACK_SOURCE = 'spray-tracks'
export const TRACK_MARK_SOURCE = 'spray-track-marks'
export const TRACK_END_SOURCE = 'spray-track-ends'
/** Sprayed segments, width by gallons per km. */
export const TRACK_LAYER = 'spray-track'
/** The de-emphasised half of the same strokes.
 *
 *  A second layer exists ONLY because of the taper. line-gradient can read
 *  `line-progress` and nothing else — not a feature property — so a single
 *  layer cannot fade a selected track in one hue and an unselected one in
 *  grey. Splitting by filter works because the record allows it: checked
 *  against the source, 0 of 11,273 runs carry more than one agent, so every
 *  track belongs wholly to one side of the split and none has to be half
 *  tinted and half grey. */
export const TRACK_DIM_LAYER = 'spray-track-dim'
/** Segments of runs with no recorded volume — the same fact the hollow rings
 *  carry on the dot map, in the grammar of a line. */
export const TRACK_NIL_LAYER = 'spray-track-nil'
/** Runs recorded at a single grid reference: no line exists to draw. */
export const TRACK_MARK_LAYER = 'spray-track-mark'
/** The ends of each track.
 *
 *  Cosmetic and deliberate: butt-capped lines end in a hard rectangle, and
 *  8,753 of them at 50% alpha read as scratches on the paper rather than as
 *  flight. Round caps fix the end itself; a dot at each end gives the stroke
 *  somewhere to resolve, the way a route diagram does. */
export const TRACK_END_LAYER = 'spray-track-end'

/** Zoom anchors for the width ramp. One span, because there is one tier. */
const Z_TOP = 11

/** Per-anchor width: k·gallons-per-km, capped in px. */
export interface TrackRamp {
  k: number
  cap: number
}

/**
 * Everything that decides what a track LOOKS like, in one table.
 *
 * Same shape and same reason as DOTS in volumeGrid: a console cannot offer a
 * full set of controls over values it has to go and find, and two copies of a
 * number are how a panel starts describing a map we do not have.
 */
export interface TrackStyle {
  /** Width in px at the far and near zoom anchors.
   *
   *  Set against the real distribution of gallons per km — p25 36, p50 162,
   *  p75 288, p90 442, p99 1143, max 9074 — so the median segment is 0.8 px
   *  with the record on screen and 3 px at the ceiling, and the cap bites
   *  above ~760 gal/km, which is 2.7% of segments. Without a cap the top of
   *  the tail is 56 px and stops being a line at all. */
  far: TrackRamp
  near: TrackRamp
  opacity: number
  /** Feathering in PX, unlike circle-blur's fraction-of-radius. */
  blur: number
  /** Round caps stop 8,753 strokes reading as scratches. `butt` is here to
   *  make that comparison, not because it is a real option. */
  cap: 'round' | 'butt'
  /** The endpoint beads. OFF by default, and the reason is worth keeping.
   *
   *  head and tail are multiples of the line's own half-width, so at 1.0 a bead
   *  is exactly the round cap the stroke already draws. The idea was that
   *  making head bigger than tail turns every track into an arrow without
   *  drawing an arrowhead.
   *
   *  It cannot work, and matching the alpha — the `fuse` attempt below — made
   *  it worse rather than better. A circle layer and a line layer composite
   *  independently: ink laid at alpha a, twice, reads 1 − (1 − a)², so a bead
   *  at the stroke's own 0.5 over a stroke at 0.5 reads 0.75. Fusing the alpha
   *  is precisely what guarantees the end is 50% darker than the line running
   *  out of it. There is no group opacity in WebGL to fix this with.
   *
   *  Then the record makes it worse again. HERBS grid references are quantised,
   *  so runs share start waypoints: measured over Đồng Xoài at z9.7, 3,084
   *  beads land in 2,262 four-pixel bins and the busiest holds 33 of them —
   *  1 − 0.5³³, an opaque disc, while the strokes leaving it fan apart at 0.5.
   *  That is the "dots on a map of lines" this map kept showing, and it gets
   *  worse as you zoom OUT, because zooming out packs more shared waypoints
   *  into one pixel while the bead radius barely changes. Hence a fault that
   *  appeared across one small zoom step.
   *
   *  Shrinking the bead does not fix it: at head 1.25 the discs are still
   *  solid, because the defect is the compositing, not the radius. Below 1.0 a
   *  bead is invisible — it is inside the cap — so the honest range is a
   *  choice between "no direction cue" and "a disc". The taper is neither: it
   *  lives in the line's own paint and so composites exactly as the line does.
   *
   *  Left in the panel because seeing the bad option is how the panel earns
   *  its keep, and because at head ≤ 1.0 it is harmless.
   *
   *  What the direction MEANS is worth being careful about either way: head is
   *  leg 1A, the run's first row and the one the gallons are booked against.
   *  The record gives no flight bearing, so this is "first waypoint on file",
   *  not "verified direction of travel". */
  ends: {
    head: number
    tail: number
    opacity: number
    blur: number
    shown: boolean
    /** Give the bead the stroke's alpha and a matched feather.
     *
     *  Kept as a switch because it is the comparison that shows why beads lose:
     *  off, the bead is a different red (0.6 vs 0.5) and reads as a separate
     *  object; on, it is the same red laid twice and reads as a darker object.
     *  The feather can only be matched at ONE size — line-blur is in px and
     *  circle-blur is a fraction of the radius — so it is matched at the median
     *  segment, which is where most of the map lives. */
    fuse: boolean
  }
  /** The dashed track of a run with no recorded volume. */
  nil: { width: number; opacity: number; dash: [number, number]; shown: boolean }
  /** Runs recorded at a single grid reference — a point, drawn as one. */
  marks: { kFar: number; kNear: number; cap: number; shown: boolean }
  /** Fade along the stroke, head to tail. 0 = flat, 1 = tail fully transparent.
   *
   *  The direction cue this map actually ships, and the only one that can be:
   *  it is a property of the line's own paint, so it composites exactly as the
   *  line does and can never separate from it the way a bead does. It also
   *  carries direction along the whole length rather than marking two points,
   *  so a run reads as having been FLOWN instead of as a segment with
   *  different-sized ends.
   *
   *  It costs a layer. MapLibre's line-gradient can only read `line-progress`,
   *  never a feature property, so the tinted and the greyed strokes cannot
   *  share one layer once either of them is a gradient. See TRACK_DIM_LAYER. */
  taper: number
}

/** Shipped track appearance. Mutable ONLY through `setTracks`. */
export const TRACKS: TrackStyle = {
  far: { k: 0.8 / 162, cap: 4 },
  near: { k: 3 / 162, cap: 14 },
  opacity: 0.5,
  blur: 0.4,
  cap: 'round',
  // head/tail sit at 0.75 — INSIDE the round cap — so that turning the beads
  // on from the panel shows what they do without putting the discs back.
  ends: { head: 0.75, tail: 0.75, opacity: 0.6, blur: 0.3, shown: false, fuse: true },
  nil: { width: 0.6, opacity: 0.35, dash: [2, 2], shown: true },
  marks: { kFar: 0.02, kNear: 0.09, cap: 14, shown: true },
  // Strong enough to read at a glance on a 155 px median stroke, short of 1.0
  // so the tail still records that the aircraft was there.
  taper: 0.7,
}

/** The last selection applied, so applyTracks can rebuild a gradient without
 *  the caller having to hand it the colours again. Module state rather than a
 *  parameter because the console changes the taper and the agent chips change
 *  the selection, and either one has to be able to redraw the other's work. */
let paintState = { tint: '#ff5449', dim: '#bdbdbd', indices: null as number[] | null }

/** #rrggbb → rgba(), for the gradient stops. MapLibre needs a colour string
 *  with the alpha baked in; line-opacity multiplies on top of it. */
function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Full at the head, faded to (1 − taper) at the tail. */
function gradient(colour: string): maplibregl.ExpressionSpecification {
  return [
    'interpolate', ['linear'], ['line-progress'],
    0, rgba(colour, 1),
    1, rgba(colour, Math.max(0, 1 - TRACKS.taper)),
  ] as unknown as maplibregl.ExpressionSpecification
}

/** Console hook. Merges in place so TRACKS stays one object; the nested
 *  groups are deep-copied for the same aliasing reason as setDots. */
export function setTracks(next: Partial<TrackStyle>) {
  Object.assign(TRACKS, next)
  if (next.far) TRACKS.far = { ...next.far }
  if (next.near) TRACKS.near = { ...next.near }
  if (next.ends) TRACKS.ends = { ...next.ends }
  if (next.nil) TRACKS.nil = { ...next.nil, dash: [next.nil.dash[0], next.nil.dash[1]] }
  if (next.marks) TRACKS.marks = { ...next.marks }
}

const dayFilter = (day: number) =>
  ['<=', ['get', 'day'], day] as unknown as maplibregl.FilterSpecification
const sprayed = (day: number) =>
  ['all', ['<=', ['get', 'day'], day], ['>', ['get', 'gpk'], 0]] as unknown as maplibregl.FilterSpecification
const unsprayed = (day: number) =>
  ['all', ['<=', ['get', 'day'], day], ['==', ['get', 'gpk'], 0]] as unknown as maplibregl.FilterSpecification

/** min(k·gpk, cap) at each zoom anchor. The zoom interpolate has to be the
 *  outermost expression, so the cap goes inside each stop — the same shape as
 *  the dots' radius ramp, for the same MapLibre reason. */
function widthRamp(): maplibregl.ExpressionSpecification {
  const at = (w: TrackRamp) => ['min', ['*', w.k, ['get', 'gpk']], w.cap]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(TRACKS.far),
    Z_TOP, at(TRACKS.near),
  ] as unknown as maplibregl.ExpressionSpecification
}

/** Endpoint radius: half the line's own width at this zoom, times head or tail.
 *
 *  Derived from the same numbers as the stroke rather than typed again, so a
 *  wider line always gets a proportionate bead. The head/tail choice goes
 *  INSIDE each zoom stop, because MapLibre needs the zoom interpolate to be
 *  the outermost expression — the same constraint the dot radius ramp has. */
function endRamp(): maplibregl.ExpressionSpecification {
  const at = (w: TrackRamp) => [
    '*',
    0.5,
    ['min', ['*', w.k, ['get', 'gpk']], w.cap],
    ['case', ['==', ['get', 'end'], 0], TRACKS.ends.head, TRACKS.ends.tail],
  ]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(TRACKS.far),
    Z_TOP, at(TRACKS.near),
  ] as unknown as maplibregl.ExpressionSpecification
}

/** Bead feather for ANY track table, matched to that table's line.
 *
 *  line-blur is PX; circle-blur is a FRACTION of the radius. There is no value
 *  that matches them at every size, so this matches them at the median segment
 *  (162 gal/km) at the near anchor — where most of the map is. Away from the
 *  median the two edges differ slightly, which is a real limit of the two
 *  properties and not something a better number fixes.
 *
 *  Takes the table as an argument so the console can SHOW the derived number in
 *  the box it has disabled without computing it a second time. A panel that
 *  re-derives a value is a panel that can disagree with the map. */
export function beadFeather(t: TrackStyle): number {
  if (!t.ends.fuse) return t.ends.blur
  const medianHalfWidth = Math.min(t.near.k * 162, t.near.cap) / 2
  const r = Math.max(0.5, medianHalfWidth * t.ends.head)
  return Math.min(1, t.blur / r)
}

/** Bead alpha: the stroke's own when fused, so the two are one ink. */
export function beadOpacity(): number {
  return TRACKS.ends.fuse ? TRACKS.opacity : TRACKS.ends.opacity
}

export function beadBlur(): number {
  return beadFeather(TRACKS)
}

/** Single-point runs: k·√gallons, the dot map's own encoding, because a run
 *  recorded at one grid reference IS a point. */
function markRamp(): maplibregl.ExpressionSpecification {
  const m = TRACKS.marks
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, ['min', ['*', m.kFar, ['sqrt', ['get', 'gallons']]], m.cap],
    Z_TOP, ['min', ['*', m.kNear, ['sqrt', ['get', 'gallons']]], m.cap],
  ] as unknown as maplibregl.ExpressionSpecification
}

/** Push the current TRACKS onto a live map — one function that knows how a
 *  track parameter reaches the screen, called at creation and by the console. */
export function applyTracks(map: maplibregl.Map) {
  // The taper decides whether colour comes from line-color or line-gradient,
  // so any change to TRACKS has to re-run the colour pass.
  applyTrackColour(map)
  const vis = (id: string, on: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
  for (const id of [TRACK_LAYER, TRACK_DIM_LAYER]) {
    if (!map.getLayer(id)) continue
    map.setPaintProperty(id, 'line-width', widthRamp() as never)
    map.setPaintProperty(id, 'line-opacity', TRACKS.opacity)
    map.setPaintProperty(id, 'line-blur', TRACKS.blur)
    map.setLayoutProperty(id, 'line-cap', TRACKS.cap)
  }
  if (map.getLayer(TRACK_END_LAYER)) {
    map.setPaintProperty(TRACK_END_LAYER, 'circle-radius', endRamp() as never)
    map.setPaintProperty(TRACK_END_LAYER, 'circle-opacity', beadOpacity())
    map.setPaintProperty(TRACK_END_LAYER, 'circle-blur', beadBlur())
    vis(TRACK_END_LAYER, TRACKS.ends.shown)
  }
  if (map.getLayer(TRACK_NIL_LAYER)) {
    map.setPaintProperty(TRACK_NIL_LAYER, 'line-width', TRACKS.nil.width)
    map.setPaintProperty(TRACK_NIL_LAYER, 'line-opacity', TRACKS.nil.opacity)
    map.setPaintProperty(TRACK_NIL_LAYER, 'line-dasharray', TRACKS.nil.dash as never)
    vis(TRACK_NIL_LAYER, TRACKS.nil.shown)
  }
  if (map.getLayer(TRACK_MARK_LAYER)) {
    map.setPaintProperty(TRACK_MARK_LAYER, 'circle-radius', markRamp() as never)
    map.setPaintProperty(TRACK_MARK_LAYER, 'circle-opacity', TRACKS.opacity)
    vis(TRACK_MARK_LAYER, TRACKS.marks.shown)
  }
}

/** Add the track layers under the basemap's labels. Returns the bottom
 *  layer id, matching addVolumeLayers' contract. */
export function addTrackLayers(
  map: maplibregl.Map,
  data: TrackDataset,
  day: number,
  tint: string,
): string {
  lastDay = day
  paintState = { ...paintState, tint }
  const labelId = firstLabelLayerId(map)
  // lineMetrics is what makes `line-progress` — and so the taper — possible.
  // It costs a per-feature length pass at load and nothing after.
  map.addSource(TRACK_SOURCE, { type: 'geojson', data: data.lines, lineMetrics: true })
  map.addSource(TRACK_MARK_SOURCE, { type: 'geojson', data: data.marks })
  map.addSource(TRACK_END_SOURCE, { type: 'geojson', data: data.ends })

  // Unsprayed tracks first, so a real spray line always draws over the record
  // of a pass that carried nothing.
  map.addLayer(
    {
      id: TRACK_NIL_LAYER,
      type: 'line',
      source: TRACK_SOURCE,
      // The near band only — the grids above it are dots, binned from these
      // same lines by trackGrid.
      minzoom: Z_NEAR,
      filter: unsprayed(day),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': TRACKS.nil.width,
        'line-opacity': TRACKS.nil.opacity,
        // Dashed for the same reason the zero-volume dots are hollow: it is a
        // different KIND of mark, not a thinner amount of the same one.
        'line-dasharray': TRACKS.nil.dash,
      },
    },
    labelId,
  )

  // The de-emphasised twin, added under the tinted one so a selected track
  // always draws over a greyed neighbour. Its filter matches nothing until an
  // agent is isolated.
  map.addLayer(
    {
      id: TRACK_DIM_LAYER,
      type: 'line',
      source: TRACK_SOURCE,
      minzoom: Z_NEAR,
      filter: ['all', sprayed(day), ['==', ['literal', true], false]] as unknown as maplibregl.FilterSpecification,
      layout: { 'line-cap': TRACKS.cap, 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': widthRamp(),
        'line-opacity': TRACKS.opacity,
        'line-blur': TRACKS.blur,
      },
    },
    labelId,
  )

  map.addLayer(
    {
      id: TRACK_LAYER,
      type: 'line',
      source: TRACK_SOURCE,
      // The near band only — the grids above it are dots, binned from these
      // same lines by trackGrid.
      minzoom: Z_NEAR,
      filter: sprayed(day),
      layout: { 'line-cap': TRACKS.cap, 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': widthRamp(),
        'line-opacity': TRACKS.opacity,
        'line-blur': TRACKS.blur,
      },
    },
    labelId,
  )

  map.addLayer(
    {
      id: TRACK_MARK_LAYER,
      type: 'circle',
      source: TRACK_MARK_SOURCE,
      minzoom: Z_NEAR,
      filter: dayFilter(day),
      paint: {
        'circle-color': tint,
        'circle-opacity': TRACKS.opacity,
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-radius': markRamp(),
      },
    },
    labelId,
  )
  // Endpoint caps last, so they sit on top of the stroke they belong to.
  map.addLayer(
    {
      id: TRACK_END_LAYER,
      type: 'circle',
      source: TRACK_END_SOURCE,
      minzoom: Z_NEAR,
      filter: sprayed(day),
      paint: {
        'circle-color': tint,
        'circle-opacity': beadOpacity(),
        'circle-blur': beadBlur(),
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-radius': endRamp(),
      },
    },
    labelId,
  )
  // The layers above are added with the paint they need to EXIST; applyTracks
  // is what makes them match TRACKS. Running it here rather than leaving it to
  // the caller is not tidiness — without it every field applyTracks alone owns
  // is dead on the shipped path, because MapView never calls it and only the
  // console does. `ends.shown`, `nil.shown` and `marks.shown` were exactly
  // that: setting `shown: false` turned nothing off, and 3,075 beads went on
  // drawing at z9.7 with the flag reading `false` in the table. Correct code
  // that never runs, again.
  //
  // It also gets the taper onto the first frame. applyTracks starts with
  // applyTrackColour, which is the only thing that installs a line-gradient;
  // before this, a tapered map painted flat until the reader happened to move
  // the playhead and setTrackTime ran.
  applyTracks(map)
  return TRACK_NIL_LAYER
}

/** Advance the playhead. Cheap — a filter change, no re-tessellation of the
 *  geometry, which is the one thing the grid tiers could never avoid. */
/** The playhead, remembered so the colour pass can rebuild a filter without
 *  being handed the day again — every sprayed filter is `day AND selection`,
 *  and the two are set from different places. */
let lastDay = 0

export function setTrackTime(map: maplibregl.Map, day: number) {
  lastDay = day
  if (map.getLayer(TRACK_NIL_LAYER)) map.setFilter(TRACK_NIL_LAYER, unsprayed(day))
  if (map.getLayer(TRACK_END_LAYER)) map.setFilter(TRACK_END_LAYER, sprayed(day))
  if (map.getLayer(TRACK_MARK_LAYER)) map.setFilter(TRACK_MARK_LAYER, dayFilter(day))
  // The two sprayed LINE layers are not touched here. Their filter is
  // `day AND selection` and the selection half lives in applyTrackColour, so
  // setting it from two places is how one of them silently wins — the taper
  // split survived only because MapView happened to call the other one next.
  applyTrackColour(map)
}

/** Isolate an agent: the selection takes the agent's hue, the rest go grey, and
 *  with nothing isolated the whole record is one colour. Same rule as
 *  updateVolume, deliberately — two encodings of one record that disagree
 *  about what a colour means are worse than either alone.
 *
 *  A paint expression rather than a stamped property, because unlike the grid
 *  tiers there is nothing here to re-bin. */
export function setTrackAgents(
  map: maplibregl.Map,
  indices: number[] | null,
  tint: string,
  dim: string,
) {
  paintState = { tint, dim, indices }
  applyTrackColour(map)
}

/** Colour and split the two sprayed layers from `paintState` + TRACKS.taper.
 *
 *  With no taper this is one layer doing a `case` on the agent, exactly as
 *  before. With a taper the split has to be a FILTER, because a gradient reads
 *  `line-progress` and cannot see which agent a stroke belongs to — so the
 *  selected strokes go in one layer with the tint's gradient and the rest in
 *  the twin with grey's. Both paths end with the same picture; only the taper
 *  needs the second layer, so only the taper pays for it. */
function applyTrackColour(map: maplibregl.Map) {
  const { tint, dim, indices } = paintState
  const inSel = ['in', ['get', 'agent'], ['literal', indices ?? []]]
  const day = lastDay
  const both = (l: maplibregl.FilterSpecification, r: unknown) =>
    ['all', l, r] as unknown as maplibregl.FilterSpecification

  const has = (id: string) => map.getLayer(id) != null
  if (TRACKS.taper > 0) {
    // Split by filter. `line-color` is deliberately left alone: MapLibre gives
    // line-gradient precedence over it, checked on the canvas — the layer still
    // reports line-color '#ff5449' while painting the gradient. Clearing it
    // would be worse than useless, because `undefined` resets the property to
    // its spec default of BLACK, so any path where the gradient failed to
    // install would paint the record in black rather than fall back to the
    // tint. (An earlier comment here claimed the opposite. It was wrong.)
    if (has(TRACK_LAYER)) {
      map.setFilter(TRACK_LAYER, indices ? both(sprayed(day), inSel) : sprayed(day))
      map.setPaintProperty(TRACK_LAYER, 'line-gradient', gradient(tint) as never)
    }
    if (has(TRACK_DIM_LAYER)) {
      map.setFilter(
        TRACK_DIM_LAYER,
        indices ? both(sprayed(day), ['!', inSel]) : both(sprayed(day), ['==', ['literal', true], false]),
      )
      map.setPaintProperty(TRACK_DIM_LAYER, 'line-gradient', gradient(dim) as never)
    }
  } else {
    const colour = indices
      ? (['case', inSel, tint, dim] as never)
      : (tint as never)
    if (has(TRACK_LAYER)) {
      map.setPaintProperty(TRACK_LAYER, 'line-gradient', undefined as never)
      map.setFilter(TRACK_LAYER, sprayed(day))
      map.setPaintProperty(TRACK_LAYER, 'line-color', colour)
    }
    // The twin goes empty rather than hidden: an empty filter costs nothing
    // and leaves the layer ready for the next taper without a re-add.
    if (has(TRACK_DIM_LAYER)) {
      map.setFilter(TRACK_DIM_LAYER, both(sprayed(day), ['==', ['literal', true], false]))
    }
  }
  const colour = indices
    ? (['case', inSel, tint, dim] as never)
    : (tint as never)
  if (has(TRACK_NIL_LAYER)) map.setPaintProperty(TRACK_NIL_LAYER, 'line-color', colour)
  for (const id of [TRACK_MARK_LAYER, TRACK_END_LAYER]) {
    if (has(id)) map.setPaintProperty(id, 'circle-color', colour)
  }
}

/** Hide the dot tiers when the tracks are on, and vice versa. Kept here so the
 *  spike owns its own on/off rather than threading a flag through MapView. */
export function setLayersVisible(map: maplibregl.Map, ids: string[], on: boolean) {
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}
