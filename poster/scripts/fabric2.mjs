// The fabric, re-inked: one plate per agent. Every plate carries all 7,047
// runs; the featured agent's runs in one ink, every other run in a second,
// the sheet printed twice, half a line off register.
// SVG structure is built for recolouring by hand: each pass is a <g>, inside
// it one <g id="pass1-O"> per agent carrying the fill — no colour on any
// <text>. Change a group's fill and every run of that agent follows.
// Plates: [name, ground, featuredAgent|null, inkA, inkB, footerInk, blend?]
import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const SP = process.env.SP, W = 2828, H = 4000, F = 265, FONT = 'Courier Prime'
const T = JSON.parse(fs.readFileSync('public/data/spray-tracks.json', 'utf8'))
const runs = T.tracks.filter(t => t[2] > 0).sort((a, b) => a[1] - b[1])
const grp = (a) => ({ O: 'O', W: 'W', B: 'B', P: 'P' }[T.agents[a]] || 'X')
const NAME = { O: 'AGENT ORANGE', W: 'AGENT WHITE', B: 'AGENT BLUE', P: 'AGENT PURPLE' }
const n = (x) => x.toLocaleString('en')
const VIVID = { P: '#a52bd4', O: '#ff6a00', W: '#1e8fbf', B: '#1a3fd6', X: '#b5852a' }
const AGENTS = ['P', 'O', 'W', 'B', 'X']

const PLATES = JSON.parse(process.env.PLATES || 'null') || [
  ['INK-O', '#f3cf1c', 'O', '#e8330a', '#0b6f8a', '#3a2a00'],
  ['INK-W', '#faf4dc', 'W', '#1f9e63', '#21a8d8', '#141109'],
  ['INK-B', '#f6b4c4', 'B', '#1030c8', '#c2308f', '#2a1030'],
  ['INK-P', '#faf4dc', 'P', '#6a17b8', '#8ccf1e', '#141109'],
  ['INK-ALL', '#faf4dc', null, null, null, '#141109'],
  ['INK-NIGHT', '#0d0b14', null, null, null, '#c9c4b8', 'normal'],
]

const FS = Number(process.env.FS || 15), cw = FS * 0.6, slot = 9 * cw, boxW = W - 2 * F
const perRow = Math.floor((boxW + cw) / slot), rows = Math.ceil(runs.length / perRow)
const top = F, lh = (3640 - top) / rows
const WEIGHT = process.env.WEIGHT || 700, OP1 = Number(process.env.OP1 || 1), OP2 = Number(process.env.OP2 || 0.85)

// texts per agent, positions fixed by chronological index
const byAgent = Object.fromEntries(AGENTS.map(a => [a, []]))
runs.forEach((t, i) => {
  byAgent[grp(t[0])].push(`<text x="${(F + (i % perRow) * slot).toFixed(1)}" y="${(top + FS + Math.floor(i / perRow) * lh).toFixed(1)}">${mgrs(t[4][0], t[4][1])}</text>`)
})

for (const [name, ground, agent, inkA, inkB, fink, blend = 'multiply'] of PLATES) {
  const colorOf = agent ? (g) => (g === agent ? inkA : inkB) : (g) => VIVID[g]
  const pass = (k, dx, dy, op) => `<g id="pass${k}" transform="translate(${dx} ${dy.toFixed(1)})" font-family="${FONT}" font-weight="${WEIGHT}" font-size="${FS}" fill-opacity="${op}" style="mix-blend-mode:${blend}">` +
    AGENTS.map(a => `<g id="pass${k}-${a}" fill="${colorOf(a)}">${byAgent[a].join('')}</g>`).join('') + `</g>`
  const count = agent ? byAgent[agent].length : runs.length
  const desc = agent ? `THE ${n(count)} RUNS OF ${NAME[agent]} IN ITS INK, EVERY OTHER RUN IN THE GROUND INK` : `EACH RUN’S CODE IN ITS AGENT’S INK`
  const foot = `<text xml:space="preserve" id="footer" x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${fink}" fill-opacity="0.7">OPERATION RANCH HAND    HERBS FILE    ${desc}, PRINTED TWICE, HALF A LINE OFF    ALL ${n(runs.length)} SPRAY RUNS    1962–1971</text>`
  const note = `<!-- A Decade of Rain, ${name}. Colour slots: ground = rect#ground; per-agent inks = g#pass1-P/O/W/B/X and g#pass2-… (P purple, O orange, W white, B blue, X other); footer = text#footer. Passes blend with mix-blend-mode:${blend}. Font: Courier Prime ${WEIGHT}. -->`
  fs.writeFileSync(`${SP}/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${note}<rect id="ground" width="${W}" height="${H}" fill="${ground}"/>${pass(1, 0, 0, OP1)}${pass(2, 3, lh / 2, OP2)}${foot}</svg>`)
  console.log(name, ground, agent || 'all')
}
