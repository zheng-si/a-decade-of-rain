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
 *      lon/lat. The strings omit the UTM zone, so we try Vietnam's candidate
 *      zone/bands and keep the result that falls inside the Vietnam bbox. This
 *      reproduces Stellman's own georeferencing (validated to 100% landing in
 *      the correct 100 km square against his gridpoints.json).
 *   3. Emits a compact, app-ready file at src/data/spray.json.
 *
 * Run:  npm run build:data
 * The source file is cached under scripts/.cache (gitignored). If absent it is
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
const HERBS_URL = `https://raw.githubusercontent.com/andrewstellman/hea-v/${HEA_V_SHA}/data/herbs.json`
const CACHE = join(__dirname, '.cache', 'herbs.json')
// Served as a static asset (fetched at runtime), so it stays out of the JS
// bundle and off the TypeScript literal-inference path.
const OUT = join(ROOT, 'public', 'data', 'spray.json')

// Vietnam spans UTM zones 48 & 49, latitude bands N/P/Q. Listing the common
// bands first makes the bbox test resolve each grid square unambiguously.
const CANDIDATE_ZONES = ['48P', '49P', '48Q', '49Q', '48N', '49N']
const IN_BBOX = (lon, lat) => lon > 101 && lon < 112 && lat > 7 && lat < 24

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

function utmToLonLat(utm) {
  if (!utm || utm.length < 4) return null
  const sq = utm.slice(0, 2)
  const digits = utm.slice(2)
  if (!digits.length || digits.length % 2) return null
  const half = digits.length / 2
  const e = digits.slice(0, half)
  const n = digits.slice(half)
  for (const zb of CANDIDATE_ZONES) {
    try {
      const [lon, lat] = mgrs.toPoint(`${zb}${sq}${e}${n}`)
      if (IN_BBOX(lon, lat)) return [lon, lat]
    } catch {
      /* invalid square for this zone — try next */
    }
  }
  return null
}

async function loadHerbs() {
  if (existsSync(CACHE)) {
    return JSON.parse(await readFile(CACHE, 'utf8'))
  }
  console.log(`Cache miss — fetching herbs.json from hea-v@${HEA_V_SHA.slice(0, 7)} …`)
  const resp = await fetch(HERBS_URL)
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
  const text = await resp.text()
  await mkdir(dirname(CACHE), { recursive: true })
  await writeFile(CACHE, text)
  return JSON.parse(text)
}

async function main() {
  const herbs = await loadHerbs()
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

  const yr = (day) => new Date(EPOCH + (day - 1) * DAY_MS).getUTCFullYear()
  console.log(`✓ wrote ${OUT}`)
  console.log(`  runs:    ${runs.length} (dropped ${dropped})`)
  console.log(`  span:    ${yr(minDay)}–${yr(maxDay)}`)
  console.log(`  gallons: ${totalGallons.toLocaleString()}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
