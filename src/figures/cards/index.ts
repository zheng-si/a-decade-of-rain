/* The story cards' illustrations, by card id (src/content/facts/events.ts).
   Two styles were drawn for the same eight scenes: B, a woodcut in ivory on
   the card's green, one picture per card; and C, an isometric diorama with
   moving parts laid over it in SVG (cardArtMotion.ts). This file names the
   style this build ships and lists its files; only that style's pictures
   are bundled. 'none' ships no art and the cards stand as before. */
export type CardArtStyle = "none" | "b" | "c";

export const CARD_ART_STYLE: CardArtStyle = "none";

export const CARD_ART: Record<string, string> = {};
