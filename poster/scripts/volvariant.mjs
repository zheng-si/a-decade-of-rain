// FINAL-vol2 : the BY VOLUME wall with MGRS-only marks (no YYMMDD prefix),
// matching t5s8's unit. Same allocation: block height = fixed-wing gallons per
// agent; within each agent the records stay in date order, evenly sampled.
import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const T=JSON.parse(fs.readFileSync('public/data/spray-tracks.json','utf8'))
const SP=process.env.SP, W=2828, H=4000, F=265
const FONT='Courier Prime', INK='#141109', PAPER='#faf9f4'
const COL={O:'#ef7409',W:'#3f5162',B:'#2f83c8',P:'#8f5fc0',X:'#6f5c44'}
const NAME={P:'PURPLE',O:'ORANGE',W:'WHITE',B:'BLUE',X:'OTHER (U, K)'}
const grp=a=>({O:'O',W:'W',B:'B',P:'P',U:'X',K:'X',D:'X',T:'X'}[a]||'X')
const AG=['O','W','B','P','X']                 // stacking order: gallons descending
const KEYORDER=['P','O','W','B','X']

const galFW={}; for(const a of AG) galFW[a]=0
for(const [ai,,g] of T.tracks){ if(!(g>0))continue; galFW[grp(T.agents[ai])]+=g }
const sumFW=AG.reduce((s,a)=>s+galFW[a],0)
const nSorties=T.tracks.filter(t=>t[2]>0).length

const TOKLEN=8, FS=24, cw=FS*0.6, lh=FS*1.30
const bw=W-2*F, charsPerRow=Math.floor(bw/cw), tokPerRow=Math.floor((charsPerRow+1)/(TOKLEN+1))
const slot=(TOKLEN+1)*cw
const y0=F, seaBottom=H-F-96
const sample=(arr,n)=>{ if(arr.length<=n) return arr.slice(); const out=[]; for(let i=0;i<n;i++) out.push(arr[Math.floor(i*(arr.length-1)/(n-1))]); return out }

const byA={}; for(const a of AG) byA[a]=[]
for(const [ai,day,g,,flat] of T.tracks){ if(!(g>0))continue; byA[grp(T.agents[ai])].push([day, mgrs(flat[0],flat[1])]) }
for(const a of AG) byA[a].sort((x,y)=>x[0]-y[0])

const GAP=16, NG=AG.length-1
const usable=Math.floor((seaBottom-y0-NG*GAP)/lh)
const raw=AG.map(a=>usable*galFW[a]/sumFW)
const alloc=raw.map(Math.floor); let rem=usable-alloc.reduce((a,b)=>a+b,0)
raw.map((v,i)=>[i,v-Math.floor(v)]).sort((a,b)=>b[1]-a[1]).forEach(([i])=>{if(rem>0){alloc[i]++;rem--}})
const els=[]; let yc=y0, shownTok=0
for(let i=0;i<AG.length;i++){ const a=AG[i], rowsN=alloc[i]
  const toks=sample(byA[a].map(x=>x[1]), rowsN*tokPerRow); shownTok+=toks.length
  for(let k=0;k<rowsN;k++){ const s=toks.slice(k*tokPerRow,(k+1)*tokPerRow); if(!s.length)break
    for(let c=0;c<s.length;c++) els.push(`<text x="${(F+c*slot).toFixed(1)}" y="${(yc+FS+k*lh).toFixed(1)}" font-family="${FONT}" font-size="${FS}" fill="${COL[a]}" fill-opacity="0.95">${s[c]}</text>`) }
  yc += rowsN*lh + GAP }
els.push(`<text x="${F}" y="3742" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="1" fill="${INK}" fill-opacity="0.55">AGENTS</text>`)
let kx=F+('AGENTS'.length+3)*19*0.6
for(const a of KEYORDER){ const t=`${a}  ${NAME[a]}`
  els.push(`<text x="${kx.toFixed(0)}" y="3742" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="1" fill="${COL[a]}">${t}</text>`)
  kx += (t.length+4)*19*0.6 }
els.push(`<text x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    BLOCKS SCALED TO GALLONS PER AGENT, 18,905,413 US GAL FIXED-WING    ${shownTok.toLocaleString('en')} OF ${nSorties.toLocaleString('en')}, EVENLY SAMPLED PER AGENT    1962–1971</text>`)
fs.writeFileSync(`${SP}/FINAL-vol2.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${els.join('').replaceAll('<text ','<text xml:space="preserve" ')}</svg>`)
console.log(`FINAL-vol2  alloc ${alloc.join('/')}  tokPerRow ${tokPerRow}  shown ${shownTok}/${nSorties}`)
