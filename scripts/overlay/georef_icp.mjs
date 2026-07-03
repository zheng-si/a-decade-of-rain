import { readFileSync } from 'node:fs'
import { loadPolys, inRing, KEYS } from './lib.mjs'
const LON0=106.5,LAT0=12.8,KLAT=110.57,KLON=111.32*Math.cos(12.8*Math.PI/180)
const toKm=(lon,lat)=>[(lon-LON0)*KLON,(lat-LAT0)*KLAT]
const toLL=(ex,ny)=>[LON0+ex/KLON,LAT0+ny/KLAT]

// geojson boundary points (clip lat<17.12) -> km
const gj=JSON.parse(readFileSync('public/data/vietnam.geojson','utf8'))
const Bgeo=[]; const rings=[]
const collect=(c)=>{ if(typeof c[0][0]==='number') rings.push(c); else c.forEach(collect) }
gj.features.forEach(f=>collect(f.geometry.coordinates))
for(const r of rings) for(const [lon,lat] of r) if(lat<17.12 && lon<110) Bgeo.push(toKm(lon,lat))

// SVG land mask + boundary cells (px, y-down)
const polys=loadPolys()
const GS=2, W=494,H=750
const gw=Math.ceil(W/GS),gh=Math.ceil(H/GS)
const land=new Uint8Array(gw*gh)
for(let ix=0;ix<gw;ix++)for(let iy=0;iy<gh;iy++){ const x=ix*GS+GS/2,y=iy*GS+GS/2; for(const p of polys){ if(inRing([x,y],p.ring)){land[iy*gw+ix]=1;break} } }
const Bsvg=[]
for(let ix=0;ix<gw;ix++)for(let iy=0;iy<gh;iy++){ if(!land[iy*gw+ix])continue
  let edge=false; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const jx=ix+dx,jy=iy+dy; if(jx<0||jy<0||jx>=gw||jy>=gh||!land[jy*gw+jx]){edge=true;break} }
  if(edge) Bsvg.push([ix*GS+GS/2, iy*GS+GS/2]) }
console.log('Bgeo=',Bgeo.length,'Bsvg=',Bsvg.length)

