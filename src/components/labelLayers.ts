// Group the basemap's text (label) layers into readable tiers so they can be
// toggled from the UI. Works off the live style, so it adapts to whatever the
// basemap actually ships.
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'

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

/** The curated label spec, shared by the Story and the Archive so the two maps
 *  read identically: hide the noisy tiers, normalise casing/" Ward" suffixes,
 *  and let province labels anchor the reader from a low zoom.
 *  (Full tier spec: docs/map-labels.md.) */
export function applyLabelCuration(map: maplibregl.Map) {
  normalizePlaceLabels(map)
  for (const g of readLabelGroups(map)) {
    if (!g.visible) setGroupVisible(map, g.layerIds, false)
    if (g.key === 'state') {
      for (const id of g.layerIds) {
        try {
          map.setLayerZoomRange(id, 4, 22)
        } catch {
          /* layer may not accept a zoom-range override */
        }
      }
    }
  }
}

// ── casing + name normalisation ───────────────────────────────────────────
// The basemap uppercases its state/other tiers (ATTAPEU, CHAMPASAK) while city
// and town labels are title-case; and since Vietnam's 2025 admin reform some
// OSM city nodes carry a literal " Ward" suffix (Nha Trang Ward) while others
// don't (Da Lat). Normalise both so every place reads the same:
//   - text-transform: none everywhere (title-case across the board)
//   - strip a trailing " Ward" / " Commune" from place names
//   - Latin name only (drops the non-Latin second line for neighbours)

/** Expression: the place's Latin name with any " Ward"/" Commune" tail cut off. */
function strippedName(): ExpressionSpecification {
  const name: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']]
  // ends-with, guarded so a short name can't false-match via index-of's -1
  // (e.g. a place literally named "Ward": -1 === 4-5 would slice it to "War").
  const endsWith = (suffix: string): ExpressionSpecification => [
    'all',
    ['>', ['length', ['var', 'n']], suffix.length],
    ['==', ['index-of', suffix, ['var', 'n']], ['-', ['length', ['var', 'n']], suffix.length]],
  ]
  const cut = (suffix: string): ExpressionSpecification => [
    'slice',
    ['var', 'n'],
    0,
    ['-', ['length', ['var', 'n']], suffix.length],
  ]
  return [
    'let',
    'n',
    name,
    ['case', endsWith(' Ward'), cut(' Ward'), endsWith(' Commune'), cut(' Commune'), ['var', 'n']],
  ]
}

export function normalizePlaceLabels(map: maplibregl.Map) {
  for (const l of map.getStyle().layers ?? []) {
    if (l.type !== 'symbol') continue
    const layout = (l as { layout?: Record<string, unknown> }).layout
    if (!layout || layout['text-field'] == null) continue
    try {
      // Uniform casing (kills the basemap's uppercase state/other tiers).
      map.setLayoutProperty(l.id, 'text-transform', 'none')
      // Suffix-stripped names for the place tiers that can carry " Ward".
      if (l['source-layer'] === 'place') map.setLayoutProperty(l.id, 'text-field', strippedName())
    } catch {
      /* layer doesn't support the override — leave it as shipped */
    }
  }
}
