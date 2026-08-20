// FINAL-map : density dot-grid poster. Every spray run's gallons walked along
// its track and deposited into an equirectangular grid; one orange dot per
// cell, area scaled to gallons. No basemap — the record draws the country.
// Knobs: CELL (degrees, default 0.05), OUT, RMIN (px floor for smallest dots).
import fs from 'fs'
const T = JSON.parse(fs.readFileSync('public/data/spray-tracks.json', 'utf8'))
const SP = process.env.SP, W = 2828, H = 4000, F = 265
const FONT = 'Courier Prime', INK = '#141109', OR = '#ef7409', PAPER = '#faf9f4'
const CELL = Number(process.env.CELL || 0.05)
const OUT = process.env.OUT || 'FINAL-map'
const RMIN = Number(process.env.RMIN || 1.6)

const runs = T.tracks.filter((t) => t[2] > 0)

// deposit gallons along each polyline, one sample per ~0.5 km
const cells = new Map()
const key = (cx, cy) => cx + '|' + cy
const KM = 0.5
let totalGal = 0
for (const [, , g, km, flat] of runs) {
  totalGal += g
  const pts = []
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]])
  // segment lengths (km, equirectangular approx is fine at deposit scale)
  const segs = []
  let L = 0
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i]
    const dx = (x2 - x1) * 111.32 * Math.cos(((y1 + y2) / 2) * Math.PI / 180)
    const dy = (y2 - y1) * 110.57
    const l = Math.hypot(dx, dy)
    segs.push(l); L += l
  }
  if (L === 0) { // degenerate: whole run into one cell
    const cx = Math.floor(pts[0][0] / CELL), cy = Math.floor(pts[0][1] / CELL)
    cells.set(key(cx, cy), (cells.get(key(cx, cy)) || 0) + g)
    continue
  }
  for (let i = 1; i < pts.length; i++) {
    const n = Math.max(1, Math.round(segs[i - 1] / KM))
    const gShare = (g * segs[i - 1] / L) / n
    for (let s = 0; s < n; s++) {
      const t = (s + 0.5) / n
      const lon = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t
      const lat = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t
      const cx = Math.floor(lon / CELL), cy = Math.floor(lat / CELL)
      cells.set(key(cx, cy), (cells.get(key(cx, cy)) || 0) + gShare)
    }
  }
}

// bounds over occupied cells
let minCx = Infinity, maxCx = -Infinity, minCy = Infinity, maxCy = -Infinity, gmax = 0
for (const [k, g] of cells) {
  const [cx, cy] = k.split('|').map(Number)
  minCx = Math.min(minCx, cx); maxCx = Math.max(maxCx, cx)
  minCy = Math.min(minCy, cy); maxCy = Math.max(maxCy, cy)
  gmax = Math.max(gmax, g)
}
const nx = maxCx - minCx + 1, ny = maxCy - minCy + 1
const midLat = ((minCy + ny / 2) * CELL) * Math.PI / 180

// fit: content box x 265..2563; data bottom leaves the triptych's ~112px
// clearance above the footer zone (footer 3790, no AGENTS row here)
const boxW = W - 2 * F
const top = F, bottom = 3630
const aspect = (nx * Math.cos(midLat)) / ny   // width/height in true km terms
let mapH = bottom - top, mapW = mapH * aspect
if (mapW > boxW) { mapW = boxW; mapH = mapW / aspect }
const ox = F + (boxW - mapW) / 2, oy = top + (bottom - top - mapH) / 2
const px = mapW / nx, py = mapH / ny
const rmax = Math.min(px, py) / 2
const X = (cx) => ox + (cx - minCx + 0.5) * px
const Y = (cy) => oy + (maxCy - cy + 0.5) * py   // north up

const els = []
let shown = 0
const sorted = [...cells.entries()].sort((a, b) => a[1] - b[1])
for (const [k, g] of sorted) {
  const [cx, cy] = k.split('|').map(Number)
  const r = Math.max(RMIN, rmax * Math.sqrt(g / gmax))
  els.push(`<circle cx="${X(cx).toFixed(1)}" cy="${Y(cy).toFixed(1)}" r="${r.toFixed(2)}" fill="${OR}" fill-opacity="0.95"/>`)
  shown++
}

const kmCell = Math.round(CELL * 110.57 * 10) / 10
els.push(`<text xml:space="preserve" x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    ONE DOT PER ${kmCell} KM CELL, AREA SCALED TO US GALLONS, SMALLEST HELD LEGIBLE    ALL ${runs.length.toLocaleString('en')} SPRAY RUNS, ALL AGENTS    1962–1971</text>`)

fs.writeFileSync(`${SP}/${OUT}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${els.join('')}</svg>`)
console.log(`${OUT}  cells ${shown}  grid ${nx}x${ny}  px ${px.toFixed(1)}  rmax ${rmax.toFixed(1)}  gmax ${Math.round(gmax).toLocaleString('en')}  total ${Math.round(totalGal).toLocaleString('en')}`)
