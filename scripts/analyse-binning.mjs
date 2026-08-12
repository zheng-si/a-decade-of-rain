/**
 * analyse-binning.mjs — how much does the archive's own accounting move the map?
 *
 * HERBS books every gallon of a spray run against its first waypoint, leg 1A;
 * every other leg of the run sums to exactly 0 (measured in
 * build-spray-tracks.mjs against the source). Drawing straight from those
 * fields puts a whole run's volume in one place and leaves the rest of the
 * flown track empty. This script measures what that costs, at every spatial
 * scale, so the choice of encoding rests on numbers rather than on taste.
 *
 * THERE IS NO GROUND TRUTH HERE and the script does not pretend otherwise.
 * Nobody measured gallons per square kilometre on the ground in 1967. Both
 * fields below are ESTIMATES derived from the same records, so every figure
 * printed is a DISAGREEMENT between two readings, never an error against a
 * true value. What makes the comparison decisive is not that one reading is
 * measured — it is §3, which shows the disagreement is far larger than the
 * whole envelope of readings the record admits.
 *
 *   node scripts/analyse-binning.mjs
 *
 * Reads public/data/spray-tracks.json. Pure measurement, writes nothing.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const T = JSON.parse(readFileSync(join(ROOT, 'public/data/spray-tracks.json'), 'utf8'))

/** Great-circle distance in km, flat-earth approximation (fine at this scale). */
const km = (a, b, c, d) => {
  const R = 6371, r = Math.PI / 180
  const dx = (c - a) * r * Math.cos(((b + d) / 2) * r)
  const dy = (d - b) * r
  return Math.sqrt(dx * dx + dy * dy) * R
}

/**
 * Sample a run's gallons onto a grid.
 *
 * `rate(u)` is the relative spray rate at normalised position u along the run.
 * Every profile is renormalised per run, so each run contributes EXACTLY its
 * recorded gallons whatever profile is used — the totals can never drift, and
 * any disagreement between two profiles is purely spatial.
 */
function field(deg, mode, rate = () => 1) {
  const key = (x, y) => `${Math.floor(x / deg)}|${Math.floor(y / deg)}`
  const M = new Map()
  const add = (k, v) => M.set(k, (M.get(k) ?? 0) + v)
  for (const [, , gallons, runKm, flat] of T.tracks) {
    if (gallons <= 0) continue
    const n = flat.length / 2
    if (mode === 'first') { add(key(flat[0], flat[1]), gallons); continue }
    if (mode === 'last') { add(key(flat[2 * n - 2], flat[2 * n - 1]), gallons); continue }
    if (n < 2 || runKm <= 0) { add(key(flat[0], flat[1]), gallons); continue }
    // Step finely enough that no cell is skipped, and cap the step so a coarse
    // grid does not sample a long run at two points.
    const pts = []
    let along = 0
    for (let i = 0; i + 3 < flat.length; i += 2) {
      const seg = km(flat[i], flat[i + 1], flat[i + 2], flat[i + 3])
      const steps = Math.max(1, Math.ceil(seg / Math.min(2, deg * 111 * 0.35)))
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps
        pts.push([
          key(flat[i] + (flat[i + 2] - flat[i]) * t, flat[i + 1] + (flat[i + 3] - flat[i + 1]) * t),
          Math.min(1, (along + seg * t) / runKm),
          seg / steps,
        ])
      }
      along += seg
    }
    let w = 0
    for (const [, u, len] of pts) w += rate(u) * len
    for (const [k, u, len] of pts) add(k, (gallons * rate(u) * len) / w)
  }
  // A run logged at a single grid reference is identical under every reading.
  for (const [, , gallons, lon, lat] of T.marks) {
    if (gallons > 0) add(key(lon, lat), gallons)
  }
  return M
}

/** Share of the total volume that would have to be MOVED to turn A into B. */
const moved = (A, B) => {
  let d = 0, total = 0
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    d += Math.abs((A.get(k) ?? 0) - (B.get(k) ?? 0))
    total += A.get(k) ?? 0
  }
  return d / 2 / total
}

const pct = (x) => `${Math.round(x * 100)}%`
const cellKm = (deg) => Math.round(deg * 111)
const SCALES = [0.01, 0.03, 0.06, 0.12, 0.25, 0.5, 1.0]

// ── 0 · the record ────────────────────────────────────────────────────────
const lens = T.tracks.map((t) => t[3]).sort((a, b) => a - b)
const q = (p) => lens[Math.floor(lens.length * p)]
const totalGal =
  T.tracks.reduce((a, t) => a + t[2], 0) + T.marks.reduce((a, m) => a + m[2], 0)
console.log('§0 · the record')
console.log(`   ${T.tracks.length.toLocaleString()} runs as lines, ${T.marks.length.toLocaleString()} at a single grid reference`)
console.log(`   ${(totalGal / 1e6).toFixed(3)}M gallons, and BOTH readings carry all of it — the disagreement is purely spatial`)
console.log(`   run length km: p25 ${q(0.25).toFixed(1)} · median ${q(0.5).toFixed(1)} · p75 ${q(0.75).toFixed(1)} · p90 ${q(0.9).toFixed(1)} · max ${lens[lens.length - 1].toFixed(1)}`)

