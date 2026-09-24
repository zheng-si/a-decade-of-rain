// NACIS 2026 Map Gallery placard for A Decade of Rain.
//
// The gallery's digital entries hang as one 11 × 17 inch print with a 2 × 2 inch
// QR code in a corner; attendees scan it and open the map on their own phone.
// This script lays that print out as HTML in real inches, renders it with the
// site's own fonts through headless Chromium, and writes
//
//   out/placard-<variant>.pdf   vector text, embedded fonts, the shots as PNG
//   out/placard-<variant>.png   3300 × 5100 px, 300 dpi, for a JPEG upload
//   out/contact.png             the variants side by side, for choosing
//
// Three variants, same copy, same QR:
//   a       "product"  one portrait shot of the Atlas (3D flight tracks) nearly
//                      edge to edge under a masthead, the foot carrying the
//                      doors, the numbers, the QR
//   a-dots  "product"  the same sheet with the flat dot view
//   b       "framed"   a landscape shot of the Atlas in a hairline frame, two
//                      smaller shots under it (the Story's hook, the dot view)
//   final   the sheet as hand-tuned in Figma, rebuilt from final.layout.json
//           (the round trip of figma.mjs); the one submitted to the gallery
//
//   node poster/nacis-2026/build.mjs            # all
//   node poster/nacis-2026/build.mjs a-dots     # one
//
// Each render also writes out/placard-<variant>.layout.json: every text box,
// shot, the mark and the QR with their positions in inches and computed type,
// read back out of the rendered page. figma.mjs turns that into a Figma frame.
//
// The QR encodes URL (default https://rain.sizheng.me/): 25 × 25 modules at
// level M, so a module is 2.0 mm on the print and a phone reads it from a
// metre. The symbol is drawn as rectangles, not strokes, so no RIP thins it;
// and the build decodes it back out of the rendered PNG before it reports
// success. Quiet zone: paper for at least four modules on every side.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const OUT = path.join(HERE, 'out')
const SHOTS = path.join(HERE, 'shots')
const URL = process.env.URL || 'https://rain.sizheng.me/'
const CHROME = process.env.CHROME || findChrome()
const W = 11, H = 17 // inches
const DPI = 300

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort() : []
  for (const d of dirs.reverse()) {
    const p = path.join(root, d, 'chrome-linux', 'chrome')
    if (fs.existsSync(p)) return p
  }
  return chromium.executablePath()
}

/* ── the tokens (docs/design-tokens.tokens.json) ─────────────────────────── */
const C = {
  paper: '#faf9f4', ink: '#213528', inkSoft: '#4e6355', inkFaint: '#647468', rule: '#dfe3d9',
  accent: '#ff5449', accentDeep: '#cf3720', forest: '#213528',
}

/* ── copy ─────────────────────────────────────────────────────────────────── */
const COPY = {
  eyebrow: 'An interactive map · rain.sizheng.me',
  title: 'A Decade of Rain',
  subtitle: 'Agent Orange over South Vietnam, 1961–1971',
  dek: 'Between 1961 and 1971 the United States sprayed nearly 20 million gallons of herbicide over the forests, mangroves and croplands of South Vietnam. This site draws where it fell, run by run, from the HERBS file: the U.S. military’s own record of every mission.',
  doors: [
    ['The Story', 'A scroll-driven narrative in eight chapters, from the 1961 test sprays to the 1971 reckoning, over one heat field that fills in as you read.'],
    ['The Atlas', 'Every mission in the record: a playable decade, flight tracks weighted by gallons per kilometre, and a lookup by place or by HERBS mission number.'],
  ],
  // Every figure traces to README.md, measured at hea-v commit cb5948b.
  stats: [['19.5M', 'gallons'], ['9,141', 'missions'], ['24,604', 'records']],
  source: 'Source: the HERBS file of U.S. military herbicide missions, as republished in andrewstellman/hea-v (Stellman, Stellman, Christian, Weber & Tomasallo, Nature 422, 2003). Basemap OpenFreeMap · terrain AWS Terrain Tiles · MapLibre GL. Two static pages: no backend, no accounts, no analytics.',
  credit: 'Built on data & reporting from USAID · UNDP · U.S. National Archives',
  author: 'Si Zheng · design, code and cartography · sizheng.me · 2026',
  scan: 'Scan to open',
  url: 'rain.sizheng.me',
  urlNote: 'The Story at /, the Atlas at /archive. Works in any phone browser.',
  captions: {
    'atlas-3d': 'The Atlas, 3D view: flight tracks over the Rừng Sác mangroves south of Saigon, each run drawn where it was flown and weighted by gallons per kilometre.',
    'story-hero': 'The Story opens on the heat field of the whole decade.',
    'atlas-flat': 'The Atlas, flat view: sprayed volume binned to cells, dots sized by gallons and coloured by herbicide family.',
  },
}

