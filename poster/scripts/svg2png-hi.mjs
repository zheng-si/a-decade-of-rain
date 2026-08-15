// Full native-resolution PNG (2828x4000) so record text is readable when zoomed.
import { chromium } from 'playwright-core'
import fs from 'fs'
const SP = process.env.SP
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
for (const name of process.argv.slice(2)) {
  const svg = fs.readFileSync(`${SP}/${name}`, 'utf8')
  const m = svg.match(/width="(\d+)" height="(\d+)"/)
  const w = +m[1], h = +m[2]
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.setContent(`<style>html,body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${SP}/${name.replace('.svg', '-hi.png')}` })
  await p.close()
  console.log(name, '→', name.replace('.svg', '-hi.png'), `${w}x${h}`)
}
await b.close()
