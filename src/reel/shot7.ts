// ── shot 7 · within a radius ──────────────────────────────────────────────
// The Atlas's lookup, staged: a ring opens around one town and every run whose
// recorded flight path passes inside it lights as the ring reaches it. The
// counting rule is the Atlas's own (src/components/lookup.ts): a run is in if
// any of its geometry comes within the radius, and its gallons are the run's
// whole load, which is all the source can say.
//
// Cát Tiên is the town in the gazetteer with the most runs within 5 km.
//
//   0.0 – 1.0   the record around the town, panel in
//   0.8 – 1.4   the town
//   1.4 – 5.4   the ring opens to 5 km
//   5.8 – 10    hold; first and last dates
import type maplibregl from 'maplibre-gl'
import type { Shot } from './main'
import { el, fmtInt, json, lerp, span, easeInOut, easeOut, dateOf } from './util'

interface RawTracks {
  tracks: [number, number, number, number, number[], number, number, number][]
  marks: [number, number, number, number, number, number, number, number][]
}

const PLACE = { name: 'Cát Tiên', lng: 107.36215, lat: 11.58321 }
const R_KM = 5
const KX = 111.32 * Math.cos((PLACE.lat * Math.PI) / 180)
const KY = 110.57

const SRC = 'reel7-tracks'
const MSRC = 'reel7-marks'
const RING = 'reel7-ring'
const DOT = 'reel7-dot'

let map: maplibregl.Map
/** Runs near the place, sorted by distance: [distanceKm, gallons, day]. */
let runs: [number, number, number][] = []
let lastR = -1

let head: HTMLElement
let runsEl: HTMLElement
let galEl: HTMLElement
let datesEl: HTMLElement
let chip: HTMLElement
let ringLabel: HTMLElement
let credits: HTMLElement[] = []

const xy = (lng: number, lat: number): [number, number] => [(lng - PLACE.lng) * KX, (lat - PLACE.lat) * KY]

function segDist(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const L = dx * dx + dy * dy
  let u = L ? (-ax * dx - ay * dy) / L : 0
  u = Math.max(0, Math.min(1, u))
  return Math.hypot(ax + u * dx, ay + u * dy)
}

function ring(rKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const pts: [number, number][] = []
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 2
    pts.push([PLACE.lng + (Math.cos(a) * rKm) / KX, PLACE.lat + (Math.sin(a) * rKm) / KY])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] }, properties: {} }
}

const camAt = (t: number) => ({
  center: [lerp(PLACE.lng - 0.052, PLACE.lng - 0.047, t / 10), PLACE.lat] as [number, number],
  zoom: lerp(11.72, 12.0, easeInOut(t / 10)),
})

