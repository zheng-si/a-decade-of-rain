// Applies the editable mapConfig to a live MapLibre map: recolours the basemap
// from the theme tokens, and builds one heatmap layer per agent group so each
// herbicide shows in its own colour.
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { mapConfig, type MapTheme } from '../config/mapConfig'
import type { AgentChoice } from './agentChoices'

/** Resolve the map style: a URL, or the style JSON with a custom glyph endpoint
 *  swapped in when mapConfig.glyphsUrl is set. Shared by every map instance. */
export async function resolveMapStyle(): Promise<string | maplibregl.StyleSpecification> {
  if (!mapConfig.glyphsUrl) return mapConfig.baseStyleUrl
  const resp = await fetch(mapConfig.baseStyleUrl)
  const style = (await resp.json()) as maplibregl.StyleSpecification
  style.glyphs = mapConfig.glyphsUrl
  return style
}

// ── colour helpers ────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
function mixHex(c: [number, number, number], towards: [number, number, number], t: number) {
  return [mix(c[0], towards[0], t), mix(c[1], towards[1], t), mix(c[2], towards[2], t)] as const
}
const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

/** Heatmap colour ramp: transparent → light tint → base, staying near the base
 *  hue at the centre (only a gentle deepen) so dense cores don't read as dark. */
function agentRamp(baseHex: string): ExpressionSpecification {
  const base = hexToRgb(baseHex)
  const light = mixHex(base, [255, 255, 255], 0.5)
  const deep = mixHex(base, [30, 30, 36], 0.16)
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(0,0,0,0)',
    0.12, rgba(light, 0.5),
    0.45, rgba(base, 0.85),
    0.75, rgba(base, 0.95),
    1, rgba(deep, 1),
  ]
}

const stops = (pairs: [number, number][]): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], ...pairs.flat()] as ExpressionSpecification

// ── basemap theming ───────────────────────────────────────────────────────
// OpenFreeMap styles follow the OpenMapTiles schema, so we recolour layers by
// matching their ids/types. Tweak the buckets here if a base style differs.
function classify(id: string): keyof MapTheme | 'label' | null {
  if (id === 'background') return 'land'
  if (/water|sea|ocean|river|lake/.test(id)) return 'water'
  if (/wood|forest|park|grass|green|landcover|landuse|vegetation/.test(id)) return 'greenspace'
  if (/building/.test(id)) return 'building'
  if (/boundary|admin|border/.test(id)) return 'boundary'
  if (/road|highway|transportation|street|bridge|tunnel|motorway/.test(id)) return 'road'
  return null
}

export function applyMapTheme(map: maplibregl.Map, theme: MapTheme = mapConfig.theme) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    try {
      // Symbol layers = labels (and icons). Recolour their text.
      if (layer.type === 'symbol') {
        if (map.getLayoutProperty(id, 'text-field') == null) continue
        map.setPaintProperty(id, 'text-color', theme.label.color)
        map.setPaintProperty(id, 'text-halo-color', theme.label.halo)
        map.setPaintProperty(id, 'text-halo-width', theme.label.haloWidth)
        if (theme.label.font) map.setLayoutProperty(id, 'text-font', theme.label.font)
        if (theme.label.sizeScale !== 1) {
          const size = map.getLayoutProperty(id, 'text-size')
          if (size != null) map.setLayoutProperty(id, 'text-size', ['*', size, theme.label.sizeScale])
        }
        continue
      }

      const bucket = classify(id)
      if (!bucket || bucket === 'label') continue
      const color = theme[bucket] as string
      if (layer.type === 'background') map.setPaintProperty(id, 'background-color', color)
      else if (layer.type === 'fill') map.setPaintProperty(id, 'fill-color', color)
      else if (layer.type === 'line') {
        map.setPaintProperty(id, 'line-color', color)
        // Sub-national admin lines (province/district, admin_level ≥ 3) clutter
        // the map, so knock them back a level: lighter + thinner + more
        // transparent. The national border (admin_level ≤ 2) stays full-strength.
        if (bucket === 'boundary') {
          const subLevel: ExpressionSpecification = ['>=', ['coalesce', ['to-number', ['get', 'admin_level']], 4], 3]
          map.setPaintProperty(id, 'line-color', ['case', subLevel, '#b9bcb2', color] as ExpressionSpecification)
          const w = map.getPaintProperty(id, 'line-width') as number | ExpressionSpecification | undefined
          const base: number | ExpressionSpecification = w != null ? w : 1
          map.setPaintProperty(id, 'line-width', ['case', subLevel, ['*', base, 0.55], base] as ExpressionSpecification)
          map.setPaintProperty(id, 'line-opacity', ['case', subLevel, 0.5, 0.9] as ExpressionSpecification)
        }
      } else if (layer.type === 'fill-extrusion') {
        map.setPaintProperty(id, 'fill-extrusion-color', color)
      }
    } catch {
      /* layer doesn't support this property — skip */
    }
  }
}

