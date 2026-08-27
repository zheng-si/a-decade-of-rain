/**
 * harvest-wikipedia.mjs — build the first-pass base gazetteer for the
 * Location Lookup's place search (brief: Task B).
 *
 * Sources, in the brief's order:
 *   1. The three Wikipedia list pages of US installations in South Vietnam
 *      (Army, Marine Corps, Air Force). CC BY-SA; every row keeps its
 *      source_url. Coordinates come from the linked articles' own coordinate
 *      tags via the MediaWiki API — this script copies nothing from sources
 *      that forbid copying, and it drops every linked page that carries no
 *      coordinate rather than inferring one.
 *   2. NGA GEOnet name variants are a separate pass (see fetch-geonet.mjs
 *      note in the README) — network access to geonames.nga.mil is not
 *      assumed here.
 *
 * Method:
 *   · pull every article linked from the three list pages
 *   · batch-query the API for coordinates (50 titles per request)
 *   · keep pages whose coordinate falls in the Vietnam box (8–18°N,
 *     102–110°E); everything else (people, units, concepts, US locations)
 *     self-selects out by having no coordinate there
 *   · batch-query redirects for the kept pages — the redirect titles are the
 *     name variants (diacritics, joined spellings, old names)
 *   · type from the title's own vocabulary (Air Base / FSB / LZ / Camp …),
 *     falling back to the list the entry came from
 *   · province_modern by point-in-polygon against public/data/provinces.geojson
 *   · confidence: 'high' when two independent sources agree within 2 km
 *     (currently: a Wikipedia coordinate matching an entry in our own
 *     landmarks.geojson), else 'medium' (source gives a coordinate, not yet
 *     cross-checked). This script never writes 'low' because it never infers
 *     a coordinate.
 *
 * Run:  node scripts/gazetteer/harvest-wikipedia.mjs
 * Deterministic given the same API responses; each run rewrites
 * data/gazetteer/bases.csv and prints what it kept and dropped.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const OUT_DIR = join(ROOT, 'data', 'gazetteer')

const API = 'https://en.wikipedia.org/w/api.php'
// Wikimedia asks tools to identify themselves; a blocked default UA is how
// this script fails first.
const UA = 'ADOR-gazetteer/0.1 (https://remedial-vietnam.vercel.app)'

// The brief names the Wikipedia LIST pages, but those titles do not exist;
// what Wikipedia actually maintains are the CATEGORIES below (verified by
// reading the category tags off Bien Hoa Air Base and Khe Sanh Combat Base).
// Same content, better structure: members are exactly the installations.
const ROOTS = [
  { title: 'Category:Installations of the United States Army in South Vietnam', origin: 'army' },
  {
    // NOT 'Installations of…' like its two siblings — the Marine branch is
    // named 'Military installations of…' (verified via the umbrella
    // Category:Military installations of the United States in South Vietnam).
    title: 'Category:Military installations of the United States Marine Corps in South Vietnam',
    origin: 'marine',
  },
  {
    title: 'Category:Installations of the United States Air Force in South Vietnam',
    origin: 'usaf',
  },
]
const MAX_DEPTH = 2 // root -> subcat -> pages; deeper starts pulling in noise

// Vietnam box, generous: the record's own bbox plus margin.
const BOX = { w: 102, e: 110.8, s: 8, n: 18 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params) {
  const q = new URLSearchParams({ format: 'json', ...params })
  // The egress IP here is shared, so 429s are about the neighbourhood, not
  // this script's own pace: back off hard and retry rather than failing.
  for (let attempt = 0; ; attempt++) {
    const resp = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } })
    if (resp.ok) {
      await sleep(1000)
      return resp.json()
    }
    if ((resp.status === 429 || resp.status >= 500) && attempt < 5) {
      await sleep(15_000 * (attempt + 1))
      continue
    }
    throw new Error(`API ${resp.status} for ${q.get('action')}`)
  }
}

/** Pages in a category tree, to MAX_DEPTH, with a visited guard. */
async function categoryPages(root) {
  const pages = []
  const seen = new Set()
  const walk = async (cat, depth) => {
    if (seen.has(cat) || depth > MAX_DEPTH) return
    seen.add(cat)
    let cmcontinue
    do {
      const r = await api({
        action: 'query',
        list: 'categorymembers',
        cmtitle: cat,
        cmtype: 'page|subcat',
        cmlimit: 'max',
        ...(cmcontinue ? { cmcontinue } : {}),
      })
      for (const m of r.query?.categorymembers ?? []) {
        if (m.ns === 14) await walk(m.title, depth + 1)
        else if (m.ns === 0) pages.push(m.title)
      }
      cmcontinue = r.continue?.cmcontinue
    } while (cmcontinue)
  }
  await walk(root, 0)
  return pages
}

