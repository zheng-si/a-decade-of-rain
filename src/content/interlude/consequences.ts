// Interlude — "The Consequences": the human & health legacy that bridges Act I
// (what fell) and Act II (the cleanup). Sober, stat-forward.
//
// Figures are the most widely cited estimates (Government of Vietnam and the
// Vietnamese Red Cross); health causation remains scientifically contested and
// hard to quantify — the copy says so.

export interface ConsequenceStat {
  value: string
  label: string
  sourceId?: string
}

export const CONSEQUENCE_STATS: ConsequenceStat[] = [
  { value: 'Up to 4M', label: 'Vietnamese exposed to the herbicides', sourceId: 'impact_wiki' },
  { value: '~3M', label: 'estimated to have suffered illness', sourceId: 'impact_wiki' },
  { value: '≥150,000', label: 'children born with serious birth defects', sourceId: 'impact_wiki' },
  { value: '7–11 yrs', label: 'dioxin’s half-life in the human body', sourceId: 'va_basics' },
]

export const CONSEQUENCES = {
  eyebrow: 'The consequences',
  title: 'What the Dioxin Left Behind',
  dek: 'The spraying stopped in 1971; the poison did not leave with it. The herbicides broke down within weeks — but the trace of dioxin they carried did not. It settled into soil, sediment and the fatty tissue of living bodies, where it is still measured today. This is the part of the story with no end date.',
  body: [
    'Dioxin (TCDD) is not the herbicide itself but a by-product of making it — one of the most toxic compounds ever studied. It is fat-soluble and slow to break down, so it climbs the food chain and lingers in the body for years, crossing the placenta and passing into breast milk.',
    'That persistence is why the harm did not end with the war. Elevated rates of cancers, birth defects and developmental disability have followed the exposed and, studies suggest, their children after them — a toll now counted across a second, third and fourth generation.',
  ],
  note: 'Estimates: Government of Vietnam and the Vietnamese Red Cross (via the impact summary); dioxin toxicology from the U.S. Dept. of Veterans Affairs. Human-health causation remains scientifically contested and hard to quantify; these are the most widely cited figures.',
}
