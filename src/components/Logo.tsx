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
 * `currentColor`, so every placement takes the colour of the text around it —
 * the rail's white, the epilogue's white, the agent card's own herbicide
 * colour. public/favicon.svg carries the same geometry with the brand orange
 * baked in, since a favicon has no inherited colour to take.
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
