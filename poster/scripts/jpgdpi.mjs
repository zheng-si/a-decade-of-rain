// Export a poster SVG to JPEG at a given paper size and resolution, with the
// JFIF density stamped so the file reports the intended print size.
// Usage: SP=<dir> node jpgdpi.mjs <name> <width mm> <height mm> [dpi] [quality]
//   e.g. node jpgdpi.mjs FINAL-f4 210 297 300      -> A4 at 300 dpi (2480x3508)
import { chromium } from 'playwright-core'
import fs from 'fs'

const SP = process.env.SP
const [name, wmmS, hmmS, dpiS = '300', qS = '92'] = process.argv.slice(2)
const wmm = Number(wmmS), hmm = Number(hmmS), dpi = Number(dpiS), quality = Number(qS)
const px = (mm) => Math.round((mm / 25.4) * dpi)
const W = px(wmm), H = px(hmm)

// Stamp the JFIF APP0 density fields (units=1 -> dots per inch).
function stampDensity(buf, d) {
  if (!(buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF && buf[3] === 0xE0)) {
    console.warn('  ! no JFIF APP0 segment; density not stamped')
    return buf
  }
  buf[13] = 1                       // units: dots per inch
  buf[14] = (d >> 8) & 0xFF; buf[15] = d & 0xFF   // X density
  buf[16] = (d >> 8) & 0xFF; buf[17] = d & 0xFF   // Y density
  return buf
}

// Prefer the embedded-font print svg when present, so the export does not
// depend on the host having Courier Prime installed.
const src = fs.existsSync(`${SP}/${name}-print.svg`) ? `${SP}/${name}-print.svg` : `${SP}/${name}.svg`
const svg = fs.readFileSync(src, 'utf8')

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: W, height: H } })
await p.setContent(`<style>html,body{margin:0}svg{width:${W}px;height:${H}px;display:block}</style>${svg}`)
await p.waitForTimeout(900)
const out = `${SP}/${name}-${wmm}x${hmm}mm-${dpi}dpi.jpg`
await p.screenshot({ path: out, type: 'jpeg', quality })
await p.close()
await b.close()

fs.writeFileSync(out, stampDensity(fs.readFileSync(out), dpi))
const kb = (fs.statSync(out).size / 1024).toFixed(0)
console.log(`${out.split('/').pop()}  ${W}x${H}px  ${wmm}x${hmm}mm @ ${dpi}dpi  ${kb}KB  (src: ${src.split('/').pop()})`)
