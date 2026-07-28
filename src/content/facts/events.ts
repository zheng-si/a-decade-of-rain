// Facts — chronological spray-campaign nodes that drive the scrollytelling map.
// Cameras and region bboxes are anchored to real spray concentrations in the
// HERBS dataset (see scripts/build-spray-data.mjs); facts and quotes are sourced
// via sources.ts. Copy is editorial and meant to be revised.
//
// EDITORIAL RULE — direct quotes: only wording verified against the primary
// source may appear inside quotation marks. Unverified material is carried as
// attributed paraphrase in the body instead (see the A Sầu node).
// Terminology: the HERBS dataset counts spray RUNS (one aircraft's spray pass);
// "mission" is reserved for sourced mission counts.

export interface Camera {
  center: [number, number]
  zoom: number
  pitch?: number
  bearing?: number
}

export interface Quote {
  text: string
  speaker: string
  sourceId: string
}

export interface City {
  name: string
  lng: number
  lat: number
}

/** A node's representative reference. `point` alone → a labelled orange ring
 *  marker (areas with no authoritative boundary, e.g. War Zone C/D). With
 *  `boundaryId`, the real polygon from public/data/landmarks.geojson is
 *  outlined and `point` anchors its floating label chip. */
export interface Landmark {
  name: string
  point?: [number, number]
  boundaryId?: string
}

export interface StoryEvent {
  id: string
  name: string
  period: string
  /** Playhead date (ISO) — spray is shown cumulatively up to here. */
  date: string
  camera: Camera
  /** Agent chip key: 'all' | 'O' | 'W' | 'B' | 'other'. */
  agent: string
  /** Region to outline/highlight, as [west, south, east, north]. */
  bbox?: [number, number, number, number]
  /** Nearby places to pin. */
  cities?: City[]
  /** Pilot / test-spray locations marked with a pulsing dot instead of heat
   *  (used where the sprayed volume is too small to read as a heatmap).
   *  `below` hangs the label under the dot (pointer up); `leader` floats it
   *  `leader`px to the right on a hairline — for parking a label over open sea
   *  clear of the basemap's own labels. */
  crosses?: { lng: number; lat: number; label: string; below?: boolean; leader?: number }[]
  /** Representative reference points / boundaries highlighted so the reader can
   *  place the node's hotspot fast (marked once the camera zooms in). */
  landmarks?: Landmark[]
  dek: string
  body: string
  quote?: Quote
  stat?: { value: string; label: string }
}

