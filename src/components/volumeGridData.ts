import type maplibregl from 'maplibre-gl'

export const VOL_COARSE_SOURCE = 'vol-coarse'
export const VOL_FINE_SOURCE = 'vol-fine'
export const VOL_COARSE_LAYER = 'vol-coarse-l'
export const VOL_FINE_LAYER = 'vol-fine-l'

export interface VolumeGridData {
  data: GeoJSON.FeatureCollection
  cellDeg: number
}
type Listener = (source: string, grid: VolumeGridData) => void
const snapshots = new WeakMap<maplibregl.Map, Map<string, VolumeGridData>>()
const listeners = new WeakMap<maplibregl.Map, Set<Listener>>()

/** Publish exactly the bins sent to MapLibre, with the size used to build them.
 * Keeps references only; no second binning pass or debug geometry in shipping.
 * The tuner can subscribe after the initial bins have already been installed. */
export function setVolumeGridData(
  map: maplibregl.Map,
  source: string,
  data: GeoJSON.FeatureCollection,
  cellDeg: number,
) {
  const src = map.getSource(source) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(data)
  let grids = snapshots.get(map)
  if (!grids) snapshots.set(map, grids = new Map())
  const grid = { data, cellDeg }
  grids.set(source, grid)
  for (const listener of listeners.get(map) ?? []) listener(source, grid)
}

export function watchVolumeGridData(map: maplibregl.Map, listener: Listener): () => void {
  let observers = listeners.get(map)
  if (!observers) listeners.set(map, observers = new Set())
  observers.add(listener)
  for (const [source, grid] of snapshots.get(map) ?? []) listener(source, grid)
  return () => { observers.delete(listener) }
}
