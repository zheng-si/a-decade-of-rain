// The PhotoVogue series: the archive printed over itself. Nine plates,
// one footer system, one 5.5 km grid shared by every map so dots are
// comparable from plate to plate.
import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const SP = process.env.SP, W = 2828, H = 4000, F = 265
const FONT = 'Courier Prime', INK = '#141109', PAPER = '#faf9f4'
const COL = { P: '#8f5fc0', O: '#ef7409', W: '#3f5162', B: '#2f83c8', X: '#6f5c44' }
const footer = (desc, samp) => `<text xml:space="preserve" x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    ${desc}    ${samp}    1962–1971</text>`
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${inner}</svg>`
const save = (name, inner) => { fs.writeFileSync(`${SP}/${name}.svg`, wrap(inner)); console.log(name) }
const n = (x) => x.toLocaleString('en')

const T = JSON.parse(fs.readFileSync('public/data/spray-tracks.json', 'utf8'))
const runs = T.tracks.filter(t => t[2] > 0).sort((a, b) => a[1] - b[1])
const EPOCH = Date.UTC(1961, 0, 1)
const yearOf = (day) => new Date(EPOCH + day * 86400000).getUTCFullYear()
const grp = (a) => ({ O: 'O', W: 'W', B: 'B', P: 'P' }[T.agents[a]] || 'X')

// ---- density: one grid for every map plate ----
const CELL = 0.05, KM = 0.5
function deposit(keyFn) {
  const layers = new Map()
  for (const [ai, day, g, , flat] of runs) {
    const k = keyFn(ai, day)
    if (!layers.has(k)) layers.set(k, new Map())
    const cells = layers.get(k)
    const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]])
    const segs = []; let L = 0
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i]
      const l = Math.hypot((x2 - x1) * 111.32 * Math.cos(((y1 + y2) / 2) * Math.PI / 180), (y2 - y1) * 110.57)
      segs.push(l); L += l
    }
    const add = (lon, lat, v) => { const c = Math.floor(lon / CELL) + '|' + Math.floor(lat / CELL); cells.set(c, (cells.get(c) || 0) + v) }
    if (L === 0) { add(pts[0][0], pts[0][1], g); continue }
    for (let i = 1; i < pts.length; i++) {
      const m = Math.max(1, Math.round(segs[i - 1] / KM)), share = (g * segs[i - 1] / L) / m
      for (let s = 0; s < m; s++) { const u = (s + 0.5) / m; add(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u, share) }
    }
  }
  return layers
}
const byYear = deposit((ai, day) => yearOf(day))
const byAgent = deposit((ai) => grp(ai))
// shared frame: bounds over every cell ever touched; dot scale = largest single-year cell
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, gmaxYear = 0
for (const cells of byYear.values()) for (const [k, g] of cells) {
  const [cx, cy] = k.split('|').map(Number)
  minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy); gmaxYear = Math.max(gmaxYear, g)
}
let gmaxAgent = 0; for (const cells of byAgent.values()) for (const g of cells.values()) gmaxAgent = Math.max(gmaxAgent, g)
const nx = maxX - minX + 1, ny = maxY - minY + 1, midLat = ((minY + ny / 2) * CELL) * Math.PI / 180
const boxW = W - 2 * F, top = F, bottom = 3630, aspect = (nx * Math.cos(midLat)) / ny
let mapH = bottom - top, mapW = mapH * aspect
if (mapW > boxW) { mapW = boxW; mapH = mapW / aspect }
const ox = F + (boxW - mapW) / 2, oy = top + (bottom - top - mapH) / 2, px = mapW / nx, py = mapH / ny, rmax = Math.min(px, py) / 2
const dotsOf = (cells, gmax) => [...cells].map(([c, g]) => {
  const [cx, cy] = c.split('|').map(Number)
  return `<circle cx="${(ox + (cx - minX + 0.5) * px).toFixed(1)}" cy="${(oy + (maxY - cy + 0.5) * py).toFixed(1)}" r="${Math.max(1.4, rmax * Math.sqrt(g / gmax)).toFixed(2)}"/>`
}).join('')
const layer = (cells, color, op, gmax) => `<g fill="${color}" fill-opacity="${op}" style="mix-blend-mode:multiply">${dotsOf(cells, gmax)}</g>`
const DOT = 'ONE DOT PER 5.5 KM CELL, AREA SCALED TO US GALLONS, SMALLEST HELD LEGIBLE'

// a–d : four single years on one scale
const yearRuns = (y) => runs.filter(t => yearOf(t[1]) === y).length
for (const [tag, y] of [['a', 1965], ['b', 1967], ['c', 1969], ['d', 1971]])
  save(`VOGUE-${tag}-${y}`, layer(byYear.get(y), COL.O, 0.95, gmaxYear) + footer(DOT, `ALL ${n(yearRuns(y))} SPRAY RUNS OF ${y}`))

// e : ten years printed over each other
save('VOGUE-e-ten-years', [...byYear.keys()].sort().map(y => layer(byYear.get(y), COL.O, 0.45, gmaxYear)).join('') + footer('ONE DOT PER 5.5 KM CELL PER YEAR, TEN YEARS PRINTED OVER EACH OTHER', `ALL ${n(runs.length)} SPRAY RUNS`))

// f : the same ground, each agent's ink over the others
save('VOGUE-f-same-ground', ['P', 'O', 'W', 'B', 'X'].filter(a => byAgent.has(a)).map(a => layer(byAgent.get(a), COL[a], 0.9, gmaxAgent)).join('') + footer('ONE DOT PER 5.5 KM CELL PER AGENT, EACH AGENT’S INK PRINTED OVER THE OTHERS', `ALL ${n(runs.length)} SPRAY RUNS`))

// g–i : the fabric, printed once, five times, ten times
{
  const FS = 13.2, cw = FS * 0.6, slot = 9 * cw, perRow = Math.floor((boxW + cw) / slot), rows = Math.ceil(runs.length / perRow)
  const lh = (3640 - top) / rows
  const cells = runs.map((t, i) => `<text x="${(F + (i % perRow) * slot).toFixed(1)}" y="${(top + FS + Math.floor(i / perRow) * lh).toFixed(1)}" fill="${COL[grp(t[0])]}">${mgrs(t[4][0], t[4][1])}</text>`).join('')
  const pass = (dx, dy, op) => `<g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})" font-family="${FONT}" font-size="${FS}" fill-opacity="${op}" style="mix-blend-mode:multiply">${cells}</g>`
  const passes = (k, op) => [...Array(k)].map((_, i) => pass(i === 0 ? 0 : (i % 2 ? 1 : -1) * i * 1.6, i * lh / 2, op)).join('')
  const desc = 'EACH RUN’S CODE IN ITS AGENT’S INK'
  save('VOGUE-g-fabric-once', passes(2, 0.8) + footer(desc + ', PRINTED TWICE, HALF A LINE OFF REGISTER', `ALL ${n(runs.length)} SPRAY RUNS`))
  save('VOGUE-h-fabric-five', passes(5, 0.6) + footer(desc + ', PRINTED FIVE TIMES, DRIFTING OFF REGISTER', `ALL ${n(runs.length)} SPRAY RUNS`))
  save('VOGUE-i-fabric-ten', passes(10, 0.5) + footer(desc + ', PRINTED TEN TIMES, DRIFTING OFF REGISTER', `ALL ${n(runs.length)} SPRAY RUNS`))
}
console.log('year runs:', [1962,1963,1964,1965,1966,1967,1968,1969,1970,1971].map(y => y + ':' + yearRuns(y)).join(' '))