// Source coordinate resolution — the floor under every figure below.
const xs = new Set(), ys = new Set()
for (const [, , , , f] of T.tracks) for (let i = 0; i + 1 < f.length; i += 2) { xs.add(f[i]); ys.add(f[i + 1]) }
const step = (s) => {
  const a = [...s].sort((p, r) => p - r)
  const d = []
  for (let i = 1; i < a.length; i++) if (a[i] - a[i - 1] > 1e-9) d.push(a[i] - a[i - 1])
  return d.sort((p, r) => p - r)[Math.floor(d.length / 2)]
}
const stepM = step(xs) * 111.32 * 1000
console.log(`   source coordinates are quantised to ${step(xs).toFixed(3)}° ≈ ${Math.round(stepM)} m — ${Math.round((0.03 * 111320) / stepM)}× finer than the finest cell used, so quantisation is not a term in anything below`)

// ── 1 · how far apart are the two readings? ───────────────────────────────
console.log('\n§1 · booked at 1A vs spread along the run')
console.log('   cell     cells with volume     volume to move     peak cell ratio')
const uniform = {}
for (const deg of SCALES) {
  const F = field(deg, 'first')
  const U = field(deg, 'uniform')
  uniform[deg] = U
  const peak = Math.max(...F.values()) / Math.max(...U.values())
  console.log(
    `  ${String(cellKm(deg) + ' km').padStart(6)}` +
    `${String(F.size.toLocaleString() + ' → ' + U.size.toLocaleString()).padStart(22)}` +
    `${String(pct(moved(F, U))).padStart(19)}` +
    `${String(peak.toFixed(2) + '×').padStart(20)}`,
  )
}
console.log('   The disagreement dies at the scale of a run. Above ~28 km a run stays')
console.log('   inside its own cell and the booking convention stops mattering.')

// ── 2 · what the disagreement does to a density field ─────────────────────
console.log('\n§2 · cumulative deposited volume, gal/km²')
console.log('   cell      mean    mean abs diff   rel   read as 0   >2× out   Spearman')
for (const deg of SCALES) {
  const F = field(deg, 'first')
  const U = uniform[deg]
  const keys = [...new Set([...F.keys(), ...U.keys()])]
  const area = (k) => {
    const lat = (Number(k.split('|')[1]) + 0.5) * deg
    return deg * 111.32 * deg * 111.32 * Math.cos((lat * Math.PI) / 180)
  }
  const f = keys.map((k) => (F.get(k) ?? 0) / area(k))
  const u = keys.map((k) => (U.get(k) ?? 0) / area(k))
  const mean = u.reduce((a, c) => a + c, 0) / keys.length
  const mad = f.reduce((a, c, i) => a + Math.abs(c - u[i]), 0) / keys.length
  let zero = 0, out2 = 0, live = 0
  for (let i = 0; i < keys.length; i++) {
    if (u[i] <= 0) continue
    live++
    if (f[i] <= 0) { zero++; out2++; continue }
    const r = f[i] / u[i]
    if (Math.max(r, 1 / r) > 2) out2++
  }
  const rank = (a) => {
    const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
    const r = new Array(a.length)
    let i = 0
    while (i < o.length) {
      let j = i
      while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++
      for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1
      i = j + 1
    }
    return r
  }
  const rf = rank(f), ru = rank(u)
  const n = keys.length
  const mf = rf.reduce((a, c) => a + c, 0) / n, mu = ru.reduce((a, c) => a + c, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const a = rf[i] - mf, b = ru[i] - mu; sxy += a * b; sxx += a * a; syy += b * b }
  console.log(
    `  ${String(cellKm(deg) + ' km').padStart(6)}` +
    `${String(Math.round(mean)).padStart(10)}` +
    `${String(Math.round(mad)).padStart(17)}` +
    `${String(pct(mad / mean)).padStart(6)}` +
    `${String(pct(zero / live)).padStart(12)}` +
    `${String(pct(out2 / live)).padStart(10)}` +
    `${String((sxy / Math.sqrt(sxx * syy)).toFixed(2)).padStart(11)}`,
  )
}
console.log('   "read as 0" is the share of cells that were dosed and the booked')
console.log('   reading leaves empty. At 3 km that is most of them.')

// ── 3 · the argument that does not need a ground truth ────────────────────
//
// Spreading along the run assumes a constant rate, which is an assumption and
// not a measurement. So: push that assumption as hard as the record allows and
// see how far the answer moves. Every profile here is still "the herbicide fell
// along the track the aircraft flew" — the one thing the record does establish.
console.log('\n§3 · sensitivity — how much does the rate profile actually matter?')
console.log('   Volume to move, relative to a constant rate along the run:')
console.log('   cell   2× front-loaded  2× back-loaded  middle-heavy  ends-heavy  |  BOOKED AT 1A')
const PROFILES = [
  ['front', (u) => 2 * (1 - u)],
  ['back', (u) => 2 * u],
  ['mid', (u) => 1.5 - Math.abs(2 * u - 1)],
  ['ends', (u) => 0.5 + Math.abs(2 * u - 1)],
]
for (const deg of [0.03, 0.12, 0.25]) {
  const U = uniform[deg]
  const cols = PROFILES.map(([, r]) => pct(moved(field(deg, 'uniform', r), U)))
  const widths = [17, 16, 14, 12]
  console.log(
    `  ${String(cellKm(deg) + ' km').padStart(6)}` +
    cols.map((c, i) => String(c).padStart(widths[i])).join('') +
    `${String(pct(moved(field(deg, 'first'), U))).padStart(18)}`,
  )
}
console.log('')
console.log('   This is the finding. Within the family of readings the record admits —')
console.log('   the herbicide fell somewhere along the flown track — the answer is')
console.log('   settled to within about 15% at 3 km, even under rate profiles far more')
console.log('   extreme than anything Ranch Hand is likely to have flown. Booking it all')
console.log('   at 1A sits ~4× outside that whole envelope. It is not one plausible')
console.log('   reading among several; it is outside the range of readings compatible')
console.log('   with the aircraft having flown the track the record itself gives.')
