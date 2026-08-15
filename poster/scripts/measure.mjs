// Measure real rendered bboxes of footer/legend lines. Usage: node measure.mjs file.svg [file2.svg ...]
import { chromium } from 'playwright-core'
import fs from 'fs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
for (const f of process.argv.slice(2)) {
  const svg = fs.readFileSync(f, 'utf8')
  const p = await b.newPage({ viewport: { width: 1400, height: 1980 } })
  await p.setContent(`<style>html,body{margin:0}svg{width:1400px;height:1980px;display:block}</style>${svg}`)
  await p.waitForTimeout(500)
  const rows = await p.evaluate(() => {
    const out = []
    for (const t of document.querySelectorAll('text')) {
      const y = +t.getAttribute('y')
      if (y < 3500) continue
      const bb = t.getBBox()
      out.push({ y, x2: +(bb.x + bb.width).toFixed(1), text: t.textContent.slice(0, 40) })
    }
    return out
  })
  console.log('==', f)
  for (const r of rows.sort((a, b) => a.y - b.y || a.x2 - b.x2)) {
    const flag = r.x2 > 2563 ? '  << OVER 2563' : ''
    console.log(`y=${r.y}  right=${r.x2}${flag}  ${r.text}`)
  }
  await p.close()
}
await b.close()
