/**
 * The year typology's geometry, in one place and as parameters rather than as
 * a literal path.
 *
 * The drop used to be an authored path string with its construction described
 * in a comment beside it. That was right while the shape was settled and wrong
 * the moment it needed tuning: a comment cannot be dialled, and the previous
 * round of shape work was done on throwaway HTML sheets outside the repo, so
 * nothing that was learned there could be re-opened here. These functions
 * rebuild that exact path from four numbers, so the tuner and the shipped page
 * are the same geometry rather than two that have to be kept in step.
 *
 * VERIFIED: at the defaults below, buildDrop() reproduces the shipped path
 * point for point — tangent points (55.01, 2.70) and (95.05, 63.50), equator
 * (100, 80), flank 33.37 degrees from vertical against the 33.4 that was
 * measured. The path is regenerated, not remembered.
 */

export type Shape = 'drop' | 'circle' | 'square'

export interface FieldGeom {
  shape: Shape

  // ── the mark ────────────────────────────────────────────────────────────
  /** Height as a multiple of width. The drop's box is W x (W * aspect). */
  aspect: number
  /** Apex arc radius, as a percentage of width. 0 is a true point. */
  apex: number
  /** Hip arc radius, as a percentage of width. Cannot exceed 50, which is the
   *  base radius — at exactly 50 the hips ARE the base circle. */
  hip: number
  /** Corner radius for the square, as a percentage of width. */
  corner: number

  // ── the field ───────────────────────────────────────────────────────────
  cols: number
  rows: number
  /** Space between marks WITHIN one year's field, as a percentage of the
   *  mark's own width (gapX) and height (gapY). The shipped 58.73/45.18 is the
   *  63% density that was chosen on a built sheet: pitch = W / 0.63, so the
   *  gap is W * (1/0.63 - 1) = 58.7% of W, and the same absolute gap on the
   *  Y axis is 58.7/1.30 = 45.2% of the taller H. */
  gapX: number
  gapY: number

  // ── the grid of fields ──────────────────────────────────────────────────
  /** Minimum width of one year cell, in px. This is what decides how many
   *  years sit across, and therefore how large each mark renders.
   *
   *  PX, NOT REM, and that is not an oversight: the root font-size is this
   *  project's density dial and drops to 13.6px between 641 and 1600 wide, so
   *  a rem floor meant as a physical size on glass would quietly become 85% of
   *  itself on a laptop — a 140px floor turning into 119. */
  cellMin: number
  /** Gaps BETWEEN year cells, in REM — where cellMin above is px, and the
   *  difference is deliberate. cellMin is a physical floor on the mark's size
   *  and must not shrink with the root; this is layout rhythm and should move
   *  with the type around it, which is what the shipped `1.25rem 1rem` does
   *  (13.6px on a laptop, not 16). The tuner shows both numbers. */
  gridGapX: number
  gridGapY: number
  /** Cap on the whole grid, in px. Without it the 1120px measure at 1920 takes
   *  a seventh column and leaves a row of seven over a row of four. */
  maxWidth: number

  // ── the unit ────────────────────────────────────────────────────────────
  /** U.S. gallons per mark in Volume mode. Tied to cols x rows: the peak year
   *  must still fit the field. */
  gallons: number
}

/** The shipped values. Every one of these was measured rather than guessed —
 *  see the PR for the sheets each came off. */
export const FIELD_DEFAULTS: FieldGeom = {
  shape: 'drop',
  aspect: 1.3,
  apex: 6,
  hip: 30,
  corner: 20,
  cols: 12,
  rows: 12,
  gapX: 58.7302,
  gapY: 45.1771,
  cellMin: 140,
  gridGapX: 1,
  gridGapY: 1.25,
  maxWidth: 1030,
  gallons: 40000,
}

/** The mark's own coordinate space. The grid is scaled INTO this, never the
 *  other way round: rescaling a path means a regex over its numbers, which
 *  also hits the arc flags (`A R R 0 1 1`) and silently invalidates every
 *  path. That bug cost a rendering pass to find once already. */
export const UNIT_W = 100

const r2 = (v: number) => Math.round(v * 100) / 100

/**
 * The straight-flanked compass drop, rebuilt from its parameters.
 *
 * Four radii and two lines, every junction tangent-continuous. Apex arc r=a
 * centred (W/2, a), so it is tangent to the top of the box. Base circle r=W/2
 * centred (W/2, H - W/2), so the widest point is exactly the box width. Hip
 * arcs r=h centred (W/2 +/- (W/2 - h), H - W/2), placed so they are internally
 * tangent to the base circle exactly at the equator. The flanks are the common
 * tangents of the apex and hip circles.
 *
 * The tangent construction, which is the only part that is not arithmetic: for
 * circles C1 (r=a) and C2 (r=h), a line touching both on the same side has a
 * unit normal n with n·(C2 - C1) = a - h. That fixes the angle between n and
 * the centre line to acos((a - h)/D), leaving two candidates; the flank on the
 * right is the one whose normal points right.
 *
 * This replaces a construction whose apex rounding was a quadratic THROUGH the
 * nominal apex, so the drawn shape never reached the top of its own box: at the
 * shipped rounding the curve's highest point sat 7.9% down, the drop rendered
 * 8.02px where the parameters said 8.7, and changing the rounding silently
 * changed the effective aspect ratio too. Here the bbox is exactly 0,0,W,H for
 * every parameter combination, so the numbers mean what they say.
 */
