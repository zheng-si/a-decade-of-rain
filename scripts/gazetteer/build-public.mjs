/**
 * build-public.mjs — bases.csv → public/data/gazetteer.json, the compact form
 * the Location Lookup's search box fetches (lazily, on first focus).
 *
 * Field names are single letters because this file ships to every searcher:
 * n name, v variants[], t type, p province_modern, c confidence, lat, lng.
 * The review workflow lives in the CSV; this is a build product of it, so
 * re-run after every edit to bases.csv:  node scripts/gazetteer/build-public.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

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

const text = await readFile(join(ROOT, 'data', 'gazetteer', 'bases.csv'), 'utf8')
const [header, ...rows] = parseCsv(text.trim())
const col = Object.fromEntries(header.map((h, i) => [h, i]))

const places = rows.map((r) => ({
  n: r[col.name_canonical],
  v: (r[col.name_variants] || '').split('|').filter(Boolean),
  t: r[col.type],
  lat: Number(r[col.lat]),
  lng: Number(r[col.lng]),
  p: r[col.province_modern] || '',
  c: r[col.confidence],
}))

const out = join(ROOT, 'public', 'data', 'gazetteer.json')
await writeFile(out, JSON.stringify({ places }))
console.log(`✓ wrote ${out} — ${places.length} places`)