/* ── the mark (src/components/Logo.tsx) ──────────────────────────────────── */
const LOGO_BARS = [[0, 2, 40], [13, 4, 60], [27, 6, 80], [40, 10, 100], [53, 14, 120], [70, 10, 100], [87, 6, 80], [103, 4, 60], [118, 2, 40]]
const logoSvg = (color) =>
  `<svg viewBox="0 0 120 120" fill="${color}" aria-hidden="true">${LOGO_BARS.map(([x, w, h]) => `<rect x="${x}" y="0" width="${w}" height="${h}"/>`).join('')}</svg>`

/* ── the QR, as rectangles ───────────────────────────────────────────────── */
function qrSvg(text, color) {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = q.modules.size
  const rects = []
  for (let y = 0; y < n; y++) {
    let x = 0
    while (x < n) {
      if (!q.modules.get(y, x)) { x++; continue }
      let x2 = x
      while (x2 < n && q.modules.get(y, x2)) x2++
      rects.push(`<rect x="${x}" y="${y}" width="${x2 - x}" height="1"/>`)
      x = x2
    }
  }
  return { n, version: q.version, svg: `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="${color}" role="img" aria-label="QR code: ${text}">${rects.join('')}</svg>` }
}

/* ── the page ────────────────────────────────────────────────────────────── */
function fontFaces() {
  const f = (p) => `../../../public/fonts/${p}`
  const geist = [300, 400, 500, 600].map((w) => `
@font-face{font-family:'Geist';font-weight:${w};src:url('${f(`ui/Geist-${w}.woff2`)}') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Geist';font-weight:${w};src:url('${f(`ui/Geist-latin-ext-${w}.woff2`)}') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Geist';font-weight:${w};src:url('${f(`ui/Geist-vietnamese-${w}.woff2`)}') format('woff2');unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}`).join('')
  return `${geist}
@font-face{font-family:'Courier Prime';font-weight:400;src:url('${f('mono/CourierPrime-Regular.woff2')}') format('woff2')}
@font-face{font-family:'Courier Prime';font-weight:700;src:url('${f('mono/CourierPrime-Bold.woff2')}') format('woff2')}
@font-face{font-family:'Playfair Display';font-weight:400 900;src:url('${f('serif/PlayfairDisplay-var.woff2')}') format('woff2')}`
}

