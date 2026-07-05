// Epilogue — "The Close": the bookend to the hook. A dark, quiet statement
// (the rain slowing to a stop), verified ways to act, then the full sources
// ledger and a colophon. Organisations verified July 2026; links open in a
// new tab. No logos by design: wordmark-style cards keep the licensing clean
// and the row visually consistent.

export const CLOSE_HEAD = {
  eyebrow: 'Epilogue',
  statement: 'The rain stopped in 1971. The work has not.',
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
    role: 'Official programme',
    desc: 'The joint U.S.–Vietnam remediation effort: fact sheets, progress and project documents.',
    action: 'Follow the work',
    url: 'https://vn.usembassy.gov/fact-sheets-dioxin-remediation-at-bien-hoa-airbase-area/',
  },
  {
    name: 'VAVA',
    role: 'Victims’ association',
    desc: 'The Vietnam Association for Victims of Agent Orange: 400,000 members, chapters in all 63 provinces, direct support to affected families.',
    action: 'Donate',
    url: 'http://www.vava.org.vn/',
  },
  {
    name: 'VAORRC',
    role: 'US relief campaign',
    desc: 'The Vietnam Agent Orange Relief & Responsibility Campaign; tax-deductible giving via Veterans For Peace.',
    action: 'Donate (US)',
    url: 'https://www.vn-agentorange.org/',
  },
  {
    name: 'War Legacies Project',
    role: 'Research · advocacy',
    desc: 'Two decades of fieldwork documenting Agent Orange’s legacy and supporting families in rural Vietnam and Laos.',
    action: 'Get involved',
    url: 'https://www.warlegacies.org/',
  },
]

// The sources ledger, grouped for reading. Entries reference SOURCES ids
// where one exists; photo credits are listed inline (they have no URL of
// record beyond the Commons file pages).
export interface RefGroup {
  title: string
  /** ids into SOURCES */
  sourceIds?: string[]
  /** free-form lines (photo credits) */
  lines?: string[]
}

export const REF_GROUPS: RefGroup[] = [
  {
    title: 'Data',
    sourceIds: ['stellman_2003', 'nas_1974', 'westing_bioscience'],
    lines: [
      'Spray missions: HERBS file digitisation (24,604 runs, 1961–1971) behind Stellman et al. 2003',
    ],
  },
  {
    title: 'Reports & fact sheets',
    sourceIds: ['usaf_ranchhand', 'usaid_danang', 'usembassy_bienhoa', 'undp_hotspots', 'va_basics', 'aspen_whatis', 'aspen_bienhoa'],
  },
  {
    title: 'News & features',
    sourceIds: ['yale_e360', 'pulitzer_forest', 'va_news', 'aorecord_hotspots'],
  },
  {
    title: 'Photographs',
    lines: [
      'The Land: U.S. Air Force and U.S. Army photographs (public domain); RANCH HAND Collection, Vietnam Archive, Texas Tech University',
      'The Body: Alexis Duclos and other photographers via Wikimedia Commons (Creative Commons)',
      'The Actions & Methods: USAID Vietnam project photographs (public domain)',
    ],
  },
]

export const COLOPHON = {
  lines: [
    'A story about what fell, what it broke, and what it takes to clean it up.',
    'Built with React, MapLibre GL and Scrollama.',
  ],
  credit: 'Designed & built by Si Zheng',
  email: 'zhengsi0709@gmail.com',
}
