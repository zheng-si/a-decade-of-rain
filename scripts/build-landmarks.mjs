// Builds public/data/landmarks.geojson — the real boundary outlines a few story
// nodes highlight as their "representative area":
//   - Cà Mau        → province boundary (from the existing provinces.geojson, ADM1)
//   - A Lưới        → district boundary (geoBoundaries VNM ADM2) — the admin unit
//                     that contains the A Sầu valley (the valley itself has none)
//
// Point landmarks (no authoritative boundary, or a boundary that reads poorly at
// the node's zoom — War Zone C/D, the Iron Triangle, Biên Hòa airbase) are not
// here; they're marked inline in content/facts/events.ts.
//
// Run: node scripts/build-landmarks.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ADM2_CACHE = join(__dirname, '.cache', 'vnadm2.json')
const ADM2_URL =
  'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/VNM/ADM2/geoBoundaries-VNM-ADM2.geojson'

const round = (n) => Math.round(n * 1000) / 1000

// Douglas–Peucker — thin dense source rings to a light outline (geoBoundaries
// ADM2 ships full-resolution). eps is in degrees (~0.0018° ≈ 200 m).
function simplify(ring, eps = 0.0018) {
  if (ring.length < 5) return ring
  const sqSegDist = (p, a, b) => {
    let [x, y] = a
    let dx = b[0] - x
    let dy = b[1] - y
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) [x, y] = b
      else if (t > 0) { x += dx * t; y += dy * t }
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2
  }
  const dp = (pts, first, last, out) => {
    let maxSq = eps * eps
    let idx = -1
    for (let i = first + 1; i < last; i++) {
      const sq = sqSegDist(pts[i], pts[first], pts[last])
      if (sq > maxSq) { idx = i; maxSq = sq }
    }
    if (idx === -1) return
    dp(pts, first, idx, out)
    out.push(pts[idx])
    dp(pts, idx, last, out)
  }
  const out = [ring[0]]
  dp(ring, 0, ring.length - 1, out)
  out.push(ring[ring.length - 1])
  return out
}

const roundRing = (r) => simplify(r).map(([x, y]) => [round(x), round(y)])
const roundRings = (poly) => poly.map(roundRing)
const roundGeom = (g) =>
  g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: roundRings(g.coordinates) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map(roundRings) }

const norm = (s) => (s || '').normalize('NFC').trim()
// Diacritic-insensitive key so "A Lưới" and geoBoundaries' ASCII "A Luoi" match.
const deburr = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()

async function loadAdm2() {
  if (existsSync(ADM2_CACHE)) return JSON.parse(await readFile(ADM2_CACHE, 'utf8'))
  const resp = await fetch(ADM2_URL)
  if (!resp.ok) throw new Error(`ADM2 fetch failed: ${resp.status}`)
  const txt = await resp.text()
  await mkdir(dirname(ADM2_CACHE), { recursive: true })
  await writeFile(ADM2_CACHE, txt)
  return JSON.parse(txt)
}

async function main() {
  const features = []

  // Cà Mau — from the province set we already ship.
  const provinces = JSON.parse(await readFile(join(ROOT, 'public/data/provinces.geojson'), 'utf8'))
  const caMau = provinces.features.find((f) => norm(f.properties.name) === norm('Cà Mau'))
  if (!caMau) throw new Error('Cà Mau not found in provinces.geojson')
  features.push({
    type: 'Feature',
    properties: { id: 'ca-mau', name: 'Cà Mau', kind: 'province' },
    geometry: roundGeom(caMau.geometry),
  })

  // A Lưới — district (ADM2) containing the A Sầu valley.
  const adm2 = await loadAdm2()
  const aLuoi = adm2.features.find((f) => deburr(f.properties.shapeName) === 'a luoi')
  if (!aLuoi) throw new Error('A Lưới (A Luoi) not found in ADM2')
  features.push({
    type: 'Feature',
    properties: { id: 'a-luoi', name: 'A Lưới', kind: 'district' },
    geometry: roundGeom(aLuoi.geometry),
  })

  const out = { type: 'FeatureCollection', features }
  await writeFile(join(ROOT, 'public/data/landmarks.geojson'), JSON.stringify(out))
  for (const f of features) {
    const g = f.geometry
    const n =
      g.type === 'Polygon'
        ? g.coordinates.reduce((s, r) => s + r.length, 0)
        : g.coordinates.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0)
    console.log(`  ${f.properties.id.padEnd(18)} ${f.properties.name}  (${g.type}, ${n} pts)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