/** Batch a prop query over many titles, 50 at a time, following continues. */
async function batchProp(titles, params, collect) {
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50)
    let cont = {}
    do {
      const r = await api({
        action: 'query',
        titles: chunk.join('|'),
        ...params,
        ...cont,
      })
      for (const page of Object.values(r.query?.pages ?? {})) collect(page)
      cont = r.continue ?? null
    } while (cont)
  }
}

const stripDiacritics = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ĐĐ]/g, 'D')
    .replace(/đ/g, 'd')

function classify(title, origin) {
  const t = title.toLowerCase()
  if (/air (base|field)|airfield|airport|\bab\b/.test(t)) return 'airbase'
  if (/fire ?(support )?base|\bfsb\b/.test(t)) return 'firebase'
  if (/landing zone|\blz\b/.test(t)) return 'lz'
  if (/\bcamp\b/.test(t)) return 'camp'
  if (/combat base/.test(t)) return origin === 'marine' ? 'marine_base' : 'army_base'
  if (/\bbase\b|installation|barracks|post\b/.test(t))
    return origin === 'marine' ? 'marine_base' : origin === 'usaf' ? 'airbase' : 'army_base'
  if (origin === 'marine') return 'marine_base'
  if (origin === 'army') return 'army_base'
  return 'other'
}

/* ── point-in-polygon for province_modern ────────────────────────────────── */
function inRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}
function inPoly(pt, geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    if (inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h))) return true
  }
  return false
}