// init affine px(x,y)->km via moment match (quick PCA)
function mom(P){let mx=0,my=0;for(const[x,y]of P){mx+=x;my+=y}mx/=P.length;my/=P.length;let xx=0,yy=0,xy=0;for(const[x,y]of P){const a=x-mx,b=y-my;xx+=a*a;yy+=b*b;xy+=a*b}const n=P.length;return{m:[mx,my],c:[[xx/n,xy/n],[xy/n,yy/n]]}}
function eig(C){const a=C[0][0],b=C[0][1],d=C[1][1],tr=a+d,dt=a*d-b*b,ds=Math.sqrt(Math.max(0,tr*tr/4-dt)),l1=tr/2+ds,l2=tr/2-ds;let v=Math.abs(b)>1e-9?[l1-d,b]:[1,0];const n=Math.hypot(...v);const e1=[v[0]/n,v[1]/n];return{l:[l1,l2],V:[[e1[0],-e1[1]],[e1[1],e1[0]]]}}
const Sm=mom(Bsvg.map(([x,y])=>[x,-y])),Gm=mom(Bgeo)
const eS=eig(Sm.c),eG=eig(Gm.c)
const mul=(A,B)=>[[A[0][0]*B[0][0]+A[0][1]*B[1][0],A[0][0]*B[0][1]+A[0][1]*B[1][1]],[A[1][0]*B[0][0]+A[1][1]*B[1][0],A[1][0]*B[0][1]+A[1][1]*B[1][1]]]
const Tp=A=>[[A[0][0],A[1][0]],[A[0][1],A[1][1]]]
const sc=[[Math.sqrt(eG.l[0]/eS.l[0]),0],[0,Math.sqrt(eG.l[1]/eS.l[1])]]
const anchors=[[[25,605],[103.97,10.22]],[[110,735],[104.9,8.7]],[[492,383],[109.45,12.88]],[[270,4],[107.05,17.0]]]
// choose flip
let A6=null,bestErr=1e18
for(const s0 of[1,-1])for(const s1 of[1,-1]){
  const Vs=[[eS.V[0][0]*s0,eS.V[0][1]*s1],[eS.V[1][0]*s0,eS.V[1][1]*s1]]
  const M=mul(mul(eG.V,sc),Tp(Vs))
  // px(x,y)->km : first (x,-y)-Sm.m, apply M, +Gm.m
  const f=(x,y)=>{const dx=x-Sm.m[0],dy=-y-Sm.m[1];return[M[0][0]*dx+M[0][1]*dy+Gm.m[0],M[1][0]*dx+M[1][1]*dy+Gm.m[1]]}
  let e=0;for(const[px,ll]of anchors){const[ex,ny]=f(px[0],px[1]);const[lo,la]=toLL(ex,ny);e+=Math.hypot((lo-ll[0])*KLON,(la-ll[1])*KLAT)}
  if(e<bestErr){bestErr=e; // store as full 2x3 in px-space (x,y,1)
    A6={a:M[0][0],b:-M[0][1],c:M[0][0]*(-Sm.m[0])+M[0][1]*(-Sm.m[1])+Gm.m[0], d:M[1][0],e:-M[1][1],f:M[1][0]*(-Sm.m[0])+M[1][1]*(-Sm.m[1])+Gm.m[1]}}
}
// A6: ex=a*x+b*y+c ; ny=d*x+e*y+f
const apply=(A,x,y)=>[A.a*x+A.b*y+A.c, A.d*x+A.e*y+A.f]
// ICP refine
function fitAffine(src,dst){ // src px [x,y], dst km [ex,ny]; LS for a,b,c and d,e,f
  let Sxx=0,Sxy=0,Sx=0,Syy=0,Sy=0,n=0,Sxu=0,Syu=0,Su=0,Sxv=0,Syv=0,Sv=0
  for(let i=0;i<src.length;i++){const[x,y]=src[i],[u,v]=dst[i];Sxx+=x*x;Sxy+=x*y;Sx+=x;Syy+=y*y;Sy+=y;n++;Sxu+=x*u;Syu+=y*u;Su+=u;Sxv+=x*v;Syv+=y*v;Sv+=v}
  const N=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]]
  const sol=(b)=>{const M=N.map((r,i)=>[...r,b[i]]);for(let c=0;c<3;c++){let p=c;for(let r=c+1;r<3;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;[M[c],M[p]]=[M[p],M[c]];for(let r=0;r<3;r++){if(r===c)continue;const f=M[r][c]/M[c][c];for(let k=c;k<4;k++)M[r][k]-=f*M[c][k]}}return[M[0][3]/M[0][0],M[1][3]/M[1][1],M[2][3]/M[2][2]]}
  const[a,b,c]=sol([Sxu,Syu,Su]),[d,e,f]=sol([Sxv,Syv,Sv]);return{a,b,c,d,e,f}
}
for(let it=0;it<12;it++){
  const src=[],dst=[],errs=[]
  for(const [x,y] of Bsvg){ const [ex,ny]=apply(A6,x,y); let bd=1e18,bp=null; for(const g of Bgeo){const dd=(g[0]-ex)**2+(g[1]-ny)**2; if(dd<bd){bd=dd;bp=g}} src.push([x,y]);dst.push(bp);errs.push(Math.sqrt(bd)) }
  // trim worst 25%
  const idx=[...errs.keys()].sort((i,j)=>errs[i]-errs[j]).slice(0,Math.floor(errs.length*0.75))
  A6=fitAffine(idx.map(i=>src[i]),idx.map(i=>dst[i]))
  if(it%3===0||it===11){const me=idx.reduce((a,i)=>a+errs[i],0)/idx.length;console.log('ICP it'+it,'trimmed mean err(km)=',me.toFixed(1))}
}
for(const[px,ll]of anchors){const[ex,ny]=apply(A6,px[0],px[1]);const[lo,la]=toLL(ex,ny);console.log('  anchor',ll,'->',[lo.toFixed(2),la.toFixed(2)],Math.hypot((lo-ll[0])*KLON,(la-ll[1])*KLAT).toFixed(0)+'km')}

export function pxToLonLat(x,y){const[ex,ny]=apply(A6,x,y);return toLL(ex,ny)}
const dtA=A6.a*A6.e-A6.b*A6.d
export function lonlatToPx(lon,lat){const[ex,ny]=toKm(lon,lat);const bx=ex-A6.c,by=ny-A6.f;return[(A6.e*bx-A6.b*by)/dtA,(-A6.d*bx+A6.a*by)/dtA]}
export { KEYS }
