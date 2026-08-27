/**
 * build-spray-tracks.mjs — the spray record as what it actually is: lines.
 *
 * Same source and same georeferencing as build-spray-data.mjs (see that file
 * for the UTM-zone disambiguation, which is lifted verbatim), but it keeps the
 * three fields that ETL drops — Mission, Run, Leg — and those three are the
 * whole point.
 *
 * WHAT THE SOURCE ACTUALLY SAYS. Measured against herbs.json at the pinned
 * commit, not inferred:
 *
 *   · every row carries a Leg of the form 1A, 1B, 2A … (100% of 24,604)
 *   · grouped by Mission + Run there are 11,273 runs; 8,582 have more than one
 *     waypoint, and the waypoints chain end to end (median gap from leg nB to
 *     (n+1)A is 2.63 km)
 *   · 11,097 of the 11,273 are a single numbered leg — one unbroken track
 *   · the commonest shape is two waypoints: a straight line from A to B
 *   · ALL 19,490,690 gallons sit on leg 1A; every other leg sums to exactly 0
 *   · the median run traces an 11.4 km polyline (p90 19.9 km, max 354.6)
 *   · Date, Agent, Method, Type, Source and CTZ never vary within a run
 *
 * So a spray run is a LINE flown on one day by one aircraft type carrying one
 * agent, and HERBS books the run's whole volume against the first waypoint.
 * Reading those rows as independent points — which is what dropping Mission /
 * Run / Leg forces you to do — puts an eleven-kilometre run's entire volume in
 * the cell containing one of its ends.
 *
 * WHAT THIS FILE DOES NOT KNOW. There is no per-waypoint quantity anywhere in
 * the source: Gallons and FWAC both appear only on leg 1A. So volume can only
 * be spread along a track geometrically, and this script spreads it by LENGTH,
 * on the physical argument that an aircraft with the valve open lays down a
 * roughly constant amount per kilometre flown.
 *
 * One thing the data genuinely cannot answer: whether the aircraft sprayed
 * across the jump from leg n to leg n+1, or whether that jump is a turn. This
 * script assumes it is a turn and spreads volume only WITHIN a numbered leg —
 * which is why the leg number exists at all. It matters for 176 runs out of
 * 11,273, and the assumption is recorded here rather than buried in a formula.
 *
 * Run:  npm run build:tracks
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mgrs from 'mgrs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Same pinned commit as build-spray-data.mjs — the two outputs must describe
// the same record, so they must not drift to different snapshots of it.
const HEA_V_SHA = 'cb5948bb6b48cb731f139bc3143ae36d0de02b81'
const rawUrl = (file) =>
  `https://raw.githubusercontent.com/andrewstellman/hea-v/${HEA_V_SHA}/data/${file}`
const CACHE_DIR = join(__dirname, '.cache')
const OUT = join(ROOT, 'public', 'data', 'spray-tracks.json')

const CANDIDATE_ZONES = ['48', '49']
const CANDIDATE_BANDS = ['N', 'P', 'Q', 'R']
const SNAP_TOLERANCE = 0.05

const EPOCH = Date.UTC(1961, 0, 1)
const DAY_MS = 86_400_000

function dateToDay(mmddyy) {
  const [m, d, y] = String(mmddyy).split('/').map(Number)
  if (!m || !d || Number.isNaN(y)) return null
  const year = y >= 61 ? 1900 + y : 2000 + y
  return Math.floor((Date.UTC(year, m - 1, d) - EPOCH) / DAY_MS) + 1
}

const AGENTS = ['O', 'W', 'B', 'P', 'U', 'K', 'D', 'T']

/* ── georeferencing (identical to build-spray-data.mjs) ─────────────────── */

const GRID_CELL = 0.1
const gridHash = new Map()
const gridKey = (lon, lat) => `${Math.floor(lon / GRID_CELL)}|${Math.floor(lat / GRID_CELL)}`

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
        continue
      }
      const [lon, lat] = point
      const dist = nearestGridDist(lon, lat)
      if (!best || dist < best.dist) best = { lon, lat, dist }
    }
  }
  if (!best || best.dist > SNAP_TOLERANCE) return null
  return [Number(best.lon.toFixed(3)), Number(best.lat.toFixed(3))]
}

