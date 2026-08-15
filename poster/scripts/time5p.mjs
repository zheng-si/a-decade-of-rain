// Parametric month-flow poster. All knobs via env:
//   RATIO   sampling ratio: 1 (all), 0.5 (one in 2), 0.25 (one in 4)...
//   BIN     time slice per block: 'month' (default), 'half', or a number of days
//   FS      font size in px (omit = auto-fit largest size that fills the page)
//   GAPL    extra leading between blocks, as fraction of line height (default 0.4)
//   OUT     output name
import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const T=JSON.parse(fs.readFileSync('public/data/spray-tracks.json','utf8'))
const SP=process.env.SP, W=2828, H=4000, F=265
const FONT='Courier Prime', INK='#141109', PAPER='#faf9f4'
const EPOCH=Date.UTC(1961,0,1)
const dateOf=day=>new Date(EPOCH+day*86400000)
const d6=day=>{const d=dateOf(day);return String(d.getUTCFullYear()).slice(2)+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0')}
const COL={O:'#ef7409',W:'#3f5162',B:'#2f83c8',P:'#8f5fc0',X:'#6f5c44'}
const NAME={P:'PURPLE',O:'ORANGE',W:'WHITE',B:'BLUE',X:'OTHER (U, K)'}
const grp=a=>({O:'O',W:'W',B:'B',P:'P',U:'X',K:'X',D:'X',T:'X'}[a]||'X')
const STACK=['P','O','W','B','X']
const RATIO=Number(process.env.RATIO||1)
const BIN=process.env.BIN||'month'
const GAPL=process.env.GAPL!==undefined?Number(process.env.GAPL):0.4
const FSFIX=process.env.FS?Number(process.env.FS):null
const OUT=process.env.OUT||'FINAL-time5p'
const TOKFULL=process.env.TOK==='full'

const recs=[]
for(const [ai,day,g,,flat] of T.tracks){ if(!(g>0))continue
  const d=dateOf(day)
  recs.push({day, yr:d.getUTCFullYear(), mo:d.getUTCMonth(), dom:d.getUTCDate(), a:grp(T.agents[ai]), t:(TOKFULL?d6(day)+'-':'')+mgrs(flat[0],flat[1])})
}
recs.sort((x,y)=>x.day-y.day)
const firstDay=recs[0].day
const keyOf=x=> BIN==='month' ? x.yr*12+x.mo
             : BIN==='half'  ? x.yr*24+x.mo*2+(x.dom>15?1:0)
             : Math.floor((x.day-firstDay)/Number(BIN))
// bins in chronological order
const keys=[...new Set(recs.map(keyOf))].sort((a,b)=>a-b)
const bins=keys.map(k=>{
  const bin=recs.filter(x=>keyOf(x)===k)
  const keep=RATIO>=1?bin:bin.filter((_,i)=>i%Math.round(1/RATIO)===0)
  const ordered=[]; for(const a of STACK) ordered.push(...keep.filter(x=>x.a===a))
  return {yr:bin[0].yr, list:ordered}
}).filter(b=>b.list.length)
const shown=bins.reduce((s,b)=>s+b.list.length,0)

const TOKLEN=TOKFULL?15:8
const y0=F, seaBottom=H-F-96, sea=seaBottom-y0
const bw=W-2*F
const fit=fs_=>{ const cw=fs_*0.6, chars=Math.floor(bw/cw), slots=Math.floor((chars+1)/(TOKLEN+1))
  const l=fs_*1.18
  const lines=bins.reduce((s,b)=>s+Math.ceil(b.list.length/slots),0)
  return {need:lines*l+(bins.length-1)*GAPL*l, slots, l} }
let FS=FSFIX, cpl, lh
if(FSFIX){ const r=fit(FSFIX); cpl=r.slots; lh=r.l
  if(r.need>sea) console.log(`WARN: FS ${FSFIX} overflows by ${(r.need-sea).toFixed(0)}px`) }
else { for(let fs_=26; fs_>=6; fs_-=0.25){ const r=fit(fs_); if(r.need<=sea){ FS=fs_; cpl=r.slots; lh=r.l; break } } }
const cw=FS*0.6, slot=(TOKLEN+1)*cw

const els=[], yearAt={}
let ycur=y0
for(const b of bins){
  if(yearAt[b.yr]===undefined){ yearAt[b.yr]=ycur
    els.push(`<text x="${(F-20).toFixed(0)}" y="${(ycur+FS).toFixed(1)}" font-family="${FONT}" font-weight="700" font-size="21" letter-spacing="1" fill="#6f5c44" text-anchor="end">${b.yr}</text>`) }
  const nLines=Math.ceil(b.list.length/cpl)
  for(let li=0;li<nLines;li++){
    const y=(ycur+FS+li*lh).toFixed(1)
    b.list.slice(li*cpl,(li+1)*cpl).forEach((rec,c)=>{
      els.push(`<text x="${(F+c*slot).toFixed(1)}" y="${y}" font-family="${FONT}" font-size="${FS}" fill="${COL[rec.a]}" fill-opacity="0.95">${rec.t}</text>`)
    })
  }
  ycur+=nLines*lh + GAPL*lh
}
els.push(`<text x="${F}" y="3742" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="1" fill="${INK}" fill-opacity="0.55">AGENTS</text>`)
let kx=F+('AGENTS'.length+3)*19*0.6
for(const a of STACK){ const tk=`${a}  ${NAME[a]}`
  els.push(`<text x="${kx.toFixed(0)}" y="3742" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="1" fill="${COL[a]}">${tk}</text>`)
  kx+=(tk.length+4)*19*0.6 }
const binName=BIN==='month'?'MONTH':BIN==='half'?'HALF-MONTH':`${BIN} DAYS`
const fnote=RATIO>=1?`ALL ${recs.length.toLocaleString('en')} SORTIES`:`${shown.toLocaleString('en')} OF ${recs.length.toLocaleString('en')}, EVERY ${Math.round(1/RATIO)}TH OF EACH ${BIN==='month'?'MONTH':'BLOCK'}`
els.push(`<text x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    ${TOKFULL?"EACH RECORD IS ONE SPRAY RUN'S DATE AND COORDINATE":"EACH CODE IS ONE SPRAY RUN'S MAP REFERENCE"}    EACH BLOCK IS ONE ${binName}    ${fnote}    1962–1971</text>`)

fs.writeFileSync(`${SP}/${OUT}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${els.join('').replaceAll('<text ','<text xml:space="preserve" ')}</svg>`)
console.log(`${OUT}  bin=${BIN} ratio=${RATIO} gap=${GAPL}  blocks ${bins.length}  FS ${FS}  cpl ${cpl}  shown ${shown}/${recs.length}  bottom ${ycur.toFixed(0)}/${seaBottom}`)
