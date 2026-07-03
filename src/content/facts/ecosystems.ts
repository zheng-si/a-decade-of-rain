// "The War-disrupted Ecosystems" — the interactive vegetation figure.
// The map (src/figures/vegetation-map.svg) is coloured by these 7 classes; the
// colours here MUST match the SVG fills (that's how highlight/legend line up).
//
// AREAS are in thousands of hectares (×10³ ha). Each type shows two numbers:
//   sprayed — area sprayed once or more
//   total   — total area of that vegetation type in South Vietnam
// so the bar reads sprayed-over-total, and the headline % = sprayed / total.
//
// DATA STATUS (please confirm/replace from the Figma source):
//   ✓ literature-confirmed: forest (dense, ~35% — Westing 1971),
//     mangrove (~124k ha / ~40% — NAS 1974), rice (~2%).
//   ~ ESTIMATE, pending your numbers: slashburn, grassland, marsh, rubber.

export type VegKey = 'forest' | 'slashburn' | 'grassland' | 'rice' | 'mangrove' | 'marsh' | 'rubber'

export interface VegType {
  key: VegKey
  /** Must equal the fill in vegetation-map.svg. */
  color: string
  name: string
  /** Thousands of hectares. */
  sprayed: number
  total: number
  /** true = literature-sourced; false = estimate pending confirmation. */
  sourced: boolean
  sourceId?: string
}

export const VEG_TYPES: VegType[] = [
  { key: 'forest', color: '#9DBFAB', name: 'Forest', sprayed: 1925, total: 5500, sourced: true, sourceId: 'westing_bioscience' },
  { key: 'slashburn', color: '#859F97', name: 'Forest, with slash / burn', sprayed: 300, total: 1200, sourced: false },
  { key: 'grassland', color: '#C9DD95', name: 'Grassland', sprayed: 50, total: 700, sourced: false },
  { key: 'rice', color: '#544685', name: 'Rice', sprayed: 60, total: 2900, sourced: true, sourceId: 'nas_1974' },
  { key: 'mangrove', color: '#ABA1CD', name: 'Mangrove', sprayed: 124, total: 291, sourced: true, sourceId: 'nas_1974' },
  { key: 'marsh', color: '#61C1C2', name: 'Marshes & other inundated vegetation', sprayed: 8, total: 350, sourced: false },
  { key: 'rubber', color: '#E4CA1C', name: 'Tree crops, chiefly rubber', sprayed: 25, total: 120, sourced: false },
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
  note: 'Vegetation map redrawn from the project’s source infographic (after Westing / SIPRI). Sprayed and total areas: Westing (1971) and the U.S. National Academy of Sciences (1974); figures marked “est.” await confirmation.',
  mapAlt: 'Map of South Vietnam shaded by vegetation type — forest, mangrove, rice, grassland, rubber and marsh.',
}
