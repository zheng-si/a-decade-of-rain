// Builds docs/design-system.html from docs/design-system.src.html.
//
// The page is a specimen of the design system, so it has to be set in the
// system's real faces — which means the faces travel with it. This inlines
// them as base64 @font-face rules at the `/*FONTS*/` marker and wraps the
// fragment in a document, so the result opens from a file:// URL with no
// server, no network and no silent fallback to Georgia.
//
//   node scripts/build-design-system-doc.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Latin subsets only: the page's copy is English, and the vietnamese and
// latin-ext subsets would roughly triple the payload for glyphs it never sets.
// Gambarino is retired from --font-serif (see src/fonts.css) and this page
// never renders it, so it is deliberately not embedded here.
const FACES = [
  ['Public Sans', 300, 'public/fonts/ui/PublicSans-Light.woff2'],
  ['Public Sans', 400, 'public/fonts/ui/PublicSans-Regular.woff2'],
  ['Public Sans', 500, 'public/fonts/ui/PublicSans-Medium.woff2'],
  ['Playfair Display', 400, 'public/fonts/serif/playfair-display-latin-400-normal.woff2'],
  ['Playfair Display', 500, 'public/fonts/serif/playfair-display-latin-500-normal.woff2'],
]

const fonts = FACES.map(([family, weight, file]) => {
  const b64 = readFileSync(join(root, file)).toString('base64')
  return (
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
    `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`
  )
}).join('\n')

const src = readFileSync(join(root, 'docs/design-system.src.html'), 'utf8')
if (!src.includes('/*FONTS*/')) {
  throw new Error('docs/design-system.src.html no longer has the /*FONTS*/ marker')
}

// The source is a fragment (no document skeleton) so the same file can be
// published as an artifact, which supplies its own wrapper.
const filled = src.replace('/*FONTS*/', fonts)
const cut = filled.indexOf('</style>') + '</style>'.length
const html =
  '<!doctype html>\n<html lang="en">\n<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  filled.slice(0, cut) +
  '\n</head>\n<body>' +
  filled.slice(cut) +
  '\n</body>\n</html>\n'

writeFileSync(join(root, 'docs/design-system.html'), html)
console.log(`docs/design-system.html — ${(html.length / 1024).toFixed(0)} KB`)
