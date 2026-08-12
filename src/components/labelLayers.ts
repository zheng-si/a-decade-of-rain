// Group the basemap's text (label) layers into readable tiers so they can be
// toggled from the UI. Works off the live style, so it adapts to whatever the
// basemap actually ships.
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { LABEL_FONT } from '../config/mapConfig'
import { textSizeRamp } from './mapTheme'
import { labelTierOf, LABEL_TIERS, type LabelTier, type LayerLike } from './mapTaxonomy'

export interface LabelGroup {
  key: string
  label: string
  layerIds: string[]
  visible: boolean
}

const CATS: { key: string; label: string }[] = [
  { key: 'country', label: 'Countries' },
  { key: 'state', label: 'Provinces / states' },
  { key: 'city', label: 'Cities' },
  { key: 'town', label: 'Towns' },
  { key: 'village', label: 'Villages, hamlets & wards' },
  { key: 'water', label: 'Seas, lakes & rivers' },
  { key: 'road', label: 'Roads' },
  { key: 'poi', label: 'Points of interest' },
  { key: 'airport', label: 'Airports' },
  { key: 'other', label: 'Other labels' },
]

/** Which visibility group a text layer belongs to.
 *
 *  This used to be ten regexes run against the layer id, and one of them was
 *  wrong in a way only the data could show: `/state|province|region/` matched
 *  `highway-shield-us-interSTATE`, so a US Interstate road shield was filed
 *  under "Provinces / states". Roads are hidden by default and provinces are
 *  not, so that layer stayed visible — and worse, applyLabelCuration forces
 *  every layer in the `state` group to zoom 4–22, so it was also pinned on
 *  from a continental zoom. Nothing rendered, because there are no US
 *  interstates in Vietnam, which is precisely why it survived: a mis-grouping
 *  whose only symptom is a wrong switch in a panel nobody ships.
 *
 *  So it now asks the taxonomy instead. labelTierOf reads `source-layer`
 *  first, which is a fact about the vector tile rather than a guess about a
 *  name, and only falls back to the id inside `place`, where positron's own
 *  filters genuinely are unreachable any other way. One classifier for both
 *  the type system and the visibility groups means they can no longer disagree
 *  about what a layer IS. */
const TIER_CAT: Record<LabelTier, string> = {
  country: 'country',
  capital: 'city',
  city: 'city',
  town: 'town',
  village: 'village',
  placeOther: 'other',
  province: 'state',
  sea: 'water',
  river: 'water',
  airport: 'airport',
  roadName: 'road',
  roadShield: 'road',
  // Our own three. They are added after this runs, so they never reach it —
  // but if that order ever changes they must not land in a group that gets
  // switched off, so they are named rather than left to the fallback.
  mr: 'ours',
  island: 'ours',
  vnCountry: 'ours',
  other: 'other',
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
    const k = TIER_CAT[labelTierOf(l as LayerLike)]
    if (k === 'ours') continue // never grouped, never switched off from here
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

/**
 * The label TYPE system — one tier table, both maps.
 *
 * The two surfaces had drifted into two label styles without anyone choosing
 * two. The Archive classifies every text layer by its vector tile's own
 * `source-layer` and gives each tier a colour, a face, a tracking value and a
 * size ramp (mapTaxonomy.ts, LABEL_TIERS); the Story only ever got
 * applyMapTheme's flat treatment — one colour and one face for country, city
 * and river alike. Same basemap, same palette, but a hierarchy on one page and
 * none on the other, which is what reads as "two maps".
 *
 * This applies the tier table's TYPOGRAPHY only. Visibility and zoom staging
 * stay with each surface, deliberately: the Archive is an instrument that
 * quiets the basemap to let the record speak, while the Story needs province
 * and town names to place a reader who has never seen this country. Those are
 * different questions from "what should a river name look like", and merging
 * the answers would silently delete labels the Story is using to orient.
 */
function applyLabelTypography(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue
    const lo = (layer as { layout?: Record<string, unknown> }).layout
    if (!lo || lo['text-field'] == null) continue
    const style = LABEL_TIERS[labelTierOf(layer as LayerLike)]
    try {
      map.setPaintProperty(layer.id, 'text-color', style.color)
      map.setPaintProperty(layer.id, 'text-halo-color', style.halo)
      map.setPaintProperty(layer.id, 'text-halo-width', style.haloWidth)
      map.setLayoutProperty(layer.id, 'text-letter-spacing', style.tracking)
      map.setLayoutProperty(layer.id, 'text-font', [style.font || LABEL_FONT])
      map.setLayoutProperty(layer.id, 'text-size', textSizeRamp(style.size[0], style.size[1]))
      // Which name survives a collision is a rule, not tile order: OpenMapTiles
      // ranks 1 as most important and MapLibre places the lowest key first.
      map.setLayoutProperty(layer.id, 'symbol-sort-key', [
        'case',
        ['has', 'rank'],
        ['to-number', ['get', 'rank']],
        100,
      ])
    } catch {
      /* layer doesn't take one of these — leave it as shipped */
    }
  }
}

/** The curated label spec, shared by the Story and the Archive so the two maps
 *  read identically: one tier type system, the noisy tiers hidden, casing and
 *  " Ward" suffixes normalised, and province labels anchoring the reader from a
 *  low zoom. (Full tier spec: docs/map-labels.md.) */
export function applyLabelCuration(map: maplibregl.Map) {
  applyLabelTypography(map)
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
