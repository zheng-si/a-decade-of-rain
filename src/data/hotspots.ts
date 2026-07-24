// Known dioxin (Agent Orange) hotspot former U.S. air bases in Vietnam.
// These were major herbicide storage/handling sites and are the focus of
// post-war environmental remediation efforts (USAID / Government of Vietnam).
export interface Hotspot {
  id: string
  name: string
  lng: number
  lat: number
  note: string
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'danang',
    name: 'Đà Nẵng Air Base',
    lng: 108.199,
    lat: 16.044,
    note: 'Thermal cleanup completed 2018 — 90,000 m³ of soil and sediment treated (USAID).',
  },
  {
    id: 'bienhoa',
    name: 'Biên Hòa Air Base',
    lng: 106.818,
    lat: 10.972,
    note: 'The largest hotspot — ~500,000 m³ of soil; excavation under way since 2019.',
  },
  {
    id: 'phucat',
    name: 'Phú Cát Air Base',
    lng: 109.043,
    lat: 13.952,
    note: '~7,500 m³ sealed on-site in an engineered landfill in 2012, with UNDP.',
  },
]
