// Crop a region from an SVG at native scale. Usage: node crop.mjs name.svg x y w h out.png
import { chromium } from 'playwright-core'
import fs from 'fs'
const SP = process.env.SP
const [name, x, y, w, h, out] = process.argv.slice(2)
const svg = fs.readFileSync(`${SP}/${name}`, 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 2828, height: 4000 } })
await p.setContent(`<style>html,body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`)
await p.waitForTimeout(600)
await p.screenshot({ path: `${SP}/${out}`, clip: { x: +x, y: +y, width: +w, height: +h } })
await b.close()
console.log(out)
