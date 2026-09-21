// The dose fabric: one cell per spray run in time order, row by row. The
// cell's full-size shape is a ghost in the agent's ink; a core of the same
// shape grows from the centre with area scaled to the run's US gallons.
// SHAPE = circle | square | diamond | drop.   COLS (default 70).
import fs from 'fs'
const SP = process.env.SP, W = 2828, H = 4000, F = 265, FONT = 'Courier Prime'
const SHAPE = process.env.SHAPE || 'circle', COLS = Number(process.env.COLS || 70)
const GROUND = process.env.GROUND || '#faf4dc', GHOST = Number(process.env.GHOST || 0.18)
const INK = JSON.parse(process.env.INK || 'null') || { P: '#a52bd4', O: '#ff6a00', W: '#1e8fbf', B: '#1a3fd6', X: '#b5852a' }
const T = JSON.parse(fs.readFileSync('public/data/spray-tracks.json', 'utf8'))
const runs = T.tracks.filter(t => t[2] > 0).sort((a, b) => a[1] - b[1])
const grp = (a) => ({ O: 'O', W: 'W', B: 'B', P: 'P' }[T.agents[a]] || 'X')
const gmax = Math.max(...runs.map(t => t[2]))
const n = (x) => x.toLocaleString('en')

// unit shapes, centred on 0,0, "radius" 1 (drop is taller: tip at -1.4)
const UNIT = {
  circle: '<circle id="u" r="1"/>',
  square: '<rect id="u" x="-1" y="-1" width="2" height="2"/>',
  diamond: '<path id="u" d="M0,-1 L1,0 L0,1 L-1,0 Z"/>',
  drop: '<path id="u" d="M0,-1.4 C0.55,-0.5 1,-0.1 1,0.4 A1,1 0 1,1 -1,0.4 C-1,-0.1 -0.55,-0.5 0,-1.4 Z"/>',
}
// drop cells are taller than wide so the drop fills the cell's width
const TALL = SHAPE === 'drop' ? 1.4 : 1
const boxW = W - 2 * F, cell = boxW / COLS, cellH = cell * TALL, rows = Math.ceil(runs.length / COLS)
const top = F, base = (cell / 2) * 0.94
const AGENTS = ['P', 'O', 'W', 'B', 'X']
const ghost = Object.fromEntries(AGENTS.map(a => [a, []])), core = Object.fromEntries(AGENTS.map(a => [a, []]))
runs.forEach((t, i) => {
  const a = grp(t[0]), cx = F + (i % COLS + 0.5) * cell, cy = top + (Math.floor(i / COLS) + 0.5) * cellH
  const s = base * Math.sqrt(t[2] / gmax)
  ghost[a].push(`<use href="#u" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${base.toFixed(2)})"/>`)
  core[a].push(`<use href="#u" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(2)})"/>`)
})
const layer = (id, map, op) => `<g id="${id}" fill-opacity="${op}">` + AGENTS.map(a => `<g id="${id}-${a}" fill="${INK[a]}">${map[a].join('')}</g>`).join('') + '</g>'
const foot = `<text xml:space="preserve" id="footer" x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="#141109" fill-opacity="0.7">OPERATION RANCH HAND    HERBS FILE    ONE CELL PER SPRAY RUN IN TIME ORDER, ITS CORE SCALED TO US GALLONS    ALL ${n(runs.length)} SPRAY RUNS    1962–1971</text>`
const note = `<!-- A Decade of Rain, dose fabric (${SHAPE}). Colour slots: rect#ground; g#ghost-P/O/W/B/X (cell outline tint) and g#core-P/O/W/B/X (dose); footer text#footer. -->`
fs.writeFileSync(`${SP}/DOSE-${SHAPE}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${note}<defs>${UNIT[SHAPE]}</defs><rect id="ground" width="${W}" height="${H}" fill="${GROUND}"/>${layer('ghost', ghost, GHOST)}${layer('core', core, 1)}${foot}</svg>`)
console.log(`DOSE-${SHAPE}  ${COLS} cols x ${rows} rows, cell ${cell.toFixed(1)}px, bottom ${(top + rows * cellH).toFixed(0)}, gmax ${gmax}`)
