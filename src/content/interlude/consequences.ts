// Interlude — "The Consequences", told as two full-page photo walls:
//   1. THE LAND  — the ecological toll   (deep-green gradient)
//   2. THE BODY  — the public-health toll (orange gradient, blurred by default)
// Each wall: a big number on the left third, a photo mosaic on the right.
//
// CREDITS: every image here is public-domain (U.S. military / NARA) or
// Creative-Commons via Wikimedia Commons — no copyrighted press images. The
// land wall is all U.S. Gov PD; the body wall is CC/Commons documentary work.
// Verify each file's exact license line on Commons before launch.

import land1 from '../../assets/consequences/land-1.webp'
import land3 from '../../assets/consequences/land-3.webp'
import land4 from '../../assets/consequences/land-4.webp'
import body1 from '../../assets/consequences/body-1.webp'
import body2 from '../../assets/consequences/body-2.webp'
import body3 from '../../assets/consequences/body-3.webp'

export interface WallPhoto {
  src: string
  alt: string
  caption: string
  credit: string
}

export interface WallStat {
  value: string
  label: string
}

export interface ConsequenceWall {
  key: 'land' | 'body'
  theme: 'eco' | 'health'
  value: string
  label: string
  /** A few secondary figures shown beneath the headline number. */
  stats?: WallStat[]
  lede: string
  sourceId?: string
  /** Blur the photos by default behind a consent notice. */
  sensitive?: boolean
  warning?: string
  photos: WallPhoto[]
}

export const WALLS: ConsequenceWall[] = [
  {
    key: 'land',
    theme: 'eco',
    value: '3.1M\u00A0ha',
    label: 'of forest and mangrove stripped bare',
    stats: [
      { value: '36%', label: 'of the south’s mangrove forest destroyed' },
      { value: '4+', label: 'times some of the forest was sprayed' },
      { value: '50+\u00A0yrs', label: 'and the worst-hit land is still bare' },
    ],
    lede: 'The herbicides broke down in weeks, but the forests did not come back. Half a century on, the worst-hit mangroves and hillsides still have not recovered.',
    sourceId: 'stellman_2003',
    photos: [
      { src: land1, alt: 'A C-123 aircraft spraying defoliant over dense forest', caption: 'A U.S. Air Force C-123 lays a swath of defoliant over triple-canopy forest.', credit: 'U.S. Air Force' },
      { src: land4, alt: 'Three aircraft spraying herbicide in formation', caption: 'Three UC-123s lay parallel swaths of herbicide in a single pass.', credit: 'U.S. Air Force' },
      { src: land3, alt: 'Aerial view of sprayed mangrove forest, 1968', caption: 'Aerial view of mangrove sprayed in the Rừng Sác, Military Region III, 1968.', credit: 'RANCH HAND Collection, Vietnam Archive, Texas Tech University' },
    ],
  },
  {
    key: 'body',
    theme: 'health',
    value: '150,000+',
    label: 'children born with serious birth defects',
    stats: [
      { value: '3M', label: 'Vietnamese with Agent Orange–linked illness' },
      { value: '4', label: 'generations affected, and counting' },
      { value: '7–11\u00A0yrs', label: 'dioxin’s half-life in the human body' },
    ],
    lede: 'Dioxin lingers in the body for years and crosses into the next generation. The toll is now counted across a second, third and fourth generation.',
    sourceId: 'aspen_whatis',
    sensitive: true,
    warning: 'These photographs show people living with dioxin-linked injury and disability. They are blurred by default; reveal them only if you wish.',
    photos: [
      { src: body1, alt: 'A mother holding her disabled son beside a sign about the spraying', caption: 'Kan Lay holds her son, born with severe disabilities, by a sign marking the spraying of the A Lưới valley.', credit: 'Alexis Duclos · Wikimedia Commons' },
      { src: body2, alt: 'Portrait of a man living with the effects of dioxin exposure', caption: 'A man living with the lifelong effects of dioxin exposure, Hồ Chí Minh City.', credit: 'Wikimedia Commons (CC BY)' },
      { src: body3, alt: 'A Vietnamese professor with children affected by Agent Orange', caption: 'Prof. Nguyễn Thị Ngọc Phượng with children in her care, all born with Agent Orange–linked defects.', credit: 'Wikimedia Commons' },
    ],
  },
]
