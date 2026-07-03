import { readFileSync } from 'node:fs'
import { loadPolys, inRing, KEYS } from './lib.mjs'

const LON0=106.5, LAT0=12.8, KLAT=110.57, KLON=111.32*Math.cos(12.8*Math.PI/180)
const toKm=(lon,lat)=>[(lon-LON0)*KLON,(lat-LAT0)*KLAT]
const toLL=(ex,ny)=>[LON0+ex/KLON, LAT0+ny/KLAT]

// ---- geojson RVN filled silhouette (lat<17.12) ----
const gj=JSON.parse(readFileSync('public/data/vietnam.geojson','utf8'))
const rings=[]
const collect=(coords,depth)=>{ if(typeof coords[0][0]==='number'){ rings.push(coords) } else coords.forEach(c=>collect(c,depth+1)) }
gj.features.forEach(f=>collect(f.geometry.coordinates,0))
const pipAny=(lon,lat)=>{ for(const r of rings){ let ins=false; for(let i=0,j=r.length-1;i<r.length;j=i++){ const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1]; if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) ins=!ins } if(ins) return true } return false }
const G=[]
for(let lon=103.4;lon<=109.7;lon+=0.03) for(let lat=8.3;lat<=17.12;lat+=0.03){ if(pipAny(lon,lat)) G.push(toKm(lon,lat)) }

// ---- SVG filled silhouette (north-up: (x,-y)) ----
const polys=loadPolys()
const S=[]
for(let x=1;x<494;x+=3) for(let y=1;y<750;y+=3){ for(const p of polys){ if(inRing([x,y],p.ring)){ S.push([x,-y]); break } } }

console.log('cloud sizes: G(geo)='+G.length+'  S(svg)='+S.length)

function moments(P){
  let mx=0,my=0; for(const [x,y] of P){mx+=x;my+=y} mx/=P.length; my/=P.length
  let xx=0,yy=0,xy=0; for(const [x,y] of P){const dx=x-mx,dy=y-my; xx+=dx*dx;yy+=dy*dy;xy+=dx*dy}
  const n=P.length; return {mean:[mx,my], cov:[[xx/n,xy/n],[xy/n,yy/n]]}
}
function eig2(C){ const a=C[0][0],b=C[0][1],d=C[1][1]; const tr=a+d, det=a*d-b*b; const disc=Math.sqrt(Math.max(0,tr*tr/4-det)); const l1=tr/2+disc,l2=tr/2-disc
  const v1 = Math.abs(b)>1e-9? [l1-d,b] : [1,0]; const n1=Math.hypot(...v1); const e1=[v1[0]/n1,v1[1]/n1]; const e2=[-e1[1],e1[0]]
  return {l:[l1,l2], V:[[e1[0],e2[0]],[e1[1],e2[1]]]} }
const mS=moments(S), mG=moments(G)
const eS=eig2(mS.cov), eG=eig2(mG.cov)
// M = Vg * diag(sqrt(lG/lS)) * Vs^T  (with sign flips on Vs columns)
const mul=(A,B)=>[[A[0][0]*B[0][0]+A[0][1]*B[1][0],A[0][0]*B[0][1]+A[0][1]*B[1][1]],[A[1][0]*B[0][0]+A[1][1]*B[1][0],A[1][0]*B[0][1]+A[1][1]*B[1][1]]]
const T=(A)=>[[A[0][0],A[1][0]],[A[0][1],A[1][1]]]
const scale=[[Math.sqrt(eG.l[0]/eS.l[0]),0],[0,Math.sqrt(eG.l[1]/eS.l[1])]]
// anchors for flip resolution (rough px): [px, known lonlat]
const anchors=[[[25,605],[103.97,10.22]],[[205,725],[104.72,8.56]],[[492,383],[109.45,12.88]],[[270,4],[107.05,17.0]]]
let best=null
for(const s0 of [1,-1]) for(const s1 of [1,-1]){
  const Vs=[[eS.V[0][0]*s0,eS.V[0][1]*s1],[eS.V[1][0]*s0,eS.V[1][1]*s1]]
  const M=mul(mul(eG.V,scale),T(Vs))
  const map=([x,y])=>{ const dx=x-mS.mean[0],dy=y-mS.mean[1]; return [M[0][0]*dx+M[0][1]*dy+mG.mean[0], M[1][0]*dx+M[1][1]*dy+mG.mean[1]] }
  let err=0; for(const [px,ll] of anchors){ const [ex,ny]=map([px[0],-px[1]]); const [lo,la]=toLL(ex,ny); err+=Math.hypot((lo-ll[0])*KLON,(la-ll[1])*KLAT) }
  if(!best||err<best.err) best={err,M,map,s0,s1}
}
console.log('best flip s0,s1=',best.s0,best.s1,' anchor total err(km)=',best.err.toFixed(0))
for(const [px,ll] of anchors){ const [ex,ny]=best.map([px[0],-px[1]]); const [lo,la]=toLL(ex,ny); console.log('  anchor',ll,'-> ',[lo.toFixed(2),la.toFixed(2)],' d=',Math.hypot((lo-ll[0])*KLON,(la-ll[1])*KLAT).toFixed(0),'km') }

// expose transform px(x,y[y-down]) -> lonlat
export function pxToLonLat(x,y){ const [ex,ny]=best.map([x,-y]); return toLL(ex,ny) }
// inverse lonlat->px via numeric solve of the affine (M is 2x2 invertible)
const M=best.M, mS_=mS.mean, mG_=mG.mean
const invdet=1/(M[0][0]*M[1][1]-M[0][1]*M[1][0])
export function lonlatToPx(lon,lat){ const [ex,ny]=toKm(lon,lat); const bx=ex-mG_[0],by=ny-mG_[1]
  const dx=( M[1][1]*bx - M[0][1]*by)*invdet, dy=(-M[1][0]*bx + M[0][0]*by)*invdet
  return [dx+mS_[0], -(dy+mS_[1])] }
export { KEYS }
