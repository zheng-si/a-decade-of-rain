// Facts — the opening hook / banner. Edit copy and the opening camera here.
export const HOOK = {
  eyebrow: 'Agent Orange · Operation Ranch Hand · 1961–1971',
  title: 'A decade of rain',
  dek: 'Between 1962 and 1971 the United States sprayed nearly 20 million gallons of herbicide — the “rainbow” defoliants, Agent Orange chief among them — over the forests, mangroves and croplands of South Vietnam. Half a century on, the dioxin it left behind is still being cleaned from the soil. This is where it fell, year by year.',
  cue: 'Scroll to begin ↓',
  // Opening overview: framed on the sprayed south-centre (spray’s weighted
  // centroid is ~12.4°N), not the empty north.
  camera: { center: [107.4, 12.9] as [number, number], zoom: 6.3 },
}
