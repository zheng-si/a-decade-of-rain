// "The War-disrupted Ecosystems" — the interactive vegetation figure.
// The map (src/figures/vegetation-map.svg) is coloured by these 7 classes; the
// colours here MUST match the SVG fills (that's how highlight/legend line up).
//
// AREAS are in thousands of hectares (×10³ ha). Each type shows two numbers:
//   sprayed — area sprayed once or more
//   total   — total area of that vegetation type in South Vietnam
// so the bar reads sprayed-over-total, and the headline % = sprayed / total.
//
// DATA STATUS:
//   ✓ literature-confirmed:
//       forest    — 35% of ~5.5M ha dense forest (Westing 1971).
//       mangrove  — 105k of 291k ha = 36% (Westing 1971; Stellman et al. 2003).
//       rice      — ~200k ha of crop spraying, chiefly rice (NAS 1974 / Stellman).
//   ~ ESTIMATE (not separately tabulated in the literature; a spray-track ×
//     land-cover GIS overlay is the only rigorous source — see scripts/overlay):
//       slashburn, grassland, marsh, rubber.

export type VegKey = 'forest' | 'slashburn' | 'grassland' | 'rice' | 'mangrove' | 'marsh' | 'rubber'

export interface VegType {
  key: VegKey
  /** Soft map/swatch fill. Must equal the fill in vegetation-map.svg. */
  color: string
  /** Darker, same-hue colour for the big headline number — the soft fill is
   *  too pale to read as type on the paper background. */
  ink: string
  name: string
  /** Thousands of hectares. */
  sprayed: number
  total: number
  /** true = literature-sourced; false = estimate pending confirmation. */
  sourced: boolean
  sourceId?: string
}

export const VEG_TYPES: VegType[] = [
  { key: 'forest', color: '#8FB4A0', ink: '#3F6D55', name: 'Forest', sprayed: 1925, total: 5500, sourced: true, sourceId: 'westing_bioscience' },
  { key: 'slashburn', color: '#859F97', ink: '#4C6459', name: 'Forest, with slash / burn', sprayed: 300, total: 1200, sourced: false },
  { key: 'grassland', color: '#C3D888', ink: '#5E7A2C', name: 'Grassland', sprayed: 50, total: 700, sourced: false },
  { key: 'rice', color: '#544685', ink: '#4A3D77', name: 'Rice', sprayed: 200, total: 2900, sourced: true, sourceId: 'nas_1974' },
  { key: 'mangrove', color: '#ABA1CD', ink: '#5C4F97', name: 'Mangrove', sprayed: 105, total: 291, sourced: true, sourceId: 'nas_1974' },
  { key: 'marsh', color: '#61C1C2', ink: '#2C7E7F', name: 'Marshes & other inundated vegetation', sprayed: 8, total: 350, sourced: false },
  { key: 'rubber', color: '#DDC21A', ink: '#7C6D0F', name: 'Tree crops, chiefly rubber', sprayed: 25, total: 120, sourced: false },
]

/** Axis maximum for the shared scale (×10³ ha), a round step above the biggest total. */
export const VEG_AXIS_MAX = 6000
export const VEG_AXIS_STEP = 2000

export const ECOSYSTEMS = {
  eyebrow: 'What it fell on',
  title: 'The War-disrupted Ecosystems',
  dek: 'The spraying did not fall on empty ground. It settled onto a living map of triple-canopy forest, coastal mangrove, rice and rubber. The damage to the soils, and thereby to the ecosystems, has proven far harder to quantify than the gallons themselves.',
  scaleUnit: '×10³ ha',
  scaleSprayed: 'Area sprayed once or more',
  scaleTotal: 'Area of type',
  note: 'Vegetation map redrawn from the war-era U.S. land-use survey (after Westing / SIPRI). Well-documented shares: dense forest ~35% and mangrove ~36% sprayed one or more times (Westing 1971; Stellman et al. 2003, ~105,000 of 291,000 ha), plus ~200,000 ha of crop spraying, chiefly rice (NAS 1974). Types marked “est.” are not separately tabulated in the literature and await a spray-track overlay.',
  mapAlt: 'Map of South Vietnam shaded by vegetation type — forest, mangrove, rice, grassland, rubber and marsh.',
}
