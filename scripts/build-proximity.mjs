/**
 * build-proximity.mjs — the Stellmans' own proximity model, one cell at a time.
 *
 * hea-v ships the Exposure_Master table behind Stellman & Stellman (2004):
 * one row per (mission, grid point) wherever a mission's spray path came
 * within 5 km of a point of the 0.01° study grid (data/exposure/bucket_*.json
 * at the pinned commit, 1,454,956 rows). Each row carries the "hits" of that
 * mission on that point — how many of its spray paths passed within 0.5, 1, 2
 * and 5 km, nested so that a 0.5 km hit is also a 1 km one — and E4_total_30,
 * the mission's contribution to the exposure opportunity index at that point
 * for a 30-day half-life. The truncated longitude and latitude of a grid
 * point are the SOUTH-WEST corner of its cell (hea-v engine.js, gridKey).
 *
 * This script does not model anything. It sums those rows per cell, per agent
 * group, so the Atlas can draw "spray paths recorded within d km of this cell,
 * 1961–1971" from the authors' own table rather than from a re-derivation of
 * it. Nothing here is a claim about deposition or dose; the E4 sums are
 * carried so that a later reading can show the index the 2004 paper defines,
 * and are not drawn yet.
 *
 * Output: public/data/proximity.json — a sparse grid. `idx` is the cell index
 * (row × ncols + col) delta-encoded; `n[g][b]` the path count for agent group
 * g within band b; `e4[g]` the summed E4_total_30, rounded to whole units.
 *
 * Run: node scripts/build-proximity.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE = join(__dirname, '.cache')
const OUT = join(ROOT, 'public', 'data', 'proximity.json')

// The Atlas's four agent groups, from mapConfig.agents. Everything the table
// codes that is not O, W or B is "Other", as on the map.
const GROUPS = ['Orange', 'White', 'Blue', 'Other']
const groupOf = (agent) => ({ O: 0, W: 1, B: 2 })[agent] ?? 3
const BANDS = [0.5, 1, 2, 5]
const STEP = 0.01

const grid = JSON.parse(await readFile(join(CACHE, 'gridpoints.json'), 'utf8'))
let lon0 = Infinity, lat0 = Infinity, lon1 = -Infinity, lat1 = -Infinity
for (const [, lon, lat] of grid.rows) {
  if (lon < lon0) lon0 = lon
  if (lat < lat0) lat0 = lat
  if (lon > lon1) lon1 = lon
  if (lat > lat1) lat1 = lat
}
const ncols = Math.round((lon1 - lon0) / STEP) + 1
const nrows = Math.round((lat1 - lat0) / STEP) + 1
const cellOfPoint = new Map()
for (const [id, lon, lat] of grid.rows) {
  const col = Math.round((lon - lon0) / STEP)
  const row = Math.round((lat - lat0) / STEP)
  cellOfPoint.set(id, row * ncols + col)
}

// Per cell: 16 counts and 4 E4 sums, in flat typed arrays over the full
// rectangle; sparsified on output.
const N = ncols * nrows
const counts = Array.from({ length: GROUPS.length * BANDS.length }, () => new Uint32Array(N))
const e4 = Array.from({ length: GROUPS.length }, () => new Float64Array(N))

const dir = join(CACHE, 'exposure')
const files = (await readdir(dir)).filter((f) => /^bucket_\d{3}\.json$/.test(f)).sort()
let rows = 0
let missions = new Set()
let unknownPoint = 0
let repaired = 0
for (const f of files) {
  const b = JSON.parse(await readFile(join(dir, f), 'utf8'))
  const c = b.cols
  const iM = c.indexOf('Mission'), iP = c.indexOf('PointID'), iA = c.indexOf('Agent')
  const iH = c.indexOf('hits05km'), iE = c.indexOf('E4_total_30')
  for (const r of b.rows) {
    const cell = cellOfPoint.get(r[iP])
    if (cell == null) {
      unknownPoint++
      continue
    }
    rows++
    missions.add(r[iM])
    const g = groupOf(r[iA])
    // The bands nest by construction (a leg within 0.5 km is within 1 km), and
    // the table honours that in every row but one: mission 989 at point
    // 226078 carries hits2km = 65536 against hits5km = 1, a stray bit in the
    // source. Nesting is enforced from the outside in, so that row reads as
    // the one leg within 5 km it also says it is; the count of rows touched
    // is reported below and should stay at 1.
    const h = [r[iH], r[iH + 1], r[iH + 2], r[iH + 3]]
    for (let bi = 2; bi >= 0; bi--) if (h[bi] > h[bi + 1]) { h[bi] = h[bi + 1]; repaired++ }
    for (let bi = 0; bi < BANDS.length; bi++) counts[g * BANDS.length + bi][cell] += h[bi]
    e4[g][cell] += r[iE]
  }
}

// Sparse output: every cell with at least one path within 5 km.
const idx = []
const n = GROUPS.map(() => BANDS.map(() => []))
const e4Out = GROUPS.map(() => [])
let last = 0
let maxAll = [0, 0, 0, 0]
const n1All = []
for (let cell = 0; cell < N; cell++) {
  let any = 0
  for (let g = 0; g < GROUPS.length; g++) any += counts[g * BANDS.length + 3][cell]
  if (!any) continue
  idx.push(cell - last)
  last = cell
  let tot1 = 0
  for (let g = 0; g < GROUPS.length; g++) {
    for (let bi = 0; bi < BANDS.length; bi++) {
      const v = counts[g * BANDS.length + bi][cell]
      n[g][bi].push(v)
    }
    tot1 += counts[g * BANDS.length + 1][cell]
    e4Out[g].push(Math.round(e4[g][cell]))
  }
  for (let bi = 0; bi < BANDS.length; bi++) {
    let t = 0
    for (let g = 0; g < GROUPS.length; g++) t += counts[g * BANDS.length + bi][cell]
    if (t > maxAll[bi]) maxAll[bi] = t
  }
  n1All.push(tot1)
}
n1All.sort((a, b) => a - b)
const q = (p) => n1All[Math.min(n1All.length - 1, Math.floor(p * n1All.length))]

const out = {
  source: 'hea-v data/exposure at cb5948b (Stellman & Stellman, 2004)',
  lon0, lat0, step: STEP, ncols, nrows,
  groups: GROUPS,
  bands: BANDS,
  cells: idx.length,
  idx, n,
}
// E4 is summed (e4Out) but not shipped yet: it doubles the file and nothing
// draws it. When the index view exists it goes out as its own file.
await writeFile(OUT, JSON.stringify(out))
const e4Cells = e4Out[0].filter((v, i) => v + e4Out[1][i] + e4Out[2][i] + e4Out[3][i] > 0).length
console.log(JSON.stringify({
  files: files.length, rows, missions: missions.size, unknownPoint, repaired, e4Cells,
  grid: { ncols, nrows, lon0, lat0 }, cells: idx.length,
  maxPathsWithin: Object.fromEntries(BANDS.map((b, i) => [b, maxAll[i]])),
  within1kmQuantiles: { p50: q(0.5), p75: q(0.75), p90: q(0.9), p95: q(0.95), p99: q(0.99) },
  zeroWithin1km: n1All.filter((v) => v === 0).length,
}, null, 1))
console.log(`wrote ${OUT}`)
