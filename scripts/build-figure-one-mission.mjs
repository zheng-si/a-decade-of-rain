// One mission, two readings, on the Atlas's 3 km cells.
//
// A companion to build-figure-binning.mjs at the scale of a single record:
// the same two readings of the same gallons, but for one mission whose two
// tracks can be followed by eye, so the two whole-record percentages in the
// note (59% of gallons change cell, 63% of track cells are empty at 1A)
// have a concrete instance next to them. Reads public/data/spray-tracks.json
// and writes docs/figures/one-mission.svg.
//
//   node scripts/build-figure-one-mission.mjs [mission]
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'figures')
const MISSION = Number(process.argv[2] || 3985)
const DEG = 0.03 // the fine grid: ~3 km

const data = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'spray-tracks.json'), 'utf8'))
const tracks = data.tracks.filter((t) => t[5] === MISSION).map(([agent, day, gallons, km, coords, mission, run]) => ({ agent, day, gallons, km, coords, run }))
if (!tracks.length) throw new Error(`no line tracks for mission ${MISSION}`)
tracks.sort((a, b) => a.run - b.run)

// ── deposit the volume into cells, sampling along each track by length ──
const R = 111.195
const distKm = (x0, y0, x1, y1) => {
  const c = Math.cos(((y0 + y1) / 2) * Math.PI / 180)
  return Math.hypot((x1 - x0) * c, y1 - y0) * R
}
const cellOf = (x, y) => `${Math.floor(x / DEG)}|${Math.floor(y / DEG)}`
const spread = new Map()
const crossed = new Set()
let totalGal = 0, totalKm = 0
for (const t of tracks) {
  totalGal += t.gallons
  totalKm += t.km
  const gpk = t.km > 0 ? t.gallons / t.km : 0
  const c = t.coords
  for (let i = 0; i + 3 < c.length; i += 2) {
    const [x0, y0, x1, y1] = [c[i], c[i + 1], c[i + 2], c[i + 3]]
    const km = distKm(x0, y0, x1, y1)
    const n = Math.max(1, Math.ceil(km / 0.3))
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n
      const key = cellOf(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)
      crossed.add(key)
      spread.set(key, (spread.get(key) || 0) + (gpk * km) / n)
    }
  }
}
const first = tracks[0].coords
const firstKey = cellOf(first[0], first[1])
const booked = new Map([[firstKey, totalGal]])
const emptyAt1A = [...crossed].filter((k) => k !== firstKey)
const shareIn1A = (spread.get(firstKey) || 0) / totalGal
const toMove = 1 - shareIn1A
const peakS = Math.max(...spread.values())

// ── frame: the crossed cells plus a one-cell margin, squared up ───────────
const cells = [...crossed].map((k) => k.split('|').map(Number))
let cx0 = Math.min(...cells.map((c) => c[0])) - 1, cx1 = Math.max(...cells.map((c) => c[0])) + 2
let cy0 = Math.min(...cells.map((c) => c[1])) - 1, cy1 = Math.max(...cells.map((c) => c[1])) + 2
const side = Math.max(cx1 - cx0, cy1 - cy0)
// Square the frame and centre the extra rows or columns around the tracks.
cx0 -= Math.floor((side - (cx1 - cx0)) / 2); cx1 = cx0 + side
cy0 -= Math.floor((side - (cy1 - cy0)) / 2); cy1 = cy0 + side
const W = 440, H = 440, PX = W / side
const px = (x) => (x / DEG - cx0) * PX
const py = (y) => H - (y / DEG - cy0) * PX
const rOf = (g) => 0.42 * Math.sqrt(g)

