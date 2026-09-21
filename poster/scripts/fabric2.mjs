// The fabric, re-inked: one plate per agent. Every plate carries all 7,047
// runs; the featured agent's runs in a loud ink, every other run in a second
// ink that sits close to the ground; the sheet printed twice, half a line off
// register. Plates are [name, ground, featured agent, inkA, inkB, footer ink].
import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const SP = process.env.SP, W = 2828, H = 4000, F = 265, FONT = 'Courier Prime'
const T = JSON.parse(fs.readFileSync('public/data/spray-tracks.json', 'utf8'))
const runs = T.tracks.filter(t => t[2] > 0).sort((a, b) => a[1] - b[1])
const grp = (a) => ({ O: 'O', W: 'W', B: 'B', P: 'P' }[T.agents[a]] || 'X')
const NAME = { O: 'AGENT ORANGE', W: 'AGENT WHITE', B: 'AGENT BLUE', P: 'AGENT PURPLE' }
const n = (x) => x.toLocaleString('en')

const PLATES = JSON.parse(process.env.PLATES || 'null') || [
  // name          ground     agent  inkA       inkB       footer
  ['INK-orange',   '#f3cf1c', 'O',   '#f0400f', '#f0a13a', '#3a2a00'],
  ['INK-white',    '#cfe9dc', 'W',   '#0b5f7a', '#7cc7b0', '#0b3a44'],
  ['INK-blue',     '#f4b6c6', 'B',   '#1a3fd6', '#c78ad1', '#2a1030'],
  ['INK-purple',   '#d3e33a', 'P',   '#6a17b8', '#8fae3c', '#25301a'],
  ['INK-paper',    '#faf9f4', null,  null,      null,      '#141109'],
]
const VIVID = { O: '#ff6a00', W: '#1e8fbf', B: '#1a3fd6', P: '#a52bd4', X: '#b5852a' }

const FS = Number(process.env.FS || 15), cw = FS * 0.6, slot = 9 * cw, boxW = W - 2 * F
const perRow = Math.floor((boxW + cw) / slot), rows = Math.ceil(runs.length / perRow)
const top = F, lh = (3640 - top) / rows
const cellsFor = (colorOf) => runs.map((t, i) => `<text x="${(F + (i % perRow) * slot).toFixed(1)}" y="${(top + FS + Math.floor(i / perRow) * lh).toFixed(1)}" fill="${colorOf(grp(t[0]))}">${mgrs(t[4][0], t[4][1])}</text>`).join('')

for (const [name, ground, agent, inkA, inkB, fink, blend = 'multiply'] of PLATES) {
  const colorOf = agent ? (g) => (g === agent ? inkA : inkB) : (g) => VIVID[g]
  const cells = cellsFor(colorOf)
  const pass = (dx, dy, op) => `<g transform="translate(${dx} ${dy.toFixed(1)})" font-family="${FONT}" font-weight="${process.env.WEIGHT || 700}" font-size="${FS}" fill-opacity="${op}" style="mix-blend-mode:${blend}">${cells}</g>`
  const count = agent ? runs.filter(t => grp(t[0]) === agent).length : runs.length
  const desc = agent ? `THE ${n(count)} RUNS OF ${NAME[agent]} IN ITS INK, EVERY OTHER RUN IN THE GROUND INK` : `EACH RUN’S CODE IN ITS AGENT’S INK`
  const foot = `<text xml:space="preserve" x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${fink}" fill-opacity="0.7">OPERATION RANCH HAND    HERBS FILE    ${desc}, PRINTED TWICE, HALF A LINE OFF    ALL ${n(runs.length)} SPRAY RUNS    1962–1971</text>`
  fs.writeFileSync(`${SP}/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${ground}"/>${pass(0, 0, Number(process.env.OP1 || 1))}${pass(3, lh / 2, Number(process.env.OP2 || 0.85))}${foot}</svg>`)
  console.log(name, ground, agent || 'all', count)
}