export function buildDrop(g: Pick<FieldGeom, 'aspect' | 'apex' | 'hip'>): {
  d: string
  valid: boolean
  why: string
  flank: number
} {
  const W = UNIT_W
  const H = W * g.aspect
  const R = W / 2
  const a = (W * g.apex) / 100
  const h = Math.min((W * g.hip) / 100, R)

  const c1 = { x: W / 2, y: a }
  const c2 = { x: W / 2 + (R - h), y: H - R }
  const dx = c2.x - c1.x
  const dy = c2.y - c1.y
  const D = Math.hypot(dx, dy)

  // No tangent exists when one circle contains the other. Clamp so the path is
  // still drawable, and say so rather than rendering a lie.
  const raw = D === 0 ? 2 : (a - h) / D
  const ok = D > 0 && Math.abs(raw) <= 1
  const psi = Math.acos(Math.max(-1, Math.min(1, raw)))
  const phi = Math.atan2(dy, dx)
  const cand = [phi - psi, phi + psi].map((t) => ({ x: Math.cos(t), y: Math.sin(t) }))
  const n = cand[0].x >= cand[1].x ? cand[0] : cand[1]

  const t1 = { x: c1.x + a * n.x, y: c1.y + a * n.y }
  const t2 = { x: c2.x + h * n.x, y: c2.y + h * n.y }
  // The flank must run DOWNWARD from apex to hip. When it does not, the outline
  // crosses itself and the mark is no longer a drop.
  const valid = ok && t1.y < t2.y && H > R

  const eqR = { x: W / 2 + R, y: H - R }
  const eqL = { x: W / 2 - R, y: H - R }
  const A = (r: number, x: number, y: number) => `A ${r2(r)} ${r2(r)} 0 0 1 ${r2(x)} ${r2(y)}`
  // A zero radius makes the apex a true point. SVG treats a zero-radius arc as
  // a line, but an explicit L says what is meant.
  const apexArc = (x: number, y: number) => (a < 0.05 ? `L ${r2(x)} ${r2(y)}` : A(a, x, y))

  const d = [
    `M ${r2(W / 2)} 0`,
    apexArc(t1.x, t1.y),
    `L ${r2(t2.x)} ${r2(t2.y)}`,
    A(h, eqR.x, eqR.y),
    // The base is two arcs, not one. A single arc between two points exactly a
    // diameter apart is ambiguous, and browsers have disagreed about it.
    A(R, W / 2, H),
    A(R, eqL.x, eqL.y),
    A(h, W - t2.x, t2.y),
    `L ${r2(W - t1.x)} ${r2(t1.y)}`,
    apexArc(W / 2, 0),
    'Z',
  ].join(' ')

  return {
    d,
    valid,
    why: !ok ? 'no common tangent — the apex circle is inside the hip' : !valid ? 'the flank runs upward — this is no longer a drop' : '',
    flank: (Math.atan2(Math.abs(n.y), n.x) * 180) / Math.PI,
  }
}

/** An ellipse filling the box. Two arcs for the same reason the base is two. */
export function buildCircle(aspect: number): string {
  const W = UNIT_W
  const H = W * aspect
  const rx = W / 2
  const ry = H / 2
  const A = `A ${r2(rx)} ${r2(ry)} 0 0 1`
  return `M ${r2(W / 2)} 0 ${A} ${r2(W / 2)} ${r2(H)} ${A} ${r2(W / 2)} 0 Z`
}

/** A rounded rectangle filling the box — the waffle mark this typology is a
 *  departure from, kept so the departure can be re-argued rather than assumed. */
export function buildSquare(aspect: number, corner: number): string {
  const W = UNIT_W
  const H = W * aspect
  const c = Math.max(0, Math.min((W * corner) / 100, Math.min(W, H) / 2))
  const A = (x: number, y: number) => `A ${r2(c)} ${r2(c)} 0 0 1 ${r2(x)} ${r2(y)}`
  if (c < 0.05) return `M 0 0 H ${r2(W)} V ${r2(H)} H 0 Z`
  return [
    `M ${r2(c)} 0`,
    `H ${r2(W - c)}`,
    A(W, c),
    `V ${r2(H - c)}`,
    A(W - c, H),
    `H ${r2(c)}`,
    A(0, H - c),
    `V ${r2(c)}`,
    A(c, 0),
    'Z',
  ].join(' ')
}

export interface BuiltField {
  d: string
  valid: boolean
  why: string
  flank: number
  /** The mark's box, in its own units. */
  dw: number
  dh: number
  cols: number
  rows: number
  cells: number
  pitchX: number
  pitchY: number
  fieldW: number
  fieldH: number
}

/** Everything the field needs, derived once per render. */
export function buildField(g: FieldGeom): BuiltField {
  const dw = UNIT_W
  const dh = UNIT_W * g.aspect
  const drop = g.shape === 'drop' ? buildDrop(g) : null
  const d =
    g.shape === 'drop'
      ? drop!.d
      : g.shape === 'circle'
        ? buildCircle(g.aspect)
        : buildSquare(g.aspect, g.corner)

  const cols = Math.max(1, Math.round(g.cols))
  const rows = Math.max(1, Math.round(g.rows))
  const pitchX = dw * (1 + g.gapX / 100)
  const pitchY = dh * (1 + g.gapY / 100)
  return {
    d,
    valid: drop ? drop.valid : true,
    why: drop ? drop.why : '',
    flank: drop ? drop.flank : 0,
    dw,
    dh,
    cols,
    rows,
    cells: cols * rows,
    pitchX,
    pitchY,
    fieldW: (cols - 1) * pitchX + dw,
    fieldH: (rows - 1) * pitchY + dh,
  }
}

/** The gap the shipped density implies, so the tuner can show both the number
 *  a designer sets (a gap) and the number the last round was argued in (a
 *  density: the mark's width as a fraction of the pitch). */
export const densityOf = (gapX: number) => 1 / (1 + gapX / 100)
export const gapOf = (density: number) => (1 / density - 1) * 100
