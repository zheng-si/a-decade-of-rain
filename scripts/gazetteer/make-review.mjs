/**
 * make-review.mjs — the human-review sheet for the gazetteer (brief: Task C).
 *
 * Sampling, per the brief:
 *   · every confidence = low row        (none exist in the current build)
 *   · every airbase                     (the highest-traffic queries)
 *   · a deterministic 20% of the remaining medium rows — seeded by name hash,
 *     not Math.random(), so the sheet is reproducible
 *   · rows whose sources disagree by >2 km (n/a while there is one source;
 *     the column structure is ready for the GEOnet pass)
 *
 * Output: data/gazetteer/review-YYYY-MM-DD.md — one row per line with the
 * source link and an OpenStreetMap link at the row's own coordinate, for
 * eyeballing. Si fills the "verdict" column and confidence gets written back
 * to bases.csv by hand (kept manual on purpose: the whole point is a human
 * judgement).
 *
 * Run:  node scripts/gazetteer/make-review.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, '..', '..', 'data', 'gazetteer')

function parseCsv(text) {
  const rows = []
  let cur = ['']
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur[cur.length - 1] += '"'
        i++
      } else if (ch === '"') q = false
      else cur[cur.length - 1] += ch
    } else if (ch === '"') q = true
    else if (ch === ',') cur.push('')
    else if (ch === '\n') {
      rows.push(cur)
      cur = ['']
    } else if (ch !== '\r') cur[cur.length - 1] += ch
  }
  if (cur.length > 1 || cur[0]) rows.push(cur)
  return rows
}

/** Small deterministic hash — the sample must survive re-runs unchanged. */
const hash = (s) => {
  let h = 2166136261
  for (const c of s) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 2 ** 32
}

async function main() {
  const text = await readFile(join(DIR, 'bases.csv'), 'utf8')
  const [header, ...rows] = parseCsv(text.trim())
  const col = Object.fromEntries(header.map((h, i) => [h, i]))
  const get = (r, k) => r[col[k]] ?? ''

  const picked = new Map() // name -> reason
  for (const r of rows) {
    const name = get(r, 'name_canonical')
    if (get(r, 'confidence') === 'low') picked.set(name, 'confidence = low')
    else if (get(r, 'type') === 'airbase') picked.set(name, 'airbase (review all)')
  }
  for (const r of rows) {
    const name = get(r, 'name_canonical')
    if (picked.has(name)) continue
    if (get(r, 'confidence') === 'medium' && hash(name) < 0.2)
      picked.set(name, 'medium, 20% sample')
  }

  const date = new Date().toISOString().slice(0, 10)
  const lines = [
    `# Gazetteer review — ${date}`,
    '',
    `${picked.size} rows of ${rows.length}: every airbase, every low-confidence row (none this build), and a seeded 20% of the remaining medium rows. Cross-source >2 km disagreements: n/a — single source until the GEOnet pass lands.`,
    '',
    'For each row: open the map link, check the pin against the source, then fill **verdict** (`ok` / `move to lat,lng` / `drop`) — confidences get written back to `bases.csv` from this column.',
    '',
    '| name | type | conf | coord | map | source | reason | verdict |',
    '|---|---|---|---|---|---|---|---|',
  ]
  const sorted = rows.filter((r) => picked.has(get(r, 'name_canonical')))
  for (const r of sorted) {
    const name = get(r, 'name_canonical')
    const lat = get(r, 'lat')
    const lng = get(r, 'lng')
    lines.push(
      `| ${name} | ${get(r, 'type')} | ${get(r, 'confidence')} | ${lat}, ${lng} | [OSM](https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}) | [wiki](${get(r, 'source_url')}) | ${picked.get(name)} |  |`,
    )
  }
  const out = join(DIR, `review-${date}.md`)
  await writeFile(out, lines.join('\n') + '\n')
  console.log(`✓ wrote ${out} — ${picked.size} rows`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
