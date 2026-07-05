// Act II — the remediation alternatives USAID evaluated for Biên Hòa, and how
// they compare on cost and CO2 emissions.
//
// Values are read off the project's Figma comparison chart (which draws on the
// USAID / CDM Smith environmental assessment for Biên Hòa). They are rounded,
// indicative figures for comparing options, not quotes.

export type AltFamily = 'containment' | 'hybrid' | 'treatment'

export interface Alternative {
  key: string
  /** Short label under the chart columns. */
  label: string
  /** Column label lines as drawn in the design (numbers get bolded). */
  chartLines: string[]
  /** Longer name used in the family cards / tooltips. */
  name: string
  family: AltFamily
  costM: number
  co2Kt: number
  /** Survived USAID's screening (with the two hybrids, the shortlist). */
  retained: boolean
  /** Why the alternative was screened out, for the reveal row. */
  screenNote?: string
}

export const ALT_FAMILIES: Record<AltFamily, { title: string; blurb: string; methodChips: string[] }> = {
  containment: {
    title: 'Containment only',
    blurb: 'Seal everything in an engineered landfill. Cheapest and quickest, but the dioxin is isolated, not destroyed.',
    methodChips: ['Landfill'],
  },
  hybrid: {
    title: 'Hybrid',
    blurb: 'Split the soil by concentration: contain what sits below a dioxin threshold, treat the worst of it thermally.',
    methodChips: ['Landfill + Ex Situ Tch'],
  },
  treatment: {
    title: 'Treatment only',
    blurb: 'Destroy the dioxin in every cubic metre. The most thorough option, and by far the most expensive.',
    methodChips: ['Incineration', 'Ex Situ Tch', 'MCD'],
  },
}

export const ALTERNATIVES: Alternative[] = [
  {
    key: 'landfill',
    label: 'Passive landfill',
    chartLines: ['Landfill'],
    name: 'Passive landfill (containment)',
    family: 'containment',
    costM: 135,
    co2Kt: 19,
    retained: true,
  },
  {
    key: 'hybrid2500',
    label: 'Landfill + thermal, 2,500 ppt split',
    chartLines: ['Landfill < 2500 PPT +', 'Ex Situ Tch > 2500 PPT'],
    name: 'Hybrid: contain below 2,500 ppt, treat above',
    family: 'hybrid',
    costM: 240,
    co2Kt: 33,
    retained: true,
  },
  {
    key: 'hybrid1200',
    label: 'Landfill + thermal, 1,200 ppt split',
    chartLines: ['Landfill < 1200 PPT +', 'Ex Situ Tch > 1200 PPT'],
    name: 'Hybrid: contain below 1,200 ppt, treat above',
    family: 'hybrid',
    costM: 335,
    co2Kt: 52,
    retained: true,
  },
  {
    key: 'incineration',
    label: 'Incineration',
    chartLines: ['Incineration'],
    name: 'Incineration (off-site burn)',
    family: 'treatment',
    costM: 665,
    co2Kt: 79,
    retained: false,
    screenNote: 'Cost and energy waste are too high; the offgas emissions might raise public concern.',
  },
  {
    key: 'thermal',
    label: 'Ex-situ thermal',
    chartLines: ['Ex Situ Tch (Thermal', 'Conducting Heating)'],
    name: 'Ex-situ thermal treatment (conductive heating)',
    family: 'treatment',
    costM: 535,
    co2Kt: 62,
    retained: false,
    screenNote: 'Building the facilities is time-consuming and hard to apply at whole-site scale.',
  },
  {
    key: 'mcd',
    label: 'MCD',
    chartLines: ['MCD (Mechano-', 'Chemical Destruction)'],
    name: 'Mechanochemical destruction',
    family: 'treatment',
    costM: 600,
    co2Kt: 31,
    retained: false,
    screenNote: 'The technology is immature.',
  },
]

export const ALTS = {
  eyebrow: 'Act II · The alternatives',
  title: 'The Remediation Alternatives',
  dek: 'For Biên Hòa, USAID weighed six ways to deal with half a million cubic metres of contaminated soil. They fall into three families: contain it all, destroy it all, or split the difference.',
  chartTitle: 'What each alternative costs, and what it emits',
  arrow: 'Increasing cost and complexity',
  revealLabel: 'Find out what alternatives USAID retained',
  revealBanner: 'After screening, 3 alternatives are retained',
  retainedLabel: 'Retained',
  note: 'Cost and CO2 figures are rounded, indicative values from the USAID environmental assessment for Biên Hòa, for comparing alternatives rather than quoting budgets.',
  sourceId: 'usembassy_bienhoa',
}
