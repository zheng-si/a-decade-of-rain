// ─────────────────────────────────────────────────────────────────────────
//  What is on this map, named once.
//
//  This replaces a set of regexes that matched against LAYER IDS and got it
//  badly wrong. Run against positron's real 19 text layers, the old classifier
//  put eight of them in the "city" bucket:
//
//    highway-name-path, highway-name-minor, highway-name-major,
//    highway-shield-non-us, road_shield_us, airport, label_other, label_city
//
//  — only the last of which is a city. So "Cities · shows from z 9" was also
//  staging every road name, both road shields and the airport, and changing
//  the city colour moved them too. `highway-shield-us-interstate` landed in
//  the province bucket, because `inter`STATE` matches /state/. The map still
//  looked like a working map, which is why it survived.
//
//  The fix is not a better regex. It is classifying on `source-layer`, which
//  is the vector tile's own answer to "what kind of thing is this" and cannot
//  be fooled by a substring:
//
//    place              → country / capital / city / town / village / other / province
//    water_name         → sea and lake names
//    waterway           → river names
//    transportation_name→ road names and shields
//    aerodrome_label    → airports
//
//  Only WITHIN `place` do we look at the id, because that is where positron
//  itself splits by attribute (capital=2, class=city|town|village) and the id
//  is the only handle on which split a layer belongs to.
//
//  LABELS AND GEOMETRY ARE SEPARATE. A label is text with a size, a face and a
//  zoom range; a fill is a colour. They were sharing one list of "layers",
//  which is why the panel could not offer either of them a full set of
//  controls. Two taxonomies, two sections.
// ─────────────────────────────────────────────────────────────────────────
import { Z_MID, Z_NEAR } from '../config/mapConfig'

/** Minimal shape we need off a style layer. Taking the LAYER rather than its
 *  id is the whole correction — `source-layer` is not reachable from a name. */
export interface LayerLike {
  id: string
  type: string
  'source-layer'?: string
}

/* ── labels ─────────────────────────────────────────────────────────────── */

export type LabelTier =
  // place
  | 'country' | 'capital' | 'city' | 'town' | 'village' | 'placeOther' | 'province'
  // water
  | 'sea' | 'river'
  // transport
  | 'airport' | 'roadName' | 'roadShield'
  // drawn by this project
  | 'mr' | 'island' | 'vnCountry'
  // anything the basemap adds that we have not named
  | 'other'

export interface LabelStyle {
  /** [px at Z_TYPE_FLOOR, px at Z_TYPE_TOP] — how big, never whether. */
  size: [number, number]
  /** [minzoom, maxzoom] — whether, never how big. The two are separate fields
   *  because conflating them is what made the panel unreadable. */
  zoom: [number, number]
  color: string
  halo: string
  haloWidth: number
  /** Glyph stack; '' inherits the map-wide face. Weight IS the stack. */
  font: string
  tracking: number
  /** Size spread by OpenMapTiles `rank` WITHIN this tier: 0 = every feature
   *  the same size, 0.4 = a rank-10 feature at 60% of a rank-1 one.
   *
   *  Per tier rather than one global slider, because it only means anything
   *  where the tier holds features of differing importance — `label_city`
   *  carries Hồ Chí Minh (rank 3) and small provincial seats (rank 7+) in the
   *  SAME layer, and nothing else can separate them. Tiers whose source has no
   *  `rank` leave it at 0; see RANKED below. */
  rankSpread: number
  /** Shipped visibility. Kept here so "what is hidden" and "how it is styled"
   *  are one answer, and so a tuner never has to race the map to find out. */
  shown: boolean
}

const HALO = 'rgba(250,249,244,0.92)'
const S = (o: Partial<LabelStyle>): LabelStyle => ({
  size: [8, 12], zoom: [0, 24], color: '#646464', halo: HALO, haloWidth: 1.1,
  font: '', tracking: 0.2, rankSpread: 0, shown: true, ...o,
})

/** Every label tier the map can draw, with its shipped appearance.
 *
 *  The settlement values are the ones already tuned and committed. The tiers
 *  that were previously invisible because they had been swept into `city` —
 *  roads, shields, the airport, `label_other` — arrive hidden, which is what
 *  they were in practice; the difference is that now they are hidden ON
 *  PURPOSE and can be switched on with a full set of controls. */
