// The diptych: ONE archive, two readings, one typographic system.
//   FINAL-vol  (BY VOLUME) -- records grouped by agent; block height = gallons.
//   FINAL-time (BY DATE)   -- every record in date order; colour = agent.
// Both scoped to the 7,047 FIXED-WING sorties (tracks with gallons>0), so their
// denominators are provably identical. Shared: warm paper, Courier Prime, M=265,
// record format YYMMDD-AAeeennn, identical bottom AGENTS key, parallel footers.
import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const T=JSON.parse(fs.readFileSync('public/data/spray-tracks.json','utf8'))
const SP=process.env.SP, W=2828, H=4000, F=265
const FONT='Courier Prime', INK='#141109', PAPER='#faf9f4'
const EPOCH=Date.UTC(1961,0,1)
const d6=day=>{const d=new Date(EPOCH+day*86400000);return String(d.getUTCFullYear()).slice(2)+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0')}
// White + Other deepened toward equal perceived contrast on the warm paper
const COL={O:'#ef7409',W:'#3f5162',B:'#2f83c8',P:'#8f5fc0',X:'#6f5c44'}
const NAME={O:'ORANGE',W:'WHITE',B:'BLUE',P:'PURPLE',X:'OTHER (U, K)'}
const grp=a=>({O:'O',W:'W',B:'B',P:'P',U:'X',K:'X',D:'X',T:'X'}[a]||'X')
const tok=(day,flat)=>`${d6(day)}-${mgrs(flat[0],flat[1])}`
const AG=['O','W','B','P','X']
// gallons per agent, FIXED-WING only (tracks with gallons>0) -> both posters share one 7,047-sortie universe
const galFW={}; for(const a of AG) galFW[a]=0
for(const [ai,,g] of T.tracks){ if(!(g>0))continue; galFW[grp(T.agents[ai])]+=g }
const sumFW=AG.reduce((s,a)=>s+galFW[a],0)          // 18,905,413
const nSorties=T.tracks.filter(t=>t[2]>0).length    // 7,047

const TOKLEN=15, FS=24, cw=FS*0.6, lh=FS*1.30
const bw=W-2*F, charsPerRow=Math.floor(bw/cw), tokPerRow=Math.floor((charsPerRow+1)/(TOKLEN+1))
const slot=(TOKLEN+1)*cw
const y0=F, seaBottom=H-F-96, totalRows=Math.floor((seaBottom-y0)/lh)
const sample=(arr,n)=>{ if(arr.length<=n) return arr.slice(); const out=[]; for(let i=0;i<n;i++) out.push(arr[Math.floor(i*(arr.length-1)/(n-1))]); return out }

// shared bottom apparatus: AGENTS colour key (y=3742) + parallel 5-part footer (y=3790)
const KEYORDER=['P','O','W','B','X']
function apparatus(mid, figure){
  const out=[]
  out.push(`<text x="${F}" y="3742" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="1" fill="${INK}" fill-opacity="0.55">AGENTS</text>`)
  let kx=F + ('AGENTS'.length+3)*19*0.6
  for(const a of KEYORDER){ const t=`${a}  ${NAME[a]}`
    out.push(`<text x="${kx.toFixed(0)}" y="3742" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="1" fill="${COL[a]}">${t}</text>`)
    kx += (t.length+4)*19*0.6 }
  out.push(`<text x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    ${mid}    ${figure}    1962–1971</text>`)
  return out.join('')
}
const wrap=(name,body)=>fs.writeFileSync(`${SP}/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${body.replaceAll('<text ','<text xml:space="preserve" ')}</svg>`)

// ---------- FINAL-vol : BY VOLUME — stacked bars of type, height = fixed-wing gallons ----------
;(()=>{
  const byA={}; for(const a of AG) byA[a]=[]
  for(const [ai,day,g,,flat] of T.tracks){ if(!(g>0))continue; byA[grp(T.agents[ai])].push([day,tok(day,flat)]) }
  for(const a of AG) byA[a].sort((x,y)=>x[0]-y[0])
  const GAP=16, NG=AG.length-1                       // thin gap between agent blocks
  const usable=Math.floor((seaBottom-y0-NG*GAP)/lh)  // rows available after gaps
  const raw=AG.map(a=>usable*galFW[a]/sumFW)
  const alloc=raw.map(Math.floor); let rem=usable-alloc.reduce((a,b)=>a+b,0)
  raw.map((v,i)=>[i,v-Math.floor(v)]).sort((a,b)=>b[1]-a[1]).forEach(([i])=>{if(rem>0){alloc[i]++;rem--}})
  const els=[]; let yc=y0, shownTok=0
  for(let i=0;i<AG.length;i++){ const a=AG[i], rowsN=alloc[i]
    const toks=sample(byA[a].map(x=>x[1]), rowsN*tokPerRow); shownTok+=toks.length
    for(let k=0;k<rowsN;k++){ const s=toks.slice(k*tokPerRow,(k+1)*tokPerRow); if(!s.length)break
      for(let c=0;c<s.length;c++) els.push(`<text x="${(F+c*slot).toFixed(1)}" y="${(yc+FS+k*lh).toFixed(1)}" font-family="${FONT}" font-size="${FS}" fill="${COL[a]}" fill-opacity="0.95">${s[c]}</text>`) }
    yc += rowsN*lh + GAP }
  els.push(apparatus('BLOCKS SCALED TO GALLONS PER AGENT, 18,905,413 US GAL FIXED-WING', `${shownTok.toLocaleString('en')} OF ${nSorties.toLocaleString('en')}, EVENLY SAMPLED PER AGENT`))
  wrap('FINAL-vol', els.join(''))
  console.log('FINAL-vol alloc',alloc.join('/'),'sumFW',sumFW.toLocaleString('en'))
})()

// ---------- FINAL-time : BY DATE — colour = agent, area = sortie count ----------
;(()=>{
  const all=[]
  for(const [ai,day,g,,flat] of T.tracks){ if(!(g>0))continue; all.push([grp(T.agents[ai]),tok(day,flat)]) }
  all.sort((x,y)=>x[1]<y[1]?-1:x[1]>y[1]?1:0)
  const N=totalRows*tokPerRow, S=sample(all, N)
  const els=[]
  for(let rr=0;rr<totalRows;rr++){ const y=(y0+FS+rr*lh).toFixed(1)
    for(let c=0;c<tokPerRow;c++){ const rec=S[rr*tokPerRow+c]; if(!rec)break
      els.push(`<text x="${(F+c*slot).toFixed(1)}" y="${y}" font-family="${FONT}" font-size="${FS}" fill="${COL[rec[0]]}" fill-opacity="0.95">${rec[1]}</text>`) } }
  els.push(apparatus('IN DATE ORDER, COLOUR = SORTIE COUNT', `${N.toLocaleString('en')} OF ${nSorties.toLocaleString('en')} SORTIES, EVENLY SAMPLED`))
  wrap('FINAL-time', els.join(''))
  console.log('FINAL-time shown',N,'of',all.length)
})()
