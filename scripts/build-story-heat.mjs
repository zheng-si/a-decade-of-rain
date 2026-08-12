/**
 * build-story-heat.mjs — the Story's heat field, binned from the LINES.
 *
 * The Story draws one combined heat field weighted by gallons. It was weighted
 * by the gallons on waypoint 1A, which is where the archive keeps its accounts
 * and not where herbicide fell — at the Story's own smoothing radius (3–7 km on
 * the ground) that puts it 42–58% out of place. See docs/methods.md §3.
 *
 * This bins the same runs the Archive's grids use: gallons per kilometre spread
 * along the flown track, into 0.03° cells — the same cell the Archive's fine
 * tier uses, so both surfaces are one binning at two presentations.
 *
 * TIME. A cell accumulates over the decade, but the Story animates: its heat
 * layer filters on `day <= playhead`. So a cell is split by MONTH, and a
 * (cell, month) pair is one point carrying that month's gallons. Monthly is the
 * resolution the Story steps in; splitting by day would multiply the file for
 * granularity nothing reads.
 *
 * The result is SMALLER than what it replaces — 21,711 points against 24,604 —
 * because binning 8,753 runs into shared cells collapses more than sampling
 * them adds.
 *
 *   node scripts/build-story-heat.mjs
 *
 * Reads public/data/spray-tracks.json, writes public/data/spray-heat.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const T = JSON.parse(readFileSync(join(ROOT, 'public/data/spray-tracks.json'), 'utf8'))

/** Must match volumeGrid's fine tier — one binning, two surfaces. */
const CELL = 0.03
const EPOCH_MS = Date.UTC(1961, 0, 1)
const DAY_MS = 86_400_000

const km = (a, b, c, d) => {
  const R = 6371, r = Math.PI / 180
  const dx = (c - a) * r * Math.cos(((b + d) / 2) * r)
  const dy = (d - b) * r
  return Math.sqrt(dx * dx + dy * dy) * R
}
const monthOf = (day) => {
  const d = new Date(EPOCH_MS + day * DAY_MS)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}
const monthStartDay = (m) =>
  Math.round((Date.UTC(Math.floor(m / 12), m % 12, 1) - EPOCH_MS) / DAY_MS)

/**
 * A bin keeps its gallons AND the volume-weighted mean position of the samples
 * that made them — not the cell's geometric centre.
 *
 * Snapping to cell centres was the first version and it drew a lattice: at the
 * Story's deep node zooms the kernel is narrower than the 3.3 km spacing, so
 * every cell rendered as its own discrete blob and the map came up as graph
 * paper. The centroid is where the volume actually was inside the cell — a cell
 * clipped by one straight run gets a point ON that run — so the positions carry
 * the tracks' own geometry instead of the grid's. Same point count, no lattice,
 * and strictly closer to the truth than the centre was.
 */
const bins = new Map()
const add = (ix, iy, m, gallons, lon, lat) => {
  const k = `${ix}|${iy}|${m}`
  let e = bins.get(k)
  if (!e) bins.set(k, (e = { g: 0, sx: 0, sy: 0 }))
  e.g += gallons
  e.sx += lon * gallons
  e.sy += lat * gallons
}
const cellOf = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)]

let sampled = 0
for (const [, day, gallons, runKm, flat] of T.tracks) {
  if (gallons <= 0) continue
  const m = monthOf(day)
  if (flat.length < 4 || runKm <= 0) {
    const [ix, iy] = cellOf(flat[0], flat[1])
    add(ix, iy, m, gallons, flat[0], flat[1])
    continue
  }
  const gpk = gallons / runKm
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const seg = km(flat[i], flat[i + 1], flat[i + 2], flat[i + 3])
    // A third of a cell, so no cell a run crosses is stepped over.
    const steps = Math.max(1, Math.ceil(seg / (CELL * 111 * 0.35)))
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps
      const lon = flat[i] + (flat[i + 2] - flat[i]) * t
      const lat = flat[i + 1] + (flat[i + 3] - flat[i + 1]) * t
      const [ix, iy] = cellOf(lon, lat)
      add(ix, iy, m, (gpk * seg) / steps, lon, lat)
      sampled++
    }
  }
}
// A run logged at a single grid reference has no line to spread along.
for (const [, day, gallons, lon, lat] of T.marks) {
  if (gallons <= 0) continue
  const [ix, iy] = cellOf(lon, lat)
  add(ix, iy, monthOf(day), gallons, lon, lat)
}

const cells = []
let total = 0
for (const [k, e] of bins) {
  const m = Number(k.split('|')[2])
  total += e.g
  // 3dp, not 4. The cell is 0.03° across (~3.3 km); 3dp is 0.001° (~110 m),
  // so the gallons-weighted centroid is still placed to a thirtieth of the
  // cell it belongs to — far finer than the heat ramp can show, and finer
  // than the underlying HERBS grid references were ever recorded. The fourth
  // digit is ~11 m of precision the record does not have, charged to every
  // reader at ~26 kB gzip.
  cells.push([
    Number((e.sx / e.g).toFixed(3)),
    Number((e.sy / e.g).toFixed(3)),
    monthStartDay(m),
    Math.round(e.g),
  ])
}
cells.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1])

// The weight reference, derived rather than typed: p90 of the cell-month
// totals, so most cells land in the ramp's working range and the handful of
// saturated ones are genuinely the heaviest ground. The old per-RUN reference
// (6000 gal) describes a different quantity and would clip nearly everything.
const sorted = cells.map((c) => c[3]).sort((a, b) => a - b)
const ref = sorted[Math.floor(sorted.length * 0.9)]

writeFileSync(
  join(ROOT, 'public/data/spray-heat.json'),
  JSON.stringify({
    epoch: '1961-01-01',
    cell: CELL,
    ref,
    note: 'gallons per (0.03deg cell, month), spread along each run — see docs/methods.md',
    fields: ['lon', 'lat', 'day', 'gallons'],
    cells,
  }),
)

const uniqueCells = new Set(cells.map((c) => `${c[0]},${c[1]}`)).size
console.log(`${cells.length.toLocaleString()} (cell, month) points over ${uniqueCells.toLocaleString()} cells`)
console.log(`${(total / 1e6).toFixed(3)}M gallons — must equal the record's total`)

// The line above said "must" and checked nothing, which is how it went on
// printing a reassuring number while 22,018 gallons of a double-count in
// build-spray-tracks.mjs passed straight through it. Say it in code instead.
// The input is spray-tracks.json, so that is what this has to balance against;
// its own agreement with the source record is asserted at the end of the
// track build. Tolerance is the per-cell rounding, one gallon a cell, not a
// percentage — a percentage would have swallowed the leak this is here for.
const inGallons =
  T.tracks.reduce((a, t) => a + t[2], 0) + T.marks.reduce((a, m) => a + m[2], 0)
if (Math.abs(total - inGallons) > cells.length) {
  throw new Error(
    `heat total ${total} does not balance spray-tracks' ${inGallons} ` +
      `(${total - inGallons > 0 ? '+' : ''}${total - inGallons}, tolerance ±${cells.length})`,
  )
}
console.log(`weight reference (p90 of cell-months): ${ref.toLocaleString()} gallons`)
console.log(`${sampled.toLocaleString()} samples taken along ${T.tracks.length.toLocaleString()} runs`)
