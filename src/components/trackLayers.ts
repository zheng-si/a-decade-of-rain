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
/** The one run under the pointer, redrawn opaque and a little wider.
 *
 *  A layer rather than a feature-state expression on the stroke itself, because
 *  applyTracks writes `line-opacity` and `line-width` on TRACK_LAYER as plain
 *  numbers every time the console moves a slider — a `case` on hover would be
 *  overwritten by the next apply, which is the same "two owners for one fact"
 *  that has bitten this file before. Here the highlight owns its own paint and
 *  nothing else writes it.
 *
 *  It filters on the feature id, so the whole run lights up even when the tile
 *  boundary has cut it into pieces — hovering the middle of an 11 km line
 *  should not highlight 3 km of it. */
export const TRACK_HI_LAYER = 'spray-track-hi'
/** The point form of the highlight — see TRACK_HI_LAYER's filter. */
export const TRACK_HI_MARK_LAYER = 'spray-track-hi-mark'
/** The hovered run's own source, holding at most one feature.
 *
 *  It began as a filter on the record's own source, which is the obvious way
 *  and cost the earth: `setFilter` marks the SOURCE for reload, so every
 *  mousemove that changed the hovered run re-parsed 8,753 lines, recomputed
 *  their line metrics, and — because the two sprayed layers carry a
 *  `line-gradient` for the taper — re-rendered a 256-step colour ramp for every
 *  tile. Profiled, that made hovering as expensive as playback.
 *
 *  A source with one line in it parses in microseconds no matter how large the
 *  record is. `lineMetrics` is off because the highlight is flat colour: it has
 *  no taper to read `line-progress` for. */
export const TRACK_HI_SOURCE = 'spray-track-hi-src'
/** The ends of each track.
 *
 *  Cosmetic and deliberate: butt-capped lines end in a hard rectangle, and
 *  8,753 of them at 50% alpha read as scratches on the paper rather than as
 *  flight. Round caps fix the end itself; a dot at each end gives the stroke
 *  somewhere to resolve, the way a route diagram does. */
export const TRACK_END_LAYER = 'spray-track-end'
/** The runs ARRIVING at the current playback step, drawn on stroke by stroke.
 *
 *  Its own source, and that is the whole design. A wipe is a gradient, a
 *  gradient has to be rewritten every frame, and every style write against a
 *  source costs in proportion to that source: `spray-tracks` carries 8,753
 *  lines with lineMetrics, so animating it directly would re-tessellate the
 *  record sixty times a second. This source holds only the runs of one step —
 *  8,753 over ~304 steps, so a few dozen — and is replaced once per step
 *  instead. The per-frame write lands on the small one. */
export const TRACK_DRAW_SOURCE = 'spray-track-draw'
export const TRACK_DRAW_LAYER = 'spray-track-draw'

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
  /** Draw each arriving run on, stroke by stroke, while the record plays.
   *
   *  `from` is which end the stroke grows FROM. 'tail' means it grows towards
   *  the head — towards leg 1A, the waypoint the gallons are booked against —
   *  which with a taper reads as a brush loading as it lands. 'head' is the
   *  other reading: the aircraft leaving its first waypoint and running out.
   *  Neither is a claim about heading; the record carries none.
   *
   *  There is no duration. The wipe is driven by where the playhead sits inside
   *  its own filter step, so a run draws on over exactly one step and the
   *  animation cannot fall behind playback however fast the record is played.
   *  A fixed duration would need a queue the moment the two disagreed. */
  draw: { shown: boolean; from: 'tail' | 'head' }
}

/** The zoom the tracks take over at.
 *
 *  Deliberately NOT a field of TRACKS. It is not an appearance value — it is
 *  one half of the hand-off, and the other half is the fine grid's maxzoom over
 *  in volumeGrid. Whoever sets it has to set both or the map gets a band with
 *  dots and tracks together, or a band with neither. Keeping it out of the
 *  style table stops it being tuned from the TRACKS panel as if it were a look.
 *
 *  Seeded from Z_NEAR so nothing moves unless something moves it. */
let trackStart: number = Z_NEAR

/** Move the hand-off. Callers must move the grid tiers to match — see the
 *  ZOOM tab, which is the one place that owns both sides. */
export function setTrackStart(z: number) {
  trackStart = z
}

/** Shipped track appearance. Mutable ONLY through `setTracks`. */
export const TRACKS: TrackStyle = {
  far: { k: 0.8 / 162, cap: 4 },
  near: { k: 3 / 162, cap: 14 },
  opacity: 0.8,
  blur: 1.5,
  cap: 'round',
  // head/tail sit at 0.75 — INSIDE the round cap — so that turning the beads
  // on from the panel shows what they do without putting the discs back.
  ends: { head: 0.75, tail: 0.75, opacity: 0.6, blur: 0.3, shown: false, fuse: true },
  nil: { width: 0.6, opacity: 0.35, dash: [2, 2], shown: false },
  marks: { kFar: 0.02, kNear: 0.09, cap: 14, shown: true },
  // Strong enough to read at a glance on a 155 px median stroke, short of 1.0
  // so the tail still records that the aircraft was there.
  taper: 0.7,
  draw: { shown: true, from: 'tail' },
}

