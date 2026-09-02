/**
 * analyse-mission-spread.mjs — does HERBS book volume per MISSION rather than
 * per run, and what does spreading per mission change on the map?
 *
 * Companion to analyse-binning.mjs; see docs/methods-paper.md §4.3. Reads the
 * cached source files (scripts/.cache, fetched by build-spray-data.mjs) and
 * writes nothing.
 *
 *   node scripts/analyse-mission-spread.mjs
 */
// Does HERBS book volume per MISSION rather
// than per run, and what does spreading per mission change on the map?
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mgrs from 'mgrs'
const CACHE = join(dirname(fileURLToPath(import.meta.url)), '.cache')
const H = JSON.parse(readFileSync(join(CACHE, 'herbs.json'), 'utf8'))
const G = JSON.parse(readFileSync(join(CACHE, 'gridpoints.json'), 'utf8'))
const GRID_CELL = 0.1, gridHash = new Map()
const gk = (lon, lat) => `${Math.floor(lon / GRID_CELL)}|${Math.floor(lat / GRID_CELL)}`
for (const [, lon, lat] of G.rows) { const k = gk(lon, lat); (gridHash.get(k) || gridHash.set(k, []).get(k)).push([lon, lat]) }
const nearest = (lon, lat) => { const cx = Math.floor(lon / GRID_CELL), cy = Math.floor(lat / GRID_CELL); let best = Infinity
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const b = gridHash.get(`${cx + dx}|${cy + dy}`); if (!b) continue; for (const [x, y] of b) { const d = Math.hypot(lon - x, lat - y); if (d < best) best = d } } return best }
const cacheLL = new Map()
function toLL(utm) { if (cacheLL.has(utm)) return cacheLL.get(utm); let best = null
  const sq = utm.slice(0, 2), digits = utm.slice(2), half = digits.length / 2, e = digits.slice(0, half), n = digits.slice(half)
  for (const z of ['48', '49']) for (const b of ['N', 'P', 'Q', 'R']) { let p; try { p = mgrs.toPoint(`${z}${b}${sq}${e}${n}`) } catch { continue } const d = nearest(p[0], p[1]); if (!best || d < best.d) best = { lon: p[0], lat: p[1], d } }
  const r = best && best.d <= 0.05 ? [Number(best.lon.toFixed(3)), Number(best.lat.toFixed(3))] : null; cacheLL.set(utm, r); return r }
const km = (a, b, c, d) => { const R = 6371, r = Math.PI / 180; const dx = (c - a) * r * Math.cos(((b + d) / 2) * r), dy = (d - b) * r; return Math.sqrt(dx * dx + dy * dy) * R }

