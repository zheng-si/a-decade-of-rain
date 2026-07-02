// Group the basemap's text (label) layers into readable tiers so they can be
// toggled from the UI. Works off the live style, so it adapts to whatever the
// basemap actually ships.
import type maplibregl from 'maplibre-gl'

export interface LabelGroup {
  key: string
  label: string
  layerIds: string[]
  visible: boolean
}

const CATS: { key: string; label: string; re: RegExp }[] = [
  { key: 'country', label: 'Countries', re: /country/i },
  { key: 'state', label: 'Provinces / states', re: /state|province|region/i },
  { key: 'city', label: 'Cities', re: /city/i },
  { key: 'town', label: 'Towns', re: /town/i },
  { key: 'village', label: 'Villages, hamlets & wards', re: /village|hamlet|suburb|neighbou?rhood|quarter/i },
  { key: 'water', label: 'Seas, lakes & rivers', re: /water|marine|ocean|sea|lake|river|bay/i },
  { key: 'road', label: 'Roads', re: /road|street|highway|transportation|motorway|path/i },
  { key: 'poi', label: 'Points of interest', re: /poi|amenity|attraction|building/i },
  { key: 'airport', label: 'Airports', re: /airport|aerodrome|aeroway/i },
  { key: 'other', label: 'Other labels', re: /.*/ },
]

function catOf(id: string): string {
  for (const c of CATS) if (c.key !== 'other' && c.re.test(id)) return c.key
  return 'other'
}

// Curated label set for the story map. We show the tiers that help a reader
// place the spraying — countries, provinces, cities, towns, water and airports —
// and hide the noise: wards/hamlets (“P.9 / Thôn 7”), POIs, road names and
// anything uncategorised. The basemap's own per-layer zoom rules then decide
// WHEN each tier appears (provinces first, towns as you zoom in).
export const DEFAULT_HIDDEN = new Set(['village', 'poi', 'road', 'other'])

export function readLabelGroups(map: maplibregl.Map): LabelGroup[] {
  const byCat: Record<string, string[]> = {}
  for (const l of map.getStyle().layers ?? []) {
    if (l.type !== 'symbol') continue
    const layout = (l as { layout?: Record<string, unknown> }).layout
    if (!layout || layout['text-field'] == null) continue // text labels only
    const k = catOf(l.id)
    ;(byCat[k] = byCat[k] || []).push(l.id)
  }
  return CATS.filter((c) => byCat[c.key]).map((c) => ({
    key: c.key,
    label: c.label,
    layerIds: byCat[c.key],
    visible: !DEFAULT_HIDDEN.has(c.key),
  }))
}

export function setGroupVisible(map: maplibregl.Map, layerIds: string[], on: boolean) {
  for (const id of layerIds) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}
