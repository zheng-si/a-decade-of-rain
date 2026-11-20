// ── shot 3 · the decade ───────────────────────────────────────────────────
// The whole record played from the first test spray to the last mission. The
// heat field is the Story's own (gallons where they fell, binned by month);
// on top of it each run flashes as it is flown and then settles into a
// hairline, so the field reads as accumulating rather than fading in.
//
//   0.0 – 1.0   empty country, furniture in
//   1.0 – 7.4   1961 → end of 1967, slow through the build-up
//   7.4 – 8.6   hold on 1967, the heaviest year
//   8.6 – 12.0  1968 → December 1971
//  12.0 – 15.0  hold on the total
import type maplibregl from 'maplibre-gl'
import { loadHeat } from '../data/heat'
import { addStoryHeat, setStoryHeatTime } from '../components/mapTheme'
import type { Shot } from './main'
import { dayOf, dateOf, el, fmtInt, json, lerp, monotone, span, easeOut } from './util'

interface RawTracks {
  tracks: [number, number, number, number, number[], number, number, number][]
  marks: [number, number, number, number, number, number, number, number][]
}

const Y0 = 1961
const Y1 = 1971
const DAY_START = dayOf(1961, 8, 1)
const DAY_1968 = dayOf(1967, 12, 31)
const DAY_END = dayOf(1971, 12, 31)

const timeline = monotone([
  [1.0, DAY_START],
  [3.2, dayOf(1965, 1, 1)],
  [7.4, DAY_1968],
  [8.6, DAY_1968],
  [12.0, DAY_END],
])

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const FRESH = 'reel-fresh'
const FRESH_CORE = 'reel-fresh-core'
const SETTLED = 'reel-settled'
const SRC = 'reel-tracks'

let map: maplibregl.Map
let cumByDay: Float64Array
let yearTotals: number[] = []
let missions = 0
let lastDay = -1
let lastHeatDay = -1

// overlay nodes
let colEl: HTMLElement
let yearEl: HTMLElement
let monthEl: HTMLElement
let galEl: HTMLElement
let bars: SVGRectElement[] = []
let barYears: SVGTextElement[] = []
let noteHold: HTMLElement
let noteEnd: HTMLElement
let credits: HTMLElement[] = []

const CHART_W = 560
const CHART_H = 190
const BAR_GAP = 10