export const LABEL_TIERS: Record<LabelTier, LabelStyle> = {
  // ── places ──
  country: S({ size: [10.5, 15], zoom: [0, Z_MID], color: '#464e48' }),
  // The capital is no longer told apart by WEIGHT — it went back to the map's
  // medium and is separated by size and ink instead (15 vs 14 at the top of the
  // ramp, #424c45 vs #606662). A deliberate reversal of the Bold split: at
  // these sizes the extra weight read as a second typeface rather than a rank.
  capital: S({ size: [9.5, 15], color: '#424c45' }),
  city: S({ size: [9.5, 14], zoom: [0, 23], tracking: 0.15, color: '#606662' }),
  town: S({ size: [7.5, 11], color: '#767676', font: 'Roboto Condensed Regular', tracking: 0.1, zoom: [9, 24] }),
  // shown: false, and this is the row that made the two maps disagree. The
  // shared curation puts `village` in DEFAULT_HIDDEN — "P.9", "Thôn 7" and a
  // thousand wards are noise under a spray record — and the Story obeys it.
  // The Archive then runs volumeGrid's label pass afterwards, which reads THIS
  // table, saw shown: true, and switched every ward back on from z10. Same
  // basemap, same intent, opposite result, decided by which pass happened to
  // run last. The table is the one the Archive obeys, so the table has to say
  // what was actually decided.
  village: S({ size: [7, 10], color: '#8a8a8a', font: 'Roboto Condensed Light', zoom: [10, 24], shown: false }),
  // positron's third, unfiltered settlement tier. Documented in
  // docs/map-zoom-and-labels.md §7.2 as unmanaged; it now has a row.
  placeOther: S({ size: [7, 10], color: '#8a8a8a', font: 'Roboto Condensed Light', zoom: [Z_NEAR, 24], shown: false }),
  province: S({ size: [8, 11], color: '#8a8a8a', font: 'Roboto Condensed Light', tracking: 0.3, zoom: [4, 24], shown: false }),
  // ── water ──
  sea: S({ size: [10, 12], color: '#338199' }),
  river: S({ size: [8, 12], color: '#338199', tracking: 0.1 }),
  // ── transport ──
  airport: S({ size: [7.5, 9], zoom: [8, 24], tracking: 0.15, color: '#757575' }),
  // Road names and shields stay off. They are the tier that used to be swept
  // into `city`, and switching them on at this zoom ceiling puts bare route
  // numbers over the record.
  roadName: S({ size: [7, 9.5], color: '#9a9a9a', font: 'Roboto Condensed Light', zoom: [12, 24], shown: false }),
  roadShield: S({ size: [7, 9.5], color: '#9a9a9a', font: 'Roboto Condensed Light', zoom: [12, 24], shown: false }),
  // ── ours ──
  // The military regions are off entirely — labels here, and the dashed
  // borders at their call site in MapView. The record's own geography carries
  // the map now; the four zones were a second division competing with it.
  mr: S({ size: [11, 16], color: '#cf3720', halo: 'rgba(250,249,244,0.95)', haloWidth: 2, tracking: 0.1, zoom: [0, Z_NEAR], shown: false }),
  island: S({ size: [8.5, 11], color: '#6b7268', halo: '#ffffff', haloWidth: 1, tracking: 0 }),
  vnCountry: S({ size: [10.5, 15], zoom: [0, Z_MID], color: '#464e48' }),
  // ── unclassified ──
  // NOT a silent bucket. It has a row like every other tier, so a basemap that
  // grows a layer we have not named shows up in the panel instead of being
  // quietly styled as a city, which is exactly what used to happen.
  other: S({ size: [7, 10], color: '#9a9a9a', shown: false }),
}

/** Tiers whose source carries OpenMapTiles `rank`. Only these may use
 *  rankSpread — applying it elsewhere silently shrinks every feature to the
 *  `coalesce` default, because the property is simply absent. */
export const RANKED = new Set<LabelTier>(['country', 'capital', 'city', 'town', 'village', 'placeOther', 'province'])

/** Panel grouping. Order is the order the rows appear, and the groups are the
 *  reason the list is legible at fifteen tiers. */
