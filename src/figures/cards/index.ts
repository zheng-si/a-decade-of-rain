/* The story cards' illustrations, by card id (src/content/facts/events.ts).
   Two styles were drawn for the same eight scenes: B, a woodcut in ivory on
   the card's green, one picture per card; and C, an isometric diorama with
   moving parts laid over it in SVG (cardArtMotion.ts). This file names the
   style this build ships and lists its files; only that style's pictures
   are bundled. 'none' ships no art and the cards stand as before.

   The pictures are the illustrator's 1536x1024 masters resized to 1152x768
   (three times the 300-384px they show at, so a 3x screen is served) and
   saved as WebP at quality 88 with the alpha channel kept exact. Measured
   against the masters: alpha identical, colour off by 2/255 on average.
   The masters stay out of the repository. */
export type CardArtStyle = 'none' | 'b' | 'c'

export const CARD_ART_STYLE: CardArtStyle = 'c'

const FILES = import.meta.glob('./c/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

export const CARD_ART: Record<string, string> = {}
for (const [path, url] of Object.entries(FILES)) CARD_ART[path.replace(/^.*\//, '').replace(/\.webp$/, '')] = url

/* Bitmaps a scene lays into its SVG, by name (cardArtMotion.ts): the
   aircraft on 05, the illustrator's own pixels cut from the original
   picture, carried across the valley by the animation. */
const PART_FILES = import.meta.glob('./c/parts/*.png', { eager: true, import: 'default', query: '?url' }) as Record<
  string,
  string
>

export const CARD_ART_PARTS: Record<string, string> = {}
for (const [path, url] of Object.entries(PART_FILES))
  CARD_ART_PARTS[path.replace(/^.*\//, '').replace(/\.png$/, '')] = url
