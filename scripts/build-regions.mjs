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
      geometry: { type: 'Point', coordinates: labelPoint(unioned) },
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

  // 3) internal dividers — only the lines BETWEEN adjacent regions, not the full
  // outlines (those trace the national border / coast and clash with the
  // basemap's own border). Both neighbours dissolve from the same provinces, so
  // a shared border is exactly the edges appearing in two regions' rings.
  const edgeOwner = new Map() // "x1,y1|x2,y2" (sorted) -> Set<mr>
  const edgeKey = (a, b) => {
    const s = `${a[0]},${a[1]}`
    const t = `${b[0]},${b[1]}`
    return s < t ? `${s}|${t}` : `${t}|${s}`
  }
  for (const f of regionFeatures) {
    for (const poly of f.geometry.coordinates) {
      for (const ring of poly) {
        for (let i = 0; i < ring.length - 1; i++) {
          const k = edgeKey(ring[i], ring[i + 1])
          if (!edgeOwner.has(k)) edgeOwner.set(k, new Set())
          edgeOwner.get(k).add(f.properties.mr)
        }
      }
    }
  }
  // Chain the shared edges of each region pair into LineStrings.
  const dividerFeatures = []
  const pairs = new Map() // "1-2" -> edges [[a,b],...]
  for (const [k, owners] of edgeOwner) {
    if (owners.size < 2) continue
    const pair = [...owners].sort().join('-')
    const [a, b] = k.split('|').map((s) => s.split(',').map(Number))
    if (!pairs.has(pair)) pairs.set(pair, [])
    pairs.get(pair).push([a, b])
  }
  for (const [pair, edges] of pairs) {
    // vertex adjacency → walk chains from degree-1 endpoints
    const adj = new Map()
    const vk = (p) => `${p[0]},${p[1]}`
    for (const [a, b] of edges) {
      for (const [p, q] of [[a, b], [b, a]]) {
        if (!adj.has(vk(p))) adj.set(vk(p), [])
        adj.get(vk(p)).push(q)
      }
    }
    const used = new Set()
    const ek = (a, b) => edgeKey(a, b)
    for (const [a, b] of edges) {
      if (used.has(ek(a, b))) continue
      // walk both directions from this edge
      const chain = [a, b]
      used.add(ek(a, b))
      for (const dir of [1, 0]) {
        for (;;) {
          const head = dir ? chain[chain.length - 1] : chain[0]
          const next = (adj.get(vk(head)) || []).find((q) => !used.has(ek(head, q)))
          if (!next) break
          used.add(ek(head, next))
          if (dir) chain.push(next)
          else chain.unshift(next)
        }
      }
      dividerFeatures.push({
        type: 'Feature',
        properties: { pair },
        geometry: { type: 'LineString', coordinates: chain },
      })
    }
  }
  await writeFile(
    join(ROOT, 'public/data/military-region-dividers.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: dividerFeatures }),
  )
  console.log(`✓ dividers: ${dividerFeatures.length} line(s) across ${pairs.size} region pair(s)`)

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
