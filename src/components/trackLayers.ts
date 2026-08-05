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
  /** The endpoint beads, and the only thing on this map that carries
   *  DIRECTION.
   *
   *  head and tail are multiples of the line's own half-width, so a bead always
   *  belongs to its stroke instead of being a fixed dot stuck on it. Making
   *  head bigger than tail turns every track into an arrow without drawing an
   *  arrowhead — the taper does the work that a glyph would, and at 8,753
   *  strokes a glyph would be unreadable anyway.
   *
   *  What the direction MEANS is worth being careful about: head is leg 1A,
   *  the run's first row and the one the gallons are booked against. The
   *  record gives no flight bearing, so this is "first waypoint on file", not
   *  "verified direction of travel". */
  ends: { head: number; tail: number; opacity: number; blur: number; shown: boolean }
  /** The dashed track of a run with no recorded volume. */
  nil: { width: number; opacity: number; dash: [number, number]; shown: boolean }
  /** Runs recorded at a single grid reference — a point, drawn as one. */
  marks: { kFar: number; kNear: number; cap: number; shown: boolean }
}

/** Shipped track appearance. Mutable ONLY through `setTracks`. */
export const TRACKS: TrackStyle = {
  far: { k: 0.8 / 162, cap: 4 },
  near: { k: 3 / 162, cap: 14 },
  opacity: 0.5,
  blur: 0.4,
  cap: 'round',
  ends: { head: 1.1, tail: 0.5, opacity: 0.6, blur: 0.3, shown: true },
  nil: { width: 0.6, opacity: 0.35, dash: [2, 2], shown: true },
  marks: { kFar: 0.02, kNear: 0.09, cap: 14, shown: true },
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
  const vis = (id: string, on: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
  if (map.getLayer(TRACK_LAYER)) {
    map.setPaintProperty(TRACK_LAYER, 'line-width', widthRamp() as never)
    map.setPaintProperty(TRACK_LAYER, 'line-opacity', TRACKS.opacity)
    map.setPaintProperty(TRACK_LAYER, 'line-blur', TRACKS.blur)
    map.setLayoutProperty(TRACK_LAYER, 'line-cap', TRACKS.cap)
  }
  if (map.getLayer(TRACK_END_LAYER)) {
    map.setPaintProperty(TRACK_END_LAYER, 'circle-radius', endRamp() as never)
    map.setPaintProperty(TRACK_END_LAYER, 'circle-opacity', TRACKS.ends.opacity)
    map.setPaintProperty(TRACK_END_LAYER, 'circle-blur', TRACKS.ends.blur)
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
  const labelId = firstLabelLayerId(map)
  map.addSource(TRACK_SOURCE, { type: 'geojson', data: data.lines })
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
        'circle-opacity': TRACKS.ends.opacity,
        'circle-blur': TRACKS.ends.blur,
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-radius': endRamp(),
      },
    },
    labelId,
  )
  return TRACK_NIL_LAYER
}

/** Advance the playhead. Cheap — a filter change, no re-tessellation of the
 *  geometry, which is the one thing the grid tiers could never avoid. */
export function setTrackTime(map: maplibregl.Map, day: number) {
  if (map.getLayer(TRACK_NIL_LAYER)) map.setFilter(TRACK_NIL_LAYER, unsprayed(day))
  if (map.getLayer(TRACK_LAYER)) map.setFilter(TRACK_LAYER, sprayed(day))
  if (map.getLayer(TRACK_END_LAYER)) map.setFilter(TRACK_END_LAYER, sprayed(day))
  if (map.getLayer(TRACK_MARK_LAYER)) map.setFilter(TRACK_MARK_LAYER, dayFilter(day))
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
  const colour = indices
    ? (['case', ['in', ['get', 'agent'], ['literal', indices]], tint, dim] as never)
    : (tint as never)
  for (const id of [TRACK_LAYER, TRACK_NIL_LAYER]) {
    if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', colour)
  }
  for (const id of [TRACK_MARK_LAYER, TRACK_END_LAYER]) {
    if (map.getLayer(id)) map.setPaintProperty(id, 'circle-color', colour)
  }
}

/** Hide the dot tiers when the tracks are on, and vice versa. Kept here so the
 *  spike owns its own on/off rather than threading a flag through MapView. */
export function setLayersVisible(map: maplibregl.Map, ids: string[], on: boolean) {
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}
