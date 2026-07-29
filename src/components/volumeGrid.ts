// ── Explorer M2 · gridded proportional symbols ────────────────────────────
// One representational language at every zoom — the dot — with only the
// aggregation cell size changing (CLEVER°FRANKE model; see
// docs/explorer-m2-plan.md). Two grid tiers are re-binned at runtime from
// the ~20k spray events; the near tier draws the raw events themselves.

import type maplibregl from 'maplibre-gl'
import type { SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'

export const VOL_COARSE_SOURCE = 'vol-coarse'
export const VOL_FINE_SOURCE = 'vol-fine'
export const VOL_RAW_LAYER = 'vol-raw'
export const VOL_COARSE_LAYER = 'vol-coarse-l'
export const VOL_FINE_LAYER = 'vol-fine-l'

const COARSE_DEG = 0.12
const FINE_DEG = 0.03
// Hand-off zooms between the tiers.
const Z_FAR_TO_MID = 7.0
const Z_MID_TO_NEAR = 9.2

/** Per-agent-index colour, resolved once from the dataset's agent table. */
export function agentIndexColors(spray: SprayDataset): string[] {
  const byCode: Record<string, string> = {}
  for (const g of mapConfig.agents) for (const c of g.codes) byCode[c] = g.color
  const other = mapConfig.agents.find((g) => g.key === 'other')?.color ?? '#9a6cc4'
  return spray.agents.map((a) => byCode[a.code] ?? other)
}

/** Grey for de-emphasised (non-selected) volume. */
const DIM = '#c9cdc4'

/** Bin events up to `day` into a grid. With a selection, each cell emits a
 *  grey feature for the other agents' volume UNDER a tinted feature for the
 *  selected agent's — context stays visible, the selection reads on top.
 *  Both features also carry the cell's totals (gt/rt), dominant agent group
 *  (dom), and first/last spray day (d0/d1) for the hover tooltip. */
function binGrid(
  spray: SprayDataset,
  day: number,
  indices: number[] | null,
  cellDeg: number,
  tint: string,
): GeoJSON.FeatureCollection {
  const sel = indices ? new Set(indices) : null
  interface Cell {
    x: number
    y: number
    inSel: number
    out: number
    runs: number
    byGroup: number[]
    d0: number
    d1: number
  }
  const cells = new Map<string, Cell>()
  for (const f of spray.features.features) {
    const p = f.properties as { day: number; agent: number; gallons: number; gi?: number }
    if (p.day > day) continue
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates
    const x = Math.floor(lng / cellDeg)
    const y = Math.floor(lat / cellDeg)
    const key = `${x}|${y}`
    let cell = cells.get(key)
    if (!cell) {
      cell = { x, y, inSel: 0, out: 0, runs: 0, byGroup: [0, 0, 0, 0], d0: Infinity, d1: -Infinity }
      cells.set(key, cell)
    }
    if (!sel || sel.has(p.agent)) cell.inSel += p.gallons
    else cell.out += p.gallons
    cell.runs++
    if (p.gi != null && p.gi >= 0) cell.byGroup[p.gi] += p.gallons
    if (p.day < cell.d0) cell.d0 = p.day
    if (p.day > cell.d1) cell.d1 = p.day
  }
  const features: GeoJSON.Feature[] = []
  for (const cell of cells.values()) {
    const coords: [number, number] = [(cell.x + 0.5) * cellDeg, (cell.y + 0.5) * cellDeg]
    let dom = 0
    for (let i = 1; i < cell.byGroup.length; i++) if (cell.byGroup[i] > cell.byGroup[dom]) dom = i
    const shared = {
      gt: Math.round(cell.inSel + cell.out),
      rt: cell.runs,
      dom,
      d0: cell.d0,
      d1: cell.d1,
    }
    if (sel && cell.out > 0)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { g: Math.round(cell.out), c: DIM, s: 0, ...shared },
      })
    if (cell.inSel > 0)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { g: Math.round(cell.inSel), c: tint, s: 1, ...shared },
      })
  }
  return { type: 'FeatureCollection', features }
}

/** The aggregation cell size in effect at a zoom level (null = raw events). */
export function cellDegAt(zoom: number): number | null {
  if (zoom < Z_FAR_TO_MID) return COARSE_DEG
  if (zoom < Z_MID_TO_NEAR) return FINE_DEG
  return null
}

