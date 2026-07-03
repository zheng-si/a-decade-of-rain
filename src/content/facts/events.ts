// Facts — chronological spray-campaign nodes that drive the scrollytelling map.
// Cameras and region bboxes are anchored to real spray concentrations in the
// HERBS dataset (see scripts/build-spray-data.mjs); facts and quotes are sourced
// via sources.ts. Copy is editorial and meant to be revised.
//
// Quotes flagged `pending` still need their exact wording checked against the
// primary source (blocked from the build sandbox until the source domains are
// reachable).

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
  pending?: boolean
}

export interface City {
  name: string
  lng: number
  lat: number
}

/** A node's representative reference — either a labelled orange point (for areas
 *  with no authoritative boundary, e.g. War Zone C/D, the Iron Triangle) or a
 *  real boundary polygon outlined from public/data/landmarks.geojson (by id). */
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
   *  (used where the sprayed volume is too small to read as a heatmap). */
  crosses?: { lng: number; lat: number; label: string }[]
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
    name: 'Only We Can Prevent Forests',
    period: '1961–62',
    date: '1962-06-01',
    camera: { center: [107.6, 12.6], zoom: 6.6 },
    agent: 'all',
    cities: [
      { name: 'Đắk Tô', lng: 107.83, lat: 14.65 },
      { name: 'Sài Gòn', lng: 106.7, lat: 10.78 },
    ],
    // Đắk Tô test spray (Aug 1961) + first mission on Route 15 toward Biên Hòa.
    crosses: [
      { lng: 107.83, lat: 14.65, label: 'Đắk Tô — test spray, Aug 1961' },
      { lng: 106.82, lat: 10.97, label: 'Biên Hòa — first mission, Jan 1962' },
    ],
    dek: 'Operation Ranch Hand begins.',
    body: 'The first test spray runs on 10 August 1961 near Đắk Tô in the central highlands; the first official mission follows in January 1962 along Route 15 toward Biên Hòa. Just 107 missions fly in 1962, the quiet start of a decade-long campaign.',
    quote: {
      text: 'Only we can prevent forests.',
      speaker: 'Operation Ranch Hand squadron motto',
      sourceId: 'ranchHand_wiki',
    },
    stat: { value: '107', label: 'missions in 1962' },
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
    dek: 'Defoliation becomes routine northeast of Saigon.',
    body: 'As US ground forces surge, spraying escalates across the guerrilla base areas known as War Zone D. In 1966 the campaign jumps to 2.6 million gallons: Agent Orange soaking the forest that hid the trails and camps.',
    quote: {
      text: 'We saw this awful poison being sprayed almost every day but were told it was just bug spray and not to worry.',
      speaker: 'US veteran, C-130A crew (1968–70)',
      sourceId: 'va_news',
    },
    stat: { value: '2.6M', label: 'gallons in 1966' },
  },
  {
    id: 'peak',
    name: 'Peak: War Zone C & the Iron Triangle',
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
    body: 'Spraying peaks in 1967 at over 5 million gallons: the densest concentration anywhere in the dataset sits here, over War Zone C and the Iron Triangle northwest of Saigon, where Operation Cedar Falls had bulldozed the jungle months earlier.',
    quote: {
      text: '1.7 million acres … were sprayed in 1967, 85% for defoliation.',
      speaker: 'Operation Ranch Hand (record)',
      sourceId: 'ranchHand_wiki',
    },
    stat: { value: '5.1M', label: 'gallons in 1967' },
  },
  {
    id: 'mangroves',
    name: 'Ecocide: the Mangroves',
    landmarks: [{ name: 'Cà Mau', boundaryId: 'ca-mau' }],
    period: '1968',
    date: '1968-09-01',
    camera: { center: [105.5, 9.5], zoom: 6.9 },
    agent: 'all',
    bbox: [104.7, 8.55, 105.75, 9.7],
    cities: [
      { name: 'Cà Mau', lng: 105.15, lat: 9.18 },
      { name: 'Cần Thơ', lng: 105.78, lat: 10.03 },
    ],
    dek: 'The coastal forests of Cà Mau and the Rung Sát.',
    body: 'Mangroves proved catastrophically fragile: a single spraying could kill a whole forest. From the Rung Sát shipping channels to the Cà Mau peninsula, some 3.1 million hectares of forest and mangrove were defoliated between Quảng Trị and Cà Mau, damage later branded an "ecocide."',
    quote: {
      text: 'total annihilation of the vegetative cover.',
      speaker: 'Scientific assessment of repeated spraying',
      sourceId: 'impact_wiki',
      pending: true,
    },
    stat: { value: '3.1M ha', label: 'forest & mangrove defoliated' },
  },
  {
    id: 'a-sau',
    name: 'A Sầu Valley: sprayed eleven times',
    landmarks: [{ name: 'A Lưới', boundaryId: 'a-luoi' }],
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
    body: 'Some 224 missions crossed the A Sầu / A Lưới valley between 1965 and 1970, parts of it sprayed as many as eleven times. Decades later the soil around the former A So base still measured up to 897.85 ppt of dioxin, one of the country’s enduring hotspots.',
    quote: {
      text: 'We had no rice for nine years.',
      speaker: 'A Sầu valley resident',
      sourceId: 'pulitzer_forest',
      pending: true,
    },
    stat: { value: '11×', label: 'sprayed in places' },
  },
  {
    id: 'hotspots',
    name: 'The Halt, and the Hotspots',
    landmarks: [{ name: 'Biên Hòa Air Base', boundaryId: 'bien-hoa-airbase' }],
    period: '1970–71 → today',
    date: '1971-01-01',
    camera: { center: [106.83, 10.99], zoom: 9.6 },
    agent: 'all',
    bbox: [106.72, 10.92, 106.94, 11.06],
    cities: [
      { name: 'Biên Hòa', lng: 106.82, lat: 10.97 },
      { name: 'Sài Gòn', lng: 106.7, lat: 10.78 },
    ],
    dek: 'Spraying stops; the poison stays at the bases.',
    body: 'Ranch Hand winds down and ends in 1971. But the dioxin concentrates where the drums were stored and loaded: the airbases. Biên Hòa remains the single largest reservoir of contamination, the focus of remediation that continues to this day.',
    quote: {
      text: 'the largest remaining dioxin hotspot in Vietnam — and, arguably, in the entire world.',
      speaker: 'On Biên Hòa airbase',
      sourceId: 'aspen_bienhoa',
    },
    stat: { value: '3', label: 'priority hotspot airbases' },
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