// ── per-agent spray heatmap layers ────────────────────────────────────────
export const agentLayerId = (key: string) => `spray-heat-${key}`

/** Only the real agent groups (skip the synthetic "All" choice). */
const groups = (choices: AgentChoice[]) => choices.filter((c) => c.indices && c.color)

function timeFilter(day: number, indices: number[]): ExpressionSpecification {
  return ['all', ['<=', ['get', 'day'], day], ['in', ['get', 'agent'], ['literal', indices]]]
}

/** First label layer, so we can slot the heatmap beneath it (labels stay on top). */
function firstLabelLayerId(map: maplibregl.Map): string | undefined {
  for (const l of map.getStyle().layers ?? []) {
    if (l.type === 'symbol') return l.id
  }
  return undefined
}

export const HILLSHADE_LAYER = 'hillshade'

/** Add a hillshade layer (hidden until 3D) that shades the DEM relief, so the
 *  terrain is clearly visible — not just a tilted flat map. Sits under labels
 *  and under the spray heatmap (added afterwards). */
export function addHillshade(map: maplibregl.Map, demSource: string) {
  if (map.getLayer(HILLSHADE_LAYER)) return
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: demSource,
      layout: { visibility: 'none' },
      paint: {
        'hillshade-exaggeration': 0.6,
        'hillshade-shadow-color': '#4f4a42',
        'hillshade-accent-color': '#6b6052',
        'hillshade-highlight-color': '#ffffff',
      },
    },
    firstLabelLayerId(map),
  )
}

export function setHillshade(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(HILLSHADE_LAYER)) {
    map.setLayoutProperty(HILLSHADE_LAYER, 'visibility', on ? 'visible' : 'none')
  }
}

export function addSprayLayers(map: maplibregl.Map, sourceId: string, choices: AgentChoice[], day: number) {
  const { radius, intensity, opacity } = mapConfig.heatmap
  const beforeId = firstLabelLayerId(map)
  for (const c of groups(choices)) {
    map.addLayer(
      {
        id: agentLayerId(c.key),
        type: 'heatmap',
        source: sourceId,
        filter: timeFilter(day, c.indices as number[]),
        paint: {
          'heatmap-weight': ['get', 'w'],
          'heatmap-intensity': stops(intensity),
          'heatmap-radius': stops(radius),
          'heatmap-opacity': opacity,
          'heatmap-color': agentRamp(c.color as string),
        },
      },
      beforeId,
    )
  }
}

// ── shared reference overlays (Story + Archive) ───────────────────────────
// Both maps carry the same cartographic furniture so they read as one system.

/** The four Corps Tactical Zones / Military Regions — only the three INTERNAL
 *  dividers are drawn (bold orange dashed; the outer edges trace the national
 *  border / coast and would clash with the basemap's own lines), plus the
 *  uppercase orange region tags, overview only. Pass `beforeId` to keep the
 *  dividers under the spray heat. */
export function addMilitaryRegions(
  map: maplibregl.Map,
  mrGeo: GeoJSON.GeoJSON,
  mrLabelsGeo: GeoJSON.GeoJSON,
  beforeId?: string,
) {
  if (map.getLayer('mr-borders')) return
  map.addSource('military-regions', { type: 'geojson', data: mrGeo })
  map.addLayer(
    {
      id: 'mr-borders',
      type: 'line',
      source: 'military-regions',
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#ec7066', 'line-width': 1.2, 'line-opacity': 0.55, 'line-dasharray': [2.4, 1.8] },
    },
    beforeId,
  )
  map.addSource('military-region-labels', { type: 'geojson', data: mrLabelsGeo })
  map.addLayer({
    id: 'mr-label',
    type: 'symbol',
    source: 'military-region-labels',
    maxzoom: 8.5,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Familjen Grotesk'],
      'text-size': 15,
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.1,
    },
    paint: { 'text-color': '#cf3720', 'text-halo-color': 'rgba(250,249,244,0.95)', 'text-halo-width': 2 },
  })
}

