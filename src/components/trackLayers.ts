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

/**
 * Width in px at the two anchors, and the ceiling at each.
 *
 * Chosen against the real distribution of gallons per km, not by eye:
 *
 *   p25 36 · p50 162 · p75 288 · p90 442 · p99 1143 · max 9074
 *
 * `k` puts the median segment at 0.8 px when the whole record is on screen and
 * 3 px at the zoom ceiling; the cap bites above ~760 gal/km, which is 2.7% of
 * segments. Without a cap the top of the tail is 56 px wide and stops being a
 * line at all.
 */
const WIDTH = {
  far: { k: 0.8 / 162, cap: 4 },
  near: { k: 3 / 162, cap: 14 },
}

/** Alpha low enough that crossing tracks read as crossing, and repeated
 *  ground reads as darker. This is the whole reason not to draw them opaque. */
const TRACK_OPACITY = 0.5

/** A hair of feathering. The dots got 0.25 of their radius; a line is thin
 *  enough that the equivalent is a fraction of a pixel, and it is what stops
 *  a 1 px track looking like a scratch. In px, unlike circle-blur. */
const TRACK_BLUR = 0.4

/** Endpoint dot radius, as a multiple of the line's own half-width, so the
 *  cap always belongs to its line instead of being a fixed bead stuck on it. */
const END_SCALE = 0.75

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
  const at = (w: { k: number; cap: number }) =>
    ['min', ['*', w.k, ['get', 'gpk']], w.cap]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(WIDTH.far),
    Z_TOP, at(WIDTH.near),
  ] as unknown as maplibregl.ExpressionSpecification
}

/** Endpoint radius: half the line's own width at this zoom, scaled. Derived
 *  from the same numbers rather than typed again, so a wider line always gets
 *  a proportionate cap and the two can never drift apart. */
function endRamp(): maplibregl.ExpressionSpecification {
  const at = (w: { k: number; cap: number }) =>
    ['*', END_SCALE / 2, ['min', ['*', w.k, ['get', 'gpk']], w.cap]]
  return [
    'interpolate', ['linear'], ['zoom'],
    Z_FAR, at(WIDTH.far),
    Z_TOP, at(WIDTH.near),
  ] as unknown as maplibregl.ExpressionSpecification
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
        'line-width': 0.6,
        'line-opacity': 0.35,
        // Dashed for the same reason the zero-volume dots are hollow: it is a
        // different KIND of mark, not a thinner amount of the same one.
        'line-dasharray': [2, 2],
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
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': widthRamp(),
        'line-opacity': TRACK_OPACITY,
        'line-blur': TRACK_BLUR,
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
        'circle-opacity': TRACK_OPACITY,
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        // Same k·√gallons as the dot map's near tier — a single-point run IS a
        // point, so the point encoding is the right one for it.
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          Z_FAR, ['min', ['*', 0.02, ['sqrt', ['get', 'gallons']]], 6],
          Z_TOP, ['min', ['*', 0.09, ['sqrt', ['get', 'gallons']]], 14],
        ] as unknown as maplibregl.ExpressionSpecification,
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
        'circle-opacity': TRACK_OPACITY,
        'circle-blur': 0.3,
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