/** The last selection applied, so applyTracks can rebuild a gradient without
 *  the caller having to hand it the colours again. Module state rather than a
 *  parameter because the console changes the taper and the agent chips change
 *  the selection, and either one has to be able to redraw the other's work. */
let paintState = {
  tint: '#ff5449',
  dim: '#c9cdc4',
  indices: null as number[] | null,
  /** The agent groups' own colours, indexed by `gi`. Needed as a LIST rather
   *  than read per feature because the taper is a `line-gradient`, and a
   *  gradient reads `line-progress` only — it cannot see which agent a stroke
   *  belongs to. One layer per colour is the only way to have both. */
  palette: [] as string[],
}

/** One sprayed-track layer per agent group, for the state where every run
 *  keeps its own colour. They stand empty whenever an agent is isolated: there
 *  the question is "this agent against the rest", and two colours answer it. */
export const TRACK_HUE_LAYERS = ['spray-track-h0', 'spray-track-h1', 'spray-track-h2', 'spray-track-h3']

/** The drawing layer's own twins, one per agent.
 *
 *  Same constraint that forced TRACK_HUE_LAYERS to exist, one layer further
 *  in: the wipe is a `line-gradient`, a gradient reads `line-progress` and
 *  cannot see which agent a stroke belongs to, so a single drawing layer can
 *  only be ONE colour. That colour was `paintState.tint` — which, with nothing
 *  isolated, is the brand red this map stopped using when the colour channel
 *  was given to the agent. Every run therefore wiped in red before settling
 *  into its own hue, and late in a play-through, with steps arriving on top of
 *  a dense field, the red is most of what is on screen. */
export const TRACK_DRAW_HUE_LAYERS = [
  'spray-track-draw-h0',
  'spray-track-draw-h1',
  'spray-track-draw-h2',
  'spray-track-draw-h3',
]

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

/** The record's fade, for strokes drawn on somebody else's layer.
 *
 *  The Location Lookup redraws its hit runs on its own layers, and the key
 *  three inches away says "Each run fades away from its first waypoint on
 *  file". Left to build its own fade, the circle would be the one place on the
 *  map where that sentence is a second implementation — which is how the width
 *  ramp went wrong before it was taken from the stroke layer itself. Null when
 *  there is no taper to draw, and the caller paints flat.
 *
 *  Deliberately NOT gated on `taperLive`. That suspension exists because
 *  11,273 strokes regenerate a 256-step ramp per tile on every playhead step;
 *  a lookup's hits are tens of runs inside one circle, which is not the same
 *  bill. */
export function taperGradient(colour: string): maplibregl.ExpressionSpecification | null {
  return TRACKS.taper > 0 ? gradient(colour) : null
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
  if (next.draw) TRACKS.draw = { ...next.draw }
}

/** The taper's own alpha at a point along the stroke. */
const taperAt = (t: number) => Math.max(0, 1 - TRACKS.taper * t)

/**
 * The wipe: the taper, with everything past the drawing front cut away.
 *
 * `q` runs 0 → 1 across one playback step. line-progress is 0 at the head (leg
 * 1A) and 1 at the tail, so growing FROM the tail means the visible window is
 * [1 − q, 1] and growing from the head means [0, q].
 *
 * The front is a hard edge one thousandth of the length wide rather than a
 * feathered one, because a soft front over a taper reads as a second gradient
 * and the stroke stops having a tip. Stops must be strictly increasing, which
 * is the only reason for the clamping here.
 */
function wipe(colour: string, q: number): maplibregl.ExpressionSpecification {
  const c = (t: number, a: number) => rgba(colour, taperAt(t) * a)
  const e = 0.001
  // Clamped to [2e, 1−2e], not [e, 1−e]: the front contributes a stop at p−e
  // (or p+e), and at the tighter clamp that stop lands exactly on the 0 or 1
  // endpoint. MapLibre requires interpolate inputs to be STRICTLY ascending and
  // rejects the whole expression on a tie — every frame, silently, leaving the
  // layer on its last valid gradient.
  const p = Math.min(1 - 2 * e, Math.max(2 * e, TRACKS.draw.from === 'tail' ? 1 - q : q))
  const stops: [number, string][] =
    TRACKS.draw.from === 'tail'
      ? [[0, c(0, 0)], [p - e, c(p, 0)], [p, c(p, 1)], [1, c(1, 1)]]
      : [[0, c(0, 1)], [p, c(p, 1)], [p + e, c(p, 0)], [1, c(1, 0)]]
  return [
    'interpolate', ['linear'], ['line-progress'],
    ...stops.flat(),
  ] as unknown as maplibregl.ExpressionSpecification
}

/** Hand the draw layer the runs arriving at this step. Called ONCE per step. */
/** Whether the drawing source is already empty.
 *
 *  The day effect clears it on EVERY step that is not a playing step — every
 *  scrub, every agent switch, every zoom that re-runs the effect — and clearing
 *  an already-empty source is still a full setData: a structured-clone to the
 *  worker, a re-parse, a tile rebuild, all to arrive at the same nothing. */