const css = `
${fontFaces()}
@page { size: ${W}in ${H}in; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: ${W}in; height: ${H}in; background: ${C.paper}; color: ${C.ink};
  font-family: 'Geist', system-ui, sans-serif; font-weight: 300; font-size: 10pt; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: lining-nums; overflow: hidden }
.sheet { position: relative; width: ${W}in; height: ${H}in; overflow: hidden }
.abs { position: absolute }
.mono { font-family: 'Courier Prime', 'Courier New', monospace; font-weight: 400 }
.caps { font-weight: 600; font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.inkSoft} }
.eyebrow { font-weight: 500; font-size: 8pt; letter-spacing: 0.1em; text-transform: uppercase; color: ${C.inkSoft} }
.title { font-family: 'Courier Prime', monospace; text-transform: uppercase; font-weight: 400; line-height: 1.02; color: ${C.ink}; letter-spacing: 0 }
.sub { font-family: 'Courier Prime', monospace; font-weight: 400; color: ${C.ink}; line-height: 1.25 }
.dek { font-weight: 300; color: ${C.ink}; line-height: 1.58 }
.mark { color: ${C.accent} }
.mark svg { width: 100%; height: 100% }
.door h3 { font-weight: 600; font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.ink}; margin-bottom: 0.04in }
.door p { font-weight: 300; font-size: 9.25pt; line-height: 1.5; color: ${C.inkSoft} }
.stats { display: flex; gap: 0.32in }
.stat b { display: block; font-family: 'Courier Prime', monospace; font-weight: 400; font-size: 20pt; line-height: 1.05; color: ${C.accentDeep} }
.stat span { display: block; font-weight: 400; font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.inkSoft}; margin-top: 0.05in }
.fine { font-weight: 300; font-size: 7pt; line-height: 1.5; color: ${C.inkFaint} }
.fine b { font-weight: 500; color: ${C.inkSoft} }
.cap { font-weight: 300; font-size: 7pt; line-height: 1.45; color: ${C.inkFaint} }
.shot { overflow: hidden; background: #eef0ea }
.shot img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top }
.frame { border: 1px solid ${C.rule}; box-shadow: 0 1px 0 rgba(33,53,40,0.06) }
.qr { width: 2in; height: 2in }
.qr svg { display: block; width: 100%; height: 100% }
.scan { text-align: right }
.scan .caps { color: ${C.ink} }
.scan .url { font-family: 'Courier Prime', monospace; font-weight: 400; font-size: 11.5pt; color: ${C.ink}; line-height: 1.3; margin-top: 0.03in }
.scan .note { font-weight: 300; font-size: 7pt; color: ${C.inkFaint}; line-height: 1.45; margin-top: 0.03in }
.rule { border-top: 1px solid ${C.rule} }
`

function head({ x, y, w, titlePt, subPt, dekPt, dekW, markIn }) {
  return `
  <div class="abs mark" style="left:${x}in;top:${y}in;width:${markIn}in;height:${markIn}in">${logoSvg(C.accent)}</div>
  <div class="abs eyebrow" style="left:${x + markIn + 0.16}in;top:${y + 0.02}in">${COPY.eyebrow}</div>
  <div class="abs title" style="left:${x + markIn + 0.16}in;top:${y + 0.22}in;font-size:${titlePt}pt">${COPY.title}</div>
  <div class="abs sub" style="left:${x + markIn + 0.16}in;top:${y + 0.22 + titlePt / 72 * 1.02 + 0.1}in;font-size:${subPt}pt">${COPY.subtitle}</div>
  <div class="abs dek" style="left:${x}in;top:${y + 0.22 + titlePt / 72 * 1.02 + 0.1 + subPt / 72 * 1.25 + 0.2}in;width:${dekW}in;font-size:${dekPt}pt">${COPY.dek}</div>`
}

function doors({ x, y, w, gap }) {
  const cw = (w - gap) / 2
  return COPY.doors.map(([h, p], i) => `
  <div class="abs door" style="left:${x + i * (cw + gap)}in;top:${y}in;width:${cw}in"><h3>${h}</h3><p>${p}</p></div>`).join('')
}

function stats({ x, y }) {
  return `<div class="abs stats" style="left:${x}in;top:${y}in">${COPY.stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('')}</div>`
}

function foot({ x, y, w }) {
  // One element per line, so the layout export sees each as its own text box.
  return `
  <div class="abs fine" style="left:${x}in;top:${y}in;width:${w}in">${COPY.source}</div>
  <div class="abs fine" style="left:${x}in;top:${y + 0.62}in;width:${w}in"><b>${COPY.credit}</b></div>
  <div class="abs fine" style="left:${x}in;top:${y + 0.62 + 0.146}in;width:${w}in">${COPY.author}</div>`
}

function qrBlock({ right, bottom, qr }) {
  // The symbol sits 2 in square in the corner; the caption stands to its left,
  // outside the quiet zone (0.35 in of paper around the symbol).
  const qx = W - right - 2, qy = H - bottom - 2
  return `
  <div class="abs qr" style="left:${qx}in;top:${qy}in">${qr.svg}</div>
  <div class="abs scan" style="left:${qx - 3.2}in;top:${qy + 0.98}in;width:2.85in">
    <div class="caps">${COPY.scan}</div>
    <div class="url">${COPY.url}</div>
    <div class="note">${COPY.urlNote}</div>
  </div>`
}

function shot(name, { x, y, w, h, frame = false }) {
  return `<div class="abs shot${frame ? ' frame' : ''}" style="left:${x}in;top:${y}in;width:${w}in;height:${h}in"><img src="../shots/${name}.png" alt=""></div>`
}

