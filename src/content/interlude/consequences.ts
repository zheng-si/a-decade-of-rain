// Interlude — "The Consequences", told as two full-page photo walls:
//   1. THE LAND  — the ecological toll   (deep-green gradient)
//   2. THE BODY  — the public-health toll (orange gradient, blurred by default)
// Each wall: a big number on the left third, a photo mosaic on the right.
//
// CREDITS: every image here is public-domain (U.S. military / NARA) or
// Creative-Commons via Wikimedia Commons — no copyrighted press images. The
// land wall is all U.S. Gov PD; the body wall is CC/Commons documentary work.
// Verify each file's exact license line on Commons before launch.
//
// The land wall's second frame is the one American face in the piece: two
// soldiers of the 184th Chemical Company filling a spray tank by hose, one of
// them shirtless against the drum. Everywhere else the United States is an
// actor — "the United States sprayed" — and the men who handled the stuff are
// nowhere. NARA 111-CCV-151-CC68012, SP4 James L. Ensign, 20 March 1970,
// public domain as a work of the U.S. Army.

import land1 from '../../assets/consequences/land-1.webp'
import land3 from '../../assets/consequences/land-3.webp'
// The three-ship formation frame (land-4.webp) is retired but kept on disk:
// it said the same thing as the hero, and the wall had no person in it. Swap
// it back by restoring this import and the photo entry below.
import landCrew from '../../assets/consequences/land-crew.webp'
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
  /** An optional second paragraph under the lede. */
  lede2?: string
  /** Cited under the lede, in order. */
  sourceIds?: string[]
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
    sourceIds: ['stellman_2003'],
    photos: [
      { src: land1, alt: 'A C-123 aircraft spraying defoliant over dense forest', caption: 'A U.S. Air Force C-123 lays a swath of defoliant over triple-canopy forest.', credit: 'U.S. Air Force' },
      { src: landCrew, alt: 'Two U.S. soldiers filling a helicopter spray tank from a drum of defoliant, one of them bare-chested', caption: 'SP4 Garry Miller and SP4 Frank W. Davis of the 184th Chemical Company fill a helicopter spray tank at Phước Vĩnh, March 1970: 55 gallons of defoliant, 55 of diesel.', credit: 'SP4 James L. Ensign · U.S. Army, NARA' },
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
    // A second paragraph rather than a clause folded into the first: American
    // exposure is a different fact from the dioxin's persistence, and the two
    // do not belong in one sentence. Plain, and dated: VA had run an Agent
    // Orange registry since 1978 and had already service-connected chloracne,
    // then non-Hodgkin's lymphoma and soft tissue sarcoma in 1990, so 1991 is
    // the first LAW to presume a group of conditions, not the first
    // recognition of anything.
    lede2: 'U.S. service members were exposed as well, among them the crews who loaded and sprayed the herbicides. The Agent Orange Act of 1991 was the first law to presume a group of illnesses service-connected for Vietnam veterans; the list has grown since, and the Department of Veterans Affairs compensates eligible veterans for the conditions on it.',
    sourceIds: ['aspen_whatis', 'va_conditions'],
    sensitive: true,
    warning: 'These photographs show people living with dioxin-linked injury and disability. They are blurred by default; reveal them only if you wish.',
    photos: [
      { src: body1, alt: 'A mother holding her disabled son beside a sign about the spraying', caption: 'Kan Lay holds her son, born with severe disabilities, by a sign marking the spraying of the A Lưới valley.', credit: 'Alexis Duclos · Wikimedia Commons' },
      { src: body2, alt: 'Portrait of a man living with the effects of dioxin exposure', caption: 'A man living with the lifelong effects of dioxin exposure, Hồ Chí Minh City.', credit: 'Wikimedia Commons (CC BY)' },
      { src: body3, alt: 'A Vietnamese professor with children affected by Agent Orange', caption: 'Prof. Nguyễn Thị Ngọc Phượng with children in her care, all born with Agent Orange–linked defects.', credit: 'Wikimedia Commons' },
    ],
  },
]
