// Facts — the opening hook / banner. Edit copy and the opening camera here.
export const HOOK = {
  title: 'A Decade of Rain',
  subtitle: 'Agent Orange and Operation Ranch Hand over South Vietnam, 1961–1971',
  // NOTE: the last three words are joined with no-break spaces ( ) so
  // "by year." can never orphan onto its own line (text-wrap:pretty backstop).
  dek: 'Between 1961 and 1971 the United States sprayed nearly 20 million gallons of herbicide (the “rainbow” defoliants, Agent Orange chief among them) over the forests, mangroves and croplands of South Vietnam. Half a century on, the dioxin it left behind is still being cleaned from the soil. This is where it fell, year by year.',
  cue: 'Scroll to begin',
  // Opening overview: framed on the sprayed south-centre (spray’s weighted
  // centroid is ~12.4°N), not the empty north.
  camera: { center: [107.4, 12.9] as [number, number], zoom: 6.3 },
}