/** The variants: a layout and, for A, which portrait shot fills it. */
const VARIANTS = {
  a: { layout: 'a', shot: 'atlas-3d-square', label: 'product, the 3D flight tracks' },
  'a-dots': { layout: 'a', shot: 'atlas-flat-square', label: 'product, the flat dot view' },
  b: { layout: 'b', label: 'framed shot with two insets' },
  // The sheet as the designer tuned it by hand in Figma (23 September 2026),
  // read back as boxes in inches: final.layout.json is the source, not this
  // file's layout code. The one that goes to the gallery.
  final: { layout: 'file', file: 'final.layout.json', label: 'the Figma-tuned sheet, the one submitted' },
}
const layoutFile = (v) => JSON.parse(fs.readFileSync(path.join(HERE, VARIANTS[v].file), 'utf8'))
const shotsFor = (v) =>
  VARIANTS[v].layout === 'a' ? [VARIANTS[v].shot]
  : VARIANTS[v].layout === 'file' ? [...new Set(layoutFile(v).nodes.filter((n) => n.type === 'image').map((n) => n.name.replace(/\.png$/, '')))]
  : ['atlas-3d-wide', 'story-hero', 'atlas-flat']

function variantA(qr, shotName) {
  const M = 0.35
  return `
  ${head({ x: M + 0.1, y: 0.42, w: W - 2 * M, titlePt: 46, subPt: 16, dekPt: 10.5, dekW: 10.1, markIn: 0.52 })}
  ${shot(shotName, { x: M, y: 2.62, w: W - 2 * M, h: (W - 2 * M) * (3390 / 3300), frame: true })}
  ${doors({ x: M + 0.1, y: 13.5, w: 6.9, gap: 0.3 })}
  ${stats({ x: M + 0.1, y: 14.62 })}
  ${foot({ x: M + 0.1, y: 15.42, w: 6.9 })}
  ${qrBlock({ right: M + 0.1, bottom: M + 0.1, qr })}`
}

function variantB(qr) {
  const M = 0.5
  const cw = W - 2 * M
  const mainH = cw * (2000 / 3200)
  const insetW = (cw - 0.3) / 2, insetH = insetW * (900 / 1200) * 0.86
  const yMain = 2.72, yIns = yMain + mainH + 0.42
  return `
  ${head({ x: M, y: 0.5, w: cw, titlePt: 40, subPt: 15, dekPt: 10, dekW: cw, markIn: 0.46 })}
  ${shot('atlas-3d-wide', { x: M, y: yMain, w: cw, h: mainH, frame: true })}
  <div class="abs cap" style="left:${M}in;top:${yMain + mainH + 0.08}in;width:${cw}in">${COPY.captions['atlas-3d']}</div>
  ${shot('story-hero', { x: M, y: yIns, w: insetW, h: insetH, frame: true })}
  <div class="abs cap" style="left:${M}in;top:${yIns + insetH + 0.07}in;width:${insetW}in">${COPY.captions['story-hero']}</div>
  ${shot('atlas-flat', { x: M + insetW + 0.3, y: yIns, w: insetW, h: insetH, frame: true })}
  <div class="abs cap" style="left:${M + insetW + 0.3}in;top:${yIns + insetH + 0.07}in;width:${insetW}in">${COPY.captions['atlas-flat']}</div>
  ${doors({ x: M, y: yIns + insetH + 0.42, w: 6.7, gap: 0.3 })}
  ${stats({ x: M, y: yIns + insetH + 1.58 })}
  ${foot({ x: M, y: yIns + insetH + 2.42, w: 6.7 })}
  ${qrBlock({ right: M, bottom: M, qr })}`
}

/** Figma's style names to the weights the web fonts ship. */
const WEIGHT = { Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 }

/** A sheet from a layout file: each box placed where it was measured. A box
 *  that was auto-width in Figma is set nowrap here so the browser cannot
 *  wrap it either; a fixed or auto-height box keeps its width and wraps. */
