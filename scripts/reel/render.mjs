// Render one reel shot frame by frame and encode it.
//
//   npm run dev                                   (in another terminal)
//   node scripts/reel/render.mjs --shot 3         → reel-out/shot3.mp4
//
// Options: --fps 30  --scale 2 (supersample; frames are captured at 2× and
// downscaled, which keeps hairlines crisp)  --from 0 --to <duration>
// --url http://localhost:5173  --stills 0,7.5,14  (PNGs only, no video)
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Playwright is not a project dependency; require() finds a global install
// (NODE_PATH) as well as a local one.
const { chromium } = createRequire(import.meta.url)('playwright')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]])
    return acc
  }, []),
)
const shot = args.shot ?? '3'
const fps = Number(args.fps ?? 30)
const scale = Number(args.scale ?? 2)
const base = args.url ?? 'http://localhost:5173'
const outDir = path.resolve(args.out ?? 'reel-out')
const framesDir = path.join(outDir, `shot${shot}-frames`)
fs.mkdirSync(framesDir, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale })
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().startsWith('reel')) console.log('[page]', m.text())
})
await page.goto(`${base}/reel/?shot=${shot}`, { waitUntil: 'load' })
await page.evaluate(() => window.reel.ready)
const duration = await page.evaluate(() => window.reel.duration)
const stage = page.locator('#stage')

if (args.stills) {
  for (const s of String(args.stills).split(',').map(Number)) {
    await page.evaluate((t) => window.reel.seek(t), s)
    const file = path.join(outDir, `shot${shot}-t${s.toFixed(2)}.png`)
    await stage.screenshot({ path: file })
    console.log('still', file)
  }
  await browser.close()
  process.exit(0)
}

const from = Number(args.from ?? 0)
const to = Number(args.to ?? duration)
const n = Math.round((to - from) * fps)
const t0 = Date.now()
for (let i = 0; i <= n; i++) {
  const t = from + i / fps
  await page.evaluate((tt) => window.reel.seek(tt), t)
  await stage.screenshot({ path: path.join(framesDir, `f${String(i).padStart(5, '0')}.png`) })
  if (i % 30 === 0) {
    const el = (Date.now() - t0) / 1000
    console.log(`frame ${i}/${n}  t=${t.toFixed(2)}s  ${(el / (i + 1)).toFixed(2)}s/frame`)
  }
}
await browser.close()

const mp4 = path.join(outDir, `shot${shot}.mp4`)
execFileSync(
  'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'f%05d.png'),
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
    '-movflags', '+faststart',
    mp4,
  ],
  { stdio: 'inherit' },
)
console.log('wrote', mp4)
