// Act II — "The Actions": the present-day cleanup. The herbicide fell across a
// quarter of the country, but the dioxin concentrated at a handful of former
// U.S. air bases where it was stored, mixed, spilled and burned. Those are the
// three "hotspots" — Đà Nẵng, Biên Hòa, Phú Cát.
//
// Figures from USAID / U.S. Embassy fact sheets and the UNDP three-hotspots
// report (see sourceIds). Costs/volumes are the widely cited public numbers;
// Biên Hòa's schedule is genuinely uncertain after 2025 U.S. funding cuts.

export type HotspotKey = 'danang' | 'bienhoa' | 'phucat'
export type HotspotStatus = 'Completed' | 'Ongoing' | 'Contained'

export interface Hotspot {
  key: HotspotKey
  name: string
  place: string
  /** Weighted centroid-ish coords, for a future map integration. */
  lngLat: [number, number]
  status: HotspotStatus
  statusYear: string
  /** Contamination volume / what was done to it. */
  volume: string
  cost: string
  timeline: string
  method: string
  note: string
  sourceId: string
}

export const HOTSPOTS: Hotspot[] = [
  {
    key: 'danang',
    name: 'Đà Nẵng',
    place: 'Đà Nẵng Airport · central coast',
    lngLat: [108.199, 16.047],
    status: 'Completed',
    statusYear: '2018',
    volume: '~90,000 m³ soil treated · ~50,000 m³ contained',
    cost: '≈ US$110 million',
    timeline: '2012 – 2018',
    method: 'In-pile thermal desorption — the soil heated to ~335 °C to break the dioxin down',
    note: 'The first full-scale dioxin cleanup; the treated soil was reused as fill for the airport expansion.',
    sourceId: 'usaid_danang',
  },
  {
    key: 'bienhoa',
    name: 'Biên Hòa',
    place: 'Biên Hòa Air Base · near Hồ Chí Minh City',
    lngLat: [106.818, 10.976],
    status: 'Ongoing',
    statusYear: 'since 2019',
    volume: '~500,000 m³ — the largest hotspot, roughly 4× Đà Nẵng',
    cost: '≈ US$450 million (planned)',
    timeline: '2019 – ~2030 (est.)',
    method: 'Excavation with thermal treatment and secure, engineered containment',
    note: 'The biggest remaining task by far; 2025 cuts to U.S. funding have thrown its schedule into doubt.',
    sourceId: 'usembassy_bienhoa',
  },
  {
    key: 'phucat',
    name: 'Phú Cát',
    place: 'Phú Cát Airport · Bình Định province',
    lngLat: [109.052, 13.966],
    status: 'Contained',
    statusYear: '2012',
    volume: '~7,500 m³ isolated in an engineered landfill',
    cost: 'Vietnam · UNDP / GEF',
    timeline: '2011 – 2012',
    method: 'Active containment — the dioxin sealed in a lined, capped landfill on site',
    note: 'Contained rather than destroyed, and taken off the active hotspot list.',
    sourceId: 'undp_hotspots',
  },
]

export const ACTIONS = {
  eyebrow: 'Act II · The actions',
  title: 'Cleaning It Up',
  dek: 'The herbicide fell across a quarter of the country, but the dioxin concentrated in a few small places — the former U.S. air bases where it was stored, mixed, spilled and burned. Half a century later, those few hectares are the front line: a slow, costly and still-unfinished cleanup run jointly by Vietnam and the United States.',
  closing:
    'Đà Nẵng is finished. Phú Cát is sealed. Biên Hòa — the largest by far — is the unfinished chapter, and the one whose future now turns on whether the money holds.',
  note: 'Figures from USAID and U.S. Embassy Vietnam fact sheets and the UNDP three-hotspots report. Costs and volumes are widely cited public estimates; Biên Hòa’s timeline is uncertain.',
}