/** Area-true radius: k·√gallons, capped so dots stay inside their cell.
 *  MapLibre requires the zoom interpolate to be the OUTERMOST expression,
 *  so the cap is applied inside each stop's output. */
const gridRadius = (kStops: [number, number][], cap: number): maplibregl.ExpressionSpecification =>
  [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...kStops.flatMap(([z, k]) => [z, ['min', ['*', k, ['sqrt', ['get', 'g']]], cap]]),
  ] as unknown as maplibregl.ExpressionSpecification

/** Add the three-tier symbol stack. Returns the bottom layer id (for
 *  inserting reference overlays beneath the symbols). */
export function addVolumeLayers(map: maplibregl.Map, spraySource: string): string {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
  map.addSource(VOL_COARSE_SOURCE, { type: 'geojson', data: empty })
  map.addSource(VOL_FINE_SOURCE, { type: 'geojson', data: empty })

  // No strokes; overlap darkens by alpha stacking — the closest WebGL gets
  // to a multiply blend (MapLibre layers have no CSS-style blend modes).
  // pitch-alignment 'map' lays each disc flat on the map plane, so in the
  // 3D view the dots foreshorten into ellipses instead of billboarding.
  const shared = {
    'circle-color': ['get', 'c'] as unknown as maplibregl.ExpressionSpecification,
    'circle-opacity': 0.6,
    'circle-pitch-alignment': 'map' as const,
    'circle-pitch-scale': 'map' as const,
  }
  const sharedLayout = { 'circle-sort-key': ['get', 's'] as unknown as maplibregl.ExpressionSpecification }

  map.addLayer({
    id: VOL_COARSE_LAYER,
    type: 'circle',
    source: VOL_COARSE_SOURCE,
    maxzoom: Z_FAR_TO_MID,
    layout: sharedLayout,
    paint: {
      ...shared,
      'circle-radius': gridRadius(
        [
          [5.6, 0.03],
          [7.0, 0.069],
        ],
        13,
      ),
    },
  })

  map.addLayer({
    id: VOL_FINE_LAYER,
    type: 'circle',
    source: VOL_FINE_SOURCE,
    minzoom: Z_FAR_TO_MID,
    maxzoom: Z_MID_TO_NEAR,
    layout: sharedLayout,
    paint: {
      ...shared,
      'circle-radius': gridRadius(
        [
          [7.0, 0.037],
          [9.2, 0.1],
        ],
        12,
      ),
    },
  })

  // Near tier: the raw events themselves (single runs are ~1k gallons).
  map.addLayer({
    id: VOL_RAW_LAYER,
    type: 'circle',
    source: spraySource,
    minzoom: Z_MID_TO_NEAR,
    paint: {
      'circle-color': ['get', 'c'] as unknown as maplibregl.ExpressionSpecification,
      'circle-opacity': 0.55,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        9.2,
        ['min', ['*', 0.14, ['sqrt', ['get', 'gallons']]], 18],
        12,
        ['min', ['*', 0.34, ['sqrt', ['get', 'gallons']]], 18],
      ] as unknown as maplibregl.ExpressionSpecification,
    },
  })
  return VOL_COARSE_LAYER
}

/** Re-bin both grid tiers and re-filter the raw tier for a new playhead /
 *  agent selection. Called from the throttled day effect (not per frame). */
export function updateVolume(
  map: maplibregl.Map,
  spray: SprayDataset,
  day: number,
  indices: number[] | null,
  tint?: string | null,
) {
  const coarse = map.getSource(VOL_COARSE_SOURCE) as maplibregl.GeoJSONSource | undefined
  const fine = map.getSource(VOL_FINE_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!coarse || !fine) return
  // One hue at a time: brand red for the whole field, an agent's colour
  // when isolated — and the rest of the record dims to grey rather than
  // vanishing, so the selection keeps its context.
  const c = tint ?? '#ff5449'
  coarse.setData(binGrid(spray, day, indices, COARSE_DEG, c))
  fine.setData(binGrid(spray, day, indices, FINE_DEG, c))
  if (map.getLayer(VOL_RAW_LAYER)) {
    map.setFilter(VOL_RAW_LAYER, ['<=', ['get', 'day'], day] as never)
    map.setPaintProperty(
      VOL_RAW_LAYER,
      'circle-color',
      indices
        ? (['case', ['in', ['get', 'agent'], ['literal', indices]], c, DIM] as never)
        : c,
    )
    map.setLayoutProperty(
      VOL_RAW_LAYER,
      'circle-sort-key',
      indices ? (['case', ['in', ['get', 'agent'], ['literal', indices]], 1, 0] as never) : 0,
    )
  }
}

