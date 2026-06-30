// Applies the editable mapConfig to a live MapLibre map: recolours the basemap
// from the theme tokens, and builds one heatmap layer per agent group so each
// herbicide shows in its own colour.
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { mapConfig, type MapTheme } from '../config/mapConfig'
import type { AgentChoice } from './agentChoices'

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

/** Heatmap colour ramp: transparent → light tint → base → darker.
 *  Darkens toward a neutral (not red) so grey/blue agents stay true to hue. */
function agentRamp(baseHex: string): ExpressionSpecification {
  const base = hexToRgb(baseHex)
  const light = mixHex(base, [255, 255, 255], 0.45)
  const dark = mixHex(base, [28, 28, 34], 0.4)
  const darker = mixHex(base, [20, 20, 26], 0.62)
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(0,0,0,0)',
    0.12, rgba(light, 0.5),
    0.4, rgba(base, 0.85),
    0.7, rgba(dark, 0.92),
    1, rgba(darker, 1),
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
      else if (layer.type === 'line') map.setPaintProperty(id, 'line-color', color)
      else if (layer.type === 'fill-extrusion') map.setPaintProperty(id, 'fill-extrusion-color', color)
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

/** Update the cumulative time window on every agent layer. */
export function setSprayTime(map: maplibregl.Map, choices: AgentChoice[], day: number) {
  for (const c of groups(choices)) {
    const id = agentLayerId(c.key)
    if (map.getLayer(id)) map.setFilter(id, timeFilter(day, c.indices as number[]))
  }
}

/** Show every group for "all", otherwise just the selected one. */
export function setAgentVisibility(map: maplibregl.Map, choices: AgentChoice[], activeKey: string) {
  for (const c of groups(choices)) {
    const id = agentLayerId(c.key)
    if (!map.getLayer(id)) continue
    const visible = activeKey === 'all' || activeKey === c.key
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}
