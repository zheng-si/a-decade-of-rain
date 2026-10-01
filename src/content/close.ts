// Epilogue — "The Close": the bookend to the hook. A dark, quiet statement
// (the rain slowing to a stop), verified ways to act, then the full sources
// ledger and a colophon. Organisations verified July 2026; links open in a
// new tab. No logos by design: wordmark-style cards keep the licensing clean
// and the row visually consistent.

export const CLOSE_HEAD = {
  // The \u00A0 keeps the year glued to its preposition, so the line breaks
  // after "stopped" instead of stranding "1971." at the start of line two.
  statement: 'The rain stopped in\u00A01971. The work has not.',
  body: 'Half a century on, the largest hotspot is mid-excavation and its funding is no longer certain. The cleanup continues either way, in cubic metres, year by year. Attention is a contribution too: know the story, follow the work, and if you can, support the people still living with it.',
}

export interface CloseAction {
  name: string
  role: string
  desc: string
  action: string
  url: string
}

export const CLOSE_ACTIONS: CloseAction[] = [
  {
    name: 'USAID Vietnam',
    role: 'Official Programme',
    desc: 'The joint U.S.–Vietnam remediation effort: fact sheets, progress and project documents.',
    action: 'Follow the work',
    url: 'https://vn.usembassy.gov/fact-sheets-dioxin-remediation-at-bien-hoa-airbase-area/',
  },
  {
    name: 'VAVA',
    role: 'Victims’ Association',
    desc: 'The Vietnam Association for Victims of Agent Orange: 400,000 members, chapters in every province, direct support to affected families.',
    action: 'Donate',
    url: 'http://www.vava.org.vn/',
  },
  {
    name: 'Vietnam Veterans of America',
    role: 'Veterans’ Association',
    desc: 'The veterans’ own membership organisation: it campaigned for the presumptions behind today’s claims, and guides veterans and their families through the VA process.',
    action: 'Get involved',
    url: 'https://vva.org/what-we-do/outreach-programs/agent-orange/',
  },
  {
    name: 'War Legacies Project',
    role: 'Research · Advocacy',
    desc: 'Two decades of fieldwork documenting Agent Orange’s legacy and supporting families in rural Vietnam and Laos.',
    action: 'Get involved',
    url: 'https://www.warlegacies.org/',
  },
]

/** The record's own card, beside the Atlas's: the people and the system every
 *  map on the site is drawn from. Jeanne Mager Stellman asked (September 2026)
 *  that HEA-V and the data she and Steven Stellman gathered be acknowledged
 *  on the page, not only in the ledger; the four organisations credit the
 *  work, this credits the record. Spans two columns beside the Atlas. */
export const CLOSE_RECORD = {
  role: 'The Data',
  name: 'HEA-V, by the Stellmans',
  desc: 'Herbicide Exposure Assessment, Vietnam: the system Jeanne Mager Stellman and Steven D. Stellman built at Columbia University, and the spray records they gathered, corrected and collected over decades. Every map on this site is drawn from it. Andrew Stellman keeps it open on GitHub.',
  action: 'View hea-v on GitHub',
  url: 'https://github.com/andrewstellman/hea-v',
}

/** The site's own door, for the phone. The rail that carries "Explore the
 *  Record" on the desktop is hidden there, and the record node's CTA has
 *  scrolled away by the time a reader reaches the close, so the Atlas had one
 *  way in and it was fifteen thousand pixels back (the phone pass, PR #195).
 *  A fifth card among the four organisations', on the accent so it reads as
 *  ours; Story.css shows it on phones only. */
export const CLOSE_ATLAS = {
  role: 'The Record',
  name: 'Explore the Record',
  desc: 'Every spray run behind this story, drawn as it was flown. Search a place, play the decade, open any flight.',
  action: 'Open the Atlas',
  to: '/archive',
}

// The sources ledger, grouped for reading. Entries reference SOURCES ids
// where one exists; photo credits are listed inline (they have no URL of
// record beyond the Commons file pages).
export interface RefGroup {
  title: string
  /** ids into SOURCES */
  sourceIds?: string[]
  /** The ledger's own fuller credit for a source, by id, where the short
   *  form the story's chips use ("Stellman et al. 2003") is not enough. */
  publishers?: Record<string, string>
  /** free-form lines (photo credits) */
  lines?: string[]
}

export const REF_GROUPS: RefGroup[] = [
  {
    title: 'Data',
    // The Stellmans first: their system and their record are what every map
    // here is drawn from.
    sourceIds: ['heav', 'stellman_2003', 'nas_1974', 'westing_bioscience', 'aso_stoten'],
    publishers: {
      stellman_2003: 'J. M. Stellman, S. D. Stellman, R. Christian, T. Weber and C. Tomasallo, 2003',
    },
    lines: [
      'Spray missions: HERBS, the revised file of Stellman et al. (2003), via hea-v at commit cb5948b. 9,141 missions, 11,273 runs, 24,604 waypoint rows, 1961–1971',
    ],
  },
  {
    title: 'Reports and Fact Sheets',
    sourceIds: ['usaf_ranchhand', 'usaid_danang', 'usembassy_bienhoa', 'undp_hotspots', 'va_basics', 'va_conditions', 'ao_act_1991', 'aspen_whatis', 'aspen_bienhoa'],
  },
  {
    title: 'News and Features',
    sourceIds: ['yale_e360', 'pulitzer_forest', 'va_news', 'aorecord_hotspots'],
  },
  {
    title: 'Photographs',
    lines: [
      'The Land: U.S. Air Force and U.S. Army photographs (public domain); RANCH HAND Collection, Vietnam Archive, Texas Tech University',
      'The Body: Alexis Duclos and other photographers via Wikimedia Commons (Creative Commons)',
      'The Actions and Methods: U.S. Air Force and USAID Vietnam project photographs (public domain)',
    ],
  },
]

export const COLOPHON = {
  lines: [
    'A story about what fell, what it broke, and what it takes to clean it up.',
    'Built with React, MapLibre GL and Scrollama.',
    'Set in Courier Prime and Geist.',
  ],
  credit: 'Designed and built by Si Zheng',
  email: 'zhengsi0709@gmail.com',
}