function variantFromLayout(L, qr) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return L.nodes.map((n) => {
    if (n.type === 'image') return shot(n.name.replace(/\.png$/, ''), { x: n.x, y: n.y, w: n.w, h: n.h, frame: n.framed })
    if (n.type === 'svg' && n.name === 'mark') return `<div class="abs mark" style="left:${n.x}in;top:${n.y}in;width:${n.w}in;height:${n.h}in">${logoSvg(C.accent)}</div>`
    if (n.type === 'svg' && n.name === 'qr') return `<div class="abs qr" style="left:${n.x}in;top:${n.y}in;width:${n.w}in;height:${n.h}in">${qr.svg}</div>`
    const weight = WEIGHT[n.style] ?? 400
    const single = n.resize === 'WIDTH_AND_HEIGHT'
    const family = n.family === 'Courier Prime' ? "'Courier Prime', monospace" : "'Geist', system-ui, sans-serif"
    const style = [
      `left:${n.x}in`, `top:${n.y}in`, `width:${n.w + (single ? 0.1 : 0.02)}in`,
      `font-family:${family}`, `font-weight:${weight}`, `font-size:${n.sizePt}pt`,
      `line-height:${n.lineHeight === 'auto' ? 1.2 : n.lineHeight}`, `letter-spacing:${n.letterSpacing}em`,
      `text-transform:${n.transform}`, `text-align:${n.align}`, `color:${n.color}`,
      single ? 'white-space:nowrap' : '',
    ].join(';')
    return `<div class="abs" style="${style}">${esc(n.text)}</div>`
  }).join('\n')
}

