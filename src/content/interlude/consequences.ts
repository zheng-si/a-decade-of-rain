// Interlude — "The Consequences", told as two full-page photo walls:
//   1. THE LAND  — the ecological toll   (deep-green gradient)
//   2. THE BODY  — the public-health toll (orange gradient, blurred by default)
// Each wall: a big number on the left third, a photo mosaic on the right.
//
// CREDITS: several images are copyrighted (NYT, Tobias Nicolai, etc.) and are
// used here pending permission/licensing — see the notes handed to the editor.
// PD/CC images (U.S. military, Wikimedia CC) are safe. Verify before launch.

import land1 from '../../assets/consequences/land-1.jpg'
import land2 from '../../assets/consequences/land-2.avif'
import land3 from '../../assets/consequences/land-3.webp'
import land4 from '../../assets/consequences/land-4.webp'
import land5 from '../../assets/consequences/land-5.avif'
import land6 from '../../assets/consequences/land-6.avif'
import land7 from '../../assets/consequences/land-7.avif'
import body1 from '../../assets/consequences/body-1.jpg'
import body2 from '../../assets/consequences/body-2.jpg'
import body3 from '../../assets/consequences/body-3.jpg'
import body4 from '../../assets/consequences/body-4.jpg'
import body5 from '../../assets/consequences/body-5.jpg'
import body6 from '../../assets/consequences/body-6.jpg'
import body7 from '../../assets/consequences/body-7.webp'

export interface WallPhoto {
  src: string
  alt: string
  caption: string
  credit: string
}

export interface ConsequenceWall {
  key: 'land' | 'body'
  theme: 'eco' | 'health'
  eyebrow: string
  value: string
  label: string
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
    eyebrow: 'The consequences · the land',
    value: '3.1M ha',
    label: 'of forest and mangrove stripped bare',
    lede: 'The herbicides broke down in weeks, but the forests did not come back. Half a century on, the worst-hit mangroves and hillsides still have not recovered.',
    sourceId: 'stellman_2003',
    photos: [
      { src: land1, alt: 'A C-123 aircraft spraying defoliant over dense forest', caption: 'A U.S. Air Force C-123 lays a swath of defoliant over triple-canopy forest.', credit: 'U.S. Air Force' },
      { src: land2, alt: 'A helicopter spraying herbicide over a river', caption: 'A UH-1 “Huey” sprays herbicide low over a waterway.', credit: 'U.S. Army' },
      { src: land3, alt: 'Aerial view of sprayed mangrove forest, 1968', caption: 'Aerial view of mangrove sprayed in the Rừng Sác, III Corps, 1968.', credit: 'RANCH HAND Collection, Vietnam Archive, Texas Tech University' },
      { src: land4, alt: 'A mangrove forest reduced to bare trunks', caption: 'A mangrove forest reduced to bare trunks by repeated spraying.', credit: 'archival — credit TBC' },
      { src: land5, alt: 'People standing amid a defoliated forest', caption: 'Villagers amid the skeletons of a defoliated forest.', credit: 'archival — credit TBC' },
      { src: land6, alt: 'Aerial contrast between sprayed and living mangrove', caption: 'From the air, the line between sprayed and living mangrove.', credit: 'LIFE — credit TBC' },
      { src: land7, alt: 'Barren, scrubby ground where forest once stood', caption: 'Decades on, scrub and bare earth where forest once stood.', credit: 'credit TBC' },
    ],
  },
  {
    key: 'body',
    theme: 'health',
    eyebrow: 'The consequences · the body',
    value: '≥150,000',
    label: 'children born with serious birth defects',
    lede: 'Dioxin lingers in the body for years and crosses into the next generation. The toll is now counted across a second, third and fourth generation.',
    sourceId: 'impact_wiki',
    sensitive: true,
    warning: 'These photographs show people living with dioxin-linked injury and disability. They are blurred by default — reveal them only if you wish.',
    photos: [
      { src: body1, alt: 'Portrait of a young man affected by dioxin exposure', caption: 'A young man living with the effects of dioxin exposure.', credit: '© Tobias Nicolai' },
      { src: body2, alt: 'A mother holding her child', caption: 'A mother and her child at home.', credit: '© Tobias Nicolai' },
      { src: body3, alt: 'An older woman in a wheelchair', caption: 'An older woman disabled by chronic, Agent Orange–linked illness.', credit: 'The New York Times Magazine, 2021' },
      { src: body4, alt: 'A doctor with a group of affected children', caption: 'Prof. Nguyễn Thị Ngọc Phượng with children in her care, Hồ Chí Minh City, 2004.', credit: 'Wikimedia Commons' },
      { src: body5, alt: 'A man living with Agent Orange–linked disabilities', caption: 'A man living with Agent Orange–linked disabilities.', credit: 'Wikimedia Commons (CC BY)' },
      { src: body6, alt: 'Two children from families exposed to dioxin', caption: 'Two children from families exposed to dioxin.', credit: 'credit TBC' },
      { src: body7, alt: 'Severe skin damage associated with dioxin exposure', caption: 'Severe skin damage associated with dioxin exposure.', credit: 'credit TBC' },
    ],
  },
]
