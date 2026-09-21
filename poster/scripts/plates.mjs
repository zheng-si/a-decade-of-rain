// Sketch plates for the PhotoVogue series: the archive printed over itself.
//   PLATE-overprint : the ledger (f4) run four times, once per agent ink,
//                     each pass slightly out of register, multiply blend.
//   PLATE-agents    : the density map, one layer per agent ink, multiply —
//                     ground sprayed by several agents darkens.
//   PLATE-years     : the density map, one layer per year in orange, multiply —
//                     ground sprayed year after year darkens.
import fs from 'fs'
const SP = process.env.SP, W = 2828, H = 4000, F = 265
const FONT = 'Courier Prime', INK = '#141109', PAPER = '#faf9f4'
const COL = { P: '#8f5fc0', O: '#ef7409', W: '#3f5162', B: '#2f83c8', X: '#6f5c44' }
const footer = (desc, samp) => `<text xml:space="preserve" x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    ${desc}    ${samp}    1962–1971</text>`
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${inner}</svg>`

// ---- PLATE-overprint ----
{
  const svg = fs.readFileSync(`${SP}/FINAL-f4.svg`, 'utf8')
  const els = [...svg.matchAll(/<(text|rect)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g)].map(m => m[0])
  const body = els.filter(e => { const y = +(e.match(/ y="([\d.]+)"/) || [])[1]; return y && y < 3500 })
  const passes = [['P', 0, 0], ['O', 7, 4], ['W', -6, 8], ['B', 4, -7]]
  const style = `<style>${passes.map(([a]) => `.L${a} *{fill:${COL[a]} !important}`).join('')}</style>`
  const layers = passes.map(([a, dx, dy]) => `<g class="L${a}" transform="translate(${dx} ${dy})" style="mix-blend-mode:multiply">${body.join('')}</g>`).join('')
  fs.writeFileSync(`${SP}/PLATE-overprint.svg`, wrap(style + layers + footer('THE LEDGER PRINTED FOUR TIMES, ONCE IN EACH AGENT’S INK, OUT OF REGISTER', '91 OF 7,047 SPRAY RUNS, EVERY 77TH')))
  console.log('PLATE-overprint', body.length, 'elements x 4 passes')
}

// ---- density layers (shared) ----
const T = JSON.parse(fs.readFileSync('public/data/spray-tracks.json', 'utf8'))
const runs = T.tracks.filter(t => t[2] > 0)
const CELL = 0.05, KM = 0.5
const EPOCH = Date.UTC(1961, 0, 1)
const yearOf = (day) => new Date(EPOCH + day * 86400000).getUTCFullYear()
const grp = (a) => ({ O: 'O', W: 'W', B: 'B', P: 'P' }[T.agents[a]] || 'X')
function deposit(keyFn) {
  const layers = new Map()
  for (const t of runs) {
    const [ai, day, g, , flat] = t
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
      const n = Math.max(1, Math.round(segs[i - 1] / KM)), share = (g * segs[i - 1] / L) / n
      for (let s = 0; s < n; s++) { const u = (s + 0.5) / n; add(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u, share) }
    }
  }
  return layers
}
function plotLayers(layers, colorOf, name, desc, OPA = 0.9) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, gmax = 0
  for (const cells of layers.values()) for (const [k, g] of cells) {
    const [cx, cy] = k.split('|').map(Number)
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy); gmax = Math.max(gmax, g)
  }
  const nx = maxX - minX + 1, ny = maxY - minY + 1, midLat = ((minY + ny / 2) * CELL) * Math.PI / 180
  const boxW = W - 2 * F, top = F, bottom = 3630
  const aspect = (nx * Math.cos(midLat)) / ny
  let mapH = bottom - top, mapW = mapH * aspect
  if (mapW > boxW) { mapW = boxW; mapH = mapW / aspect }
  const ox = F + (boxW - mapW) / 2, oy = top + (bottom - top - mapH) / 2, px = mapW / nx, py = mapH / ny, rmax = Math.min(px, py) / 2
  const out = []
  for (const [k, cells] of [...layers.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    const dots = []
    for (const [c, g] of cells) {
      const [cx, cy] = c.split('|').map(Number)
      const r = Math.max(1.4, rmax * Math.sqrt(g / gmax))
      dots.push(`<circle cx="${(ox + (cx - minX + 0.5) * px).toFixed(1)}" cy="${(oy + (maxY - cy + 0.5) * py).toFixed(1)}" r="${r.toFixed(2)}"/>`)
    }
    out.push(`<g fill="${colorOf(k)}" fill-opacity="${OPA}" style="mix-blend-mode:multiply">${dots.join('')}</g>`)
  }
  fs.writeFileSync(`${SP}/${name}.svg`, wrap(out.join('') + footer(desc, 'ALL 7,047 SPRAY RUNS')))
  console.log(name, layers.size, 'layers')
}
plotLayers(deposit((ai) => grp(ai)), (k) => COL[k], 'PLATE-agents', 'ONE DOT PER 5.5 KM CELL PER AGENT, EACH AGENT’S INK PRINTED OVER THE OTHERS')
plotLayers(deposit((ai, day) => yearOf(day)), () => COL.O, 'PLATE-years', 'ONE DOT PER 5.5 KM CELL PER YEAR, TEN YEARS PRINTED OVER EACH OTHER', 0.45)

// ---- PLATE-fabric : every run's map reference, set edge to edge in its
// agent's ink, then the whole sheet printed a second time half a line out
// of register. Sugiura no.63 by way of the record itself. ----
{
  const recs = runs.slice().sort((a, b) => a[1] - b[1])
  const { mgrs } = await import('./mgrs.mjs')
  const FS = 13.2, cw = FS * 0.6, TOK = 8, slot = (TOK + 1) * cw
  const boxW = W - 2 * F, perRow = Math.floor((boxW + cw) / slot)
  const rows = Math.ceil(recs.length / perRow)
  const top = F, bottom = 3640, lh = (bottom - top) / rows
  const cells = recs.map((t, i) => {
    const [ai, , , , flat] = t
    const r = Math.floor(i / perRow), c = i % perRow
    return `<text x="${(F + c * slot).toFixed(1)}" y="${(top + FS + r * lh).toFixed(1)}" fill="${COL[grp(ai)]}">${mgrs(flat[0], flat[1])}</text>`
  }).join('')
  const pass = (dx, dy, op) => `<g transform="translate(${dx} ${dy})" font-family="${FONT}" font-size="${FS}" fill-opacity="${op}" style="mix-blend-mode:multiply">${cells}</g>`
  fs.writeFileSync(`${SP}/PLATE-fabric.svg`, wrap(pass(0, 0, 0.9) + pass(3, lh / 2, 0.75) + footer('EVERY RUN’S MAP REFERENCE IN ITS AGENT’S INK, THE SHEET PRINTED TWICE, HALF A LINE OUT OF REGISTER', `ALL ${recs.length.toLocaleString('en')} SPRAY RUNS`)))
  console.log('PLATE-fabric', recs.length, 'tokens', perRow, 'per row', rows, 'rows, lh', lh.toFixed(2))
}
