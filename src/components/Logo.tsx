/**
 * The mark: five bars, thinning left to right, on a 20×20 square.
 *
 * Geometry is the supplied artwork's own, not a trace of it: widths 4, 3, 2, 1,
 * 0.5 on a pitch of 5, with the last bar flush to the right edge. The ink
 * halves away while the rhythm holds, which is the whole idea — a decade of
 * spraying tapering off, drawn as the record thinning out.
 *
 * Kept as rects rather than path data. Four of the five sit on integers and
 * survive being drawn at 16px in a browser tab; a traced path would land its
 * edges on fractional pixels and blur. The fifth is a deliberate half-unit
 * hairline and is left exactly as drawn.
 *
 * Two placements, both on `currentColor` so each takes the colour of the text
 * around it: the rail mark and the epilogue mark, which are the two places the
 * site signs its own name. The agent card keeps the biohazard trefoil — on a
 * card naming a herbicide that symbol is saying what the drum held, which is
 * not what a wordmark is for.
 *
 * public/favicon.svg carries the same geometry with #ff5449 baked in, since a
 * favicon has no inherited colour to take. The supplied artwork came in
 * #FB4D46; the site keeps ONE orange and it is #ff5449, which is also what
 * index.html declares as its theme-color.
 */
export const LOGO_SIZE = 20

/** [x, width] per bar. Height is always the full square. */
export const LOGO_BARS: readonly (readonly [number, number])[] = [
  [0, 4],
  [5, 3],
  [10, 2],
  [15, 1],
  [19.5, 0.5],
]

export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {LOGO_BARS.map(([x, w]) => (
        <rect key={x} x={x} y={0} width={w} height={LOGO_SIZE} />
      ))}
    </svg>
  )
}