export const LABEL_GROUPS: { key: string; label: string; tiers: LabelTier[] }[] = [
  { key: 'place', label: 'Places', tiers: ['country', 'capital', 'city', 'town', 'village', 'placeOther'] },
  { key: 'admin', label: 'Administrative', tiers: ['province'] },
  { key: 'water', label: 'Water', tiers: ['sea', 'river'] },
  { key: 'transport', label: 'Transport', tiers: ['airport', 'roadName', 'roadShield'] },
  { key: 'ours', label: 'Drawn by this project', tiers: ['vnCountry', 'mr', 'island'] },
  { key: 'rest', label: 'Unclassified', tiers: ['other'] },
]

export const LABEL_TIER_NAME: Record<LabelTier, string> = {
  country: 'Countries', capital: 'Capital · HÀ NỘI', city: 'Cities', town: 'Towns',
  village: 'Villages · wards', placeOther: 'Other settlements', province: 'Provinces · states',
  sea: 'Seas · lakes', river: 'Rivers · waterways',
  airport: 'Airports', roadName: 'Road names', roadShield: 'Road shields',
  mr: 'Military regions', island: 'Island notes', vnCountry: 'VIET NAM (ours)',
  other: 'Everything else',
}

/** Our own text layers, by exact id — the vector-tile taxonomy knows nothing
 *  about them, so they are matched before it is consulted. */
const OURS: Record<string, LabelTier> = {
  'mr-label': 'mr',
  'island-label': 'island',
  'vn-country-label-l': 'vnCountry',
}

/** Which label tier a text layer belongs to.
 *
 *  `source-layer` decides everything except the split inside `place`, where
 *  positron's own filters (capital=2, class=city|town|village) are only
 *  reachable through the layer id it gave them. */
export function labelTierOf(layer: LayerLike): LabelTier {
  if (OURS[layer.id]) return OURS[layer.id]
  switch (layer['source-layer']) {
    case 'water_name':
      return 'sea'
    case 'waterway':
      return 'river'
    case 'aerodrome_label':
      return 'airport'
    case 'transportation_name':
      return /shield/.test(layer.id) ? 'roadShield' : 'roadName'
    case 'place': {
      const id = layer.id
      if (/country/.test(id)) return 'country'
      if (/capital/.test(id)) return 'capital'
      if (/state|province/.test(id)) return 'province'
      if (/village|hamlet|suburb|neighbourhood|quarter/.test(id)) return 'village'
      if (/town/.test(id)) return 'town'
      if (/city/.test(id)) return 'city'
      return 'placeOther'
    }
    default:
      return 'other'
  }
}

/* ── geometry ───────────────────────────────────────────────────────────── */

export type GeomGroup =
  | 'water' | 'waterway' | 'landcover' | 'landuse' | 'park' | 'building'
  | 'road' | 'aeroway' | 'boundary' | 'terrain' | 'ours' | 'otherGeom'

export const GEOM_NAME: Record<GeomGroup, string> = {
  water: 'Water bodies', waterway: 'Rivers · canals', landcover: 'Woods · glaciers',
  landuse: 'Built-up land', park: 'Parks', building: 'Buildings',
  road: 'Roads', aeroway: 'Runways · taxiways', boundary: 'Borders',
  terrain: 'Hillshade', ours: 'The record (our layers)', otherGeom: 'Everything else',
}

/** Non-text layers, grouped the same way and by the same rule — the source
 *  layer, not the name. `background` is excluded by the caller. */
export function geomGroupOf(layer: LayerLike): GeomGroup {
  if (/^vol-|^mr-borders$/.test(layer.id)) return 'ours'
  if (layer.type === 'hillshade' || /hillshade|terrain/.test(layer.id)) return 'terrain'
  switch (layer['source-layer']) {
    case 'water': return 'water'
    case 'waterway': return 'waterway'
    case 'landcover': return 'landcover'
    case 'landuse': return 'landuse'
    case 'park': return 'park'
    case 'building': return 'building'
    case 'transportation': return 'road'
    case 'aeroway': return 'aeroway'
    case 'boundary': return 'boundary'
    default: return 'otherGeom'
  }
}

export const GEOM_GROUPS: GeomGroup[] = [
  'water', 'waterway', 'park', 'landcover', 'landuse', 'building',
  'road', 'aeroway', 'boundary', 'terrain', 'ours', 'otherGeom',
]
