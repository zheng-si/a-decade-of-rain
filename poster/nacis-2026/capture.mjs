// NACIS 2026 placard: the product shots, taken from the live site by headless
// Chromium at print resolution. Each shot names a viewport in CSS px and a
// device scale factor; width × dpr is the pixel width, and at 300 dpi the
// 3300 px wide portrait shot spans the full 11-inch sheet.
//
//   node poster/nacis-2026/capture.mjs            # all shots
//   node poster/nacis-2026/capture.mjs atlas-3d   # one shot, by name
//
// The camera rides in the Atlas URL (?cam=lng,lat,zoom,bearing,pitch&view=3d),
// so a shot is reproducible: change the numbers here, not by hand in a browser.
// Chromium is the Playwright build under /opt/pw-browsers (CHROME overrides);
// WebGL runs on SwiftShader, which is slow but exact, so each shot waits for
// the network to go idle and then a fixed settle time for tiles and terrain.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'shots')
const SITE = process.env.SITE || 'https://rain.sizheng.me'
const CHROME = process.env.CHROME || findChrome()

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort() : []
  for (const d of dirs.reverse()) {
    const p = path.join(root, d, 'chrome-linux', 'chrome')
    if (fs.existsSync(p)) return p
  }
  return chromium.executablePath()
}

/** The shots. `path` is appended to SITE; sizes are CSS px. */
export const SHOTS = {
  // A: the Atlas in the tilted 3D view over the Rừng Sác mangroves south of
  // Saigon, Vũng Tàu at the right edge. Portrait, sized for the full-bleed
  // variant: 1100 × 1130 CSS px at 3× = 3300 × 3390 px.
  'atlas-3d-square': { path: '/archive?cam=106.83,10.70,10.05,0,55&view=3d', w: 1100, h: 1130, dpr: 3, settle: 30000 },
  // B: the same view, landscape, for the framed variant: 3200 × 2000 px.
  'atlas-3d-wide': { path: '/archive?cam=106.85,10.60,9.9,0,55&view=3d', w: 1600, h: 1000, dpr: 2, settle: 30000 },
  // The flat dot view around Đồng Xoài and Long Khánh at the 10 km scale.
  'atlas-flat': { path: '/archive?cam=107.25,11.05,8.7', w: 1200, h: 900, dpr: 2, settle: 25000 },
  // The Story's hook: the heat field under the title.
  'story-hero': { path: '/', w: 1200, h: 900, dpr: 2, settle: 20000 },
}

const only = process.argv.slice(2)
const names = only.length ? only : Object.keys(SHOTS)
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=<-loopback>'] : []),
  ],
})
try {
  for (const name of names) {
    const s = SHOTS[name]
    if (!s) throw new Error(`no shot named ${name}; have ${Object.keys(SHOTS).join(', ')}`)
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr })
    const page = await ctx.newPage()
    const failed = []
    page.on('requestfailed', (r) => failed.push(r.url()))
    const t0 = Date.now()
    await page.goto(SITE + s.path, { waitUntil: 'networkidle', timeout: 120000 })
    await page.waitForTimeout(s.settle)
    const file = path.join(OUT, `${name}.png`)
    await page.screenshot({ path: file })
    const kb = Math.round(fs.statSync(file).size / 1024)
    console.log(`${name}: ${s.w * s.dpr}×${s.h * s.dpr} px, ${kb} KB, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${failed.length} failed requests`)
    for (const u of failed.slice(0, 5)) console.log('  failed:', u)
    await ctx.close()
  }
} finally {
  await browser.close()
}
