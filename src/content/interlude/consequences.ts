// Interlude — "The Consequences", told as two full-page photo walls:
//   1. THE LAND  — the ecological toll   (deep-green gradient)
//   2. THE BODY  — the public-health toll (orange gradient)
// Each wall: a big number on the left third, a photo mosaic on the right.
//
// IMAGES ARE PLACEHOLDERS. The sandbox can't download photos, so every tile
// currently points at the spray photo (heroSpray). The `caption`/`credit`/`alt`
// on each tile are the real, intended annotations — when the actual images are
// supplied, only each photo's `src` needs swapping.

import heroSpray from '../../assets/hero-spray.jpg'

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
  photos: WallPhoto[]
}

const P = heroSpray // placeholder src for every tile until real photos arrive

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
      { src: P, alt: 'A C-123 aircraft spraying defoliant over dense forest', caption: 'A Ranch Hand C-123 lays a swath of defoliant over triple-canopy forest.', credit: 'U.S. Air Force' },
      { src: P, alt: 'Dead mangrove forest', caption: 'Mangrove killed by a single pass of spray — Cà Mau / Rừng Sác.', credit: 'placeholder — source TBD' },
      { src: P, alt: 'Stripped, eroding hillside', caption: 'A bare, eroding hillside where forest once stood.', credit: 'placeholder' },
      { src: P, alt: 'Sprayed versus untouched forest boundary from the air', caption: 'The hard edge between sprayed and untouched canopy.', credit: 'placeholder' },
      { src: P, alt: 'Barren grassland where forest used to be', caption: 'Fifty years on, tough grass — not forest — holds the worst-hit ground.', credit: 'placeholder' },
      { src: P, alt: 'Standing dead trees', caption: 'Standing dead: hardwoods that never leafed again.', credit: 'placeholder' },
      { src: P, alt: 'Aerial view of devastated forest', caption: 'Bare crowns to the horizon after repeated spraying.', credit: 'placeholder' },
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
    photos: [
      { src: P, alt: 'A child affected by Agent Orange at a care centre', caption: 'A child at the Vietnam Friendship Village, which cares for those affected.', credit: 'placeholder' },
      { src: P, alt: 'Preserved specimens at the War Remnants Museum', caption: 'Preserved specimens on display at the War Remnants Museum, Hồ Chí Minh City.', credit: 'placeholder — sensitive' },
      { src: P, alt: 'A second-generation Agent Orange victim', caption: 'The harm reaches the children and grandchildren of the exposed.', credit: 'placeholder' },
      { src: P, alt: 'Peace Village at Tu Du Hospital', caption: 'Peace Village, Từ Dũ Hospital — care for children with severe disabilities.', credit: 'placeholder' },
      { src: P, alt: 'A family caring for a disabled child', caption: 'A family’s daily care, decades after the war ended.', credit: 'placeholder' },
      { src: P, alt: 'A Vietnamese veteran affected by dioxin', caption: 'Veterans on every side carry dioxin-linked illness.', credit: 'placeholder' },
      { src: P, alt: 'Physical therapy at an Agent Orange care centre', caption: 'Therapy and prosthetics at an Agent Orange care centre.', credit: 'placeholder' },
    ],
  },
]
