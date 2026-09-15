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

/** What the figure measures about itself, handed to the copy above so a caption
 *  can never disagree with the grid it sits under. */
export interface FieldNums {
  /** Gallons per mark, already grouped: "20,000". */
  gal: string
  /** Marks in one year's field. */
  cells: number
  peakYear: number
  /** Marks the peak year fills, as the figure actually draws it. */
  peakFill: number
}

export const RAINBOW = {
  title: 'The Rainbow Herbicides',
  dek: 'Ranch Hand sprayed a family of defoliants, each known by the colour banded on its drum. Together they came to nearly 20 million gallons, yet they were far from equal, in volume and in what they left behind.',
  chartTitle: 'Herbicide sprayed per year, by agent',
  chartUnit: 'U.S. gallons',
  chartNote: 'Real spray volumes from the HERBS spray records (Stellman et al., 2003).',
  chartSourceId: 'stellman_2003',
  // The year typology, which stands on its own under the chart and carries its
  // own heading, dek and unit line.
  //
  // FUNCTIONS, not strings, for every line that states a number. These used to
  // be literals -- "one drop = 40,000 U.S. gallons", "1967 fills 127 of its
  // 144" -- and the moment the field's geometry moved they were quietly false
  // while still reading as authoritative. The figure now hands them its own
  // arithmetic, so a caption cannot disagree with the grid above it. Anything
  // here that is NOT a function is a fact about the record rather than about
  // the drawing, and does not move when the geometry does.
  fieldHeading: 'The mixture changed',
  fieldDek: (n: FieldNums) =>
    `Every year of the record as a field of drops \u2014 one drop to ${n.gal} gallons, or the whole field to the whole year. The volume swells and collapses inside a decade, and what the drops are made of changes with it.`,
  fieldTitle: 'Each year as a field of drops',
  fieldUnitVol: (n: FieldNums) => `one drop = ${n.gal} U.S. gallons`,
  fieldUnitShare: (n: FieldNums) => `${n.cells} drops = the whole year`,
  fieldNoteVol: (n: FieldNums) =>
    `Volume: a drop is ${n.gal} U.S. gallons, so every field is the same measure \u2014 ${n.peakYear} fills ${n.peakFill} of its ${n.cells}. An agent that sprayed never rounds away to nothing, so a year worth barely one drop still carries one for each agent in it.`,
  // 1962, 1963 and 1964 are 0.79%, 1.77% and 4.39% of the peak. A fact about
  // the record, so it is a string.
  fieldNoteShare:
    'Share: every year gets the whole field, whatever it sprayed \u2014 which is the only way the early years, each under 5% of the peak, can be read at all.',
  // Always shown, in both scales, and worded for whether 1961 has a field or
  // not. A year that is in the record and carries nothing is a fact about the
  // record; hiding its field removed the only place that fact was visible, so
  // it moves into the prose instead of disappearing with the grid.
  //
  // "Spray points", not missions: a HERBS row is a waypoint record (24,604 of
  // them resolve into 9,141 missions, see src/data/README.md), so six rows are
  // six points on a track, not six sorties.
  fieldNoteNil: (hidden: boolean) =>
    hidden
      ? ' 1961 has no field here, which is the record rather than an omission: it carries six spray points and no volume against any of them.'
      : ' 1961 is in the record as six spray points with no volume against any of them.',
}
