import fs from 'fs'
import { mgrs } from './mgrs.mjs'
const T=JSON.parse(fs.readFileSync('public/data/spray-tracks.json','utf8'))
const SP=process.env.SP, W=2828, H=4000, F=265
const FONT='Courier Prime', INK='#141109', OR='#ef7409', PAPER='#faf9f4'   // deepened for A1 print presence
const EPOCH=Date.UTC(1961,0,1)
const d6=day=>{const d=new Date(EPOCH+day*86400000);return String(d.getUTCFullYear()).slice(2)+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0')}
const g5=g=>String(Math.min(99999,Math.round(g))).padStart(5,'0')
const legLbl=i=>`${Math.floor(i/26)+1}${String.fromCharCode(65+i%26)}`
// Combat Tactical Zone derived from latitude (I extreme north -> IV delta).
// Approximate: CTZ boundaries followed province lines; this is a geographic estimate.
const ctzOf=lat=> lat>=15.35?'1' : lat>=11.85?'2' : lat>=10.42?'3' : '4'
const runs=[...T.tracks].filter(([,,g,km])=>g>0&&km>0).sort((a,b)=>a[1]-b[1])

function build(name, {full=false, FS=30, LH=46, nMiss=44, capLeg=6, mode='full'}={}) {
  const cw=FS*0.6
  // columns: [key,label,widthChars]; layout with 1-char gaps
  const MIN=[['date','YYMMDD',6],['h','H',1],['gal','GAL',5],['leg','LEG',3],['coord','COORD',8],['m','M',1]]
  const FULLC=[['date','YYMMDD',6],['ctz','CTZ',3],['pro','PRO',3],['h','H',1],['gal','GAL',5],['t','T',1],['leg','LEG',3],['coord','COORD',8],['s','S',1],['i','I',1],['m','M',1]]
  const cols=full?FULLC:MIN
  // compute x offset (chars) for each column
  let acc=0; const X={}
  for(const [k,,wch] of cols){ X[k]=acc*cw; acc+=wch+1 }
  const M=265, boxW=W-2*M
  const NP=3
  const panelWch=acc-1, panelW=panelWch*cw
  const gap=(boxW-NP*panelW)/(NP-1), ox=M
  const y0=300               // header baseline aligned to box top (first-ink line ~y300, matches f1/rainbow)
  const dataBottom=3500

  // build rows
  const rows=[]
  const step=Math.max(1,Math.floor(runs.length/nMiss))
  for(let k=0;k<runs.length && rows.length<260;k+=step){
    const [ai,day,gal,,flat]=runs[k]
    const ag=T.agents[ai], date=d6(day)
    const nwp=Math.min(flat.length/2, capLeg)
    for(let w=0;w<nwp;w++){
      rows.push({date, ctz:w===0?ctzOf(flat[1]):'', ag:w===0?ag:'', gal:w===0?g5(gal):'', leg:legLbl(w),
        coord:mgrs(flat[w*2],flat[w*2+1]), m:w===0?'F':'', rowAg:ag})
    }
  }
  const HG=92                // gap from header/square rule down to first data row (widened)
  const perPanel=Math.floor((dataBottom-(y0+HG))/LH)
  const cap=perPanel*NP
  const use=rows.slice(0,cap)
  const per=Math.ceil(use.length/NP)
  const panels=[...Array(NP)].map((_,i)=>use.slice(i*per,(i+1)*per))

  const t=(x,y,s,{op=.82,fill=INK,an='start',w=400}={})=>s?`<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="${FONT}" font-size="${FS}" font-weight="${w}" fill="${fill}" fill-opacity="${op}" text-anchor="${an}">${s}</text>`:''
  const els=[]
  // (title removed per direction)
  for(let pi=0;pi<NP;pi++){
    const px=ox+pi*(panelW+gap)
    for(const [k,lab,wch] of cols){
      els.push(t(px+X[k], y0, lab, {op:.72}))
      // square underline: one small square centered under each glyph
      const sq=Math.round(cw*0.34), sy=y0+13
      for(let c=0;c<wch;c++){
        const gx=px+X[k]+c*cw+(cw-sq)/2
        els.push(`<rect x="${gx.toFixed(1)}" y="${sy}" width="${sq}" height="${sq}" fill="${INK}" fill-opacity="0.6"/>`)
      }
    }
    // AUTHORSHIP: colour each record by its agent (rainbow palette). Orange
    // floods ~62% of the ledger -- an authored reading of the record, not a
    // raw facsimile. Metadata muted, agent letter + gallons full-strength.
    const CLR={O:'#ef7409',W:'#3f5162',B:'#2f83c8',P:'#8f5fc0'}   // deepened system palette (matches time2 / tally)
    panels[pi].forEach((r,i)=>{
      const y=y0+HG+i*LH
      const agc=CLR[r.rowAg]||'#6f5c44'
      // colour registers: full=whole row in agent colour; orange=only Orange rows
      // highlighted, rest neutral ink; accent=metadata neutral, only agent+gallons coloured
      const rowc = mode==='orange' ? (r.rowAg==='O'?OR:INK) : agc
      const metac = (mode==='accent'||mode==='letter') ? INK : rowc
      const galc  = mode==='letter' ? INK : rowc
      els.push(t(px+X.date,y,r.date,{op:.78,fill:metac}))
      if(r.ctz) els.push(t(px+X.ctz,y,r.ctz,{op:.6,fill:metac}))
      if(r.ag) els.push(t(px+X.h,y,r.ag,{op:1,fill:rowc,w:700}))
      if(r.gal) els.push(t(px+X.gal,y,r.gal,{op:mode==='letter'?0.82:1,fill:galc,w:700}))
      els.push(t(px+X.leg,y,r.leg,{op:.62,fill:metac}))
      els.push(t(px+X.coord,y,r.coord,{op:.85,fill:metac}))
      if(r.m) els.push(t(px+X.m,y,r.m,{op:.5,fill:metac}))
    })
  }
  // ---- codebook legend, verbatim from DTIC ADA160563 ----
  const legFS=19, lx=M, ly=3560, lh=26
  const leg=(x,y,s,op=.6)=>`<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="${FONT}" font-size="${legFS}" fill="${INK}" fill-opacity="${op}">${s}</text>`
  const colW=boxW/4
  // codebook: every populated column defined; unretained fields declared as such
  const C1=['COLUMNS','YYMMDD  DATE FLOWN','CTZ  CORPS TACTICAL ZONE','H  HERBICIDE AGENT','GAL  US GALLONS']
  const C2=['','LEG  FLIGHT LEG','COORD  MGRS GRID REFERENCE','M  MEANS OF DELIVERY','PRO T S I  NOT RETAINED']
  ;[C1,C2].forEach((col,ci)=>{ col.forEach((line,li)=>{ if(line) els.push(leg(lx+ci*colW, ly+li*lh, line, li===0?.75:.55)) }) })
  // agent key with coloured code letters (mirrors the AGENTS key on the other panels)
  const AGC={P:'#8f5fc0',O:'#ef7409',W:'#3f5162',B:'#2f83c8'}
  const pair=(a1,n1,a2,n2)=>`<tspan font-weight="700" fill="${AGC[a1]}" fill-opacity="1">${a1}</tspan> ${n1}   <tspan font-weight="700" fill="${AGC[a2]}" fill-opacity="1">${a2}</tspan> ${n2}`
  els.push(leg(lx+2*colW, ly, 'H  AGENT', .75))
  els.push(`<text x="${(lx+2*colW).toFixed(0)}" y="${(ly+lh).toFixed(0)}" font-family="${FONT}" font-size="${legFS}" fill="${INK}" fill-opacity="0.55">${pair('P','PURPLE','O','ORANGE')}</text>`)
  els.push(`<text x="${(lx+2*colW).toFixed(0)}" y="${(ly+2*lh).toFixed(0)}" font-family="${FONT}" font-size="${legFS}" fill="${INK}" fill-opacity="0.55">${pair('W','WHITE','B','BLUE')}</text>`)
  els.push(leg(lx+2*colW, ly+3*lh, 'U K  MINOR / UNSPEC', .55))
  els.push(leg(lx+3*colW, ly, 'M  MEANS', .75))
  els.push(leg(lx+3*colW, ly+lh, 'F  FIXED-WING  (ALL SORTIES)', .55))
  // honesty footnotes: CTZ is derived; header-only fields repeat on first leg only
  els.push(`<text x="${F}" y="3706" font-family="${FONT}" font-size="18" fill="${INK}" fill-opacity="0.5">CTZ APPROXIMATED FROM COORDINATES   ·   EACH LINE IS ONE FLIGHT LEG   ·   CTZ / H / GAL / M ON FIRST LEG ONLY</text>`)
  els.push(`<text x="${F}" y="3790" font-family="${FONT}" font-size="22" letter-spacing="1" fill="${INK}" fill-opacity="0.55">OPERATION RANCH HAND    HERBS FILE    91 OF ${runs.length.toLocaleString('en')} SORTIES, EVERY ${step}TH    ${use.length} FLIGHT LEGS    1962–1971</text>`)
  fs.writeFileSync(`${SP}/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${els.join('').replaceAll('<text ','<text xml:space="preserve" ')}</svg>`)
  console.log(`${name}  ${use.length} rows  panelWch=${panelWch}  FS=${FS}`)
}

build('FINAL-f4',{full:true, FS:28, LH:44, nMiss:91, mode:'accent'})   // current: agent letter + gallons coloured
build('FINAL-f4L',{full:true, FS:28, LH:44, nMiss:91, mode:'letter'})  // letter-only: agent letter coloured, gallons ink
build('FINAL-f4F',{full:true, FS:28, LH:44, nMiss:91, mode:'full'})    // full row coloured (matches other panels)
