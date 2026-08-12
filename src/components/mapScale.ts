// ── the scale bar's arithmetic, once ──────────────────────────────────────
// This was byte-identical in MapKey.tsx and ArchiveKey.tsx. Two copies of a
// number that has to agree with a CSS width is how the key came to overflow
// its own panel on both surfaces: fixing the target in one file would have
// left the other still running long.
import type maplibregl from 'maplibre-gl'

/** Round DOWN to a 1/2/3/5 × 10ⁿ value, so the bar's label is a number a
 *  reader can hold in their head and multiply by. */
function niceRound(x: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(x)))
  const f = x / pow
  const n = f >= 5 ? 5 : f >= 3 ? 3 : f >= 2 ? 2 : 1
  return n * pow
}

const fmtDist = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${Math.round(m)} m`)

/** How long we would LIKE the bar to be, in px. The drawn length is this
 *  scaled down to the nearest nice distance, so it is also the maximum the bar
 *  can ever reach — which is what makes it a layout constant and not just a
 *  preference.
 *
 *  It was 92, and 92 does not fit. The key's top row is `scale bar + label`
 *  at one end and the compass at the other, inside a 12rem panel; measured
 *  across the zoom range, the bar peaks at 84px around z6 ("100 km") and the
 *  compass was pushed 18.6px past the panel's content box — clipped by the
 *  panel edge on the Archive, and reachable on the Story at any zoom where the
 *  bar runs long. 70px is the largest target that still fits the widest label
 *  the algorithm can produce ("1000 km") with the panel at 12rem:
 *
 *    70 bar + 5.95 gap + 34 label + 8.5 gap + 14.4 compass = 132.9
 *    content box at 12rem = 139.1 (Story, with its 1px border) / 141.1
 *
 *  Change either number and check the other. */
const TARGET_PX = 70

/** The scale bar for the map's current centre: a nice round distance and the
 *  pixel length that represents it. */
export function computeScale(map: maplibregl.Map): { label: string; w: number } {
  const el = map.getContainer()
  const y = el.clientHeight / 2
  const meters = map.unproject([12, y]).distanceTo(map.unproject([12 + TARGET_PX, y]))
  if (!isFinite(meters) || meters <= 0) return { label: '', w: 0 }
  const nice = niceRound(meters)
  return { label: fmtDist(nice), w: Math.round((nice / meters) * TARGET_PX) }
}