let drawEmpty = true

/** Which agent groups the arriving step actually contains.
 *
 *  setDrawProgress runs every animation frame, so writing all four twins'
 *  gradients per frame would quadruple the one write the single layer used to
 *  cost. A step usually holds one or two agents, so only those are written and
 *  the common case is no dearer than before. */
let drawGis: number[] = []

export function setTrackDraw(map: maplibregl.Map, data: GeoJSON.FeatureCollection) {
  const empty = data.features.length === 0
  if (empty && drawEmpty) return
  const src = map.getSource(TRACK_DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(data)
  drawEmpty = empty
  const seen = new Set<number>()
  for (const f of data.features) {
    const gi = (f.properties as { gi?: number } | null)?.gi
    if (typeof gi === 'number') seen.add(gi)
  }
  drawGis = [...seen]
}

/** Advance the drawing front. Called every frame — on the SMALL source. */
export function setDrawProgress(map: maplibregl.Map, q: number) {
  // With nothing isolated the twins carry it, each in its own agent's colour.
  if (drawHueLive) {
    for (const gi of drawGis) {
      const id = TRACK_DRAW_HUE_LAYERS[gi]
      const c = paintState.palette[gi]
      if (c && map.getLayer(id)) map.setPaintProperty(id, 'line-gradient', wipe(c, q) as never)
    }
    return
  }
  if (!map.getLayer(TRACK_DRAW_LAYER)) return
  // An agent IS isolated, so the tint is that agent's own colour and one layer
  // is the right answer.
  map.setPaintProperty(TRACK_DRAW_LAYER, 'line-gradient', wipe(paintState.tint, q) as never)
}

/** Show or hide the drawing layer without touching the record's own source. */
/** Whether the drawing twins are the ones carrying the arriving step, and
 *  whether MapView wants the drawing layer on at all. Two facts set from two
 *  places — the colour pass and the playback loop — that together decide one
 *  visibility, so they are applied through one function. */
let drawHueLive = false
let drawShown = false

function applyDrawVisibility(map: maplibregl.Map) {
  const show = drawShown && TRACKS.draw.shown
  for (let gi = 0; gi < TRACK_DRAW_HUE_LAYERS.length; gi++) {
    const id = TRACK_DRAW_HUE_LAYERS[gi]
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', show && drawHueLive ? 'visible' : 'none')
    }
  }
  if (map.getLayer(TRACK_DRAW_LAYER)) {
    map.setLayoutProperty(TRACK_DRAW_LAYER, 'visibility', show && !drawHueLive ? 'visible' : 'none')
  }
}

export function setDrawVisible(map: maplibregl.Map, on: boolean) {
  drawShown = on
  applyDrawVisibility(map)
}

// ── the playhead is PAINT, not a filter ───────────────────────────────────
//
// It used to be a filter, which is the obvious way to write it and the
// expensive one. MapLibre routes every `setFilter` through `Style._updateLayer`,
// which marks the layer's whole SOURCE for reload: each visible tile goes back
// to the worker, re-parses its share of the 8,753 lines, recomputes the line
// metrics the taper needs, rebuilds its buckets and re-uploads them. Measured on
// the running page, six seconds of playback issued 203 filter writes — roughly
// eleven playhead steps a second, each one tearing down and rebuilding the
// geometry of a source whose geometry never changes.
//
// A run's day never changes either, so the playhead is not a question about
// which features exist. It is a question about which ones are VISIBLE, and that
// is a paint property: `line-opacity` gates on `['<=', day, playhead]` and
// MapLibre re-evaluates the paint arrays over buckets it already has. No worker
// round trip, no re-tessellation.
//
// What stays a filter is what genuinely partitions the record into two layers
// drawn differently: volume vs no volume, and selected agent vs the rest. Those
// change when the reader acts, not eleven times a second.
//
// The cost is that features past the playhead are still in the buffers and
// still drawn, at alpha 0. Two consequences, both handled: fill rate (measured
// below — no regression on this machine, which is software-rendered and so the
// worst case), and `queryRenderedFeatures`, which respects filters but NOT
// opacity — so a run that has not happened yet is still pickable and MapView's
// hit test has to check the day itself.
const HAS_VOLUME = ['>', ['get', 'gpk'], 0] as const
const NO_VOLUME = ['==', ['get', 'gpk'], 0] as const
const NEVER = ['==', ['literal', true], false] as const

const all = (...parts: unknown[]) => ['all', ...parts] as unknown as maplibregl.FilterSpecification

/** `o` where the run has happened, 0 where it has not. */
const dayGate = (o: number) =>
  ['case', ['<=', ['get', 'day'], lastDay], o, 0] as unknown as maplibregl.ExpressionSpecification

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

/** The hovered run's width: the stroke's own ramp plus a constant.
 *
 *  Plus, not times. A multiplier would grow the thick runs most and leave a
 *  0.8px hairline still nearly invisible, which is backwards — the hairlines
 *  are the ones the reader most needs help finding. A flat +1.6px is the same
 *  visible gain everywhere.
 *
 *  The constant is added INSIDE each stop, not around the finished ramp.
 *  `['+', widthRamp(), 1.6]` is the shape you would write first and MapLibre
 *  rejects the whole layer for it — "zoom may only be used as input to a
 *  top-level step or interpolate" — which is the rule the comment above
 *  widthRamp already states. Written the wrong way it did not fall back to a
 *  plain width: addLayer threw, addTrackLayers never finished, and the map came
 *  up with no strokes at all. */
