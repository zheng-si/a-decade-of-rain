import { createRequire } from 'module'
const S = process.env.S
const require = createRequire(`${S}/wt/poster/scripts/package.json`)
const { chromium } = require('playwright-core')
const [src, dst] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const p = await b.newPage()
await p.goto('file://' + src, { waitUntil: 'networkidle' })
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(800)
await p.pdf({ path: dst, preferCSSPageSize: true, printBackground: true })
await b.close()