/** Great-circle distance in km, equirectangular — good to <0.1% at this scale
 *  and these are 100 m-precision grid references to begin with. */
function km(a, b) {
  const R = 6371
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const lat = rad((a[1] + b[1]) / 2)
  return R * Math.hypot(dLat, dLon * Math.cos(lat))
}

async function loadCached(file) {
  const path = join(CACHE_DIR, file)
  if (existsSync(path)) return JSON.parse(await readFile(path, 'utf8'))
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

  // Group by run, preserving source order — the rows arrive in leg order and
  // that order IS the track. Sorting by the Leg label would be a second
  // opinion about the flight path; the file's own order is the first.
  const runs = new Map()
  for (const r of herbs) {
    const key = `${r.Mission}|${r.Run}`
    let g = runs.get(key)
    if (!g) runs.set(key, (g = []))
    g.push(r)
  }

  /** Segments of one run, split at leg-number changes. Each segment is a
   *  polyline the aircraft is assumed to have sprayed continuously. */
  const segmentsOf = (rows) => {
    const segs = []
    let cur = null
    let curLeg = null
    for (const r of rows) {
      const leg = String(r.Leg).match(/^\d+/)?.[0] ?? '1'
      const pt = utmToLonLat(String(r.UTM || '').trim())
      if (!pt) continue
      if (leg !== curLeg) {
        cur = []
        segs.push(cur)
        curLeg = leg
      }
      // Consecutive duplicate coordinates would contribute zero length and a
      // zero-length segment to the renderer; collapse them here.
      const last = cur[cur.length - 1]
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) cur.push(pt)
    }
    return segs.filter((s) => s.length > 0)
  }

  const tracks = [] // [agent, day, gallons, km, [lon,lat,…]]
  const marks = [] // single-point runs: [agent, day, gallons, lon, lat]
  let dropped = 0
  let totalGallons = 0
  let spreadGallons = 0
  let markGallons = 0

  for (const rows of runs.values()) {
    const day = dateToDay(rows[0].Date)
    if (day == null) {
      dropped += rows.length
      continue
    }
    let agent = AGENTS.indexOf(rows[0].Agent)
    if (agent < 0) agent = AGENTS.indexOf('U')
    const gallons = rows.reduce((s, r) => s + Math.max(0, Math.round(r.Gallons || 0)), 0)
    totalGallons += gallons
    // Run identity, carried through so a record on screen can cite the row it
    // came from. Mission and Run are integers in the source; like Date and
    // Agent they never vary within a run (verified at the pinned commit).
    const mission = Number(rows[0].Mission) || 0
    const runNo = Number(rows[0].Run) || 0
    // FWAC (aircraft count) books on leg 1A like Gallons. Six digits, three
    // two-digit subfields; hea-v's own engine.js reads the count from the
    // LAST two ("FWAC filter uses last 2 digits"), and that reading is
    // followed here rather than inventing one. 0 = not recorded.
    const fw = String(rows[0].FWAC || '')
    const fwac = fw.length === 6 ? parseInt(fw.slice(-2), 10) || 0 : 0

    const segs = segmentsOf(rows)
    if (!segs.length) {
      dropped += rows.length
      continue
    }
    // Total sprayed length: only within-leg segments count, per the note at the
    // top. A run whose segments are all single points has zero length and can
    // only be a mark.
    const lengths = segs.map((s) => {
      let t = 0
      for (let i = 1; i < s.length; i++) t += km(s[i - 1], s[i])
      return t
    })
    const total = lengths.reduce((a, b) => a + b, 0)

    if (total <= 0) {
      // No line to draw — a run recorded at one place. Its gallons stay put,
      // which for a point is not an approximation but the whole record.
      //
      // "Stay put" has to mean SPLIT once a run has more than one point, and
      // that is what this replaces: the old line handed EVERY single-point
      // segment the run's full volume, so a run logged at three places
      // published three times its gallons. Measured across the record it put
      // 22,018 gallons into the marks that the source never recorded — 0.11%
      // against 19.5M, which is small, and wrong in a file whose entire claim
      // is that it is the record.
      //
      // Length-share is unavailable here by definition, so count is the only
      // weight the source supports. The remainder rides on the first point so
      // the parts sum to the whole exactly rather than to within a rounding.
      const points = segs.reduce((n, s) => n + (s.length === 1 ? 1 : 0), 0)
      const each = points ? Math.floor(gallons / points) : 0
      let rest = gallons - each * points
      for (const s of segs) {
        let g = 0
        if (s.length === 1) {
          g = each + rest
          rest = 0
        }
        markGallons += g
        marks.push([agent, day, g, s[0][0], s[0][1], mission, runNo, fwac])
      }
      continue
    }
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].length < 2) continue
      // Volume by share of length — the only weight the source supports.
      const g = Math.round((gallons * lengths[i]) / total)
      spreadGallons += g
      tracks.push([agent, day, g, Number(lengths[i].toFixed(2)), segs[i].flat(), mission, runNo, fwac])
    }
  }

  tracks.sort((a, b) => a[1] - b[1])
  marks.sort((a, b) => a[1] - b[1])

  const out = {
    source: {
      dataset: 'andrewstellman/hea-v',
      commit: HEA_V_SHA,
      paper: 'Stellman et al. 2003, Nature 422:681-687',
      license: 'MIT (c) 2026 Andrew Stellman',
    },
    epoch: '1961-01-01',
    note:
      "A spray run is a line. HERBS books a run's whole volume against its " +
      'first waypoint; here it is spread along the run by segment length, ' +
      'which is the only weighting the source supports.',
    agents: AGENTS,
    trackFields: ['agent', 'day', 'gallons', 'km', 'coords', 'mission', 'run', 'fwac'],
    markFields: ['agent', 'day', 'gallons', 'lon', 'lat', 'mission', 'run', 'fwac'],
    tracks,
    marks,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(out))

  const lens = tracks.map((t) => t[3]).sort((a, b) => a - b)
  const gpk = tracks.filter((t) => t[3] > 0).map((t) => t[2] / t[3]).sort((a, b) => a - b)
  const q = (a, p) => a[Math.floor(a.length * p)]
  console.log(`✓ wrote ${OUT}`)
  console.log(`  runs:      ${runs.size} → ${tracks.length} tracks + ${marks.length} marks`)
  console.log(`  dropped:   ${dropped} rows`)
  console.log(
    `  gallons:   ${totalGallons.toLocaleString()} in, ${spreadGallons.toLocaleString()} along tracks + ` +
      `${markGallons.toLocaleString()} on marks`,
  )

  // The guard that would have caught the point-run double-count on the day it
  // was written. Every gallon the source records leaves by exactly one of two
  // doors — spread along a track, or parked on a mark — so the two have to sum
  // to the input. Rounding per segment is allowed to move a gallon between
  // runs; it is not allowed to invent or lose one, so the tolerance is the
  // number of rounded segments, not a percentage.
  const leak = spreadGallons + markGallons - totalGallons
  if (Math.abs(leak) > tracks.length) {
    throw new Error(
      `gallons do not balance: ${spreadGallons} along tracks + ${markGallons} on marks ` +
        `= ${spreadGallons + markGallons}, against ${totalGallons} in (${leak > 0 ? '+' : ''}${leak})`,
    )
  }
  console.log(`  balance:   ${leak > 0 ? '+' : ''}${leak} gallons (rounding, tolerance ±${tracks.length})`)
  console.log(`  track km:  p50 ${q(lens, 0.5)}  p90 ${q(lens, 0.9)}  max ${lens[lens.length - 1]}`)
  console.log(
    `  gal/km:    p10 ${Math.round(q(gpk, 0.1))}  p50 ${Math.round(q(gpk, 0.5))}  ` +
      `p90 ${Math.round(q(gpk, 0.9))}  max ${Math.round(gpk[gpk.length - 1])}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