export const shot7: Shot = {
  duration: 10,
  camera: { center: [PLACE.lng - 0.052, PLACE.lat], zoom: 11.72 },

  async setup(m, overlay) {
    map = m
    const raw = await json<RawTracks>('/data/spray-tracks.json')

    // one entry per run (Mission + Run), distance to its nearest geometry
    const byRun = new Map<string, { d: number; gal: number; day: number }>()
    const touch = (key: string, d: number, gal: number, day: number) => {
      const r = byRun.get(key)
      if (!r) byRun.set(key, { d, gal, day })
      else {
        r.d = Math.min(r.d, d)
        r.gal += gal
        r.day = Math.min(r.day, day)
      }
    }
    const lines: GeoJSON.Feature<GeoJSON.LineString>[] = []
    const lineKeys: string[] = []
    for (const [, day, gal, , flat, mission, run] of raw.tracks) {
      const key = `${mission}|${run}`
      let d = Infinity
      for (let i = 0; i + 3 < flat.length; i += 2) {
        const [ax, ay] = xy(flat[i], flat[i + 1])
        const [bx, by] = xy(flat[i + 2], flat[i + 3])
        d = Math.min(d, segDist(ax, ay, bx, by))
      }
      touch(key, d, gal, day)
      if (d < 40) {
        const coordinates: [number, number][] = []
        for (let i = 0; i < flat.length; i += 2) coordinates.push([flat[i], flat[i + 1]])
        lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })
        lineKeys.push(key)
      }
    }
    const marks: GeoJSON.Feature<GeoJSON.Point>[] = []
    const markKeys: string[] = []
    for (const [, day, gal, lon, lat, mission, run] of raw.marks) {
      const key = `${mission}|${run}`
      const [x, y] = xy(lon, lat)
      const d = Math.hypot(x, y)
      touch(key, d, gal, day)
      if (d < 40) {
        marks.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} })
        markKeys.push(key)
      }
    }
    // the whole run lights at once: stamp the run's distance on every piece
    lines.forEach((f, i) => (f.properties = { d: Number(byRun.get(lineKeys[i])!.d.toFixed(3)) }))
    marks.forEach((f, i) => (f.properties = { d: Number(byRun.get(markKeys[i])!.d.toFixed(3)) }))
    runs = [...byRun.values()]
      .filter((r) => r.d <= R_KM)
      .map((r) => [r.d, r.gal, r.day] as [number, number, number])
      .sort((a, b) => a[0] - b[0])
    console.log('reel shot7', { runs: runs.length, gallons: runs.reduce((s, r) => s + r[1], 0) })

    // The basemap prints its own small "Cát Tiên" beside the chip; at this
    // zoom its labels are noise around the one name that matters.
    for (const l of map.getStyle().layers ?? []) {
      if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none')
    }

    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: lines } })
    map.addSource(MSRC, { type: 'geojson', data: { type: 'FeatureCollection', features: marks } })
    map.addSource(RING, { type: 'geojson', data: ring(0.001) })
    map.addSource(DOT, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Point', coordinates: [PLACE.lng, PLACE.lat] }, properties: {} },
    })
    map.addLayer({ id: 'r7-ring-fill', type: 'fill', source: RING, paint: { 'fill-color': '#ff5449', 'fill-opacity': 0.06 } })
    map.addLayer({
      id: 'r7-base',
      type: 'line',
      source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#7d8a80', 'line-width': 1.4, 'line-opacity': 0.42 },
    })
    map.addLayer({
      id: 'r7-base-mark',
      type: 'circle',
      source: MSRC,
      paint: { 'circle-radius': 2.6, 'circle-color': '#7d8a80', 'circle-opacity': 0.5 },
    })
    map.addLayer({
      id: 'r7-hit',
      type: 'line',
      source: SRC,
      filter: ['<=', ['get', 'd'], -1],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e8443a', 'line-width': 2.6, 'line-opacity': 0.85 },
    })
    map.addLayer({
      id: 'r7-hit-mark',
      type: 'circle',
      source: MSRC,
      filter: ['<=', ['get', 'd'], -1],
      paint: { 'circle-radius': 4, 'circle-color': '#e8443a', 'circle-opacity': 0.95 },
    })
    map.addLayer({
      id: 'r7-ring-line',
      type: 'line',
      source: RING,
      paint: { 'line-color': '#cf3720', 'line-width': 2.5, 'line-opacity': 0 },
    })
    map.addLayer({
      id: 'r7-dot',
      type: 'circle',
      source: DOT,
      paint: {
        'circle-radius': 0,
        'circle-color': '#213528',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-opacity': 0,
        'circle-stroke-opacity': 0,
      },
    })

    // ── overlay ──
    head = el('div', 's7-head', overlay)
    el('div', 'eyebrow', head, 'The Herbicide Atlas · Lookup')
    el('div', 's7-title', head, `Every spray run recorded within 5&nbsp;km of ${PLACE.name}`)
    const stats = el('div', 's7-stats', head)
    const s1 = el('div', 's7-stat', stats)
    runsEl = el('div', 'v fig', s1, '0')
    el('div', 'l', s1, 'spray runs')
    const s2 = el('div', 's7-stat', stats)
    galEl = el('div', 'v fig', s2, '0')
    el('div', 'l', s2, 'gallons on those runs')
    const first = Math.min(...runs.map((r) => r[2]))
    const last = Math.max(...runs.map((r) => r[2]))
    const fmtD = (day: number) =>
      dateOf(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    datesEl = el('div', 's7-dates', head, `First run&nbsp;&nbsp;${fmtD(first)}<br>Last run&nbsp;&nbsp;&nbsp;${fmtD(last)}`)

    chip = el('div', 's7-chip', overlay, PLACE.name)
    ringLabel = el('div', 's7-ringlabel', overlay)
    credits = [
      el(
        'div',
        'credit left',
        overlay,
        'Distance to each run’s recorded flight path; gallons are each run’s whole load. Source: the HERBS file (Stellman et al., 2003)',
      ),
      el('div', 'credit right', overlay, '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap'),
    ]
  },

  apply(t) {
    map.jumpTo(camAt(t))

    const r = R_KM * easeInOut(span(t, 1.4, 5.4))
    if (Math.abs(r - lastR) > 1e-4) {
      lastR = r
      ;(map.getSource(RING) as maplibregl.GeoJSONSource).setData(ring(Math.max(r, 0.001)))
      map.setFilter('r7-hit', ['<=', ['get', 'd'], r > 0 ? r : -1])
      map.setFilter('r7-hit-mark', ['<=', ['get', 'd'], r > 0 ? r : -1])
    }
    map.setPaintProperty('r7-ring-line', 'line-opacity', span(t, 1.35, 1.6))

    const dot = easeOut(span(t, 0.8, 1.3))
    map.setPaintProperty('r7-dot', 'circle-radius', 8 * dot)
    map.setPaintProperty('r7-dot', 'circle-opacity', dot)
    map.setPaintProperty('r7-dot', 'circle-stroke-opacity', dot)

    // overlay
    const furn = easeOut(span(t, 0.1, 0.9))
    head.style.opacity = String(furn)
    head.style.transform = `translateY(${(1 - furn) * 14}px)`
    for (const c of credits) c.style.opacity = String(furn)

    let n = 0
    let gal = 0
    for (const [d, g] of runs) {
      if (d > r || r === 0) break
      n++
      gal += g
    }
    runsEl.textContent = fmtInt(n)
    galEl.textContent = fmtInt(gal)
    const dates = easeOut(span(t, 5.8, 6.5))
    datesEl.style.opacity = String(dates)

    const p = map.project([PLACE.lng, PLACE.lat])
    chip.style.left = `${p.x}px`
    chip.style.top = `${p.y + 20}px`
    chip.style.opacity = String(dot)

    // ring label rides the ring at the upper right
    const a = (-38 * Math.PI) / 180
    const q = map.project([PLACE.lng + (Math.cos(a) * r) / KX, PLACE.lat - (Math.sin(a) * r) / KY])
    ringLabel.style.left = `${q.x + 34}px`
    ringLabel.style.top = `${q.y - 12}px`
    ringLabel.style.opacity = String(span(t, 1.8, 2.2))
    ringLabel.textContent = `${r.toFixed(1)} km`
  },
}
