// Act II — "The Timeline": the remediation programme as one readable arc,
// 2009 to the present. No interaction: an overview bar shows the three
// projects' spans, then a colour-coded spine walks the key moments. Facts
// follow USAID / U.S. Embassy Vietnam / UNDP public reporting (see sourceId).

export type TlProject = 'programme' | 'phucat' | 'danang' | 'bienhoa'

export interface TlMoment {
  /** Display year: '2009', '2012', '2020s'. */
  year: string
  project: TlProject
  /** Short editorial kicker above the body. */
  tag: string
  body: string
  /** Optional big-number callout for the landmark moments. */
  stat?: { value: string; label: string }
}

/** The three projects' spans for the overview bar. */
export interface TlSpan {
  key: Exclude<TlProject, 'programme'>
  name: string
  status: string
  start: number
  end: number
  /** Open-ended: the bar fades out instead of closing. */
  ongoing?: boolean
}

export const TL_AXIS = { min: 2009, max: 2031, ticks: [2010, 2015, 2020, 2025, 2030] }

export const TL_SPANS: TlSpan[] = [
  { key: 'phucat', name: 'Phú Cát', status: 'Contained', start: 2011, end: 2012 },
  { key: 'danang', name: 'Đà Nẵng', status: 'Completed', start: 2012, end: 2018 },
  { key: 'bienhoa', name: 'Biên Hòa', status: 'Ongoing', start: 2019, end: 2030, ongoing: true },
]

export const TL_MOMENTS: TlMoment[] = [
  {
    year: '2009',
    project: 'programme',
    tag: 'The handshake',
    body: 'USAID and Vietnam’s Office 33 sign the Memorandum of Understanding that frames the Đà Nẵng Airport Remediation Project, and the environmental assessment of the contamination begins.',
  },
  {
    year: '2011',
    project: 'danang',
    tag: 'A method is chosen',
    body: 'The assessment is complete. In-pile thermal desorption, heating the soil until the dioxin molecule breaks apart, is selected as the treatment technology.',
  },
  {
    year: '2012',
    project: 'phucat',
    tag: 'Phú Cát sealed',
    body: 'The smallest hotspot is dealt with first: about 7,500 m³ of contaminated soil is isolated in an engineered landfill on site, a Vietnam and UNDP project finished within the year.',
  },
  {
    year: '2012',
    project: 'danang',
    tag: 'Ground broken at Đà Nẵng',
    body: 'In August, shovels hit the ground: the first full-scale dioxin cleanup in Vietnam officially begins.',
  },
  {
    year: '2013',
    project: 'danang',
    tag: 'The pile rises',
    body: 'A sealed above-ground treatment structure the size of a football field is built, and the first ~45,000 m³ of soil and sediment are loaded in.',
  },
  {
    year: '2014',
    project: 'danang',
    tag: 'Heat on',
    body: 'Phase 1 heating switches on in April: electrodes warm the pile to about 335 °C and hold it there for months, breaking the dioxin down inside the soil.',
  },
  {
    year: '2016',
    project: 'danang',
    tag: 'The scope grows',
    body: 'Phase 2 loading brings the treated total towards 90,000 m³, half as much again as first planned; roughly 50,000 m³ of lightly contaminated soil is sealed under an engineered cover instead.',
  },
  {
    year: '2018',
    project: 'danang',
    tag: 'Đà Nẵng finished',
    stat: { value: '90,000 m³', label: 'treated · 50,000 m³ contained · ≈ US$110 million' },
    body: 'In November the project is declared complete, and the land is handed back to expand the airport.',
  },
  {
    year: '2019',
    project: 'bienhoa',
    tag: 'The big one begins',
    stat: { value: '500,000 m³', label: 'roughly four times Đà Nẵng' },
    body: 'In April the United States and Vietnam launch the Biên Hòa cleanup, planned to take at least a decade.',
  },
  {
    year: '2020s',
    project: 'bienhoa',
    tag: 'Still digging',
    body: 'Excavation and the first treatment cells advance year by year. Cuts to U.S. funding in 2025 have thrown the schedule into doubt; the work, and the story, are not finished.',
  },
]

export const TIMELINE_HEAD = {
  eyebrow: 'Act II · The timeline',
  title: 'Remediation Project Timeline',
  dek: 'From a signature to a finished cleanup, and into a bigger, unfinished one. Two decades of work, read top to bottom.',
  note: 'Milestones from USAID and U.S. Embassy Vietnam fact sheets and the UNDP three-hotspots report.',
  sourceId: 'usaid_danang',
}