/** Stamp each raw event feature with its resolved colour (`c`) and agent
 *  group index (`gi`) so the near tier can colour by agent without a runtime
 *  match expression and the bins can tally a dominant group per cell. */
export function stampEventColors(spray: SprayDataset, colors: string[], groupOf?: number[]) {
  for (const f of spray.features.features) {
    const p = f.properties as { agent: number; c?: string; gi?: number }
    p.c = colors[p.agent]
    if (groupOf) p.gi = groupOf[p.agent] ?? -1
  }
}


/** CF-style quiet basemap for the explorer: vegetation and buildings off,
 *  water a shade paler, town-and-below labels gone, remaining labels set
 *  as small tracked grey caps so the data owns the page. */
export function quietBasemap(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    try {
      if (/wood|forest|park|grass|green|landcover|landuse|vegetation|building/.test(id)) {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      if (layer.type === 'fill' && /water|sea|ocean|river|lake/.test(id)) {
        map.setPaintProperty(id, 'fill-color', '#e9edea')
        continue
      }
      if (layer.type === 'line' && /water|river|lake/.test(id)) {
        map.setPaintProperty(id, 'line-color', '#dde4e0')
        continue
      }
      if (layer.type === 'line' && /highway|road|street|bridge|tunnel|transportation/.test(id)) {
        if (!/motorway|trunk|primary|major/.test(id)) {
          map.setLayoutProperty(id, 'visibility', 'none')
        } else {
          // The kept trunk network stays a hairline whisper.
          map.setPaintProperty(id, 'line-width', [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.4,
            10,
            1.1,
            14,
            2,
          ])
        }
        continue
      }
      if (/boundary|admin/.test(id) && layer.type === 'line') {
        map.setPaintProperty(id, 'line-color', '#a8ada2')
        map.setPaintProperty(id, 'line-width', 0.7)
        map.setPaintProperty(id, 'line-opacity', 0.6)
        // District/city rings are noise at this scale: draw nothing below
        // the national/provincial levels (admin_level > 4).
        const existing = map.getFilter(id)
        const levelF = ['<=', ['coalesce', ['to-number', ['get', 'admin_level']], 2], 4]
        map.setFilter(id, (existing ? ['all', existing, levelF] : levelF) as never)
        continue
      }
      if (layer.type === 'symbol' && map.getLayoutProperty(id, 'text-field') != null) {
        if (/village|hamlet|suburb|neighbourhood|quarter|town/.test(id)) {
          map.setLayoutProperty(id, 'visibility', 'none')
          continue
        }
        if (/state|province/.test(id)) {
          map.setLayoutProperty(id, 'visibility', 'none')
          continue
        }
        const isWater = /water|sea|ocean|marine|river|lake|bay/.test(id)
        if (isWater) {
          // Open-sea names read in English (the site's language); coalesce
          // falls back to the local name where no translation exists.
          map.setLayoutProperty(id, 'text-field', [
            'coalesce',
            ['get', 'name:en'],
            ['get', 'name_en'],
            ['get', 'name'],
          ])
        }
        map.setPaintProperty(id, 'text-color', isWater ? '#7d9ba1' : '#6f7568')
        map.setPaintProperty(id, 'text-halo-color', 'rgba(250,249,244,0.92)')
        map.setPaintProperty(id, 'text-halo-width', 1.1)
        map.setLayoutProperty(id, 'text-transform', 'uppercase')
        map.setLayoutProperty(id, 'text-letter-spacing', 0.2)
        map.setLayoutProperty(id, 'text-font', ['Cuprum'])
        // Flat tiered sizes, well under the basemap defaults.
        const size = /country/.test(id) ? 15 : 12
        if (!/country/.test(id)) {
          // Settlements only appear once the reader starts zooming in; the
          // full-country overview stays clear for the data.
          map.setLayerZoomRange(id, 6.4, 22)
        }
        map.setLayoutProperty(id, 'text-size', size)
      }
    } catch {
      /* layer doesn't support the property — skip */
    }
  }
}