function html(variant, qr) {
  const body = VARIANTS[variant].layout === 'file' ? variantFromLayout(layoutFile(variant), qr)
    : VARIANTS[variant].layout === 'a' ? variantA(qr, VARIANTS[variant].shot) : variantB(qr)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A Decade of Rain · NACIS 2026 placard ${variant.toUpperCase()}</title><style>${css}</style></head><body><div class="sheet">${body}</div></body></html>`
}

/* ── render ──────────────────────────────────────────────────────────────── */
async function render(browser, variant, qr) {
  const file = path.join(OUT, `placard-${variant}.html`)
  fs.writeFileSync(file, html(variant, qr))
  const ctx = await browser.newContext({ viewport: { width: W * 96, height: H * 96 }, deviceScaleFactor: DPI / 96 })
  const page = await ctx.newPage()
  await page.goto('file://' + file, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  // Every family the sheet actually sets must have loaded; a declared face the
  // sheet never uses stays unloaded and must not fail the check.
  const fonts = await page.evaluate(() => {
    const used = new Set()
    for (const el of document.querySelectorAll('.sheet *'))
      if (el.childElementCount === 0 && el.textContent.trim()) used.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim())
    return [...used].map((f) => [f, document.fonts.check(`12px "${f}"`)])
  })
  for (const [f, ok] of fonts) if (!ok) throw new Error(`font not loaded: ${f}`)
  await page.waitForTimeout(500)
  fs.writeFileSync(path.join(OUT, `placard-${variant}.layout.json`), JSON.stringify(await measure(page, variant), null, 1))
  const png = path.join(OUT, `placard-${variant}.png`)
  await page.screenshot({ path: png })
  const pdf = path.join(OUT, `placard-${variant}.pdf`)
  await page.pdf({ path: pdf, width: `${W}in`, height: `${H}in`, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  await ctx.close()
  return { png, pdf }
}

/** The sheet as placed boxes, read back out of the rendered page: every leaf
 *  text element with its computed type, the shots, the mark and the QR, all in
 *  inches from the top-left corner. This is what the Figma export consumes, so
 *  the frame there is the print, not a re-layout of it. */
async function measure(page, variant) {
  const nodes = await page.evaluate(() => {
    const IN = 96
    const out = []
    const leaf = (el) => el.childElementCount === 0 || [...el.children].every((c) => c.tagName === 'BR')
    for (const el of document.querySelectorAll('.sheet *')) {
      if (el.closest('svg')) continue
      const r = el.getBoundingClientRect()
      if (el.classList.contains('shot')) {
        out.push({ type: 'image', name: el.querySelector('img').getAttribute('src').replace(/^.*\//, ''), x: r.x / IN, y: r.y / IN, w: r.width / IN, h: r.height / IN, framed: el.classList.contains('frame') })
        continue
      }
      if (el.classList.contains('qr') || el.classList.contains('mark')) {
        out.push({ type: 'svg', name: el.classList.contains('qr') ? 'qr' : 'mark', x: r.x / IN, y: r.y / IN, w: r.width / IN, h: r.height / IN, svg: el.innerHTML.trim() })
        continue
      }
      if (!leaf(el) || !el.textContent.trim()) continue
      const cs = getComputedStyle(el)
      const px = parseFloat(cs.fontSize)
      out.push({
        type: 'text', x: r.x / IN, y: r.y / IN, w: r.width / IN, h: r.height / IN,
        text: el.innerText,
        family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
        sizePt: (px * 72) / IN, weight: +cs.fontWeight,
        lineHeight: cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / px,
        letterSpacing: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / px,
        transform: cs.textTransform, align: cs.textAlign, color: cs.color,
      })
    }
    return out
  })
  return { variant, widthIn: W, heightIn: H, dpi: DPI, background: C.paper, nodes }
}

/** Read the QR back out of the rendered PNG. `box` is the symbol's box in
 *  inches when the layout knows it; otherwise the bottom-right 3 × 3 inches,
 *  where the hand-laid variants keep it. Half an inch of the sheet around the
 *  symbol goes in too, so the check sees the quiet zone the print will have. */
function verifyQr(pngPath, box) {
  const img = PNG.sync.read(fs.readFileSync(pngPath))
  const pad = 0.5 * DPI
  let x0, y0, w, h
  if (box) {
    x0 = Math.max(0, Math.round(box.x * DPI - pad)); y0 = Math.max(0, Math.round(box.y * DPI - pad))
    w = Math.min(img.width - x0, Math.round(box.w * DPI + 2 * pad)); h = Math.min(img.height - y0, Math.round(box.h * DPI + 2 * pad))
  } else {
    w = h = 3 * DPI; x0 = img.width - w; y0 = img.height - h
  }
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const src = ((y0 + y) * img.width + x0) * 4
    data.set(img.data.subarray(src, src + w * 4), y * w * 4)
  }
  const hit = jsQR(data, w, h)
  return hit ? hit.data : null
}

async function contact(browser, variants) {
  const cards = variants.map((v) => `<figure><img src="placard-${v}.png"><figcaption>${v.toUpperCase()} · ${VARIANTS[v].label}</figcaption></figure>`).join('')
  const file = path.join(OUT, 'contact.html')
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#3a3a3a;font:13px Geist,system-ui;color:#ddd;display:flex;gap:40px;padding:40px}figure{margin:0}img{display:block;width:560px;box-shadow:0 8px 30px rgba(0,0,0,.6)}figcaption{margin-top:12px}</style>${cards}`)
  const ctx = await browser.newContext({ viewport: { width: 40 + variants.length * 600, height: 940 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto('file://' + file, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(OUT, 'contact.png') })
  await ctx.close()
}

const variants = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTS)
fs.mkdirSync(OUT, { recursive: true })
for (const v of variants) {
  if (!VARIANTS[v]) throw new Error(`no variant ${v}; have ${Object.keys(VARIANTS).join(', ')}`)
  for (const s of shotsFor(v)) if (!fs.existsSync(path.join(SHOTS, `${s}.png`))) throw new Error(`missing shots/${s}.png: run capture.mjs first`)
}

const qr = qrSvg(URL, C.ink)
console.log(`QR: ${URL} → version ${qr.version}, ${qr.n}×${qr.n} modules, ${(50.8 / qr.n).toFixed(2)} mm per module at 2 in`)
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] })
try {
  for (const v of variants) {
    const { png, pdf } = await render(browser, v, qr)
    const qrBox = VARIANTS[v].layout === 'file' ? layoutFile(v).nodes.find((n) => n.type === 'svg' && n.name === 'qr') : null
    const decoded = verifyQr(png, qrBox)
    const mb = (p) => (fs.statSync(p).size / 1048576).toFixed(1) + ' MB'
    console.log(`${v}: ${path.basename(pdf)} ${mb(pdf)} · ${path.basename(png)} ${mb(png)} · QR reads back as ${decoded === URL ? 'the URL, verified' : `"${decoded}" — MISMATCH`}`)
    if (decoded !== URL) process.exitCode = 1
  }
  await contact(browser, variants)
} finally {
  await browser.close()
}
