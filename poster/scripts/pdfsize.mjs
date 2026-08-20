// Export a *-print.svg to a vector PDF at an arbitrary paper size.
// Usage: SP=<dir> node pdfsize.mjs FINAL-map 707 1000   (width mm, height mm)
import { chromium } from 'playwright-core'
import fs from 'fs'
const SP = process.env.SP
const [name, wmm, hmm] = process.argv.slice(2)
const svg = fs.readFileSync(`${SP}/${name}-print.svg`, 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setContent(`<style>@page{size:${wmm}mm ${hmm}mm;margin:0}html,body{margin:0}svg{width:${wmm}mm;height:${hmm}mm;display:block}</style>${svg}`)
await p.waitForTimeout(700)
const out = `${SP}/${name}-${wmm}x${hmm}mm.pdf`
await p.pdf({ path: out, width: `${wmm}mm`, height: `${hmm}mm`, printBackground: true, pageRanges: '1' })
await b.close()
console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + 'KB')