// ── missions → runs → segments (the ETL's own segmentation, leg-number split)
const missions = new Map()
for (const r of H) (missions.get(r.Mission) || missions.set(r.Mission, []).get(r.Mission)).push(r)
let mixedDate = 0, mixedAgent = 0, multi = 0, galMulti = 0, galAll = 0, lenFirst = 0, lenAll = 0, galMultiMovable = 0
const M = [] // { gal, agent, runs: [ {segs:[[pts]], len} ] }
for (const rows of missions.values()) {
  const gal = rows.reduce((a, r) => a + Math.max(0, Math.round(r.Gallons || 0)), 0)
  galAll += gal
  const runIds = [...new Set(rows.map(r => r.Run))]
  if (new Set(rows.map(r => r.Date)).size > 1) mixedDate++
  if (new Set(rows.map(r => r.Agent)).size > 1) mixedAgent++
  const runs = []
  for (const rid of runIds) {
    const rr = rows.filter(r => r.Run === rid)
    const segs = []; let cur = null, curLeg = null
    for (const r of rr) { const leg = String(r.Leg).match(/^\d+/)?.[0] ?? '1'; const pt = toLL(String(r.UTM || '').trim()); if (!pt) continue
      if (leg !== curLeg) { cur = []; segs.push(cur); curLeg = leg }
      const last = cur[cur.length - 1]; if (!last || last[0] !== pt[0] || last[1] !== pt[1]) cur.push(pt) }
    const len = segs.reduce((a, s) => { let t = 0; for (let i = 1; i < s.length; i++) t += km(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1]); return a + t }, 0)
    const gRun = rr.reduce((a, r) => a + Math.max(0, Math.round(r.Gallons || 0)), 0)
    runs.push({ segs: segs.filter(s => s.length), len, gRun })
  }
  if (runIds.length > 1) { multi++; galMulti += gal
    const first = runs.find(r => r.gRun > 0) || runs[0]
    lenFirst += first.len; lenAll += runs.reduce((a, r) => a + r.len, 0)
    if (runs.filter(r => r.len > 0).length > 1 && gal > 0) galMultiMovable += gal }
  M.push({ gal, runs })
}
console.log(`missions ${missions.size}; multi-run ${multi} (${(100 * multi / missions.size).toFixed(1)}%); mixed date ${mixedDate}, mixed agent ${mixedAgent}`)
console.log(`gallons in multi-run missions ${galMulti.toLocaleString()} of ${galAll.toLocaleString()} (${(100 * galMulti / galAll).toFixed(1)}%); of which on missions with >1 line run ${galMultiMovable.toLocaleString()} (${(100 * galMultiMovable / galAll).toFixed(1)}%)`)
console.log(`multi-run missions: length of the run carrying the gallons ${Math.round(lenFirst).toLocaleString()} km, all runs ${Math.round(lenAll).toLocaleString()} km (×${(lenAll / lenFirst).toFixed(2)})`)

// ── two spread readings, binned
function field(deg, mode) {
  const key = (x, y) => `${Math.floor(x / deg)}|${Math.floor(y / deg)}`
  const F = new Map(); const add = (k, v) => F.set(k, (F.get(k) ?? 0) + v)
  const spread = (segsList, gal) => { // segsList: array of segments (each an array of pts); gallons by length across them
    const pts = []; let total = 0
    for (const s of segsList) { if (s.length < 2) continue
      for (let i = 1; i < s.length; i++) { const seg = km(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1]); const steps = Math.max(1, Math.ceil(seg / Math.min(2, deg * 111 * 0.35)))
        for (let q = 0; q < steps; q++) { const t = (q + 0.5) / steps; pts.push([key(s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t), seg / steps]); total += seg / steps } } }
    if (total <= 0) { const p = segsList.find(s => s.length)?.[0]; if (p) add(key(p[0], p[1]), gal); return }
    for (const [k, len] of pts) add(k, gal * len / total) }
  for (const m of M) { if (m.gal <= 0) continue
    if (mode === 'run') { for (const r of m.runs) if (r.gRun > 0) spread(r.segs, r.gRun) }
    else if (mode === 'mission') spread(m.runs.flatMap(r => r.segs), m.gal)
    else if (mode === 'first') { const r = m.runs.find(r => r.gRun > 0); const p = r?.segs[0]?.[0]; if (p) add(key(p[0], p[1]), m.gal) } }
  return F
}
const moved = (A, B) => { let d = 0, t = 0; for (const k of new Set([...A.keys(), ...B.keys()])) { d += Math.abs((A.get(k) ?? 0) - (B.get(k) ?? 0)); t += A.get(k) ?? 0 } return d / 2 / t }
const pct = x => `${(x * 100).toFixed(1)}%`
for (const deg of [0.03, 0.12, 0.25]) {
  const R = field(deg, 'run'), Mi = field(deg, 'mission'), Fi = field(deg, 'first')
  const sum = F => [...F.values()].reduce((a, b) => a + b, 0)
  console.log(`${Math.round(deg * 111)} km: per-run → per-mission volume to move ${pct(moved(R, Mi))}; cells ${R.size} → ${Mi.size}; peak ratio ${(Math.max(...R.values()) / Math.max(...Mi.values())).toFixed(2)}× | booked-at-1A → per-mission ${pct(moved(Fi, Mi))} | totals ${Math.round(sum(R))} / ${Math.round(sum(Mi))} / ${Math.round(sum(Fi))}`)
}