const INK = '#ff5449', LAND = '#f4f2f1', RULE = '#d8d6d2', LABEL = '#4b5a50', DARK = '#101a14'
const FONT = "Geist, 'Public Sans', 'Helvetica Neue', Arial, sans-serif"
const fmt = (n) => Math.round(n).toLocaleString('en-US')
const epoch = Date.UTC(1961, 0, 1)
const date = new Date(epoch + (tracks[0].day - 1) * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const grid = () => {
  let s = ''
  for (let i = 0; i <= side; i++) {
    s += `<line x1="${(i * PX).toFixed(1)}" y1="0" x2="${(i * PX).toFixed(1)}" y2="${H}" stroke="${RULE}" stroke-width="1"/>`
    s += `<line x1="0" y1="${(i * PX).toFixed(1)}" x2="${W}" y2="${(i * PX).toFixed(1)}" stroke="${RULE}" stroke-width="1"/>`
  }
  return s
}
const lines = tracks.map((t) => {
  let d = ''
  for (let i = 0; i + 1 < t.coords.length; i += 2) d += `${i ? 'L' : 'M'}${px(t.coords[i]).toFixed(1)} ${py(t.coords[i + 1]).toFixed(1)}`
  return `<path d="${d}" fill="none" stroke="${DARK}" stroke-width="1.2" stroke-opacity="0.55" stroke-linecap="round" stroke-linejoin="round"/>`
}).join('')
const centre = (key) => { const [i, j] = key.split('|').map(Number); return [(i + 0.5 - cx0) * PX, H - (j + 0.5 - cy0) * PX] }
const dots = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, g]) => { const [x, y] = centre(k); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rOf(g).toFixed(2)}" fill="${INK}" fill-opacity="0.62"/>` }).join('')
const rings = emptyAt1A.map((k) => { const [x, y] = centre(k); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rOf(spread.get(k)).toFixed(2)}" fill="none" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.6"/>` }).join('')
const mark1A = `<circle cx="${px(first[0]).toFixed(1)}" cy="${py(first[1]).toFixed(1)}" r="2.6" fill="${DARK}"/><text x="${(px(first[0]) - 24).toFixed(1)}" y="${(py(first[1]) + 16).toFixed(1)}" font-size="11.5" font-weight="600" fill="${DARK}">1A</text>`

const PAD = { l: 40, r: 40, t: 150, b: 116 }, GAP = 60
const totalW = PAD.l + 2 * W + GAP + PAD.r
const totalH = PAD.t + H + PAD.b
const panel = (i, kicker, title, body, note) => {
  const x = PAD.l + i * (W + GAP)
  return `<g transform="translate(${x} ${PAD.t})">
  <text x="0" y="-40" font-size="12" fill="${LABEL}">${kicker}</text>
  <text x="0" y="-18" font-size="17" font-weight="600" fill="${DARK}">${title}</text>
  <rect width="${W}" height="${H}" fill="${LAND}"/>
  <g clip-path="url(#clip)">${grid()}${body}${lines}${mark1A}</g>
  <rect width="${W}" height="${H}" fill="none" stroke="${RULE}" stroke-width="1"/>
  <text y="${H + 24}" font-size="12.5" fill="${LABEL}">${note}</text>
</g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" font-family="${FONT}">
<defs><clipPath id="clip"><rect width="${W}" height="${H}"/></clipPath></defs>
<rect width="${totalW}" height="${totalH}" fill="#ffffff"/>
<text x="${PAD.l}" y="40" font-size="24" font-weight="600" fill="${DARK}">One mission, two readings</text>
<text x="${PAD.l}" y="66" font-size="14" fill="${LABEL}">HERBS mission ${MISSION}, ${date}: ${fmt(totalGal)} gallons recorded on its 1A row, ${tracks.length} tracks, ${totalKm.toFixed(1)} km. The grid is the Atlas's 3 km cell; dot area is gallons.</text>
${panel(0, 'First-waypoint reading', 'All of the volume in the cell holding 1A', dots(booked) + rings, `1 cell carries volume: ${fmt(totalGal)} gallons. Rings mark the ${emptyAt1A.length} track cells left empty.`)}
${panel(1, 'Track-based reconstruction', 'The same volume spread along the tracks', dots(spread), `${crossed.size} cells carry volume; the largest holds ${fmt(peakS)} gallons.`)}
<g transform="translate(${PAD.l} ${PAD.t + H + 56})" font-size="12.5" fill="${DARK}">
  <text y="0">For this mission, ${Math.round(toMove * 100)}% of the recorded gallons change cell between the two readings, and ${emptyAt1A.length} of its ${crossed.size} track cells are empty under the first-waypoint reading.</text>
  <text y="20">Across the whole record at 3 km those figures are 59% of the gallons and 63% of the track cells.</text>
  <text y="44" fill="${LABEL}">Source: HERBS tape (Stellman et al., 2003), via hea-v at commit cb5948b.</text>
</g>
</svg>`

writeFileSync(join(OUT, 'one-mission.svg'), svg)
console.log(JSON.stringify({ mission: MISSION, date, tracks: tracks.length, gallons: totalGal, km: +totalKm.toFixed(1), cells: crossed.size, emptyAt1A: emptyAt1A.length, shareIn1A: +shareIn1A.toFixed(3), toMovePct: Math.round(toMove * 100), peak: Math.round(peakS) }))
console.log(`wrote docs/figures/one-mission.svg  ${totalW}×${totalH}`)