export const FACTS_EVENTS: StoryEvent[] = [
  {
    id: 'begins',
    name: 'The Spraying Begins',
    period: '1961–62',
    date: '1962-06-01',
    camera: { center: [107.6, 12.6], zoom: 6.6 },
    agent: 'all',
    cities: [
      { name: 'Đắk Tô', lng: 107.83, lat: 14.65 },
      { name: 'Sài Gòn', lng: 106.7, lat: 10.78 },
    ],
    // Đắk Tô test spray (Aug 1961) + first mission on Route 15 toward Biên Hòa.
    // Labels led out to the open sea so they don't sit on the basemap's labels.
    crosses: [
      { lng: 107.83, lat: 14.65, label: 'Đắk Tô · test spray, Aug 1961', leader: 300 },
      { lng: 106.82, lat: 10.97, label: 'Biên Hòa · first mission, Jan 1962', leader: 250 },
    ],
    dek: 'Operation Ranch Hand, the decade of defoliation, starts small.',
    body: 'The first test spray runs on 10 August 1961 near Đắk Tô in the central highlands; the first official mission follows in January 1962 along Route 15 toward Biên Hòa. The aim: strip away the jungle canopy that hid supply lines and ambushes. Only 70 spray runs are recorded in 1962, the quiet start of a decade-long campaign.',
    quote: {
      text: 'Only we can prevent forests.',
      speaker: 'Operation Ranch Hand squadron motto',
      sourceId: 'usaf_ranchhand',
    },
    stat: { value: '70', label: 'spray runs recorded in 1962' },
  },
  {
    id: 'warzone-d',
    name: 'The Ramp-Up: War Zone D',
    landmarks: [{ name: 'War Zone D', point: [107.05, 11.35] }],
    period: '1965–66',
    date: '1966-08-01',
    camera: { center: [106.95, 11.2], zoom: 7.4 },
    agent: 'O',
    bbox: [106.55, 10.85, 107.45, 11.65],
    cities: [
      { name: 'Sài Gòn', lng: 106.7, lat: 10.78 },
      { name: 'Biên Hòa', lng: 106.82, lat: 10.97 },
    ],
    dek: 'Defoliation becomes routine northeast of Sài Gòn.',
    body: 'As U.S. ground forces surge, spraying escalates across the guerrilla base areas known as War Zone D. In 1966 the campaign jumps to 2.6 million gallons: Agent Orange soaking the forest that hid the trails and camps.',
    quote: {
      text: 'We saw this awful poison being sprayed almost every day but were told it was just bug spray and not to worry.',
      speaker: 'U.S. veteran, C-130A crew (1968–70)',
      sourceId: 'va_news',
    },
    stat: { value: '2.6M', label: 'gallons in 1966' },
  },
  {
    id: 'peak',
    name: 'Peak: War Zone C and the Iron Triangle',
    landmarks: [
      { name: 'War Zone C', point: [106.25, 11.58] },
      { name: 'Iron Triangle', point: [106.53, 11.1] },
    ],
    period: '1967',
    date: '1967-10-01',
    camera: { center: [106.6, 11.32], zoom: 7.3 },
    agent: 'O',
    bbox: [106.0, 11.0, 106.95, 11.7],
    cities: [
      { name: 'Tây Ninh', lng: 106.1, lat: 11.31 },
      { name: 'Củ Chi', lng: 106.49, lat: 11.03 },
    ],
    dek: 'The heaviest year of the war.',
    body: 'Spraying peaks in 1967 at over 5 million gallons: the densest concentration anywhere in the dataset sits here, over War Zone C and the Iron Triangle northwest of Sài Gòn, where Operation Cedar Falls had bulldozed the jungle months earlier.',
    quote: {
      text: '1.7 million acres … were sprayed in 1967, 85% for defoliation.',
      speaker: 'Operation Ranch Hand (record)',
      sourceId: 'usaf_ranchhand',
    },
    stat: { value: '5.1M', label: 'gallons in 1967' },
  },
  {
    id: 'mangroves',
    name: 'Ecocide: the Mangroves',
    landmarks: [{ name: 'Cà Mau', boundaryId: 'ca-mau', point: [104.95, 8.85] }],
    period: '1968',
    date: '1968-09-01',
    camera: { center: [105.5, 9.5], zoom: 6.9 },
    agent: 'all',
    bbox: [104.7, 8.55, 105.75, 9.7],
    cities: [
      { name: 'Cà Mau', lng: 105.15, lat: 9.18 },
      { name: 'Cần Thơ', lng: 105.78, lat: 10.03 },
    ],
    dek: 'The coastal forests of Cà Mau and the Rừng Sác.',
    body: 'Mangroves prove catastrophically fragile: a single spraying can kill a whole forest. The Rừng Sác shipping channels and the Cà Mau peninsula are among the hardest hit; across the war, some 3.1 million hectares of forest and mangrove are defoliated between Quảng Trị and Cà Mau — damage scientists later brand an “ecocide.”',
    stat: { value: '3.1M\u00A0ha', label: 'forest and mangrove defoliated' },
  },
  {
    id: 'a-sau',
    name: 'A Sầu Valley: sprayed eleven times',
    landmarks: [{ name: 'A Lưới', boundaryId: 'a-luoi', point: [107.1, 16.38] }],
    period: '1965–70',
    date: '1969-08-01',
    camera: { center: [107.18, 16.3], zoom: 8.6 },
    agent: 'O',
    bbox: [106.95, 16.05, 107.45, 16.5],
    cities: [
      { name: 'Huế', lng: 107.58, lat: 16.46 },
      { name: 'A Lưới', lng: 107.28, lat: 16.22 },
    ],
    dek: 'A corridor to the Ho Chi Minh Trail, drenched again and again.',
    body: 'Some 224 spray runs cross the A Sầu / A Lưới valley between 1965 and 1970, parts of it sprayed as many as eleven times. Decades later, soil around the former A So air base still held nearly 900\u00A0ppt of dioxin — one of the country’s enduring hotspots. Residents have told the Pulitzer Center that for years after the spraying, no rice would grow.',
    stat: { value: '11', label: 'times sprayed, in places' },
  },
  {
    id: 'hotspots',
    name: 'The Halt, and the Hotspots',
    landmarks: [{ name: 'Biên Hòa Air Base', point: [106.815, 10.976] }],
    period: '1970–71 to today',
    date: '1971-01-01',
    camera: { center: [106.83, 10.99], zoom: 9.6 },
    agent: 'all',
    bbox: [106.72, 10.92, 106.94, 11.06],
    cities: [
      { name: 'Biên Hòa', lng: 106.82, lat: 10.97 },
      { name: 'Sài Gòn', lng: 106.7, lat: 10.78 },
    ],
    dek: 'Spraying stops; the poison stays at the bases.',
    body: 'Ranch Hand winds down and ends in 1971. But the dioxin concentrates where the drums were stored and loaded: the air bases. Biên Hòa remains the single largest reservoir of contamination, the focus of remediation that continues to this day.',
    quote: {
      text: 'the largest remaining dioxin hotspot in Vietnam — and, arguably, in the entire world.',
      speaker: 'On Biên Hòa Air Base',
      sourceId: 'aspen_bienhoa',
    },
    stat: { value: '3', label: 'priority hotspot air bases' },
  },
  {
    id: 'reckoning',
    name: 'The Reckoning',
    period: '1961–1971',
    date: '1971-12-31',
    camera: { center: [107.4, 12.9], zoom: 6.3 },
    agent: 'all',
    dek: 'A decade of spraying, in one number.',
    body: 'Across the whole campaign, roughly 19.5 million gallons of herbicide fell on Vietnam, at least 11 million of it Agent Orange. What follows is not just where it landed, but what it takes to clean it up.',
    stat: { value: '19.5M', label: 'gallons, 1961–1971' },
  },
]
