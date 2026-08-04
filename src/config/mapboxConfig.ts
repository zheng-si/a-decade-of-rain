// ─────────────────────────────────────────────────────────────────────────
//  Mapbox spike configuration.
//
//  This file exists to answer ONE question: is Mapbox Streets' label tiering
//  enough better than OpenMapTiles' to be worth the token, the bill and the
//  vendor lock? See docs/mapbox-evaluation.md.
//
//  It does NOT replace mapConfig.ts. The shipping Archive is still MapLibre +
//  OpenFreeMap, and stays that way unless this spike wins.
// ─────────────────────────────────────────────────────────────────────────

import { mapConfig } from './mapConfig'

/**
 * The token is read from the environment, never committed.
 *
 * Local:  put `VITE_MAPBOX_TOKEN=pk.…` in `.env.local` (git-ignored).
 * Vercel: Project → Settings → Environment Variables → `VITE_MAPBOX_TOKEN`.
 *
 * A Vite `VITE_`-prefixed variable is inlined into the client bundle, so this
 * token is PUBLIC by construction — that is normal for Mapbox (theirs is
 * visible in CF's bundle too, we read it out of it) but it means the token
 * must be URL-restricted in the Mapbox account, not kept secret. Restrict it
 * to the production domain and the Vercel preview wildcard.
 */
export const MAPBOX_TOKEN: string = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

export const hasMapboxToken = MAPBOX_TOKEN.startsWith('pk.')

/**
 * Candidate styles, cheapest-to-adopt first.
 *
 * `light-v11` is Mapbox's own Positron equivalent — the closest thing to what
 * we ship now, so it isolates the DATA difference (Streets vs OpenMapTiles)
 * from the DESIGN difference. Start here; only move to a Studio style once the
 * data question is settled, because a Studio style confounds the two.
 */
export const MAPBOX_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  // For comparison against what we ship: same intent, other vendor.
  standard: 'mapbox://styles/mapbox/standard',
} as const

/**
 * The framing is deliberately shared with the MapLibre build rather than
 * re-declared. A comparison in which the two maps are looking at different
 * ground is not a comparison.
 */
export const { recordBounds, fitPadding, minZoomMargin, maxZoom, maxBounds } = mapConfig.view

/**
 * Mapbox Streets' settlement ranking, which is the whole reason for this spike.
 *
 * OpenMapTiles gives us `class` (city / town / village / other) plus a `rank`
 * that only orders within a class — four coarse buckets and nothing continuous
 * to turn. Mapbox Streets' `settlement_label` carries:
 *
 *   symbolrank  1–18   global importance, continuous
 *   filterrank  1–5    "how much of this tier should show at all"
 *
 * so label density becomes one dial instead of four on/off switches. These are
 * the numbers to experiment with; the spike surfaces them live.
 */
export const SETTLEMENT_DEFAULTS = {
  /** Show settlements at or above this importance (lower = more important). */
  maxSymbolrank: 11,
  /** Density gate. 1 = sparsest, 5 = everything. */
  maxFilterrank: 3,
}
