import { readFileSync, writeFileSync } from 'node:fs'
import { loadPolys, COLOR } from './lib.mjs'
const P = loadPolys()
const W=494, H=750
let body=''
for (const {key,ring} of P) {
  const d = ring.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('')+'Z'
  body += `<path d="${d}" fill="${COLOR[key]}" stroke="none"/>`
}
// grid every 50px, labels
let grid=''
for (let x=0;x<=W;x+=50){ grid+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="rgba(0,0,0,.28)" stroke-width="0.6"/><text x="${x+2}" y="12" font-size="10" fill="#c00">${x}</text>` }
for (let y=0;y<=H;y+=50){ grid+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(0,0,0,.28)" stroke-width="0.6"/><text x="2" y="${y-2}" font-size="10" fill="#c00">${y}</text>` }
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W*1.6}" height="${H*1.6}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f4f3ee"/>${body}${grid}</svg>`
writeFileSync('/tmp/claude-0/-home-user-remedial-vietnam/e4066c60-d7d2-57fd-97a1-f2f78bded6ef/scratchpad/grid.svg',svg)
console.log('wrote grid.svg')
