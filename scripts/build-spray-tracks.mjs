/**
 * build-spray-tracks.mjs — the spray record as what it actually is: lines.
 *
 * Same source and same georeferencing as build-spray-data.mjs (see that file
 * for the UTM-zone disambiguation, which is lifted verbatim), but it keeps the
 * three fields that ETL drops — Mission, Run, Leg — and those three are the
 * whole point.
 *
 * WHAT THE SOURCE ACTUALLY SAYS. Measured against herbs.json at the pinned
 * commit, and confirmed by the tape's own record layout (Christian, R. S.,
 * "Services HERBS Tape", HQDA, September 1985 — see docs/methods-paper.md §2):
 *
 *   · every row carries a Leg of the form 1A, 1B, 2A … (100% of 24,604). The
 *     LETTER is the waypoint: A the start, each later letter a change of
 *     direction, the last the point where spraying stopped. The NUMBER is the
 *     spray track within the mission: "a successive number … indicate[s] that
 *     on the same mission after completing the previous spray track, the
 *     aircraft accomplished an additional spray track"
 *   · grouped by Mission there are 9,141 missions; by Mission + Run (hea-v's
 *     run is the tape's track) 11,273 tracks. 1,434 missions flew more than
 *     one track; Date and Agent never vary within a mission
 *   · GALLONS is a per-MISSION field — "the number of gallons of herbicide
 *     dispensed during the mission cited" — and the file carries it once, on
 *     the mission's 1A row. ALL 19,490,690 gallons sit on rows labelled 1A;
 *     every other leg label sums to exactly 0, and every track without a 1A
 *     row (2,132 of them) carries 0. The tape has no per-track volume
 *   · the median track traces an 10.9 km polyline (p90 19.6 km, max 354.6)
 *
 * So a spray track is a LINE, a mission is one or more of them flown on one
 * day with one agent, and HERBS books the mission's whole load once. Reading
 * the rows as independent points — which is what dropping Mission / Run / Leg
 * forces you to do — puts a mission's entire volume in the cell containing one
 * end of its first track.
 *
 * WHAT THIS FILE DOES NOT KNOW. There is no per-waypoint or per-track quantity
 * anywhere in the source, so volume can only be spread along the flown
 * geometry, and this script spreads it BY LENGTH ACROSS ALL OF A MISSION'S
 * TRACKS, on the physical argument that an aircraft with the valve open lays
 * down a roughly constant amount per kilometre flown, calibrated at a fixed
 * rate (3 gallons per acre). Spreading per mission rather than per track is
 * the reading the layout supports; it moves 4.8% of the volume at a 3 km cell
 * against spreading each track's own booked figure along that track alone
 * (scripts/analyse-mission-spread.mjs), and it gives the later tracks of a
 * multi-track mission — 11% of all flown kilometres — the volume the file
 * booked against their mission.
 *
 * A track recorded at a single grid reference has no length to take a share
 * of. In a mission that also flew line tracks it therefore gets none (110 such
 * points in 88 missions, 71,220 gallons, 0.37% of the record, now on the
 * sibling lines); in a mission with no line length at all the load is split
 * across its points by count, the only weight the source supports there.
 *
 * One thing the data genuinely cannot answer: whether the aircraft sprayed
 * across a change of leg NUMBER inside one Mission + Run pair, which happens
 * in 176 runs and which the layout does not describe. This script treats it
 * as a break and spreads volume only within a numbered leg; the assumption is
 * recorded here rather than buried in a formula.
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

  // Group by mission, then by run inside it, preserving source order — the
  // rows arrive in leg order and that order IS the track. Sorting by the Leg
  // label would be a second opinion about the flight path; the file's own
  // order is the first.
  const missions = new Map()
  for (const r of herbs) {
    let runs = missions.get(r.Mission)
    if (!runs) missions.set(r.Mission, (runs = new Map()))
    let g = runs.get(r.Run)
    if (!g) runs.set(r.Run, (g = []))
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

  const tracks = [] // [agent, day, gallons, km, [lon,lat,…], mission, run, fwac]
  const marks = [] // single-point runs: [agent, day, gallons, lon, lat, mission, run, fwac]
  let runCount = 0
  let dropped = 0
  let totalGallons = 0
  let spreadGallons = 0
  let markGallons = 0
  let multiTrack = 0
  let laterTracksWithVolume = 0
  let pointsInMixed = 0

  for (const [missionId, runs] of missions) {
    // Everything below is a property of the MISSION, and the layout says so:
    // date, agent, the load, and the aircraft count. Read them off the first
    // row that carries them, which is the 1A row.
    const rowsAll = [...runs.values()].flat()
    const day = dateToDay(rowsAll[0].Date)
    if (day == null) {
      dropped += rowsAll.length
      continue
    }
    let agent = AGENTS.indexOf(rowsAll[0].Agent)
    if (agent < 0) agent = AGENTS.indexOf('U')
    const gallons = rowsAll.reduce((s, r) => s + Math.max(0, Math.round(r.Gallons || 0)), 0)
    totalGallons += gallons
    const mission = Number(missionId) || 0
    // FWAC (aircraft count) books with the gallons, on the mission's 1A row.
    // Six digits, three two-digit subfields; hea-v's own engine.js reads the
    // count from the LAST two ("FWAC filter uses last 2 digits"), and that
    // reading is followed here rather than inventing one. 0 = not recorded.
    // It is the mission's aircraft count, so every track of the mission
    // carries it — a second track flown by the same formation is not a track
    // with no aircraft on it.
    const fwRow = rowsAll.find((r) => String(r.FWAC || '').length === 6)
    const fw = String(fwRow?.FWAC || '')
    const fwac = fw.length === 6 ? parseInt(fw.slice(-2), 10) || 0 : 0

    // Segment every run of the mission first, so the mission's total sprayed
    // length is known before any volume is handed out.
    const perRun = []
    for (const [runId, rows] of runs) {
      const segs = segmentsOf(rows)
      if (!segs.length) {
        dropped += rows.length
        continue
      }
      runCount++
      const lengths = segs.map((s) => {
        let t = 0
        for (let i = 1; i < s.length; i++) t += km(s[i - 1], s[i])
        return t
      })
      perRun.push({ runNo: Number(runId) || 0, segs, lengths })
    }
    if (!perRun.length) continue
    if (perRun.length > 1) multiTrack++

    const missionKm = perRun.reduce((a, r) => a + r.lengths.reduce((x, y) => x + y, 0), 0)

    if (missionKm <= 0) {
      // No line anywhere in the mission — a record kept at one place, or at a
      // few. The load stays put, which for a point is not an approximation but
      // the whole record.
      //
      // "Stay put" has to mean SPLIT once the mission has more than one point,
      // and that is what this replaces: an earlier version handed EVERY
      // single-point segment the full volume, so a run logged at three places
      // published three times its gallons — 22,018 gallons the source never
      // recorded, 0.11% against 19.5M, which is small, and wrong in a file
      // whose entire claim is that it is the record.
      //
      // Length-share is unavailable here by definition, so count is the only
      // weight the source supports. The remainder rides on the first point so
      // the parts sum to the whole exactly rather than to within a rounding.
      const points = perRun.reduce((n, r) => n + r.segs.filter((s) => s.length === 1).length, 0)
      const each = points ? Math.floor(gallons / points) : 0
      let rest = gallons - each * points
      for (const r of perRun) {
        for (const s of r.segs) {
          let g = 0
          if (s.length === 1) {
            g = each + rest
            rest = 0
          }
          markGallons += g
          marks.push([agent, day, g, s[0][0], s[0][1], mission, r.runNo, fwac])
        }
      }
      continue
    }

    // Volume by share of the MISSION's length — the only weight the source
    // supports, applied to the unit the source books the volume against.
    for (const r of perRun) {
      let runG = 0
      for (let i = 0; i < r.segs.length; i++) {
        const s = r.segs[i]
        if (s.length < 2) {
          // A point track inside a mission that also flew lines: no length, no
          // share. It stays in the file as a mark so the map can still say the
          // aircraft was there.
          pointsInMixed++
          marks.push([agent, day, 0, s[0][0], s[0][1], mission, r.runNo, fwac])
          continue
        }
        const g = Math.round((gallons * r.lengths[i]) / missionKm)
        spreadGallons += g
        runG += g
        tracks.push([agent, day, g, Number(r.lengths[i].toFixed(2)), s.flat(), mission, r.runNo, fwac])
      }
      if (runG > 0 && r !== perRun[0]) laterTracksWithVolume++
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
      'A spray track is a line, and a mission is one or more of them. HERBS ' +
      "books a mission's whole volume once, against the first waypoint of its " +
      'first track; here it is spread by length across every track the ' +
      'mission flew, which is the only weighting the source supports.',
    agents: AGENTS,
    trackFields: ['agent', 'day', 'gallons', 'km', 'coords', 'mission', 'run', 'fwac'],
    markFields: ['agent', 'day', 'gallons', 'lon', 'lat', 'mission', 'run', 'fwac'],
    tracks,
    marks,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(out))

  const lens = tracks.map((t) => t[3]).sort((a, b) => a - b)
  const gpk = tracks.filter((t) => t[3] > 0 && t[2] > 0).map((t) => t[2] / t[3]).sort((a, b) => a - b)
  const q = (a, p) => a[Math.floor(a.length * p)]
  console.log(`✓ wrote ${OUT}`)
  console.log(`  missions:  ${missions.size} (${multiTrack} with more than one track)`)
  console.log(`  tracks:    ${runCount} → ${tracks.length} lines + ${marks.length} marks`)
  console.log(`  dropped:   ${dropped} rows`)
  console.log(
    `  gallons:   ${totalGallons.toLocaleString()} in, ${spreadGallons.toLocaleString()} along lines + ` +
      `${markGallons.toLocaleString()} on marks`,
  )
  console.log(
    `  mission:   ${laterTracksWithVolume} later tracks now carry volume; ` +
      `${pointsInMixed} point tracks in line missions carry none`,
  )

  // The guard that would have caught the point-run double-count on the day it
  // was written. Every gallon the source records leaves by exactly one of two
  // doors — spread along a line, or parked on a mark — so the two have to sum
  // to the input. Rounding per segment is allowed to move a gallon between
  // tracks; it is not allowed to invent or lose one, so the tolerance is the
  // number of rounded segments, not a percentage.
  const leak = spreadGallons + markGallons - totalGallons
  if (Math.abs(leak) > tracks.length) {
    throw new Error(
      `gallons do not balance: ${spreadGallons} along lines + ${markGallons} on marks ` +
        `= ${spreadGallons + markGallons}, against ${totalGallons} in (${leak > 0 ? '+' : ''}${leak})`,
    )
  }
  console.log(`  balance:   ${leak > 0 ? '+' : ''}${leak} gallons (rounding, tolerance ±${tracks.length})`)
  console.log(`  track km:  p50 ${q(lens, 0.5)}  p90 ${q(lens, 0.9)}  max ${lens[lens.length - 1]}`)
  console.log(
    `  gal/km:    p10 ${Math.round(q(gpk, 0.1))}  p50 ${Math.round(q(gpk, 0.5))}  ` +
      `p90 ${Math.round(q(gpk, 0.9))}  max ${Math.round(gpk[gpk.length - 1])}  (lines with volume)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