function hiWidthRamp(): maplibregl.ExpressionSpecification {
  const at = (w: TrackRamp) => ['+', ['min', ['*', w.k, ['get', 'gpk']], w.cap], HI_BUMP]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(TRACKS.far),
    Z_TOP, at(TRACKS.near),
  ] as unknown as maplibregl.ExpressionSpecification
}
const HI_BUMP = 1.6

/** Which run the highlight source currently holds, so an unchanged hover is
 *  not a write. A mousemove fires many times over one stroke. */
let hoverKey: number | string | null = null

/** Put the highlight on one run, or clear it. Takes the FEATURE, not an id:
 *  `queryRenderedFeatures` hands back tile-CLIPPED geometry, so highlighting
 *  what the hit test returned would light up only the piece inside one tile.
 *  The caller passes the whole run out of the loaded dataset. */
export function setTrackHover(
  map: maplibregl.Map,
  /** Identity of what is lit, for the no-op check. A number for a hovered
   *  feature; a string for a whole run opened from the lookup list, which is
   *  several features at once and has no single feature id. */
  key: number | string | null,
  features?: GeoJSON.Feature | GeoJSON.Feature[] | null,
) {
  if (key === hoverKey) return
  hoverKey = key
  const src = map.getSource(TRACK_HI_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  const list = features == null ? [] : Array.isArray(features) ? features : [features]
  src.setData({
    type: 'FeatureCollection',
    features: key != null ? list : [],
  })
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

/** The mark ramp plus a ring's worth of clearance.
 *
 *  Written as its own ramp rather than `['+', markRamp(), 2.5]`, which is what
 *  it was: a `zoom` expression may only be the input to a top-level step or
 *  interpolate, so wrapping one in an arithmetic operator makes a layer
 *  MapLibre refuses — and refuses QUIETLY, because addLayer validates, logs and
 *  returns. The layer never existed. Every Archive load logged the rejection
 *  and the 2,829 runs logged at one point highlighted nothing, hovered or
 *  opened, while line runs lit up normally. The constant goes inside each zoom
 *  stop, where it is allowed, exactly as endRamp already does with head/tail. */
function markHiRamp(): maplibregl.ExpressionSpecification {
  const m = TRACKS.marks
  const at = (k: number) => ['+', ['min', ['*', k, ['sqrt', ['get', 'gallons']]], m.cap], 2.5]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(m.kFar),
    Z_TOP, at(m.kNear),
  ] as unknown as maplibregl.ExpressionSpecification
}

/** The record's stroke and mark ramps WITH A FLOOR, for a lookup's hit runs.
 *
 *  A run with no volume booked has gpk 0, and 0 gallons per km is 0 px of
 *  stroke. In the record that is correct and invisible on purpose — the nil
 *  tier draws those runs as a dashed line when it is switched on. Inside a
 *  lookup circle there is no nil tier: the answer said "32 runs within 5 km",
 *  the By Agent bars counted 32 and the list held 32 rows, while the map drew
 *  26 — and the missing six could not be clicked either, because a stroke with
 *  no width has nothing to hit. The floor is the thinnest mark this map makes,
 *  so a no-volume run reads as the least of them rather than as nothing.
 *
 *  Exported so the lookup builds the ENCODING rather than copying a number:
 *  these read TRACKS at call time, like every other ramp here. Taking them off
 *  the track layer's live paint (which is what the lookup did) also meant a
 *  deep link — where the circle exists before spray-tracks.json lands — baked
 *  in the 2.4px fallback and never revisited it. */
export function hitWidthRamp(floor: number): maplibregl.ExpressionSpecification {
  const at = (w: TrackRamp) => ['max', ['min', ['*', w.k, ['get', 'gpk']], w.cap], floor]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(TRACKS.far),
    Z_TOP, at(TRACKS.near),
  ] as unknown as maplibregl.ExpressionSpecification
}

