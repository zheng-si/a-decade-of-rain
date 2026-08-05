// ── Spike A · the record drawn as lines ───────────────────────────────────
// A spray run is a track. This module draws it as one, at every zoom, with no
// aggregation tier at all — which is not a simplification but the point: the
// grid tiers exist to make a cloud of points legible, and a cloud of points is
// not what the record is. See scripts/build-spray-tracks.mjs.
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
import { Z_FAR } from '../config/mapConfig'
import { firstLabelLayerId } from './mapTheme'

export const TRACK_SOURCE = 'spray-tracks'
export const TRACK_MARK_SOURCE = 'spray-track-marks'
/** Sprayed segments, width by gallons per km. */
export const TRACK_LAYER = 'spray-track'
/** Segments of runs with no recorded volume — the same fact the hollow rings
 *  carry on the dot map, in the grammar of a line. */
export const TRACK_NIL_LAYER = 'spray-track-nil'
/** Runs recorded at a single grid reference: no line exists to draw. */
export const TRACK_MARK_LAYER = 'spray-track-mark'

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

/** Add the three track layers under the basemap's labels. Returns the bottom
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

  // Unsprayed tracks first, so a real spray line always draws over the record
  // of a pass that carried nothing.
  map.addLayer(
    {
      id: TRACK_NIL_LAYER,
      type: 'line',
      source: TRACK_SOURCE,
      filter: unsprayed(day),
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
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
      filter: sprayed(day),
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': tint,
        'line-width': widthRamp(),
        'line-opacity': TRACK_OPACITY,
      },
    },
    labelId,
  )

  map.addLayer(
    {
      id: TRACK_MARK_LAYER,
      type: 'circle',
      source: TRACK_MARK_SOURCE,
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
  return TRACK_NIL_LAYER
}

/** Advance the playhead. Cheap — a filter change, no re-tessellation of the
 *  geometry, which is the one thing the grid tiers could never avoid. */
export function setTrackTime(map: maplibregl.Map, day: number) {
  if (map.getLayer(TRACK_NIL_LAYER)) map.setFilter(TRACK_NIL_LAYER, unsprayed(day))
  if (map.getLayer(TRACK_LAYER)) map.setFilter(TRACK_LAYER, sprayed(day))
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
  if (map.getLayer(TRACK_MARK_LAYER)) {
    map.setPaintProperty(TRACK_MARK_LAYER, 'circle-color', colour)
  }
}

/** Hide the dot tiers when the tracks are on, and vice versa. Kept here so the
 *  spike owns its own on/off rather than threading a flag through MapView. */
export function setLayersVisible(map: maplibregl.Map, ids: string[], on: boolean) {
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}