const csvField = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  // 1. category members per branch (a page can sit in several branches)
  const origins = new Map() // title -> Set(origin)
  for (const { title, origin } of ROOTS) {
    const pages = await categoryPages(title)
    console.log(`${title}: ${pages.length} pages`)
    for (const p of pages) {
      if (!origins.has(p)) origins.set(p, new Set())
      origins.get(p).add(origin)
    }
  }
  const titles = [...origins.keys()]
  console.log(`distinct articles: ${titles.length}`)

  // 2. coordinates
  const coords = new Map() // canonical title -> {lat, lon}
  const redirected = new Map() // from -> to (the API normalises + redirects)
  await batchProp(
    titles,
    { prop: 'coordinates', colimit: 'max', redirects: '1' },
    (page) => {
      const c = page.coordinates?.[0]
      if (c) coords.set(page.title, { lat: c.lat, lon: c.lon })
    },
  )
  // second pass to capture the redirect mapping (batchProp above already
  // resolved them; we re-run cheaply to record from->to for variants)
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50)
    const r = await api({ action: 'query', titles: chunk.join('|'), redirects: '1' })
    for (const m of r.query?.redirects ?? []) redirected.set(m.from, m.to)
  }

  // 2b. Wikidata fallback for pages without a local coordinate tag: many
  // firebase/LZ stubs carry their position only as Wikidata P625. Same
  // provenance class (community-maintained), so same confidence tier.
  const noCoord = titles.filter((t) => !coords.has(t) && !redirected.has(t))
  const qids = new Map() // title -> QID
  await batchProp(noCoord, { prop: 'pageprops', ppprop: 'wikibase_item' }, (page) => {
    const q = page.pageprops?.wikibase_item
    if (q) qids.set(page.title, q)
  })
  const qidList = [...qids.entries()]
  const viaWikidata = new Set()
  for (let i = 0; i < qidList.length; i += 50) {
    const chunk = qidList.slice(i, i + 50)
    const r = await (
      await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${chunk
          .map(([, q]) => q)
          .join('|')}`,
        { headers: { 'User-Agent': UA } },
      )
    ).json()
    await sleep(1000)
    for (const [title, q] of chunk) {
      const claim = r.entities?.[q]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value
      if (claim && typeof claim.latitude === 'number') {
        coords.set(title, { lat: claim.latitude, lon: claim.longitude })
        viaWikidata.add(title)
      }
    }
  }
  console.log(`coordinates via Wikidata fallback: ${viaWikidata.size} of ${noCoord.length} coordless pages`)

  const inBox = ({ lat, lon }) => lon >= BOX.w && lon <= BOX.e && lat >= BOX.s && lat <= BOX.n
  const kept = [...coords.entries()].filter(([, c]) => inBox(c))
  console.log(`with coordinates: ${coords.size}; inside Vietnam box: ${kept.length}`)

  // 3. redirect titles as variants for kept pages
  const variants = new Map() // canonical -> Set(variant)
  await batchProp(
    kept.map(([t]) => t),
    { prop: 'redirects', rdlimit: 'max' },
    (page) => {
      if (!variants.has(page.title)) variants.set(page.title, new Set())
      for (const rd of page.redirects ?? []) variants.get(page.title).add(rd.title)
    },
  )
  // the list-page link text that redirected here is a variant too
  for (const [from, to] of redirected) {
    if (!variants.has(to)) variants.set(to, new Set())
    variants.get(to).add(from)
  }

  // 4. provinces + landmark cross-check
  const provinces = JSON.parse(
    await readFile(join(ROOT, 'public', 'data', 'provinces.geojson'), 'utf8'),
  )
  const provinceOf = (lon, lat) => {
    for (const f of provinces.features) {
      if (inPoly([lon, lat], f.geometry))
        return f.properties.name ?? f.properties.NAME_1 ?? f.properties.Name ?? ''
    }
    return ''
  }
  let landmarks = { features: [] }
  try {
    landmarks = JSON.parse(
      await readFile(join(ROOT, 'public', 'data', 'landmarks.geojson'), 'utf8'),
    )
  } catch {
    /* optional */
  }
  const km = (a, b) => {
    const rad = (x) => (x * Math.PI) / 180
    const dLat = rad(b[1] - a[1])
    const dLon = rad(b[0] - a[0])
    return 6371 * Math.hypot(dLat, dLon * Math.cos(rad((a[1] + b[1]) / 2)))
  }
  const nearLandmark = (lon, lat) =>
    landmarks.features.find(
      (f) => f.geometry?.type === 'Point' && km(f.geometry.coordinates, [lon, lat]) <= 2,
    )

  // 5. rows
  const rows = []
  for (const [title, c] of kept) {
    const origin = [...(origins.get(title) ?? [])][0] ?? 'usaf'
    const allOrigins = [...(origins.get(title) ?? [])].join('+')
    const type = classify(title, origin)
    const vset = new Set(variants.get(title) ?? [])
    vset.add(stripDiacritics(title))
    vset.delete(title)
    const clean = [...vset]
      .filter((v) => !/^[A-Z]{2,5}$/.test(v) || v.length > 4) // drop bare acronyms like 'AB'
      .map((v) => v.replace(/\|/g, '/'))
    const lm = nearLandmark(c.lon, c.lat)
    rows.push({
      name_canonical: title,
      name_variants: clean.join('|'),
      type,
      lat: c.lat.toFixed(5),
      lng: c.lon.toFixed(5),
      province_rvn: '', // needs an RVN-era boundary source; see README
      province_modern: provinceOf(c.lon, c.lat),
      source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      confidence: lm ? 'high' : 'medium',
      notes: `from: ${allOrigins}${viaWikidata.has(title) ? '; coord via Wikidata P625' : ''}${lm ? `; coord matches landmarks.geojson "${lm.properties?.name ?? ''}" within 2 km` : ''}`,
    })
  }
  rows.sort((a, b) => a.name_canonical.localeCompare(b.name_canonical))

  const header = [
    'name_canonical',
    'name_variants',
    'type',
    'lat',
    'lng',
    'province_rvn',
    'province_modern',
    'source_url',
    'confidence',
    'notes',
  ]
  const csv = [header.join(',')]
    .concat(rows.map((r) => header.map((h) => csvField(r[h])).join(',')))
    .join('\n')
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, 'bases.csv'), csv + '\n')

  const byType = {}
  const byConf = {}
  for (const r of rows) {
    byType[r.type] = (byType[r.type] ?? 0) + 1
    byConf[r.confidence] = (byConf[r.confidence] ?? 0) + 1
  }
  console.log(`✓ wrote ${join(OUT_DIR, 'bases.csv')} — ${rows.length} rows`)
  console.log('  by type:', byType)
  console.log('  by confidence:', byConf)
  console.log(`  dropped (no coordinate or outside box): ${titles.length - rows.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
