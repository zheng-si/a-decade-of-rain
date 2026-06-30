/**
 * build-glyphs.mjs — generate SDF glyph PBFs for the map's custom label font.
 *
 * MapLibre renders labels from SDF glyph PBFs, not CSS fonts. OpenFreeMap only
 * serves Noto/Metropolis, so to label the map in Switzer we self-host its
 * glyphs and point mapConfig.glyphsUrl at them.
 *
 * Source font: Switzer (Indian Type Foundry / Fontshare, free for commercial
 * use). Output: public/fonts/<stack>/<lo>-<hi>.pbf
 *
 * We emit the Latin world + Vietnamese ranges (0..8447), which covers every
 * Vietnamese place name plus neighbouring romanised labels. Scripts Switzer
 * doesn't contain (e.g. CJK) simply render blank — the romanised name remains.
 *
 * Run:  npm run build:glyphs   (needs the `fontnik` dev dependency)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fontnik from 'fontnik'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// [ttf source, fontstack name as it appears in mapConfig.theme.label.font]
const FONTS = [{ file: 'fonts/Switzer-Medium.ttf', stack: 'Switzer Medium' }]

const LAST_RANGE = 32 // ranges 0..32 → codepoints 0–8447 (Latin + Vietnamese)

function range(font, start, end) {
  return new Promise((resolve, reject) => {
    fontnik.range({ font, start, end }, (err, res) => (err ? reject(err) : resolve(res)))
  })
}

async function main() {
  for (const { file, stack } of FONTS) {
    const buf = await readFile(join(__dirname, file))
    const outDir = join(ROOT, 'public', 'fonts', stack)
    await mkdir(outDir, { recursive: true })
    for (let i = 0; i <= LAST_RANGE; i++) {
      const start = i * 256
      const end = start + 255
      const pbf = await range(buf, start, end)
      await writeFile(join(outDir, `${start}-${end}.pbf`), pbf)
    }
    console.log(`✓ ${stack}: ${LAST_RANGE + 1} glyph ranges → public/fonts/${stack}/`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
