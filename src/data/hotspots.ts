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
    note: 'Remediation completed 2012–2018 (USAID). Reference project in the original design.',
  },
  {
    id: 'bienhoa',
    name: 'Biên Hòa Air Base',
    lng: 106.818,
    lat: 10.972,
    note: 'Largest remaining dioxin hotspot; remediation began 2019.',
  },
  {
    id: 'phucat',
    name: 'Phú Cát Air Base',
    lng: 109.043,
    lat: 13.952,
    note: 'Contaminated soil contained on-site in a secure landfill.',
  },
]
