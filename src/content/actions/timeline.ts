// Act II — "The Timeline": the remediation programme as one readable arc,
// 2009 to today. No interaction: an overview bar shows the three projects'
// spans, then a colour-coded card grid walks the key moments in reading
// order. 2009 copy follows the project's Figma; the rest is drawn from
// USAID / U.S. Embassy Vietnam / UNDP reporting, and the 2023-2026 entries
// from 2024-25 news coverage (AP, PBS, ProPublica) of the Biên Hòa project.

export type TlProject = 'programme' | 'phucat' | 'danang' | 'bienhoa'

export interface TlMoment {
  /** Display year: '2009', '2012', '2026'. */
  year: string
  project: TlProject
  /** Short editorial kicker above the body. */
  tag: string
  body: string
  /** Optional big-number callout for the landmark moments. */
  stat?: { value: string; label: string }
  /** Landmark moment: the card inverts to its project's gradient. */
  milestone?: boolean
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
    body: 'USAID and Vietnam’s Office 33 sign the memorandum of understanding that frames the Đà Nẵng project; assessment of the contamination begins.',
  },
  {
    year: '2011',
    project: 'danang',
    tag: 'A method is chosen',
    body: 'The assessment is complete. In-pile thermal desorption is selected: heat the soil until the dioxin molecule itself breaks apart.',
  },
  {
    year: '2012',
    project: 'phucat',
    tag: 'Phú Cát sealed',
    milestone: true,
    body: 'The smallest hotspot is dealt with first: ~7,500 m³ isolated in an engineered landfill on site, with UNDP, finished within the year.',
  },
  {
    year: '2012',
    project: 'danang',
    tag: 'Ground broken',
    body: 'In August, shovels hit the ground at Đà Nẵng: the first full-scale dioxin cleanup in Vietnam officially begins.',
  },
  {
    year: '2013',
    project: 'danang',
    tag: 'The pile rises',
    body: 'A sealed treatment structure the size of a football field is built, and the first ~45,000 m³ of soil and sediment are loaded in.',
  },
  {
    year: '2014',
    project: 'danang',
    tag: 'Heat on',
    body: 'Electrodes warm the pile to about 335 °C and hold it there for months, breaking the dioxin down inside the soil.',
  },
  {
    year: '2016',
    project: 'danang',
    tag: 'The scope grows',
    body: 'Phase 2 brings the treated total towards 90,000 m³, half as much again as planned; ~50,000 m³ of lighter soil is sealed under cover.',
  },
  {
    year: '2018',
    project: 'danang',
    tag: 'Đà Nẵng finished',
    milestone: true,
    stat: { value: '90,000 m³', label: 'treated · ≈ US$110 million' },
    body: 'November: declared complete; the land goes back to expand the airport.',
  },
  {
    year: '2019',
    project: 'bienhoa',
    tag: 'The big one begins',
    milestone: true,
    stat: { value: '500,000 m³', label: 'roughly 4× Đà Nẵng' },
    body: 'The United States and Vietnam launch the cleanup at Biên Hòa.',
  },
  {
    year: '2023',
    project: 'bienhoa',
    tag: 'First land back',
    body: 'The first remediated area at Biên Hòa is handed over for reuse; excavation passes 100,000 m³ in the years that follow.',
  },
  {
    year: '2025',
    project: 'bienhoa',
    tag: 'The money wobbles',
    body: 'A U.S. foreign-aid freeze halts the work; it restarts, with the grant raised to US$430 million and thermal treatment breaking ground.',
  },
  {
    year: '2026',
    project: 'bienhoa',
    tag: 'Unfinished',
    body: 'Most of the soil still waits its turn. The end date, once ~2030, now rides on whether the money keeps coming.',
  },
]

export const TIMELINE_HEAD = {
  title: 'Remediation Project Timeline',
  dek: 'From a signature to a finished cleanup, and into a bigger, unfinished one. Two decades of work at a glance.',
  note: 'Milestones from USAID and U.S. Embassy Vietnam fact sheets, the UNDP three-hotspots report, and 2024–25 news coverage of the Biên Hòa project.',
  sourceId: 'usaid_danang',
}
