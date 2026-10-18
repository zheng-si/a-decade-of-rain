import { createRequire } from 'module'
import fs from 'fs'
const S = process.env.S
const require = createRequire(`${S}/wt/poster/scripts/package.json`)
const { chromium } = require('playwright-core')
const font = w => fs.readFileSync(`${S}/wt/poster/fonts/${w}.ttf`).toString('base64')
const face = `<style>
@font-face{font-family:'Courier Prime';font-weight:400;src:url(data:font/ttf;base64,${font('CourierPrime')}) format('truetype');}
@font-face{font-family:'Courier Prime';font-weight:700;src:url(data:font/ttf;base64,${font('CourierPrimeBold')}) format('truetype');}
@page{size:594mm 841mm;margin:0}html,body{margin:0;background:#fff}svg{width:594mm;height:841mm;display:block}</style>`
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
for (const n of process.argv.slice(2)) {
  const p = await b.newPage()
  await p.setContent(face + fs.readFileSync(`${S}/build/ph-${n}.svg`, 'utf8'))
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(500)
  await p.pdf({ path: `${S}/build/rgb-${n}.pdf`, width: '594mm', height: '841mm', printBackground: true, pageRanges: '1' })
  await p.close()
}
await b.close()
