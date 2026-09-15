// "The Rainbow Herbicides" — the four agent groups used in Operation Ranch Hand,
// named for the coloured band painted on their 55-gallon drums. Volumes are the
// real per-agent totals aggregated at runtime from the HERBS dataset
// (spray.json); copy is sourced (see sourceIds). The `key`/`color` match
// mapConfig.agents so the chart, the map, and the Explore page speak one palette.

export interface AgentInfo {
  /** Matches mapConfig.agents[].key and the chart series key. */
  key: 'O' | 'W' | 'B' | 'other'
  /** Drum-band name. */
  name: string
  /** One-line purpose (from the Figma card). */
  tagline: string
  /** Active ingredients. */
  makeup: string
  /** What it was sprayed to do. */
  use: string
  /** The toxic legacy line. */
  legacy: string
  sourceIds: string[]
}

export const AGENTS: AgentInfo[] = [
  {
    key: 'O',
    name: 'Agent Orange',
    tagline: 'General defoliation of forest, brush, and broad-leaved crops',
    makeup: 'A 50/50 mix of the herbicides 2,4-D and 2,4,5-T (as butoxyethanol esters).',
    use: 'The workhorse defoliant, stripping the triple-canopy forest and mangrove that hid trails, camps and supply lines. Roughly 60% of all herbicide sprayed in Vietnam.',
    legacy:
      'Its manufacture left a trace of the dioxin TCDD, one of the most toxic compounds known. That contaminant, not the herbicide itself, is what still poisons soil and people half a century on.',
    sourceIds: ['va_basics', 'aspen_whatis'],
  },
  {
    key: 'W',
    name: 'Agent White',
    tagline: 'Forest defoliation where longer-term control is desired',
    makeup: 'A mix of 2,4-D and picloram.',
    use: 'A slower, longer-lasting defoliant used where the canopy had to be kept open for months. It needed no diesel thinner, so it could be sprayed as supplied.',
    legacy:
      'Free of dioxin, but picloram is exceptionally persistent: it can keep soil hostile to regrowth long after spraying stops.',
    sourceIds: ['va_basics'],
  },
  {
    key: 'B',
    name: 'Agent Blue',
    tagline: 'Rapid short-term defoliation, for grass control and use on rice',
    makeup: 'Cacodylic acid (an organic arsenic compound).',
    use: 'A desiccant that withered grasses and, above all, rice. This was the crop-destruction agent, aimed at the rice crops feeding North Vietnamese and Viet Cong forces.',
    legacy:
      'Arsenic-based rather than dioxin-based, but arsenic does not break down; it stays in the soil and water indefinitely.',
    sourceIds: ['va_basics'],
  },
  {
    key: 'other',
    name: 'Agents Purple, Pink and Green',
    tagline: 'The early defoliants, used before Agent Orange took over',
    makeup: 'Other 2,4,5-T formulations (Purple, Pink, Green).',
    use: 'The first-generation agents of the early 1960s, largely replaced by Agent Orange from 1965.',
    legacy:
      'Made with an earlier process, several of these carried far higher dioxin levels than Agent Orange itself: a small sprayed volume with an outsized toxic footprint.',
    sourceIds: ['aspen_whatis', 'stellman_2003'],
  },
]

export const RAINBOW = {
  title: 'The Rainbow Herbicides',
  dek: 'Ranch Hand sprayed a family of defoliants, each known by the colour banded on its drum. Together they came to nearly 20 million gallons, yet they were far from equal, in volume and in what they left behind.',
  chartTitle: 'Herbicide sprayed per year, by agent',
  chartUnit: 'U.S. gallons',
  chartNote: 'Real spray volumes from the HERBS spray records (Stellman et al., 2003).',
  chartSourceId: 'stellman_2003',
  // The year typology, which stands on its own under the chart and carries its
  // own heading, dek and unit line. The unit changes with the scale, so there
  // are two of it: in Volume a drop is a fixed quantity of herbicide, in Share
  // the field itself is the unit.
  fieldHeading: 'The mixture changed',
  fieldDek:
    'Every year of the record as a field of drops — one drop to 40,000 gallons, or the whole field to the whole year. The volume swells and collapses inside a decade, and what the drops are made of changes with it.',
  fieldTitle: 'Each year as a field of drops',
  fieldUnitVol: 'one drop = 40,000 U.S. gallons',
  fieldUnitShare: '144 drops = the whole year',
  fieldNoteVol:
    'Volume: a drop is 40,000 U.S. gallons, so every field is the same measure — 1967 fills 127 of its 144, and 1971 does not fill one. An agent that sprayed never rounds away to nothing, so the lightest years carry a drop apiece. 1961 is in the record with no volume against its name.',
  fieldNoteShare:
    'Share: every year gets the whole field, whatever it sprayed — which is the only way the early years, each under 5% of the peak, can be read at all.',
}
