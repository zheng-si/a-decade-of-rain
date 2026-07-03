/**
 * build-regions.mjs — one-time ETL for province borders + the four Corps
 * Tactical Zones (Military Regions I–IV) of South Vietnam.
 *
 * Source: geoBoundaries VNM ADM1 (Open, CC-BY 4.0), 64 modern provinces.
 * We emit two static assets:
 *   - public/data/provinces.geojson       — all province outlines (context)
 *   - public/data/military-regions.geojson — 4 dissolved MR polygons + labels
 *
 * The MR ⇄ province mapping follows the standard 1960s CTZ province groupings,
 * mapped onto today's provinces (close, though not pixel-identical to the old
 * boundaries). Provinces north of the DMZ have no MR and are dropped from it.
 *
 * Run:  node scripts/build-regions.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import polygonClipping from 'polygon-clipping'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE = join(__dirname, '.cache', 'vnadm1.json')
const ADM1_URL =
  'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/VNM/ADM1/geoBoundaries-VNM-ADM1_simplified.geojson'

// Corps Tactical Zone (Military Region) → member provinces (modern names).
const MR = {
  1: ['Quảng Trị', 'Thừa Thiên Huế', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi'],
  2: ['Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận'],
  3: ['Bình Phước', 'Bình Dương', 'Tây Ninh', 'Đồng Nai', 'Bà Rịa–Vũng Tàu', 'Ho Chi Minh', 'Long An'],
  4: ['Tiền Giang', 'Bến Tre', 'Vĩnh Long', 'Trà Vinh', 'Đồng Tháp', 'An Giang', 'Kiên Giang', 'Cần Thơ', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'],
}
const MR_LABEL = { 1: 'Military Region I', 2: 'Military Region II', 3: 'Military Region III', 4: 'Military Region IV' }
// Manual label placements — the auto centroid can land on a crowded spot. MR III's
// centroid sits over the dense Saigon / Biên Hòa cluster (and its test-spray pin),
// so nudge it northwest into the open Bình Dương / Tây Ninh area.
const MR_LABEL_OVERRIDE = { 3: [106.35, 11.6] }

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
const round = (n) => Number(n.toFixed(3))
const roundRings = (rings) => rings.map((r) => r.map((p) => [round(p[0]), round(p[1])]))
const roundGeom = (g) =>
  g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: roundRings(g.coordinates) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map(roundRings) }

// GeoJSON geometry → polygon-clipping "MultiPolygon" (array of polygons).
const toMulti = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

function labelPoint(multi) {
  // Representative point: centroid of the largest ring's vertices.
  let best = null
  let bestArea = -1
  for (const poly of multi) {
    const ring = poly[0]
    let a = 0
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    a = Math.abs(a)
    if (a > bestArea) {
      bestArea = a
      best = ring
    }
  }
  let x = 0
  let y = 0
  for (const p of best) {
    x += p[0]
    y += p[1]
  }
  return [round(x / best.length), round(y / best.length)]
}

async function load() {
  if (existsSync(CACHE)) return JSON.parse(await readFile(CACHE, 'utf8'))
  const resp = await fetch(ADM1_URL)
  if (!resp.ok) throw new Error(`ADM1 fetch failed: ${resp.status}`)
  const txt = await resp.text()
  await mkdir(dirname(CACHE), { recursive: true })
  await writeFile(CACHE, txt)
  return JSON.parse(txt)
}

async function main() {
  const adm1 = await load()
  const byName = new Map()
  for (const f of adm1.features) byName.set(norm(f.properties.shapeName), f)

  // 1) province outlines (all provinces, geometry rounded)
  const provinces = {
    type: 'FeatureCollection',
    features: adm1.features.map((f) => ({
      type: 'Feature',
      properties: { name: norm(f.properties.shapeName) },
      geometry: roundGeom(f.geometry),
    })),
  }
  await writeFile(join(ROOT, 'public/data/provinces.geojson'), JSON.stringify(provinces))

  // 2) dissolve each MR's provinces into one polygon
  const regionFeatures = []
  const labelFeatures = []
  const missing = []
  for (const z of [1, 2, 3, 4]) {
    const geoms = []
    for (const name of MR[z]) {
      const f = byName.get(norm(name))
      if (!f) {
        missing.push(name)
        continue
      }
      geoms.push(toMulti(f.geometry))
    }
    const unioned = polygonClipping.union(geoms[0], ...geoms.slice(1)) // MultiPolygon
    const geom = { type: 'MultiPolygon', coordinates: unioned }
    regionFeatures.push({ type: 'Feature', properties: { mr: z, name: MR_LABEL[z] }, geometry: roundGeom(geom) })
    labelFeatures.push({
      type: 'Feature',
      properties: { mr: z, name: MR_LABEL[z] },
      geometry: { type: 'Point', coordinates: MR_LABEL_OVERRIDE[z] ?? labelPoint(unioned) },
    })
  }
  await writeFile(
    join(ROOT, 'public/data/military-regions.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: regionFeatures }),
  )
  await writeFile(
    join(ROOT, 'public/data/military-region-labels.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: labelFeatures }),
  )

  if (missing.length) console.warn('⚠ provinces not found in ADM1:', missing.join(', '))
  console.log('✓ provinces:', provinces.features.length)
  for (const f of regionFeatures) {
    const nPoly = f.geometry.coordinates.length
    const nPts = f.geometry.coordinates.reduce((s, poly) => s + poly.reduce((t, r) => t + r.length, 0), 0)
    console.log(`✓ ${f.properties.name}: ${nPoly} polygon(s), ${nPts} pts`)
  }
  for (const f of labelFeatures) console.log(`  label ${f.properties.name} @ ${f.geometry.coordinates}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
