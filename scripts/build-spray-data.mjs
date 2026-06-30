/**
 * build-spray-data.mjs — one-time ETL for the Operation Ranch Hand spray data.
 *
 * Source: Andrew Stellman's open dataset `andrewstellman/hea-v` (MIT licensed),
 * the authoritative digitisation of the HERBS file behind Stellman et al. 2003,
 * "The extent and patterns of usage of Agent Orange and other herbicides in
 * Vietnam", Nature 422:681-687.
 *
 * What it does:
 *   1. Loads herbs.json (24,604 spray "runs", 1961-1971).
 *   2. Converts each run's wartime military grid string (e.g. "AR769898") to
 *      lon/lat. The strings omit the UTM zone, so for each run we convert every
 *      candidate zone/band and keep the one that lands nearest Stellman's own
 *      georeferenced grid (gridpoints.json). The correct zone lands within a
 *      couple of km of the grid; wrong zones land ~6° (one UTM zone) away, out
 *      in the sea, so the choice is unambiguous and converter-quirk-proof.
 *   3. Emits a compact, app-ready file at public/data/spray.json.
 *
 * Run:  npm run build:data
 * Source files are cached under scripts/.cache (gitignored). If absent they are
 * fetched from the pinned hea-v commit below.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mgrs from 'mgrs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Pinned commit of andrewstellman/hea-v for reproducibility.
const HEA_V_SHA = 'cb5948bb6b48cb731f139bc3143ae36d0de02b81'
const rawUrl = (file) =>
  `https://raw.githubusercontent.com/andrewstellman/hea-v/${HEA_V_SHA}/data/${file}`
const CACHE_DIR = join(__dirname, '.cache')
// Served as a static asset (fetched at runtime), so it stays out of the JS
// bundle and off the TypeScript literal-inference path.
const OUT = join(ROOT, 'public', 'data', 'spray.json')

// Vietnam spans UTM zones 48 & 49, latitude bands N–R. We convert all of these
// and let the grid-snap test below pick the right one per run.
const CANDIDATE_ZONES = ['48', '49']
const CANDIDATE_BANDS = ['N', 'P', 'Q', 'R']
// A run is accepted only if its best candidate lands within this many degrees
// (~5 km) of Stellman's grid; the correct zone is ~0.01°, wrong zones ~6° off.
const SNAP_TOLERANCE = 0.05

// HEA-V epoch: day 1 = 1961-01-01 (matches engine.js so dates stay consistent).
const EPOCH = Date.UTC(1961, 0, 1)
const DAY_MS = 86_400_000

function dateToDay(mmddyy) {
  const [m, d, y] = mmddyy.split('/').map(Number)
  if (!m || !d || Number.isNaN(y)) return null
  const year = y >= 61 ? 1900 + y : 2000 + y
  return Math.floor((Date.UTC(year, m - 1, d) - EPOCH) / DAY_MS) + 1
}

// Single-letter HERBS agent codes -> herbicide names. O/W/B/P/etc.
const AGENTS = ['O', 'W', 'B', 'P', 'U', 'K', 'D', 'T']
const AGENT_NAMES = {
  O: 'Agent Orange', W: 'Agent White', B: 'Agent Blue', P: 'Agent Purple',
  U: 'Unknown / unspecified', K: 'Agent Pink', D: 'Dinoxol', T: 'Trinoxol',
}

// Spatial hash of Stellman's authoritative grid points, for nearest-point
// lookup during zone disambiguation.
const GRID_CELL = 0.1
const gridHash = new Map()
const gridKey = (lon, lat) =>
  `${Math.floor(lon / GRID_CELL)}|${Math.floor(lat / GRID_CELL)}`

function indexGrid(rows) {
  for (const [, lon, lat] of rows) {
    const k = gridKey(lon, lat)
    let bucket = gridHash.get(k)
    if (!bucket) gridHash.set(k, (bucket = []))
    bucket.push([lon, lat])
  }
}

function nearestGridDist(lon, lat) {
  const cx = Math.floor(lon / GRID_CELL)
  const cy = Math.floor(lat / GRID_CELL)
  let best = Infinity
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = gridHash.get(`${cx + dx}|${cy + dy}`)
      if (!bucket) continue
      for (const [glon, glat] of bucket) {
        const d = Math.hypot(lon - glon, lat - glat)
        if (d < best) best = d
      }
    }
  }
  return best
}

function utmToLonLat(utm) {
  if (!utm || utm.length < 4) return null
  const sq = utm.slice(0, 2)
  const digits = utm.slice(2)
  if (!digits.length || digits.length % 2) return null
  const half = digits.length / 2
  const e = digits.slice(0, half)
  const n = digits.slice(half)
  let best = null
  for (const z of CANDIDATE_ZONES) {
    for (const b of CANDIDATE_BANDS) {
      let point
      try {
        point = mgrs.toPoint(`${z}${b}${sq}${e}${n}`)
      } catch {
        continue // invalid square for this zone/band
      }
      const [lon, lat] = point
      const dist = nearestGridDist(lon, lat)
      if (!best || dist < best.dist) best = { lon, lat, dist }
    }
  }
  if (!best || best.dist > SNAP_TOLERANCE) return null
  return [best.lon, best.lat]
}

async function loadCached(file) {
  const path = join(CACHE_DIR, file)
  if (existsSync(path)) {
    return JSON.parse(await readFile(path, 'utf8'))
  }
  console.log(`Cache miss — fetching ${file} from hea-v@${HEA_V_SHA.slice(0, 7)} …`)
  const resp = await fetch(rawUrl(file))
  if (!resp.ok) throw new Error(`Fetch failed for ${file}: ${resp.status}`)
  const text = await resp.text()
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(path, text)
  return JSON.parse(text)
}

async function main() {
  const [herbs, grid] = await Promise.all([
    loadCached('herbs.json'),
    loadCached('gridpoints.json'),
  ])
  indexGrid(grid.rows)

  const runs = []
  let dropped = 0
  let minDay = Infinity
  let maxDay = -Infinity
  let totalGallons = 0

  for (const r of herbs) {
    const ll = utmToLonLat((r.UTM || '').trim())
    const day = dateToDay(r.Date)
    if (!ll || day == null) {
      dropped++
      continue
    }
    let agentIdx = AGENTS.indexOf(r.Agent)
    if (agentIdx < 0) agentIdx = AGENTS.indexOf('U')
    const gallons = Math.max(0, Math.round(r.Gallons || 0))
    runs.push([
      Number(ll[0].toFixed(3)),
      Number(ll[1].toFixed(3)),
      day,
      agentIdx,
      gallons,
    ])
    minDay = Math.min(minDay, day)
    maxDay = Math.max(maxDay, day)
    totalGallons += gallons
  }

  runs.sort((a, b) => a[2] - b[2]) // chronological — lets the app stream by time

  const out = {
    source: {
      dataset: 'andrewstellman/hea-v',
      commit: HEA_V_SHA,
      paper: 'Stellman et al. 2003, Nature 422:681-687',
      license: 'MIT (c) 2026 Andrew Stellman',
    },
    epoch: '1961-01-01',
    fields: ['lon', 'lat', 'day', 'agent', 'gallons'],
    agents: AGENTS,
    agentNames: AGENT_NAMES,
    runs,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(out))

  const lons = runs.map((r) => r[0])
  const lats = runs.map((r) => r[1])
  const yr = (day) => new Date(EPOCH + (day - 1) * DAY_MS).getUTCFullYear()
  console.log(`✓ wrote ${OUT}`)
  console.log(`  runs:    ${runs.length} (dropped ${dropped})`)
  console.log(`  span:    ${yr(minDay)}–${yr(maxDay)}`)
  console.log(`  gallons: ${totalGallons.toLocaleString()}`)
  console.log(
    `  bbox:    lon ${Math.min(...lons).toFixed(2)}–${Math.max(...lons).toFixed(2)}, ` +
      `lat ${Math.min(...lats).toFixed(2)}–${Math.max(...lats).toFixed(2)} ` +
      `(grid: lon 102.6–110.2, lat 8.5–20.7)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