export const shot3: Shot = {
  duration: 15,
  camera: { center: [104.5, 12.85], zoom: 6.12 },

  async setup(m, overlay) {
    map = m
    const [heat, raw] = await Promise.all([loadHeat(), json<RawTracks>('/data/spray-tracks.json')])

    // gallons by day, from the same lines the heat field was binned from
    cumByDay = new Float64Array(DAY_END + 2)
    const ms = new Set<number>()
    const lines: GeoJSON.Feature<GeoJSON.LineString>[] = []
    for (const [, day, gal, , flat, mission] of raw.tracks) {
      cumByDay[day] += gal
      ms.add(mission)
      const coordinates: [number, number][] = []
      for (let i = 0; i < flat.length; i += 2) coordinates.push([flat[i], flat[i + 1]])
      lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { day } })
    }
    for (const [, day, gal, , , mission] of raw.marks) {
      cumByDay[day] += gal
      ms.add(mission)
    }
    missions = ms.size
    yearTotals = []
    for (let y = Y0; y <= Y1; y++) {
      let s = 0
      for (let d = dayOf(y, 1, 1); d < dayOf(y + 1, 1, 1) && d < cumByDay.length; d++) s += cumByDay[d]
      yearTotals.push(s)
    }
    for (let d = 1; d < cumByDay.length; d++) cumByDay[d] += cumByDay[d - 1]
    console.log('reel shot3', { total: cumByDay[DAY_END], missions, yearTotals })

    map.addSource('reel-heat', { type: 'geojson', data: heat.features })
    addStoryHeat(map, 'reel-heat', DAY_START - 1)
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: lines } })
    map.addLayer(
      {
        id: SETTLED,
        type: 'line',
        source: SRC,
        filter: ['<=', ['get', 'day'], 0],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#c2331f', 'line-width': 0.55, 'line-opacity': 0.16 },
      },
    )
    map.addLayer({
      id: FRESH,
      type: 'line',
      source: SRC,
      filter: ['<=', ['get', 'day'], 0],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ff5449', 'line-width': 1.3, 'line-opacity': 0.5 },
    })
    map.addLayer({
      id: FRESH_CORE,
      type: 'line',
      source: SRC,
      filter: ['<=', ['get', 'day'], 0],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e8443a', 'line-width': 2.2, 'line-opacity': 0.95 },
    })

    // ── overlay ──
    el('div', 'scrim', overlay)
    colEl = el('div', 's3-col', overlay)
    el('div', 'eyebrow', colEl, 'A Decade of Rain · The HERBS record')
    yearEl = el('div', 's3-year', colEl, '1961')
    monthEl = el('div', 's3-month', colEl)
    galEl = el('div', 's3-gal fig', colEl, '0')
    el('div', 's3-gal-label', colEl, 'U.S. gallons of herbicide sprayed')

    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('class', 's3-chart')
    svg.setAttribute('width', String(CHART_W))
    svg.setAttribute('height', String(CHART_H + 34))
    colEl.appendChild(svg)
    const n = Y1 - Y0 + 1
    const bw = (CHART_W - BAR_GAP * (n - 1)) / n
    const base = document.createElementNS(NS, 'line')
    base.setAttribute('x1', '0')
    base.setAttribute('x2', String(CHART_W))
    base.setAttribute('y1', String(CHART_H + 0.5))
    base.setAttribute('y2', String(CHART_H + 0.5))
    base.setAttribute('stroke', '#c9cfc3')
    svg.appendChild(base)
    bars = []
    barYears = []
    for (let i = 0; i < n; i++) {
      const r = document.createElementNS(NS, 'rect')
      r.setAttribute('x', String(i * (bw + BAR_GAP)))
      r.setAttribute('width', String(bw))
      r.setAttribute('y', String(CHART_H))
      r.setAttribute('height', '0')
      r.setAttribute('fill', '#ff5449')
      svg.appendChild(r)
      bars.push(r)
      const tx = document.createElementNS(NS, 'text')
      tx.setAttribute('x', String(i * (bw + BAR_GAP) + bw / 2))
      tx.setAttribute('y', String(CHART_H + 26))
      tx.setAttribute('text-anchor', 'middle')
      tx.setAttribute('font-family', 'Courier Prime, monospace')
      tx.setAttribute('font-size', '16')
      tx.setAttribute('fill', '#647468')
      tx.textContent = `’${String(Y0 + i).slice(2)}`
      svg.appendChild(tx)
      barYears.push(tx)
    }

    const peak = yearTotals[1967 - Y0]
    noteHold = el(
      'div',
      's3-note',
      overlay,
      `<b>1967</b>, the heaviest year of the war:<br><span class="fig"><b>${(peak / 1e6).toFixed(1)} million</b></span> gallons in twelve months.`,
    )
    noteEnd = el(
      'div',
      's3-note',
      overlay,
      `<span class="fig"><b>${(cumByDay[DAY_END] / 1e6).toFixed(1)} million</b></span> gallons over <b>${fmtInt(missions)}</b> missions, 1961–1971.`,
    )
    for (const nEl of [noteHold, noteEnd]) {
      nEl.style.left = '120px'
      nEl.style.top = '930px'
    }
    credits = [
      el('div', 'credit left', overlay, 'Source: the HERBS file, the record behind Stellman et al., <i>Nature</i> (2003)'),
      el('div', 'credit right', overlay, '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap'),
    ]
  },

  apply(t) {
    const day = Math.round(timeline(t))

    // camera: a slow push the length of the shot
    map.jumpTo({ center: [lerp(104.5, 104.7, t / 15), lerp(12.85, 12.65, t / 15)], zoom: lerp(6.12, 6.28, t / 15) })

    if (day !== lastDay) {
      lastDay = day
      const live = t >= 1.0 ? day : 0
      map.setFilter(SETTLED, ['<=', ['get', 'day'], live])
      map.setFilter(FRESH, ['all', ['<=', ['get', 'day'], live], ['>', ['get', 'day'], live - 70]])
      map.setFilter(FRESH_CORE, ['all', ['<=', ['get', 'day'], live], ['>', ['get', 'day'], live - 22]])
      const heatDay = t >= 1.0 ? day : DAY_START - 1
      if (heatDay !== lastHeatDay) {
        lastHeatDay = heatDay
        setStoryHeatTime(map, heatDay)
      }
    }
    // the flashes stand down once the record is complete
    const fade = 1 - span(t, 12.0, 13.2)
    map.setPaintProperty(FRESH, 'line-opacity', 0.5 * fade)
    map.setPaintProperty(FRESH_CORE, 'line-opacity', 0.95 * fade)

    // overlay
    const furn = easeOut(span(t, 0.1, 0.9))
    colEl.style.opacity = String(furn)
    colEl.style.transform = `translateY(${(1 - furn) * 14}px)`
    for (const c of credits) c.style.opacity = String(furn)

    const date = dateOf(Math.max(day, DAY_START))
    yearEl.textContent = String(date.getUTCFullYear())
    monthEl.textContent = t >= 1.0 ? MONTHS[date.getUTCMonth()] : ''
    const cum = t >= 1.0 ? cumByDay[Math.min(day, DAY_END)] : 0
    galEl.textContent = fmtInt(cum)

    const max = Math.max(...yearTotals)
    const yNow = date.getUTCFullYear()
    for (let i = 0; i < bars.length; i++) {
      const y = Y0 + i
      let v = 0
      if (t >= 1.0) {
        if (y < yNow) v = yearTotals[i]
        else if (y === yNow) v = cumByDay[Math.min(day, DAY_END)] - cumByDay[dayOf(y, 1, 1) - 1]
      }
      const h = (v / max) * CHART_H
      bars[i].setAttribute('y', String(CHART_H - h))
      bars[i].setAttribute('height', String(h))
      const current = y === yNow && t >= 1.0 && t < 12.0
      const peakHold = y === 1967 && t >= 7.2 && t < 9.0
      bars[i].setAttribute('fill', current || peakHold ? '#e8443a' : '#ff8a80')
      barYears[i].setAttribute('fill', current || peakHold ? '#213528' : '#647468')
      barYears[i].setAttribute('font-weight', current || peakHold ? '700' : '400')
    }

    const hold = span(t, 7.3, 7.8) * (1 - span(t, 8.7, 9.1))
    noteHold.style.opacity = String(hold)
    noteHold.style.transform = `translateY(${(1 - hold) * 8}px)`
    const end = easeOut(span(t, 12.2, 12.9))
    noteEnd.style.opacity = String(end)
    noteEnd.style.transform = `translateY(${(1 - end) * 8}px)`
  },
}
