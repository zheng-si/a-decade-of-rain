// Package the finals for TDC submission:
//  - embed Courier Prime (400+700) as base64 @font-face  -> *-print.svg (portable)
//  - export RGB JPEG at 2828x4000, JFIF density stamped 72dpi (submission file)
//  - export A1 (594x841mm) vector PDF (print master, if selected)
import { chromium } from 'playwright-core'
import fs from 'fs'
const SP = process.env.SP
const reg = fs.readFileSync('./poster/fonts/CourierPrime.ttf').toString('base64')
const bold = fs.readFileSync('./poster/fonts/CourierPrimeBold.ttf').toString('base64')
const faceCSS = `<style>
@font-face{font-family:'Courier Prime';font-style:normal;font-weight:400;src:url(data:font/ttf;base64,${reg}) format('truetype');}
@font-face{font-family:'Courier Prime';font-style:normal;font-weight:700;src:url(data:font/ttf;base64,${bold}) format('truetype');}
</style>`

// stamp JFIF APP0 density to 72x72 dpi (units=1)
function stamp72(buf){
  if(buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF&&buf[3]===0xE0){
    buf[13]=1; buf[14]=0;buf[15]=72; buf[16]=0;buf[17]=72   // units=dpi, X=72, Y=72
  }
  return buf
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
for (const n of process.argv.slice(2)) {
  let svg = fs.readFileSync(`${SP}/${n}.svg`, 'utf8')
  // inject font faces right after the opening <svg ...>
  const embedded = svg.replace(/(<svg[^>]*>)/, `$1${faceCSS}`)
  fs.writeFileSync(`${SP}/${n}-print.svg`, embedded)

  // JPEG (submission) — native 2828x4000 RGB
  const p = await b.newPage({ viewport: { width: 2828, height: 4000 } })
  await p.setContent(`<style>html,body{margin:0}svg{width:2828px;height:4000px;display:block}</style>${embedded}`)
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${SP}/${n}.jpg`, type: 'jpeg', quality: 92 })
  const jpg = stamp72(fs.readFileSync(`${SP}/${n}.jpg`)); fs.writeFileSync(`${SP}/${n}.jpg`, jpg)

  // A1 vector PDF (print master) — 594 x 841 mm
  await p.setContent(`<style>@page{size:594mm 841mm;margin:0}html,body{margin:0}svg{width:594mm;height:841mm;display:block}</style>${embedded}`)
  await p.waitForTimeout(700)
  await p.pdf({ path: `${SP}/${n}-A1.pdf`, width:'594mm', height:'841mm', printBackground:true, pageRanges:'1' })
  await p.close()

  const kb = (fs.statSync(`${SP}/${n}.jpg`).size/1024).toFixed(0)
  const pkb = (fs.statSync(`${SP}/${n}-A1.pdf`).size/1024).toFixed(0)
  console.log(`${n}: jpg ${kb}KB (2828x4000 RGB 72dpi)  A1.pdf ${pkb}KB  print.svg embedded`)
}
await b.close()
