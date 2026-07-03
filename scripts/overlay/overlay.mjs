import { readFileSync } from 'node:fs'
import { loadPolys, inRing, KEYS } from './lib.mjs'

// --- control points: SVG pixel (x,y) -> geographic (lon,lat) ---
// Picked from the gridded render against recognizable coastline features.
const CP = [
  { px:[25,605],  ll:[103.97,10.22], name:'Phu Quoc' },
  { px:[270,4],   ll:[107.05,17.00], name:'DMZ north' },
  { px:[492,383], ll:[109.45,12.88], name:'Dai Lanh cape (E)' },
  { px:[205,725], ll:[104.72,8.56],  name:'Ca Mau tip (S)' },
  { px:[415,585], ll:[107.08,10.35], name:'Vung Tau' },
  { px:[486,420], ll:[109.19,12.25], name:'Nha Trang' },
]

// Least-squares fit  q = a*x + b*y + c  for q in {lon,lat}
function fitLin(rows, target) {
  // normal equations for [a,b,c]
  let Sxx=0,Sxy=0,Sx=0,Syy=0,Sy=0,Sn=0, Sxq=0,Syq=0,Sq=0
  for (const r of rows) {
    const [x,y]=r.px, q=target(r)
    Sxx+=x*x; Sxy+=x*y; Sx+=x; Syy+=y*y; Sy+=y; Sn+=1
    Sxq+=x*q; Syq+=y*q; Sq+=q
  }
  // solve 3x3 [[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,Sn]] [a b c]=[Sxq Syq Sq]
  const A=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,Sn]], B=[Sxq,Syq,Sq]
  return solve3(A,B)
}
function solve3(A,b){
  const M=A.map((r,i)=>[...r,b[i]])
  for(let c=0;c<3;c++){
    let p=c; for(let r=c+1;r<3;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r
    ;[M[c],M[p]]=[M[p],M[c]]
    for(let r=0;r<3;r++){ if(r===c) continue; const f=M[r][c]/M[c][c]; for(let k=c;k<4;k++) M[r][k]-=f*M[c][k] }
  }
  return [M[0][3]/M[0][0],M[1][3]/M[1][1],M[2][3]/M[2][2]]
}
const lonC = fitLin(CP, r=>r.ll[0])   // lon = lonC·[x,y,1]
const latC = fitLin(CP, r=>r.ll[1])
const pxToLon=(x,y)=>lonC[0]*x+lonC[1]*y+lonC[2]
const pxToLat=(x,y)=>latC[0]*x+latC[1]*y+latC[2]
// invert 2x2 [[lonC0,lonC1],[latC0,latC1]] for lonlat->px
const det=lonC[0]*latC[1]-lonC[1]*latC[0]
const lonlatToPx=(lon,lat)=>{
  const bx=lon-lonC[2], by=lat-latC[2]
  const x=( latC[1]*bx - lonC[1]*by)/det
  const y=(-latC[0]*bx + lonC[0]*by)/det
  return [x,y]
}
// residuals
console.log('--- control residuals (km) ---')
let maxr=0
for(const c of CP){
  const lo=pxToLon(...c.px), la=pxToLat(...c.px)
  const dkm=Math.hypot((lo-c.ll[0])*111.32*Math.cos(c.ll[1]*Math.PI/180),(la-c.ll[1])*110.57)
  maxr=Math.max(maxr,dkm)
  console.log('  '+c.name.padEnd(20), dkm.toFixed(1))
}
console.log('  max residual:', maxr.toFixed(1),'km')

// --- rasterize total area per class + sprayed cells from spray points ---
const polys = loadPolys()
const STEP = 1.5 // px grid step
// cell ground area (ha) via Jacobian of px->lonlat at map centre (~12N)
const latMid=12, kmPerDegLat=110.57, kmPerDegLon=111.32*Math.cos(latMid*Math.PI/180)
const cellKm2 = Math.abs(det) * kmPerDegLat * kmPerDegLon * STEP*STEP
const cellHa = cellKm2*100

// classify grid cells
const classOf=(x,y)=>{ for(const p of polys){ if(inRing([x,y],p.ring)) return p.key } return null }
const total={}, W=494,H=750
for(const k of KEYS) total[k]=0
const cellClass=new Map() // "cx,cy"->key, for sprayed lookup
for(let x=STEP/2;x<W;x+=STEP) for(let y=STEP/2;y<H;y+=STEP){
  const k=classOf(x,y); if(k){ total[k]++; cellClass.set(Math.round(x/STEP)+','+Math.round(y/STEP),k) }
}
// spray points
const spray=JSON.parse(readFileSync('public/data/spray.json','utf8'))
const runs=spray.runs
const hit=new Map() // cellkey -> count
let placed=0, outside=0
for(const r of runs){
  const [lon,lat]=r
  const [x,y]=lonlatToPx(lon,lat)
  if(x<0||x>=W||y<0||y>=H){ outside++; continue }
  const ck=Math.round(x/STEP)+','+Math.round(y/STEP)
  if(!cellClass.has(ck)){ outside++; continue }
  hit.set(ck,(hit.get(ck)||0)+1); placed++
}
const sprayed={}, sprayedMulti={}
for(const k of KEYS){ sprayed[k]=0; sprayedMulti[k]=0 }
for(const [ck,cnt] of hit){ const k=cellClass.get(ck); sprayed[k]++; if(cnt>1) sprayedMulti[k]++ }

console.log('\n--- results (cell='+cellKm2.toFixed(2)+' km^2, '+cellHa.toFixed(0)+' ha) ---')
console.log('runs placed:',placed,' outside/unclassified:',outside)
console.log('class        total(k ha)  sprayed(k ha)   %sprayed')
let ts=0,tt=0
for(const k of KEYS){
  const tHa=total[k]*cellHa/1000, sHa=sprayed[k]*cellHa/1000
  const pctS= total[k]? (sprayed[k]/total[k]*100):0
  tt+=total[k]*cellHa; ts+=sprayed[k]*cellHa
  console.log('  '+k.padEnd(11), tHa.toFixed(0).padStart(8), sHa.toFixed(0).padStart(12), (pctS.toFixed(0)+'%').padStart(10))
}
console.log('  TOTAL       ', (tt/1e6).toFixed(2)+'M ha total,', (ts/1e6).toFixed(2)+'M ha sprayed')
console.log('\n  VALIDATION: forest should be ~35%, mangrove ~36%')
