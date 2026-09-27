import type maplibregl from 'maplibre-gl'
import {
  watchVolumeGridData, type VolumeGridData,
  VOL_COARSE_SOURCE, VOL_FINE_SOURCE, VOL_COARSE_LAYER, VOL_FINE_LAYER,
} from './volumeGridData'

const PREFIX = 'tuner-grid-'
export const isTunerGridLayer = (id: string) => id.startsWith(PREFIX)

/** Outline occupied cells from the actual emitted dot centres, not the events
 * or viewport. Selection may emit two dots per cell; shared edges are drawn
 * only once so neither selections nor neighbours darken the guide. */
export function gridCellEdges({ data, cellDeg }: VolumeGridData): GeoJSON.FeatureCollection {
  const edges = new Set<string>()
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = []
  const edge = (x: number, y: number, horizontal: boolean) => {
    const key = `${x}|${y}|${horizontal}`
    if (edges.has(key)) return
    edges.add(key)
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [x * cellDeg, y * cellDeg],
          [(x + (horizontal ? 1 : 0)) * cellDeg, (y + (horizontal ? 0 : 1)) * cellDeg],
        ],
      },
    })
  }
  for (const f of data.features) {
    if (f.geometry.type !== 'Point') continue
    const [lng, lat] = f.geometry.coordinates
    const x = Math.round(lng / cellDeg - 0.5)
    const y = Math.round(lat / cellDeg - 0.5)
    edge(x, y, true)
    edge(x, y + 1, true)
    edge(x, y, false)
    edge(x + 1, y, false)
  }
  return { type: 'FeatureCollection', features }
}

/** Exists only while the gated tuner checkbox is on. Inherit each dot
 * layer's LIVE zoom range and visibility, including per-layer overrides,
 * proximity/lookup hiding and a hand-off moved below Z_MID. */
export function showTunerGrid(map: maplibregl.Map): () => void {
  const tiers = [
    { source: VOL_COARSE_SOURCE, dots: VOL_COARSE_LAYER, id: `${PREFIX}coarse`, color: '#526773' },
    { source: VOL_FINE_SOURCE, dots: VOL_FINE_LAYER, id: `${PREFIX}fine`, color: '#74644f' },
  ]
  for (const { source, id, color } of tiers) {
    map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    // Match the dots' tile selection under tilt as well as their layer range.
    map.getSource(id)!.calculateTileZoom = map.getSource(source)!.calculateTileZoom
    map.addLayer({
      id,
      type: 'line',
      source: id,
      layout: { visibility: 'none' },
      paint: { 'line-color': color, 'line-width': 0.65, 'line-opacity': 0.3 },
    }, VOL_COARSE_LAYER)
  }
  const stop = watchVolumeGridData(map, (source, grid) => {
    const tier = tiers.find((t) => t.source === source)
    if (tier) (map.getSource(tier.id) as maplibregl.GeoJSONSource).setData(gridCellEdges(grid))
  })
  const sync = () => {
    for (const { dots, id } of tiers) {
      const parent = map.getLayer(dots)
      const guide = map.getLayer(id)
      if (!parent || !guide) continue
      const min = parent.minzoom ?? 0
      const max = parent.maxzoom ?? 24
      if ((guide.minzoom ?? 0) !== min || (guide.maxzoom ?? 24) !== max)
        map.setLayerZoomRange(id, min, max)
      const visibility = map.getLayoutProperty(dots, 'visibility') ?? 'visible'
      if (map.getLayoutProperty(id, 'visibility') !== visibility)
        map.setLayoutProperty(id, 'visibility', visibility)
    }
  }
  let removed = false
  const onRemove = () => { removed = true; stop(); map.off('styledata', sync) }
  sync()
  map.on('styledata', sync)
  map.on('remove', onRemove)
  return () => {
    stop()
    map.off('styledata', sync)
    map.off('remove', onRemove)
    if (removed) return
    for (const { id } of tiers) {
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
  }
}
