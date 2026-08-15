// build-tracks.mjs — rebuild public/data/spray-tracks.json from the raw HERBS
// digitisation (andrewstellman/hea-v, pinned commit — same source as
// scripts/build-spray-data.mjs).
//
// Reconstruction of the poster data file (verified against the committed
// FINAL-*.svg record-for-record):
//   1. Rows grouped by (Mission, Run) = one spray run.
//   2. Within a run, legs split into tracks by the leg-number digit
//      (1A,1B | 2A,2B ...). Each track's polyline = its legs in file order.
//   3. Each leg's UTM string converted to WGS84 lon/lat with the mgrs
//      package; the missing zone is disambiguated by snapping to Stellman's
//      gridpoints lattice (same procedure as build-spray-data.mjs).
//      Coordinates rounded to 3 decimals.
//   4. Run gallons (max over rows) distributed across its tracks
//      proportionally to track length; single-point tracks get 0 unless they
//      are the run's only track.
//   5. Multi-point tracks -> T.tracks [agentIdx, day, gallons, km, flatLonLat,
//      meta]; single-point runs -> T.marks [agentIdx, day, gallons, lon, lat,
//      meta]. meta = [method, ctz, province, missionType, source, incident],
//      verbatim from the track's first raw row.
//   day is 0-based: day 0 = 1961-01-01. (The poster scripts decode with
//   EPOCH + day*86400000; the first cut of this file used spray.json's 1-based
//   days, which shifted every displayed date one day late.)
//
// Run from repo root:  node poster/scripts/build-tracks.mjs
import fs from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mg = require('mgrs')

const SRC = process.env.HEAV || '/workspace/andrewstellman/hea-v/data'
const herbs = JSON.parse(fs.readFileSync(`${SRC}/herbs.json`, 'utf8'))
const grid = JSON.parse(fs.readFileSync(`${SRC}/gridpoints.json`, 'utf8'))

// --- zone disambiguation (mirrors scripts/build-spray-data.mjs) ---
const CANDIDATE_ZONES = ['48', '49']
const CANDIDATE_BANDS = ['N', 'P', 'Q', 'R']
const SNAP_TOLERANCE = 0.05
const GRID_CELL = 0.1
const gridHash = new Map()
const gridKey = (lon, lat) => `${Math.floor(lon / GRID_CELL)}|${Math.floor(lat / GRID_CELL)}`
for (const [, lon, lat] of grid.rows) {
  const k = gridKey(lon, lat)
  let b = gridHash.get(k)
  if (!b) gridHash.set(k, (b = []))
  b.push([lon, lat])
}
function nearestGridDist(lon, lat) {
  const cx = Math.floor(lon / GRID_CELL), cy = Math.floor(lat / GRID_CELL)
  let best = Infinity
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const b = gridHash.get(`${cx + dx}|${cy + dy}`)
    if (!b) continue
    for (const [glon, glat] of b) {
      const d = Math.hypot(lon - glon, lat - glat)
      if (d < best) best = d
    }
  }
  return best
}
function utmToLonLat(utm) {
  if (!utm || utm.length < 4) return null
  const sq = utm.slice(0, 2), digits = utm.slice(2)
  if (!digits.length || digits.length % 2) return null
  const half = digits.length / 2
  const e = digits.slice(0, half), n = digits.slice(half)
  let best = null
  for (const z of CANDIDATE_ZONES) for (const b of CANDIDATE_BANDS) {
    let p
    try { p = mg.toPoint(`${z}${b}${sq}${e}${n}`) } catch { continue }
    const [lon, lat] = p
    const dist = nearestGridDist(lon, lat)
    if (!best || dist < best.dist) best = { lon, lat, dist }
  }
  if (!best || best.dist > SNAP_TOLERANCE) return null
  return [Number(best.lon.toFixed(3)), Number(best.lat.toFixed(3))]
}

// --- helpers ---
const EPOCH = Date.UTC(1961, 0, 1)
function dateToDay(mmddyy) {
  const [m, d, y] = mmddyy.split('/').map(Number)
  if (!m || !d || Number.isNaN(y)) return null
  const year = y >= 61 ? 1900 + y : 2000 + y
  return Math.floor((Date.UTC(year, m - 1, d) - EPOCH) / 86400000)
}
const AGENTS = ['O', 'W', 'B', 'P', 'U', 'K', 'D', 'T']
const R = Math.PI / 180
function kmBetween(a, b) {
  const [lo1, la1] = a, [lo2, la2] = b
  const dLat = (la2 - la1) * R, dLon = (lo2 - lo1) * R
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * R) * Math.cos(la2 * R) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