/** Disputed-island reference marks (the basemap already draws the grey
 *  borders). These sit outside the spray record (occupied by China, Taiwan
 *  et al.) and were never sprayed; shown as reference, no sovereignty
 *  assigned. Names use the common English forms + Vietnamese in parentheses. */
const ISLANDS_FC = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Paracel Is. (Hoàng Sa) · disputed' }, geometry: { type: 'Point', coordinates: [112.0, 16.5] } },
    { type: 'Feature', properties: { name: 'Spratly Is. (Trường Sa) · disputed' }, geometry: { type: 'Point', coordinates: [114.0, 9.8] } },
  ],
} as GeoJSON.FeatureCollection

export function addIslandMarks(map: maplibregl.Map) {
  if (map.getLayer('island-dot')) return
  map.addSource('islands', { type: 'geojson', data: ISLANDS_FC })
  map.addLayer({
    id: 'island-dot',
    type: 'circle',
    source: 'islands',
    paint: {
      'circle-radius': 4,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#8a8d85',
      'circle-stroke-width': 1.2,
    },
  })
  map.addLayer({
    id: 'island-label',
    type: 'symbol',
    source: 'islands',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Public Sans Medium'],
      'text-size': 10,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-max-width': 9,
    },
    paint: { 'text-color': '#8a8d85', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
  })
}

// ── story mode: one combined heatmap in the brand orange ──────────────────
// The scrollytelling uses a single, all-agents heatmap (no per-agent layers
// stacking into a muddy overlap). A warm ramp keeps dense cores orange rather
// than darkening to grey.
export const STORY_HEAT_LAYER = 'spray-heat-story'

function warmRamp(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(255,84,73,0)',
    0.12, 'rgba(255,84,73,0.32)',
    0.35, 'rgba(255,84,73,0.62)',
    0.65, 'rgba(255,96,52,0.85)',
    1, 'rgba(214,54,40,0.96)',
  ]
}

const dayFilter = (day: number): ExpressionSpecification => ['<=', ['get', 'day'], day]

export function addStoryHeat(map: maplibregl.Map, sourceId: string, day: number) {
  if (map.getLayer(STORY_HEAT_LAYER)) return
  const { radius, intensity, opacity } = mapConfig.heatmap
  map.addLayer(
    {
      id: STORY_HEAT_LAYER,
      type: 'heatmap',
      source: sourceId,
      filter: dayFilter(day),
      paint: {
        'heatmap-weight': ['get', 'w'],
        'heatmap-intensity': stops(intensity),
        'heatmap-radius': stops(radius),
        'heatmap-opacity': opacity,
        'heatmap-color': warmRamp(),
      },
    },
    firstLabelLayerId(map),
  )
}

export function setStoryHeatTime(map: maplibregl.Map, day: number) {
  if (map.getLayer(STORY_HEAT_LAYER)) map.setFilter(STORY_HEAT_LAYER, dayFilter(day))
}

export function setStoryHeatVisible(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(STORY_HEAT_LAYER)) {
    map.setLayoutProperty(STORY_HEAT_LAYER, 'visibility', on ? 'visible' : 'none')
  }
}

/** Update the cumulative time window on every agent layer. */
export function setSprayTime(map: maplibregl.Map, choices: AgentChoice[], day: number) {
  for (const c of groups(choices)) {
    const id = agentLayerId(c.key)
    if (map.getLayer(id)) map.setFilter(id, timeFilter(day, c.indices as number[]))
  }
}

/** Show every group for "all", otherwise just the selected one. Toggles opacity
 *  (a cheap paint change) rather than visibility, so switching agents doesn't
 *  re-tessellate the heatmap. */
export function setAgentVisibility(map: maplibregl.Map, choices: AgentChoice[], activeKey: string) {
  for (const c of groups(choices)) {
    const id = agentLayerId(c.key)
    if (!map.getLayer(id)) continue
    const visible = activeKey === 'all' || activeKey === c.key
    map.setPaintProperty(id, 'heatmap-opacity', visible ? mapConfig.heatmap.opacity : 0)
  }
}