export function hitMarkRamp(floor: number): maplibregl.ExpressionSpecification {
  const m = TRACKS.marks
  const at = (k: number) => ['max', ['min', ['*', k, ['sqrt', ['get', 'gallons']]], m.cap], floor]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(m.kFar),
    Z_TOP, at(m.kNear),
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
  // The hand-off, pushed to all five layers from one place. They were given
  // minzoom at creation and nothing ever wrote it again, so the ZOOM tab's
  // Z_NEAR moved the grid tiers and left the tracks where they were — the
  // console could open a blank band between the two encodings and nothing said
  // so. minzoom is a layer property like any other; it belongs in the same
  // apply as the paint.
  for (const id of [TRACK_LAYER, TRACK_DIM_LAYER, TRACK_NIL_LAYER, TRACK_MARK_LAYER, TRACK_END_LAYER, TRACK_DRAW_LAYER, TRACK_HI_LAYER, TRACK_HI_MARK_LAYER, ...TRACK_HUE_LAYERS, ...TRACK_DRAW_HUE_LAYERS]) {
    if (map.getLayer(id)) map.setLayerZoomRange(id, trackStart, 24)
  }
  // The highlight is the stroke's own ramp plus a constant, so a console change
  // to the width has to reach it too — otherwise hovering would report the
  // width the map had before the slider moved.
  if (map.getLayer(TRACK_HI_LAYER)) {
    map.setPaintProperty(TRACK_HI_LAYER, 'line-width', hiWidthRamp() as never)
    map.setLayoutProperty(TRACK_HI_LAYER, 'line-cap', TRACKS.cap)
  }
  // The drawing layer shares the stroke's geometry rules, so it shares their
  // ramp — a run must not change width the moment it stops arriving. Its four
  // agent twins share them too, or a console change would move one and not the
  // others.
  for (const id of [TRACK_DRAW_LAYER, ...TRACK_DRAW_HUE_LAYERS]) {
    if (!map.getLayer(id)) continue
    map.setPaintProperty(id, 'line-width', widthRamp() as never)
    map.setPaintProperty(id, 'line-opacity', TRACKS.opacity)
    map.setPaintProperty(id, 'line-blur', TRACKS.blur)
    map.setLayoutProperty(id, 'line-cap', TRACKS.cap)
    if (!TRACKS.draw.shown) map.setLayoutProperty(id, 'visibility', 'none')
  }
  for (const id of [TRACK_LAYER, TRACK_DIM_LAYER]) {
    if (!map.getLayer(id)) continue
    map.setPaintProperty(id, 'line-width', widthRamp() as never)
    map.setPaintProperty(id, 'line-blur', TRACKS.blur)
    map.setLayoutProperty(id, 'line-cap', TRACKS.cap)
  }
  if (map.getLayer(TRACK_END_LAYER)) {
    map.setPaintProperty(TRACK_END_LAYER, 'circle-radius', endRamp() as never)
    map.setPaintProperty(TRACK_END_LAYER, 'circle-blur', beadBlur())
    vis(TRACK_END_LAYER, TRACKS.ends.shown)
  }
  if (map.getLayer(TRACK_NIL_LAYER)) {
    map.setPaintProperty(TRACK_NIL_LAYER, 'line-width', TRACKS.nil.width)
    map.setPaintProperty(TRACK_NIL_LAYER, 'line-dasharray', TRACKS.nil.dash as never)
    vis(TRACK_NIL_LAYER, TRACKS.nil.shown)
  }
  if (map.getLayer(TRACK_MARK_LAYER)) {
    map.setPaintProperty(TRACK_MARK_LAYER, 'circle-radius', markRamp() as never)
    vis(TRACK_MARK_LAYER, TRACKS.marks.shown)
  }
  // The filters are only written to layers that are ON, so a layer switched on
  // here is carrying whatever day it was hidden at. This is the counterpart of
  // that skip and has to run AFTER the vis() calls above: turn the beads on
  // from the console and they arrive filtered to the current playhead, not to
  // 1961. Cheap and console-only — nothing on the shipped path calls this
  // after load.
  setTrackTime(map, lastDay)
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
  // generateId numbers features in the order they appear in the
  // FeatureCollection, so a rendered feature's `id` IS its index in
  // `data.lines.features` — checked on the running page. That is what lets the
  // hit test hand the highlight the WHOLE run rather than the tile-clipped
  // piece queryRenderedFeatures returns.
  map.addSource(TRACK_SOURCE, {
    type: 'geojson',
    data: data.lines,
    lineMetrics: true,
    generateId: true,
  })
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
      filter: all(NO_VOLUME),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': TRACKS.nil.width,
        'line-opacity': dayGate(TRACKS.nil.opacity),
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
      filter: all(NEVER),
      layout: { 'line-cap': TRACKS.cap, 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': widthRamp(),
        'line-opacity': dayGate(TRACKS.opacity),
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
      filter: all(HAS_VOLUME),
      layout: { 'line-cap': TRACKS.cap, 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': widthRamp(),
        'line-opacity': dayGate(TRACKS.opacity),
        'line-blur': TRACKS.blur,
      },
    },
    labelId,
  )

  // The four hue twins, above the single-tint layer so that when they carry
  // the record they draw over it rather than under. Empty until applyTrackColour
  // decides the state is "all agents".
  for (let gi = 0; gi < TRACK_HUE_LAYERS.length; gi++) {
    map.addLayer(
      {
        id: TRACK_HUE_LAYERS[gi],
        type: 'line',
        source: TRACK_SOURCE,
        minzoom: Z_NEAR,
        filter: all(NEVER),
        layout: { 'line-cap': TRACKS.cap, 'line-join': 'round' },
        paint: {
          'line-color': tint,
          'line-width': widthRamp(),
          'line-opacity': dayGate(TRACKS.opacity),
          'line-blur': TRACKS.blur,
        },
      },
      labelId,
    )
  }

  map.addLayer(
    {
      id: TRACK_MARK_LAYER,
      type: 'circle',
      source: TRACK_MARK_SOURCE,
      minzoom: Z_NEAR,
      paint: {
        'circle-color': tint,
        'circle-opacity': dayGate(TRACKS.opacity),
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-radius': markRamp(),
      },
    },
    labelId,
  )
  // The arriving runs, above the settled record so a stroke being drawn reads
  // over the ones already down. Empty until playback fills it.
  map.addSource(TRACK_DRAW_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    lineMetrics: true,
  })
  map.addLayer(
    {
      id: TRACK_DRAW_LAYER,
      type: 'line',
      source: TRACK_DRAW_SOURCE,
      minzoom: Z_NEAR,
      layout: { 'line-cap': TRACKS.cap, 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-width': widthRamp(),
        'line-opacity': TRACKS.opacity,
        'line-blur': TRACKS.blur,
        'line-gradient': wipe(tint, 0),
      },
    },
    labelId,
  )
  // One per agent, on the same small source. Empty until applyTrackColour
  // decides the state is "all agents"; see TRACK_DRAW_HUE_LAYERS.
  for (let gi = 0; gi < TRACK_DRAW_HUE_LAYERS.length; gi++) {
    map.addLayer(
      {
        id: TRACK_DRAW_HUE_LAYERS[gi],
        type: 'line',
        source: TRACK_DRAW_SOURCE,
        minzoom: Z_NEAR,
        filter: all(NEVER),
        layout: { 'line-cap': TRACKS.cap, 'line-join': 'round', visibility: 'none' },
        paint: {
          'line-width': widthRamp(),
          'line-opacity': TRACKS.opacity,
          'line-blur': TRACKS.blur,
          'line-gradient': wipe(tint, 0),
        },
      },
      labelId,
    )
  }

  // Endpoint caps last, so they sit on top of the stroke they belong to.
  map.addLayer(
    {
      id: TRACK_END_LAYER,
      type: 'circle',
      source: TRACK_END_SOURCE,
      minzoom: Z_NEAR,
      filter: all(HAS_VOLUME),
      paint: {
        'circle-color': tint,
        'circle-opacity': dayGate(beadOpacity()),
        'circle-blur': beadBlur(),
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-radius': endRamp(),
      },
    },
    labelId,
  )
  // The hovered run, on top of the whole group so it is never buried under a
  // neighbour it crosses. Empty until the pointer finds one.
  map.addSource(TRACK_HI_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer(
    {
      id: TRACK_HI_LAYER,
      type: 'line',
      source: TRACK_HI_SOURCE,
      minzoom: Z_NEAR,
      // Geometry-typed, because the source now carries both: a run opened from
      // the lookup list hands over every piece of itself at once, and 2,829 of
      // the record's runs are a single grid reference with no line to draw.
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': TRACKS.cap, 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': hiWidthRamp(),
        'line-opacity': 1,
      },
    },
    labelId,
  )
  // The same highlight for the single-point runs — a ring around the mark
  // rather than a fill, so the dot's own area still reads as its volume.
  map.addLayer(
    {
      id: TRACK_HI_MARK_LAYER,
      type: 'circle',
      source: TRACK_HI_SOURCE,
      minzoom: Z_NEAR,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': markHiRamp() as never,
        'circle-stroke-color': tint,
        'circle-stroke-width': 1.75,
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
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

/** Is this layer absent or switched off?
 *
 *  A hidden layer still costs. MapLibre skips it when PAINTING, but a filter
 *  write goes through `Style._updateLayer`, which marks the whole SOURCE for
 *  reload — every tile of it re-parsed in the worker and rebuilt — whether or
 *  not anyone can see the result. Two of the five track layers ship hidden
 *  (`ends.shown: false`, `nil.shown: false`) and were being filtered on every
 *  playback step and every agent switch; the ends layer alone drags a
 *  17,506-point source through that. Measured at z9 on this machine, a filter
 *  write to the hidden ends layer costs the same ~680ms to settle as one to a
 *  layer the reader is actually looking at. */
function off(map: maplibregl.Map, id: string): boolean {
  return !map.getLayer(id) || map.getLayoutProperty(id, 'visibility') === 'none'
}

/** Push the playhead onto every track layer. Paint only — see the note above
 *  HAS_VOLUME. Skips layers that are off, because a write to a hidden layer
 *  still costs and applyTracks re-runs this whenever it turns one back on. */
function applyDayGate(map: maplibregl.Map) {
  const set = (id: string, prop: string, o: number) => {
    if (!off(map, id)) map.setPaintProperty(id, prop, dayGate(o) as never)
  }
  set(TRACK_LAYER, 'line-opacity', TRACKS.opacity)
  set(TRACK_DIM_LAYER, 'line-opacity', TRACKS.opacity)
  set(TRACK_NIL_LAYER, 'line-opacity', TRACKS.nil.opacity)
  set(TRACK_MARK_LAYER, 'circle-opacity', TRACKS.opacity)
  set(TRACK_END_LAYER, 'circle-opacity', beadOpacity())
  // AND THE FOUR HUE TWINS, which is the bug this line fixes.
  //
  // They are built with `dayGate(...)` baked in, so they looked gated and were
  // not: the gate closes over `lastDay`, and nothing ever wrote it again. The
  // playhead therefore had no effect on the layers that carry the record in
  // the state the reader spends most of their time in — settled, all agents,
  // at track zoom. Reset left the whole decade on screen, and pressing play
  // appeared to fix it only because playback suspends the taper, which hands
  // the record to TRACK_LAYER, which was gated all along.
  //
  // Only while they are the ones drawing: a paint write to a NEVER-filtered
  // layer still marks the source for reload, which is the cost `off()` guards
  // everywhere else in this function.
  if (hueLive) for (const id of TRACK_HUE_LAYERS) set(id, 'line-opacity', TRACKS.opacity)
}

export function setTrackTime(map: maplibregl.Map, day: number) {
  lastDay = day
  // It no longer calls applyTrackColour. It used to, because the sprayed
  // layers' filter was `day AND selection` and the selection half lived there —
  // so MapView calling setTrackTime and then setTrackAgents ran the whole
  // colour pass twice per step. With the day out of the filters the two have
  // nothing to share: the playhead is paint and lives here, the selection is a
  // filter and lives there.
  applyDayGate(map)
}

/** Isolate an agent: the selection takes the agent's hue and the rest go grey.
 *  With nothing isolated every run keeps its OWN agent's colour — the brand
 *  red said "sprayed", which the map already says by there being a line there
 *  at all, and spent the one channel that could have said WHAT was sprayed.
 *  Same rule as updateVolume, deliberately — two encodings of one record that
 *  disagree about what a colour means are worse than either alone.
 *
 *  A paint expression rather than a stamped property, because unlike the grid
 *  tiers there is nothing here to re-bin. */
export function setTrackAgents(
  map: maplibregl.Map,
  indices: number[] | null,
  tint: string,
  dim: string,
  palette?: string[],
) {
  // MapView calls this on every playhead step, not only when the reader picks
  // an agent — so with the day out of the filters this was still rewriting two
  // filters and two gradients eleven times a second to say the same thing. The
  // selection is the one fact this function owns; if it has not changed there
  // is nothing to push.
  const p = paintState
  const same =
    p.tint === tint &&
    p.dim === dim &&
    p.palette.join('|') === (palette ?? p.palette).join('|') &&
    (p.indices === indices ||
      (p.indices != null &&
        indices != null &&
        p.indices.length === indices.length &&
        p.indices.every((v, i) => v === indices[i])))
  if (same) return
  paintState = { tint, dim, indices, palette: palette ?? p.palette }
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
/** Whether the taper is live RIGHT NOW, as opposed to configured.
 *
 *  The taper is a `line-gradient`, and a line-gradient is a 256-step colour
 *  ramp that MapLibre renders per TILE and re-renders whenever anything about
 *  the layer changes — which, during playback, is every playhead step. Measured
 *  at z9 over Đồng Xoài: median frame 733ms with the taper against 250ms
 *  without, on the same machine and the same data. It is the single most
 *  expensive thing on this map.
 *
 *  So it is suspended while the playhead is moving and restored when it stops.
 *  The taper is something the reader studies in a settled map; during playback
 *  the strokes are arriving and the eye is on the front, not on how each run
 *  fades. Two ramp regenerations per play-through instead of eleven a second. */
let taperLive = true

/** Whether the highlight takes the LIT FEATURE'S own colour instead of the
 *  selection's tint.
 *
 *  The rule this file already states — "the highlight never changes a run's
 *  hue, only its weight" — held while the record drew every run in one tint.
 *  Inside a lookup circle it does not: the hits are drawn per agent, so a blue
 *  run lit in the brand red came out as a red stroke under a blue one, and the
 *  blue's own taper faded along it — a run that went from blue at the head to
 *  red at the tail, which is not a colour either encoding claims. Same rule,
 *  applied to what is actually on screen: the highlight reads `c` off the
 *  feature, exactly as the lookup's own layers do. */
let hiByFeature = false

/** Whether the four hue twins are the layers currently carrying the record.
 *  Owned by applyTrackColour, read by applyDayGate — see the note there. */
let hueLive = false

/** Flipped by the lookup as its circle opens and closes. */
export function setHighlightByFeature(map: maplibregl.Map, on: boolean) {
  if (hiByFeature === on) return
  hiByFeature = on
  applyTrackColour(map)
}

/** Suspend or restore the taper. One reload of the source when it flips, which
 *  is a price paid twice per play-through rather than 300 times. */
export function setTrackTaper(map: maplibregl.Map, on: boolean) {
  if (taperLive === on) return
  taperLive = on
  applyTrackColour(map)
}

function applyTrackColour(map: maplibregl.Map) {
  const { tint, dim, indices, palette } = paintState
  const inSel = ['in', ['get', 'agent'], ['literal', indices ?? []]]

  const has = (id: string) => map.getLayer(id) != null
  // With nothing isolated the colour comes off the FEATURE — `c` is stamped at
  // load, so every layer that can read a property just reads it.
  const byFeature = indices == null && palette.length > 0
  const tapering = TRACKS.taper > 0 && taperLive

  // The four hue twins carry the record only in that state, and only while
  // there is a taper to make one layer per colour necessary.
  // The drawing twins follow `byFeature` alone: the wipe is a gradient in every
  // state, so the "one layer can only be one colour" problem does not wait for
  // the settled taper the way the record's own twins do.
  drawHueLive = byFeature
  for (let gi = 0; gi < TRACK_DRAW_HUE_LAYERS.length; gi++) {
    const id = TRACK_DRAW_HUE_LAYERS[gi]
    if (!has(id)) continue
    const on = drawHueLive && !!palette[gi]
    map.setFilter(id, on ? ['==', ['get', 'gi'], gi] : all(NEVER))
    // Seeded with its own colour rather than left on the tint it was created
    // with. setDrawProgress writes only the agents present in the arriving
    // step, so a twin that has not had a step yet would otherwise be holding
    // the brand red this change exists to get rid of.
    if (on) map.setPaintProperty(id, 'line-gradient', wipe(palette[gi], 0) as never)
  }
  applyDrawVisibility(map)

  hueLive = byFeature && tapering
  for (let gi = 0; gi < TRACK_HUE_LAYERS.length; gi++) {
    const id = TRACK_HUE_LAYERS[gi]
    if (!has(id)) continue
    if (hueLive && palette[gi]) {
      map.setFilter(id, all(HAS_VOLUME, ['==', ['get', 'gi'], gi]))
      map.setPaintProperty(id, 'line-gradient', gradient(palette[gi]) as never)
      // The playhead as it stands right now. Turning a layer on is the other
      // moment its gate can be stale, and applyDayGate skips these while they
      // are off.
      map.setPaintProperty(id, 'line-opacity', dayGate(TRACKS.opacity) as never)
    } else {
      map.setFilter(id, all(NEVER))
    }
  }

  if (tapering) {
    // Split by filter. `line-color` is deliberately left alone: MapLibre gives
    // line-gradient precedence over it, checked on the canvas — the layer still
    // reports line-color '#ff5449' while painting the gradient. Clearing it
    // would be worse than useless, because `undefined` resets the property to
    // its spec default of BLACK, so any path where the gradient failed to
    // install would paint the record in black rather than fall back to the
    // tint. (An earlier comment here claimed the opposite. It was wrong.)
    if (has(TRACK_LAYER)) {
      // Stands down when the four hue layers are carrying it: one stroke drawn
      // twice is one stroke at twice the opacity, and the taper would read as
      // a heavier line rather than a fading one.
      map.setFilter(
        TRACK_LAYER,
        byFeature ? all(NEVER) : indices ? all(HAS_VOLUME, inSel) : all(HAS_VOLUME),
      )
      map.setPaintProperty(TRACK_LAYER, 'line-gradient', gradient(tint) as never)
    }
    if (has(TRACK_DIM_LAYER)) {
      map.setFilter(TRACK_DIM_LAYER, indices ? all(HAS_VOLUME, ['!', inSel]) : all(NEVER))
      map.setPaintProperty(TRACK_DIM_LAYER, 'line-gradient', gradient(dim) as never)
    }
  } else {
    const colour = (
      byFeature ? ['get', 'c'] : indices ? ['case', inSel, tint, dim] : tint
    ) as never
    if (has(TRACK_LAYER)) {
      map.setPaintProperty(TRACK_LAYER, 'line-gradient', undefined as never)
      map.setFilter(TRACK_LAYER, all(HAS_VOLUME))
      map.setPaintProperty(TRACK_LAYER, 'line-color', colour)
    }
    // The twin goes empty rather than hidden: an empty filter costs nothing
    // and leaves the layer ready for the next taper without a re-add.
    if (has(TRACK_DIM_LAYER)) {
      map.setFilter(TRACK_DIM_LAYER, all(NEVER))
    }
  }
  // Dashes, marks and endpoints are not gradients, so they take the feature's
  // own colour directly and need no twins.
  const colour = (
    byFeature ? ['get', 'c'] : indices ? ['case', inSel, tint, dim] : tint
  ) as never
  if (!off(map, TRACK_NIL_LAYER)) map.setPaintProperty(TRACK_NIL_LAYER, 'line-color', colour)
  // The same `case` the nil layer takes, so the highlight never changes a run's
  // hue — only its weight. Picking out a greyed-out run in the SELECTION's tint
  // would say it belonged to the isolated agent, which is the one thing the
  // grey exists to deny.
  const hiColour = (hiByFeature ? ['get', 'c'] : colour) as never
  if (has(TRACK_HI_LAYER)) map.setPaintProperty(TRACK_HI_LAYER, 'line-color', hiColour)
  if (has(TRACK_HI_MARK_LAYER))
    map.setPaintProperty(TRACK_HI_MARK_LAYER, 'circle-stroke-color', hiColour)
  for (const id of [TRACK_MARK_LAYER, TRACK_END_LAYER]) {
    if (!off(map, id)) map.setPaintProperty(id, 'circle-color', colour)
  }
}

/** Hide the dot tiers when the tracks are on, and vice versa. Kept here so the
 *  spike owns its own on/off rather than threading a flag through MapView. */
export function setLayersVisible(map: maplibregl.Map, ids: string[], on: boolean) {
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}
