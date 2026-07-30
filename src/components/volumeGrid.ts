// ── Explorer M2 · gridded proportional symbols ────────────────────────────
// One representational language at every zoom — the dot — with only the
// aggregation cell size changing (CLEVER°FRANKE model; see
// docs/explorer-m2-plan.md). Two grid tiers are re-binned at runtime from
// the ~20k spray events; the near tier draws the raw events themselves.

import type maplibregl from 'maplibre-gl'
import type { SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'
import { firstLabelLayerId } from './mapTheme'

export const VOL_COARSE_SOURCE = 'vol-coarse'
export const VOL_FINE_SOURCE = 'vol-fine'
export const VOL_RAW_LAYER = 'vol-raw'
export const VOL_COARSE_LAYER = 'vol-coarse-l'
export const VOL_FINE_LAYER = 'vol-fine-l'
const VN_LABEL_SOURCE = 'vn-country-label'
const VN_LABEL_LAYER = 'vn-country-label-l'

/** The Archive's own water tones. Land and vegetation come from
 *  `mapConfig.theme`; water is overridden here because the explorer wants a
 *  cooler, quieter sea than the story's. */
export const WATER_FILL = '#d1dee6'
export const WATER_LINE = '#c0d0db'
/** The layer sets the basemap treatment works on, exported so a tuner can
 *  reach exactly the same ones without re-deriving them. `building` is
 *  deliberately absent from the vegetation pattern — it is hidden outright,
 *  and a tuner must not revive it while colouring the greenery. */
export const WATER_FILL_RE = /water|sea|ocean|river|lake/
export const WATER_LINE_RE = /water|river|lake/
export const VEGETATION_RE = /wood|forest|park|grass|green|landcover|landuse|vegetation/

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

/** Grey for de-emphasised (non-selected) volume. A neutral #808080 was tried
 *  and read too heavy — de-emphasised volume competed with the selection —
 *  so this stays the original soft green-grey and leans on the raised
 *  circle-opacity (0.72) for its legibility instead of a darker value. */
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

  // Insert beneath the basemap's first label layer so place names stay
  // legible over the data rather than the reverse (a plain addLayer with no
  // beforeId appends to the very top of the stack, above every label).
  const labelId = firstLabelLayerId(map)

  // No strokes; overlap darkens by alpha stacking — the closest WebGL gets
  // to a multiply blend (MapLibre layers have no CSS-style blend modes).
  // pitch-alignment 'map' lays each disc flat on the map plane, so in the
  // 3D view the dots foreshorten into ellipses instead of billboarding.
  const shared = {
    'circle-color': ['get', 'c'] as unknown as maplibregl.ExpressionSpecification,
    'circle-opacity': 0.72,
    'circle-pitch-alignment': 'map' as const,
    'circle-pitch-scale': 'map' as const,
  }
  const sharedLayout = { 'circle-sort-key': ['get', 's'] as unknown as maplibregl.ExpressionSpecification }

  map.addLayer(
    {
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
    },
    labelId,
  )

  map.addLayer(
    {
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
    },
    labelId,
  )

  // Near tier: the raw events themselves (single runs are ~1k gallons).
  map.addLayer(
    {
      id: VOL_RAW_LAYER,
      type: 'circle',
      source: spraySource,
      minzoom: Z_MID_TO_NEAR,
      paint: {
        'circle-color': ['get', 'c'] as unknown as maplibregl.ExpressionSpecification,
        'circle-opacity': 0.72,
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
    },
    labelId,
  )
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


/** CF-style quiet basemap for the explorer: buildings off, water carrying its
 *  own blue, town-and-below labels gone, remaining labels set as small tracked
 *  grey caps so the data owns the page. */
export function quietBasemap(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    try {
      // Buildings go; vegetation stays. Footprints are noise at every zoom
      // this map opens at, but the green cover is geography the record is
      // *about* — where the canopy was is the point. `applyMapTheme` has
      // already put it at mapConfig.theme.greenspace (#e1e5d7, 1.14:1 against
      // the land), quiet enough to sit behind the circles.
      if (/building/.test(id)) {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      // Water carries its own blue rather than borrowing one. The old
      // near-neutral #e9edea only read as water because the land under it was
      // warm — it sat just +1 apart in blue-minus-red, so the moment land
      // lightened the sea stopped reading as sea. This blue is +27 cooler
      // than the land, and at 1.22:1 luminance it is still quiet enough that
      // the basemap recedes behind the data: the sea reads by hue, not by
      // lightness. The river line is the same hue two steps down so
      // waterways stay legible against land instead of against the sea.
      if (layer.type === 'fill' && WATER_FILL_RE.test(id)) {
        map.setPaintProperty(id, 'fill-color', WATER_FILL)
        continue
      }
      if (layer.type === 'line' && WATER_LINE_RE.test(id)) {
        map.setPaintProperty(id, 'line-color', WATER_LINE)
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
      // Basemap point markers go, in all three shapes positron can draw them:
      // a `circle` layer, an icon-only symbol layer, or an icon riding along
      // inside a label layer (handled below). A settlement dot next to a name
      // is redundant here — the name already marks the place — and on a map
      // whose entire visual language is "a filled circle is sprayed volume"
      // it reads as data that was never sprayed.
      if (layer.type === 'circle') {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      if (layer.type === 'symbol' && map.getLayoutProperty(id, 'text-field') == null) {
        map.setLayoutProperty(id, 'visibility', 'none')
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
        // Drop any dot the label layer carries with it, and re-centre the
        // text on the point it names — positron parks the name above the
        // icon, so without this the label floats clear of its own location.
        try {
          map.setLayoutProperty(id, 'icon-image', undefined)
        } catch {
          map.setPaintProperty(id, 'icon-opacity', 0)
        }
        map.setLayoutProperty(id, 'text-anchor', 'center')
        map.setLayoutProperty(id, 'text-offset', [0, 0])
        // Flat tiered sizes, well under the basemap defaults.
        const size = /country/.test(id) ? 15 : 12
        if (!/country/.test(id) && !isWater) {
          // Settlements only appear once the reader starts zooming in; the
          // full-country overview stays clear for the data. Water names are
          // exempt: they are not settlements, and the overview is exactly
          // where naming the East Sea earns its keep — the old rule caught
          // them by accident and hid every sea label at the default zoom.
          map.setLayerZoomRange(id, 6.4, 22)
        }
        map.setLayoutProperty(id, 'text-size', size)
      }
    } catch {
      /* layer doesn't support the property — skip */
    }
  }
}

/** Country-label styling, matched to what `quietBasemap` does to the basemap's
 *  own country layers so ours cannot drift away from LAOS / THAILAND /
 *  CAMBODIA. Kept as one object because two places set it. */
const COUNTRY_TEXT = {
  font: ['Cuprum'],
  size: 15,
  color: '#6f7568',
  halo: 'rgba(250,249,244,0.92)',
  haloWidth: 1.1,
  /** Same z0–9 window positron gives `label_country_1/2/3`. */
  maxzoom: 9,
} as const

/** Names positron may carry on the Vietnam country node, depending on which
 *  name field the tile serves. */
const VIETNAM_NAMES = ['Vietnam', 'Viet Nam', 'Việt Nam']

/**
 * Vietnam's own name on a map of Vietnam — the one country label the basemap
 * never manages to draw.
 *
 * Why it goes missing: MapLibre places symbols from the top of the layer stack
 * downwards (`PauseablePlacement` starts at `order.length - 1`), so whatever
 * sits highest wins a collision. `mr-label` is added above the basemap's
 * labels, and OSM puts the Vietnam place node at ~16.0°N 108.0°E — directly
 * under MILITARY REGION I. The country label loses every time.
 *
 * Letting it win instead is worse: it would land mid-coast, on top of our own
 * annotation and the densest part of the spray. So we place the name where a
 * cartographer would — the country's northern waist, clear of the record — and
 * drop Vietnam from the basemap's country layers so the two can never both
 * appear in the z8.5–9 window where `mr-label` has already faded out.
 *
 * Call this AFTER the volume layers. It goes in just under the basemap's own
 * labels, which puts it above the circles in draw order but *below* them in
 * placement order — so it can never suppress a city name, and at the overview,
 * where settlements are not drawn at all, nothing competes with it.
 */
export function addVietnamLabel(map: maplibregl.Map) {
  if (map.getLayer(VN_LABEL_LAYER)) return

  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || !/country/.test(layer.id)) continue
    try {
      const drop = [
        '!',
        ['in', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name'], ''], ['literal', VIETNAM_NAMES]],
      ]
      const existing = map.getFilter(layer.id)
      map.setFilter(layer.id, (existing ? ['all', existing, drop] : drop) as never)
    } catch {
      /* filter not settable — a duplicate at z8.5–9 is the worst case */
    }
  }

  map.addSource(VN_LABEL_SOURCE, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Viet Nam' },
          // The northern waist (~Thanh Hóa): inside the country, north of
          // where the record begins (~17.5°N), ~1.2° clear of the LAOS label,
          // and far enough below 23°N to stay on screen at the default view
          // even on a short laptop viewport.
          geometry: { type: 'Point', coordinates: [105.5, 19.9] },
        },
      ],
    } as GeoJSON.FeatureCollection,
  })
  map.addLayer(
    {
      id: VN_LABEL_LAYER,
      type: 'symbol',
      source: VN_LABEL_SOURCE,
      maxzoom: COUNTRY_TEXT.maxzoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [...COUNTRY_TEXT.font],
        'text-size': COUNTRY_TEXT.size,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.2,
      },
      paint: {
        'text-color': COUNTRY_TEXT.color,
        'text-halo-color': COUNTRY_TEXT.halo,
        'text-halo-width': COUNTRY_TEXT.haloWidth,
      },
    },
    firstLabelLayerId(map),
  )
}
