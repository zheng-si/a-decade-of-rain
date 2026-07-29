/**
 * build-glyphs.mjs — generate SDF glyph PBFs for the map's custom label font.
 *
 * MapLibre renders labels from SDF glyph PBFs, not CSS fonts. OpenFreeMap only
 * serves Noto/Metropolis, so to label the map in the project font we
 * self-host its glyphs and point mapConfig.glyphsUrl at them.
 *
 * Public Sans (USWDS, OFL) natively covers Vietnamese, so map labels and UI
 * text share one face with no mixed letterforms. Each range is still
 * COMPOSITED with Noto Sans as a safety net: any codepoint the primary font
 * lacks is filled from Noto instead of being silently dropped by MapLibre.
 *
 * Output: public/fonts/<stack>/<lo>-<hi>.pbf — ranges 0..8447 (Latin world +
 * Vietnamese). Scripts neither font contains (e.g. CJK) simply render blank.
 *
 * Run:  npm run build:glyphs   (needs the `fontnik` dev dependency;
 *       `pbf` comes with maplibre-gl)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fontnik from 'fontnik'
import Pbf from 'pbf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Primary font + the fallback that fills its gaps.
const FONTS = [
  { file: 'fonts/PublicSans-Medium.ttf', fallback: 'fonts/NotoSans-Medium.ttf', stack: 'Public Sans Medium' },
  { file: 'fonts/Westgate-Regular.otf', fallback: 'fonts/NotoSans-Medium.ttf', stack: 'Westgate' },
]

const LAST_RANGE = 32 // ranges 0..32 → codepoints 0–8447 (Latin + Vietnamese)

function range(font, start, end) {
  return new Promise((resolve, reject) => {
    fontnik.range({ font, start, end }, (err, res) => (err ? reject(err) : resolve(res)))
  })
}

// ── minimal glyphs.proto codec (same schema fontnik emits) ────────────────
// glyphs { repeated fontstack stacks = 1 }
// fontstack { name = 1; range = 2; repeated glyph glyphs = 3 }
// glyph { id = 1; bitmap = 2; width = 3; height = 4; left = 5; top = 6; advance = 7 }
function decodeStack(buffer) {
  const out = { name: '', range: '', glyphs: [] }
  new Pbf(buffer).readFields((tag, _, pbf) => {
    if (tag !== 1) return
    pbf.readMessage((t, __, p) => {
      if (t === 1) out.name = p.readString()
      else if (t === 2) out.range = p.readString()
      else if (t === 3) {
        const g = { id: 0, bitmap: null, width: 0, height: 0, left: 0, top: 0, advance: 0 }
        p.readMessage((gt, ___, gp) => {
          if (gt === 1) g.id = gp.readVarint()
          else if (gt === 2) g.bitmap = gp.readBytes()
          else if (gt === 3) g.width = gp.readVarint()
          else if (gt === 4) g.height = gp.readVarint()
          else if (gt === 5) g.left = gp.readSVarint()
          else if (gt === 6) g.top = gp.readSVarint()
          else if (gt === 7) g.advance = gp.readVarint()
        }, g)
        out.glyphs.push(g)
      }
    }, out)
  })
  return out
}

function encodeStack(stack) {
  const pbf = new Pbf()
  pbf.writeMessage(
    1,
    (s, p) => {
      p.writeStringField(1, s.name)
      p.writeStringField(2, s.range)
      for (const g of s.glyphs) {
        p.writeMessage(
          3,
          (gl, gp) => {
            gp.writeVarintField(1, gl.id)
            if (gl.bitmap != null) gp.writeBytesField(2, gl.bitmap)
            gp.writeVarintField(3, gl.width)
            gp.writeVarintField(4, gl.height)
            gp.writeSVarintField(5, gl.left)
            gp.writeSVarintField(6, gl.top)
            gp.writeVarintField(7, gl.advance)
          },
          g,
        )
      }
    },
    stack,
  )
  return Buffer.from(pbf.finish())
}

/** Primary-font glyphs win; the fallback fills every id the primary lacks. */
function composite(primaryBuf, fallbackBuf) {
  const a = decodeStack(primaryBuf)
  const b = decodeStack(fallbackBuf)
  const have = new Set(a.glyphs.map((g) => g.id))
  let filled = 0
  for (const g of b.glyphs) {
    if (!have.has(g.id)) {
      a.glyphs.push(g)
      filled++
    }
  }
  a.glyphs.sort((x, y) => x.id - y.id)
  return { buf: encodeStack(a), filled }
}

async function main() {
  for (const { file, fallback, stack } of FONTS) {
    const buf = await readFile(join(__dirname, file))
    const fbBuf = await readFile(join(__dirname, fallback))
    const outDir = join(ROOT, 'public', 'fonts', stack)
    await mkdir(outDir, { recursive: true })
    let filled = 0
    for (let i = 0; i <= LAST_RANGE; i++) {
      const start = i * 256
      const end = start + 255
      const primary = await range(buf, start, end)
      const fb = await range(fbBuf, start, end)
      const merged = composite(primary, fb)
      filled += merged.filled
      await writeFile(join(outDir, `${start}-${end}.pbf`), merged.buf)
    }
    console.log(`✓ ${stack}: ${LAST_RANGE + 1} ranges → public/fonts/${stack}/ (+${filled} fallback glyphs)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
