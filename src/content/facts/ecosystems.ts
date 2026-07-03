// "The War-disrupted Ecosystems" — the second Act I interlude figure, built on
// the redrawn wartime vegetation map (public/figures/vegetation-map.svg,
// exported from the original Figma). The 7 vegetation classes match the SVG's
// fill colours. Impact figures are LITERATURE-sourced (Westing / NAS 1974), not
// the Figma's original numbers.

export interface VegType {
  /** Fill colour used in vegetation-map.svg. */
  color: string
  name: string
  /** Sprayed impact, where authoritative data exists (else undefined). */
  impact?: { fraction: number; label: string; sourceId: string }
}

// Legend order roughly by area, forest first (matches the map's dominant tones).
export const VEG_TYPES: VegType[] = [
  {
    color: '#B4CEC0',
    name: 'Forest',
    impact: { fraction: 0.35, label: '≈35% of the dense inland forest sprayed at least once', sourceId: 'westing_bioscience' },
  },
  { color: '#859F97', name: 'Forest, with slash / burn' },
  { color: '#DCEABD', name: 'Grassland' },
  { color: '#544685', name: 'Rice' },
  {
    color: '#ABA1CD',
    name: 'Mangrove',
    impact: { fraction: 0.4, label: '≈124,000 ha of mangrove destroyed — about 40%', sourceId: 'nas_1974' },
  },
  { color: '#61C1C2', name: 'Marshes & other inundated vegetation' },
  { color: '#EFE12A', name: 'Tree crops, chiefly rubber' },
]

export const ECOSYSTEMS = {
  eyebrow: 'What it fell on',
  title: 'The War-disrupted Ecosystems',
  dek: 'The spraying did not fall on empty ground. It settled onto a living map — triple-canopy forest, coastal mangrove, rice, rubber — and the damage to the soils, and thereby to the ecosystems, has proven far harder to quantify than the gallons themselves.',
  // Headline callout over the map.
  headline: { value: '≈3.1M ha', label: 'of forest & mangrove sprayed', sourceId: 'env_issues_wiki' },
  legendTitle: 'Vegetation of South Vietnam, c. 1970',
  note: 'Vegetation map redrawn from the project’s original infographic; impact figures from Westing (1971) and the U.S. National Academy of Sciences (1974).',
  mapAlt:
    'Map of South Vietnam shaded by vegetation type — forest, mangrove, rice, grassland, rubber and marsh.',
}