// --- group rows by (Mission, Run), preserving file order ---
const runs = new Map()
for (const r of herbs) {
  const k = `${r.Mission}/${r.Run}`
  if (!runs.has(k)) runs.set(k, [])
  runs.get(k).push(r)
}

const tracks = [], marks = []
let droppedLegs = 0, droppedRuns = 0
for (const rows of runs.values()) {
  const day = dateToDay(rows[0].Date)
  if (day == null) { droppedRuns++; continue }
  let agentIdx = AGENTS.indexOf(rows[0].Agent)
  if (agentIdx < 0) agentIdx = AGENTS.indexOf('U')
  const g = Math.max(0, Math.round(Math.max(...rows.map((r) => r.Gallons || 0))))
  const method = rows[0].Method

  // split into tracks by leg-number digit, legs in file order
  const tr = new Map()
  for (const r of rows) {
    const t = String(r.Leg || '1A').replace(/[A-Z]/gi, '') || '1'
    if (!tr.has(t)) tr.set(t, { pts: [], first: r })
    const ll = utmToLonLat((r.UTM || '').trim())
    if (!ll) { droppedLegs++; continue }
    tr.get(t).pts.push(ll)
  }
  const parts = [...tr.values()].filter((p) => p.pts.length > 0)
  if (!parts.length) { droppedRuns++; continue }
  const metaOf = (r) => [r.Method || '', String(r.CTZ || ''), String(r.Province || ''), r.Type || '', r.Source || '', r.Incident || '']

  const lens = parts.map(({ pts }) => {
    let km = 0
    for (let i = 1; i < pts.length; i++) km += kmBetween(pts[i - 1], pts[i])
    return km
  })
  const totLen = lens.reduce((a, b) => a + b, 0)

  parts.forEach(({ pts, first }, i) => {
    const share = parts.length === 1 ? g
      : totLen > 0 ? Math.round((g * lens[i]) / totLen) : Math.round(g / parts.length)
    const km = Number(lens[i].toFixed(3))
    if (pts.length >= 2) {
      tracks.push([agentIdx, day, share, km, pts.flat(), metaOf(first)])
    } else {
      marks.push([agentIdx, day, share, pts[0][0], pts[0][1], metaOf(first)])
    }
  })
}

tracks.sort((a, b) => a[1] - b[1])
marks.sort((a, b) => a[1] - b[1])

// --- report ---
const fw = tracks.filter((t) => t[2] > 0)
const mk = marks.filter((m) => m[2] > 0)
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0)
console.log(`tracks g>0: ${fw.length}  gal: ${sum(fw, (t) => t[2])}   (target 7047 / 18905413)`)
console.log(`marks  g>0: ${mk.length}  gal: ${sum(mk, (m) => m[2])}   (target 1621 / 585275)`)
const grp = (a) => ({ O: 'O', W: 'W', B: 'B', P: 'P' }[AGENTS[a]] || 'X')
const pg = {}, pn = {}, pm = {}
for (const t of fw) { const a = grp(t[0]); pg[a] = (pg[a] || 0) + t[2]; pn[a] = (pn[a] || 0) + 1; pm[t[5][0]] = (pm[t[5][0]] || 0) + 1 }
console.log('per-agent gal:', JSON.stringify(pg))
console.log('per-agent n:  ', JSON.stringify(pn), '(target O 4138 W 1746 B 700 P 339 X 124)')
console.log('per-method n (tracks g>0):', JSON.stringify(pm))
const d6 = (day) => new Date(EPOCH + day * 86400000).toISOString().slice(0, 10)
console.log(`date range (g>0 tracks): ${d6(fw[0][1])} -> ${d6(fw[fw.length - 1][1])}`)
console.log(`dropped legs: ${droppedLegs}, dropped runs: ${droppedRuns}`)

if (process.env.WRITE) {
  const out = {
    source: {
      dataset: 'andrewstellman/hea-v',
      commit: 'cb5948bb6b48cb731f139bc3143ae36d0de02b81',
      paper: 'Stellman et al. 2003, Nature 422:681-687',
      license: 'MIT (c) 2026 Andrew Stellman',
    },
    epoch: '1961-01-01',
    epochNote: 'day is 0-based: day 0 = 1961-01-01',
    fields: ['agentIdx', 'day', 'gallons', 'km', 'flatLonLat', '[method,ctz,province,missionType,source,incident]'],
    agents: AGENTS,
    tracks,
    marks,
  }
  fs.writeFileSync('public/data/spray-tracks.json', JSON.stringify(out))
  console.log('wrote public/data/spray-tracks.json')
}
