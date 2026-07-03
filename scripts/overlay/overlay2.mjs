import { readFileSync } from 'node:fs'
import { loadPolys, inRing, KEYS } from './lib.mjs'
import { lonlatToPx } from './georef.mjs'

const polys=loadPolys()
import { pxToLonLat } from './georef.mjs'
const STEP=1.5, W=494,H=750
// ground area per cell via finite diff of pxToLonLat at the map centre
const c0=pxToLonLat(247,375), cx=pxToLonLat(248,375), cy=pxToLonLat(247,376)
const dLon_dx=cx[0]-c0[0], dLat_dx=cx[1]-c0[1], dLon_dy=cy[0]-c0[0], dLat_dy=cy[1]-c0[1]
const KLAT=110.57, KLON=111.32*Math.cos(12*Math.PI/180)
const jac=Math.abs((dLon_dx*KLON)*(dLat_dy*KLAT)-(dLon_dy*KLON)*(dLat_dx*KLAT)) // km^2 per px^2
const cellHa=jac*STEP*STEP*100

const classOf=(x,y)=>{ for(const p of polys){ if(inRing([x,y],p.ring)) return p.key } return null }
const total={}; for(const k of KEYS) total[k]=0
const cellClass=new Map()
for(let x=STEP/2;x<W;x+=STEP) for(let y=STEP/2;y<H;y+=STEP){ const k=classOf(x,y); if(k){ total[k]++; cellClass.set(Math.round(x/STEP)+','+Math.round(y/STEP),k) } }

const spray=JSON.parse(readFileSync('public/data/spray.json','utf8')).runs
const hit=new Map(); let placed=0,outside=0
for(const r of spray){ const [x,y]=lonlatToPx(r[0],r[1]); if(x<0||x>=W||y<0||y>=H){outside++;continue}
  const ck=Math.round(x/STEP)+','+Math.round(y/STEP); if(!cellClass.has(ck)){outside++;continue}
  hit.set(ck,(hit.get(ck)||0)+1); placed++ }
const sprayed={}; for(const k of KEYS) sprayed[k]=0
for(const [ck] of hit) sprayed[cellClass.get(ck)]++

console.log('cellHa=',cellHa.toFixed(0),' placed=',placed,' outside=',outside)
console.log('class        total(k ha)  sprayed(k ha)  %sprayed')
let tt=0,ts=0
for(const k of KEYS){ const tHa=total[k]*cellHa/1000,sHa=sprayed[k]*cellHa/1000,p=total[k]?sprayed[k]/total[k]*100:0
  tt+=total[k]*cellHa; ts+=sprayed[k]*cellHa
  console.log('  '+k.padEnd(11),tHa.toFixed(0).padStart(8),sHa.toFixed(0).padStart(12),(p.toFixed(0)+'%').padStart(9)) }
console.log('  TOTAL',(tt/1e6).toFixed(2)+'M ha,',(ts/1e6).toFixed(2)+'M sprayed')
console.log('  >> validation target: forest ~35%, mangrove ~36%')
