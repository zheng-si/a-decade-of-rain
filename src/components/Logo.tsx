/**
 * The mark: nine bars hanging from a flat top, longest and widest at the
 * centre, tapering to hairlines at both edges — rain falling, heaviest in the
 * middle of the decade.
 *
 * Which is the point of choosing it over a row of even bars: the profile is
 * the story's own shape. Ranch Hand starts small in 1961, climbs to a peak in
 * 1967–69 and stops in 1971, and the chart on the Herbicides screen draws
 * exactly that curve. The mark and the figure it sits above are then one
 * argument rather than two decorations.
 *
 * Geometry is the supplied artwork's, on its 120×120 square. The source
 * expressed the left half as mirrored rects — `matrix(-1 0 0 1 T 0)`, which
 * spans (T − w) to T — and those are flattened to plain coordinates here: the
 * numbers a reader needs are the ones on screen, not the ones before a
 * transform. Widths 2/4/6/10/14 and heights 40/60/80/100/120, symmetric about
 * the centre bar at x 53–67.
 *
 * Two placements, both on `currentColor` so each takes the colour of the text
 * around it: the rail mark and the epilogue mark, which are the two places the
 * site signs its own name. The agent card keeps the biohazard trefoil — on a
 * card naming a herbicide that symbol is saying what the drum held, which is
 * not a job a wordmark can take over.
 *
 * public/favicon.svg carries a REDUCED cut of this, not the same file: at 16px
 * the 2-unit edge bars land on a quarter of a pixel and disappear, taking the
 * taper with them. See the note there. The artwork came in #FB4D46; the site
 * keeps one orange and it is #ff5449, which index.html also declares as its
 * theme-color.
 */
export const LOGO_SIZE = 120

/** [x, width, height] per bar, left to right. All hang from y = 0. */
export const LOGO_BARS: readonly (readonly [number, number, number])[] = [
  [0, 2, 40],
  [13, 4, 60],
  [27, 6, 80],
  [40, 10, 100],
  [53, 14, 120],
  [70, 10, 100],
  [87, 6, 80],
  [103, 4, 60],
  [118, 2, 40],
]

export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {LOGO_BARS.map(([x, w, h]) => (
        <rect key={x} x={x} y={0} width={w} height={h} />
      ))}
    </svg>
  )
}
