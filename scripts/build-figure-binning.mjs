/**
 * build-figure-binning.mjs — the paired figure for docs/methods.md.
 *
 * Three panels over one window: the runs as recorded, the volume booked at
 * waypoint 1A, and the volume spread along the run. The two grid panels share
 * one cell size and one dot-area scale, because a comparison whose scales
 * differ is not a comparison.
 *
 * The rings on the middle panel mark cells that were dosed and that reading
 * leaves empty — drawn on the panel that is missing them, in the same hue, so
 * the two grids stay comparable. A second colour on the corrected panel made
 * it read as a different kind of map rather than the same map done right.
 *
 * The numbers in the caption are computed for THIS window, not lifted from the
 * whole-record figures in analyse-binning.mjs, and the caption says so.
 *
 *   node scripts/build-figure-binning.mjs
 *
 * Writes docs/figures/binning-comparison.svg.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs/figures')
mkdirSync(OUT, { recursive: true })
const T = JSON.parse(readFileSync(join(ROOT, 'public/data/spray-tracks.json'), 'utf8'))
const PROV = JSON.parse(readFileSync(join(ROOT, 'public/data/provinces.geojson'), 'utf8'))

// ── the window ────────────────────────────────────────────────────────────
// Zone D / Đồng Xoài — the densest linear structure in the record, and the
// ground the whole project has been tuned against.
const BB = { w: 106.15, e: 107.45, s: 10.95, n: 12.0 }
const DEG = 0.03                       // the fine grid: ~3 km
const inBB = (x, y) => x >= BB.w && x <= BB.e && y >= BB.s && y <= BB.n

// ── projection ────────────────────────────────────────────────────────────
const PANEL = 460, GAP = 26, PAD = { l: 34, r: 34, t: 168, b: 138 }
const midLat = (BB.n + BB.s) / 2
const kx = Math.cos((midLat * Math.PI) / 180)
const spanX = (BB.e - BB.w) * kx, spanY = BB.n - BB.s
const scale = Math.min(PANEL / spanX, PANEL / spanY)
const W = spanX * scale, H = spanY * scale
const px = (x) => (x - BB.w) * kx * scale
const py = (y) => (BB.n - y) * scale

// ── binning ───────────────────────────────────────────────────────────────
const key = (x, y) => `${Math.floor(x / DEG)}|${Math.floor(y / DEG)}`
const cellXY = (k) => {
  const [i, j] = k.split('|').map(Number)
  return [(i + 0.5) * DEG, (j + 0.5) * DEG]
}
const haversine = (a, b, c, d) => {
  const R = 6371, r = Math.PI / 180
  const dx = (c - a) * r * Math.cos(((b + d) / 2) * r), dy = (d - b) * r
  return Math.sqrt(dx * dx + dy * dy) * R
}
const booked = new Map()   // gallons at the MISSION's first waypoint — what the file's accounting says
const spread = new Map()   // gallons along the run — where it fell
const lines = []
// The file books a mission's whole load once, on its first track's 1A row; the
// track file has spread it across the mission's tracks, so the booked panel
// has to put it back: every track and mark of a mission, wherever it lies,
// contributes to one cell at the mission's first waypoint (see the same
// reconstruction in analyse-binning.mjs).
const missionGal = new Map(), missionFirst = new Map()
const seat = (m, run, x, y) => { const c = missionFirst.get(m); if (!c || run < c.run) missionFirst.set(m, { run, x, y }) }
for (const [, , gallons, , flat, m, run] of T.tracks) { missionGal.set(m, (missionGal.get(m) ?? 0) + gallons); seat(m, run, flat[0], flat[1]) }
for (const [, , gallons, lon, lat, m, run] of T.marks) { missionGal.set(m, (missionGal.get(m) ?? 0) + gallons); seat(m, run, lon, lat) }
for (const [m, g] of missionGal) {
  const p = missionFirst.get(m)
  if (g > 0 && p && inBB(p.x, p.y)) { const k = key(p.x, p.y); booked.set(k, (booked.get(k) ?? 0) + g) }
}
for (const [, , gallons, kmLen, flat] of T.tracks) {
  if (gallons <= 0) continue
  let any = false
  for (let i = 0; i + 1 < flat.length; i += 2) if (inBB(flat[i], flat[i + 1])) { any = true; break }
  if (!any) continue
  lines.push({ gallons, kmLen, flat, gpk: kmLen > 0 ? gallons / kmLen : 0 })
  const gpk = kmLen > 0 ? gallons / kmLen : 0
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const [x0, y0, x1, y1] = [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]
    const segKm = haversine(x0, y0, x1, y1)
    const steps = Math.max(1, Math.ceil(segKm / (DEG * 111 * 0.35)))
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps
      const [cx, cy] = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
      if (!inBB(cx, cy)) continue
      const k = key(cx, cy)
      spread.set(k, (spread.get(k) ?? 0) + (gpk * segKm) / steps)
    }
  }
}
for (const [, , gallons, lon, lat] of T.marks) {
  if (gallons <= 0 || !inBB(lon, lat)) continue
  const k = key(lon, lat)
  spread.set(k, (spread.get(k) ?? 0) + gallons)
}

// ── the numbers for THIS window ───────────────────────────────────────────
const sum = (m) => [...m.values()].reduce((a, c) => a + c, 0)
const onlySpread = [...spread.keys()].filter((k) => !booked.has(k))
const misplaced = onlySpread.reduce((a, k) => a + spread.get(k), 0)
const peakB = Math.max(...booked.values()), peakS = Math.max(...spread.values())
const stats = {
  runs: lines.length,
  cellsB: booked.size,
  cellsS: spread.size,
  blank: onlySpread.length,
  misplacedPct: Math.round((misplaced / sum(spread)) * 100),
  peakB, peakS,
}

// ── drawing ───────────────────────────────────────────────────────────────
// One dot-area scale shared by both grid panels, or the comparison is a lie.
const RMAX = 7.2
const rOf = (g) => RMAX * Math.sqrt(g / Math.max(peakB, peakS))
const INK = '#ff5449', DEEP = '#cf3720', LAND = '#f4f2f1', RULE = '#d8d6d2'
const LABEL = '#4b5a50', DARK = '#101a14'
const FONT = "Geist, 'Public Sans', 'Helvetica Neue', Arial, sans-serif"

const clipProvinces = () => {
  const paths = []
  for (const f of PROV.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys)
      for (const ring of poly) {
        let d = '', on = false
        for (const [x, y] of ring) {
          if (x < BB.w - 0.6 || x > BB.e + 0.6 || y < BB.s - 0.6 || y > BB.n + 0.6) { on = false; continue }
          d += `${on ? 'L' : 'M'}${px(x).toFixed(1)} ${py(y).toFixed(1)}`
          on = true
        }
        if (d.length > 12) paths.push(d)
      }
  }
  return paths.map((d) => `<path d="${d}" fill="none" stroke="${RULE}" stroke-width="0.8"/>`).join('')
}
const PROVINCES = clipProvinces()

const panel = (i, title, kicker, body) => {
  const x = PAD.l + i * (W + GAP)
  return `<g transform="translate(${x} ${PAD.t})">
  <text x="0" y="-46" font-family="${FONT}" font-size="12" fill="${LABEL}">${kicker}</text>
  <text x="0" y="-22" font-family="${FONT}" font-size="17" font-weight="600" fill="${DARK}">${title}</text>
  <rect width="${W}" height="${H}" fill="${LAND}"/>
  <g clip-path="url(#clip)">${PROVINCES}${body}</g>
  <rect width="${W}" height="${H}" fill="none" stroke="${RULE}" stroke-width="1"/>
</g>`
}

const linesBody = lines
  .map((l) => {
    let d = ''
    for (let i = 0; i + 1 < l.flat.length; i += 2)
      d += `${i ? 'L' : 'M'}${px(l.flat[i]).toFixed(1)} ${py(l.flat[i + 1]).toFixed(1)}`
    const w = Math.min(3.2, Math.max(0.35, l.gpk / 190))
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w.toFixed(2)}" stroke-opacity="0.34" stroke-linecap="round"/>`
  })
  .join('')

const dots = (m) =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, g]) => {
      const [cx, cy] = cellXY(k)
      return `<circle cx="${px(cx).toFixed(1)}" cy="${py(cy).toFixed(1)}" r="${rOf(g).toFixed(2)}" fill="${INK}" fill-opacity="0.62"/>`
    })
    .join('')

// The hole in the booked reading, drawn ON the booked panel: a hollow ring
// wherever volume actually fell and that map has nothing. Same hue, so the two
// grid panels stay comparable — a second colour on the corrected panel made it
// read as a different kind of map instead of the same map done right.
const blanks = onlySpread
  .map((k) => {
    const [cx, cy] = cellXY(k)
    return `<circle cx="${px(cx).toFixed(1)}" cy="${py(cy).toFixed(1)}" r="${rOf(spread.get(k)).toFixed(2)}" fill="none" stroke="${INK}" stroke-width="0.7" stroke-opacity="0.5"/>`
  })
  .join('')

const totalW = PAD.l + 3 * W + 2 * GAP + PAD.r
const totalH = PAD.t + H + PAD.b
const legendY = PAD.t + H + 34
const scaleKm = 20
const scaleLen = ((scaleKm / 111) * scale).toFixed(1)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" font-family="${FONT}">
<defs><clipPath id="clip"><rect width="${W}" height="${H}"/></clipPath></defs>
<rect width="${totalW}" height="${totalH}" fill="#ffffff"/>

<text x="${PAD.l}" y="40" font-size="24" font-weight="600" fill="${DARK}">Two readings of the same record</text>
<text x="${PAD.l}" y="66" font-size="14" fill="${LABEL}">Zone D and Đồng Xoài, ${stats.runs.toLocaleString()} spray runs. Both grid panels use the same 3 km cells and the same dot-area scale; only the allocation of recorded volume differs.</text>

${panel(0, 'What the record contains', 'Reconstructed tracks', linesBody)}
${panel(1, 'Volume at each mission’s first waypoint', 'First-waypoint reading', blanks + dots(booked))}
${panel(2, 'Volume distributed along the tracks', 'Track-based reconstruction', dots(spread))}

<g transform="translate(${PAD.l} ${legendY})" font-size="12.5" fill="${LABEL}">
  <text y="0">Each line is one spray run; width is gallons per kilometre.</text>
  <text x="${W + GAP}" y="0">${stats.cellsB.toLocaleString()} cells carry volume. Peak cell ${Math.round(peakB / 1000)}K gallons.</text>
  <text x="${W + GAP}" y="20">Rings mark the ${stats.blank.toLocaleString()} cells that carry volume under the track reading and none under this one.</text>
  <text x="${2 * (W + GAP)}" y="0">${stats.cellsS.toLocaleString()} cells carry volume. Peak cell ${Math.round(peakS / 1000)}K gallons.</text>
  <g transform="translate(0 44)">
    <line x1="0" y1="0" x2="${scaleLen}" y2="0" stroke="${DARK}" stroke-width="1.4"/>
    <text x="${Number(scaleLen) + 8}" y="4" font-size="11.5">${scaleKm} km</text>
  </g>
  <text y="72" font-size="12.5" fill="${DARK}">In this window <tspan font-weight="600">${stats.misplacedPct}%</tspan> of the recorded volume lies in cells that are empty under the first-waypoint reading, and that reading’s peak cell holds <tspan font-weight="600">${(peakB / peakS).toFixed(1)}×</tspan> the volume of the peak cell under the track reading. Across the whole record those figures are 43% and 2.5×.</text>
  <text y="92" font-size="12.5">Source: HERBS tape (Stellman et al., 2003). Runs with a recorded volume only; a run logged at a single grid reference is identical under both readings.</text>
</g>
</svg>`

writeFileSync(join(OUT, 'binning-comparison.svg'), svg)
console.log(JSON.stringify(stats, null, 2))
console.log(`\nwrote docs/figures/binning-comparison.svg  ${Math.round(totalW)}×${Math.round(totalH)}`)
