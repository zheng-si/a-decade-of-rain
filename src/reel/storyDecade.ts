// ── shot 3 · the decade, in the Story's own language ─────────────────────
// The Story's map exactly as the Story builds it (theme, curated labels, the
// quiet ground, relief, the brand-orange heat field, military-region tags,
// the country label, landmark outlines), the Story's ruler, and the Story's
// own node cards with their isometric art playing. The decade runs on the
// heat field's own monthly clock; each node's card takes the stage as the
// clock passes its date, and its landmarks come up on the map with it.
//
//   0.0 – 0.8   the country, ruler in
//   0.8 – 7.0   Aug 1961 → Dec 1967, slow through the build-up
//   7.0 – 8.4   hold on 1967, the Peak card
//   8.4 – 12.8  1968 → Dec 1971
//  12.8 – 16.0  the Reckoning card on the whole field
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../fonts.css'
import '../index.css'
import '../App.css'
import '../pages/Story.css'
import '../StorySkinV3.css'
import '../fontsGeist.css'
import './reel-site.css'
import { mapConfig } from '../config/mapConfig'
import {
  resolveMapStyle,
  applyMapTheme,
  addHillshade,
  setHillshade,
  STORY_WATER,
  addStoryHeat,
  setStoryHeatTime,
  addMilitaryRegions,
  addIslandMarks,
  STORY_HEAT_LAYER,
} from '../components/mapTheme'
import { applyLabelCuration } from '../components/labelLayers'
import { quietBasemap, addVietnamLabel } from '../components/volumeGrid'
import { loadHeat } from '../data/heat'
import { loadSpray, dayToDate, dateToDay, fmtGallons, type SprayDataset } from '../data/spray'
import { FACTS_EVENTS } from '../content/facts/events'
import { SOURCES } from '../content/sources'
import { CARD_ART, CARD_ART_PARTS, CARD_ART_STYLE } from '../figures/cards'
import { MASTER_MS, mountMotion, type Motion } from '../components/cardArtMotion'
import type { Shot } from './main'
import { monotone, span, easeOut, json } from './util'

type Ev = (typeof FACTS_EVENTS)[number]

const DAY_START = dateToDay('1961-08-01')
const DAY_PEAK = dateToDay('1967-12-31')
const DAY_END = dateToDay('1971-12-31')
const DURATION = 16
const timeline = monotone([
  [0.8, DAY_START],
  [2.8, dateToDay('1965-01-01')],
  [7.0, DAY_PEAK],
  [8.4, DAY_PEAK],
  [12.8, DAY_END],
])

/** The decade's nodes, in the order their dates fall. */
const NODE_IDS = ['begins', 'warzone-d', 'peak', 'mangroves', 'a-sau', 'hotspots', 'reckoning']

const DEM_SOURCE = 'terrain-dem'
const RELIEF_FLAT = 0.28
const HEAT_SRC = 'spray-heat'
const LANDMARK_SOURCE = 'landmarks'

/** The Story's own: monthly cumulative gallons, trimmed at 99% (Story.tsx). */
function monthlyCumulative(spray: SprayDataset): { months: number[]; yearStart: number } {
  const yearStart = spray.yearMin
  const N = (spray.yearMax - yearStart + 1) * 12
  const months = new Array(N).fill(0)
  for (const f of spray.features.features) {
    const dt = dayToDate(f.properties.day)
    const mi = (dt.getUTCFullYear() - yearStart) * 12 + dt.getUTCMonth()
    if (mi >= 0 && mi < N) months[mi] += f.properties.gallons
  }
  for (let i = 1; i < N; i++) months[i] += months[i - 1]
  const total = months[N - 1]
  let cut = 0
  while (cut < N - 1 && months[cut] < 0.99 * total) cut++
  const kept = months.slice(0, cut + 1)
  kept[kept.length - 1] = total
  return { months: kept, yearStart }
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// ── state ────────────────────────────────────────────────────────────────
let map: maplibregl.Map
let months: number[] = []
let yearStart = 1961
let landmarksGeo: GeoJSON.FeatureCollection | null = null
let lastHeatDay = -1
let shownNode = ''
let markers: maplibregl.Marker[] = []

interface CardRec {
  ev: Ev
  step: HTMLElement
  motion: Motion | null
  /** Shot time at which this card takes the stage. */
  tIn: number
}
const cards: CardRec[] = []

// ruler nodes
let rulerArea: SVGSVGElement
let scanLine: HTMLElement
let cursor: HTMLElement
let scanNum: HTMLElement
let ruler: HTMLElement

const RULER_H = 1000
const CHART_W = 100
const BARS_W = 120

function buildRuler(overlay: HTMLElement) {
  const n = months.length
  const maxCum = months[n - 1]
  ruler = h('aside', 'timeline-ruler is-visible')
  ruler.appendChild(h('div', 'timeline-bg'))
  const NS = 'http://www.w3.org/2000/svg'
  rulerArea = document.createElementNS(NS, 'svg')
  rulerArea.setAttribute('class', 'timeline-area')
  rulerArea.setAttribute('viewBox', `0 0 ${CHART_W} ${RULER_H}`)
  rulerArea.setAttribute('preserveAspectRatio', 'none')
  let d = 'M 0 0'
  for (let i = 0; i < n; i++) {
    const y0 = (i / n) * RULER_H
    const y1 = ((i + 1) / n) * RULER_H
    const x = (months[i] / maxCum) * CHART_W
    d += ` L ${x.toFixed(2)} ${y0.toFixed(2)} L ${x.toFixed(2)} ${y1.toFixed(2)}`
  }
  d += ` L 0 ${RULER_H} Z`
  rulerArea.innerHTML = `<defs><linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,84,73,0.5)"/><stop offset="100%" stop-color="rgba(255,84,73,0.9)"/></linearGradient></defs><path d="${d}" fill="url(#tl-area)"/>`
  ruler.appendChild(rulerArea)
  const ticks = document.createElementNS(NS, 'svg')
  ticks.setAttribute('class', 'timeline-ticks')
  ticks.setAttribute('viewBox', '0 0 16 1000')
  ticks.setAttribute('preserveAspectRatio', 'none')
  let tk = ''
  for (let i = 0; i <= n; i++) {
    const yr = i % 12 === 0
    const y = (i / n) * RULER_H
    tk += `<line x1="0" x2="${yr ? 12 : 6}" y1="${y}" y2="${y}" stroke="${yr ? 'rgba(33,53,40,0.5)' : 'rgba(33,53,40,0.26)'}" stroke-width="1" vector-effect="non-scaling-stroke"/>`
  }
  ticks.innerHTML = tk
  ruler.appendChild(ticks)
  const years = h('div', 'timeline-years')
  for (let y = 0; y * 12 < n; y++) {
    const s = h('span', 'timeline-year', String(yearStart + y))
    s.style.top = `${((y * 12) / n) * 100}%`
    years.appendChild(s)
  }
  ruler.appendChild(years)
  scanLine = h('span', 'timeline-scan-line')
  ruler.appendChild(scanLine)
  cursor = h('div', 'timeline-cursor')
  const vol = h('div', 'timeline-scan-vol')
  scanNum = h('span', 'timeline-scan-num')
  vol.appendChild(scanNum)
  vol.appendChild(h('span', 'timeline-scan-unit', 'Gallons Sprayed'))
  cursor.appendChild(vol)
  ruler.appendChild(cursor)
  overlay.appendChild(ruler)
}

function setRuler(day: number) {
  const n = months.length
  const maxCum = months[n - 1]
  const dt = dayToDate(day)
  const mi = (dt.getUTCFullYear() - yearStart) * 12 + dt.getUTCMonth() + (dt.getUTCDate() - 1) / 31
  const pos = Math.max(0, Math.min(1, mi / (n - 1)))
  const fpos = pos * (n - 1)
  const i0 = Math.floor(fpos)
  const frac = fpos - i0
  const vol = months[i0] + ((months[Math.min(i0 + 1, n - 1)] ?? months[i0]) - months[i0]) * frac
  const vh = 1080
  const scanTop = Math.min(vh - 34, Math.max(34, pos * vh))
  const barTip = Math.max(2, (vol / maxCum) * BARS_W)
  const reveal = `inset(0 0 ${((1 - pos) * 100).toFixed(2)}% 0)`
  rulerArea.style.clipPath = reveal
  scanLine.style.top = `${scanTop}px`
  scanLine.style.width = `${barTip}px`
  cursor.style.top = `${scanTop}px`
  cursor.style.left = `${barTip}px`
  scanNum.textContent = fmtGallons(vol)
}

function buildCard(ev: Ev): HTMLElement {
  const step = h('section', 'story-step reel-step')
  const card = h('article', 'story-card is-active')
  const src = CARD_ART[ev.id]
  if (src && CARD_ART_STYLE !== 'none') {
    const art = h('div', 'story-art')
    art.dataset.style = CARD_ART_STYLE
    const img = h('img')
    img.src = src
    img.width = 1536
    img.height = 1024
    img.alt = ''
    art.appendChild(img)
    if (CARD_ART_STYLE === 'c') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 1536 1024')
      art.appendChild(svg)
    }
    card.appendChild(art)
  }
  card.appendChild(h('p', 'story-eyebrow', esc(ev.period)))
  card.appendChild(h('h2', 'story-name', esc(ev.name)))
  if (ev.dek) card.appendChild(h('p', 'story-dek', esc(ev.dek)))
  if (ev.body) card.appendChild(h('p', 'story-body', esc(ev.body)))
  if (ev.stat) card.appendChild(h('p', 'story-stat', `<strong>${esc(ev.stat.value)}</strong> ${esc(ev.stat.label)}`))
  if (ev.note) card.appendChild(h('p', 'story-card-note', esc(ev.note)))
  if (ev.quote) {
    const s = SOURCES[ev.quote.sourceId]
    const q = h('blockquote', 'story-quote is-open')
    q.appendChild(
      h(
        'div',
        'story-quote-body',
        `<p>“${esc(ev.quote.text)}” <cite>— ${esc(ev.quote.speaker)}${s ? `, <a>${esc(s.publisher)}</a>` : ''}</cite></p>`,
      ),
    )
    card.appendChild(q)
  }
  step.appendChild(card)
  return step
}

/** The node's landmarks and pilot crosses, as the Story draws them. */
function showNodeMarks(ev: Ev | null) {
  for (const m of markers) m.remove()
  markers = []
  const src = map.getSource(LANDMARK_SOURCE) as maplibregl.GeoJSONSource
  if (!ev) {
    src.setData({ type: 'FeatureCollection', features: [] })
    return
  }
  for (const c of ev.crosses ?? []) {
    const el = h('div', c.leader ? 'map-dot map-dot--leader' : c.below ? 'map-dot map-dot--below' : 'map-dot')
    if (c.leader) el.style.setProperty('--leader', `${c.leader}px`)
    el.innerHTML = `<span class="map-dot-ring"></span><span class="map-dot-core"></span><span class="map-dot-label">${esc(c.label)}</span>`
    markers.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map))
  }
  const feats = (ev.landmarks ?? [])
    .filter((l) => l.boundaryId)
    .map((l) => landmarksGeo?.features.find((f) => (f.properties as { id?: string } | null)?.id === l.boundaryId))
    .filter((f): f is GeoJSON.Feature => !!f)
  src.setData({ type: 'FeatureCollection', features: feats })
  for (const l of ev.landmarks ?? []) {
    if (!l.point) continue
    const el = h('div')
    if (l.boundaryId) {
      el.className = 'map-area-label'
      el.innerHTML = `<span class="map-dot-label">${esc(l.name)}</span>`
    } else {
      el.className = 'map-dot'
      el.innerHTML = `<span class="map-dot-ring"></span><span class="map-dot-core"></span><span class="map-dot-label">${esc(l.name)}</span>`
    }
    markers.push(new maplibregl.Marker({ element: el }).setLngLat(l.point).addTo(map))
  }
}

export const shot: Shot = {
  duration: DURATION,
  stageClass: 'story',

  async setup(mapEl, overlay) {
    const style = await resolveMapStyle()
    map = new maplibregl.Map({
      container: mapEl,
      style,
      center: [107.4, 12.9],
      zoom: 6.3,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      maxPitch: mapConfig.view.maxPitch,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
    })
    const [spray, heat, mrGeo, mrLabelsGeo, lm] = await Promise.all([
      loadSpray(),
      loadHeat(),
      json<GeoJSON.FeatureCollection>('/data/military-region-dividers.geojson'),
      json<GeoJSON.FeatureCollection>('/data/military-region-labels.geojson'),
      json<GeoJSON.FeatureCollection>('/data/landmarks.geojson'),
      new Promise<void>((r) => map.once('load', () => r())),
    ])
    landmarksGeo = lm
    ;({ months, yearStart } = monthlyCumulative(spray))

    // The Story's map setup, in the Story's order (Story.tsx).
    applyMapTheme(map)
    applyLabelCuration(map)
    quietBasemap(map, { labels: false, water: STORY_WATER })
    if (mapConfig.terrain) {
      map.addSource(DEM_SOURCE, {
        type: 'raster-dem',
        tiles: [mapConfig.terrain.demUrl],
        tileSize: 256,
        encoding: mapConfig.terrain.encoding,
        maxzoom: 15,
      })
      addHillshade(map, DEM_SOURCE)
      setHillshade(map, true, RELIEF_FLAT)
    }
    map.addSource(HEAT_SRC, { type: 'geojson', data: heat.features })
    addStoryHeat(map, HEAT_SRC, DAY_START - 1)
    addMilitaryRegions(map, mrGeo, mrLabelsGeo, STORY_HEAT_LAYER)
    addVietnamLabel(map)
    map.addSource(LANDMARK_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'landmark-outline',
      type: 'line',
      source: LANDMARK_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#e8443a', 'line-width': 3, 'line-opacity': 0.95 },
    })
    addIslandMarks(map)
    for (const id of ['island-dot', 'island-label'])
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')

    // The Reckoning node's frame: the whole sprayed south, clear of the card.
    // The card's right edge sits at 14.5rem + 25.5rem = 640px.
    const cam = map.cameraForBounds([104.4, 8.4, 109.4, 17.1], {
      padding: { left: 700, right: 80, top: 60, bottom: 60 },
    })!
    map.jumpTo(cam)
    baseCam = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() }

    buildRuler(overlay)

    // Cards, each with the time the clock reaches its date.
    const nodes = NODE_IDS.map((id) => FACTS_EVENTS.find((e) => e.id === id)!).filter(Boolean)
    for (const ev of nodes) {
      const d = Math.max(dateToDay(ev.date), DAY_START)
      let tIn = 0
      for (let t = 0; t <= DURATION; t += 1 / 60) {
        if (timeline(t) >= d) {
          tIn = t
          break
        }
      }
      if (ev.id === 'begins') tIn = 0.5
      const step = buildCard(ev)
      overlay.appendChild(step)
      const svg = step.querySelector('svg')
      const motion = svg && CARD_ART_STYLE === 'c' ? mountMotion(svg as SVGSVGElement, ev.id, CARD_ART_PARTS) : null
      motion?.paint(0)
      cards.push({ ev, step, motion, tIn })
    }
    const credit = h('div', 'reel-credit', 'Basemap © OpenFreeMap · © OpenMapTiles · © OpenStreetMap')
    overlay.appendChild(credit)
    return map
  },

  apply(t) {
    const live = t >= 0.8
    const day = live ? Math.round(timeline(t)) : DAY_START - 1

    // camera: the Reckoning frame with a slow push the length of the shot
    map.jumpTo({ center: baseCam.center, zoom: baseCam.zoom + 0.14 * (t / DURATION) })

    // heat: the Story's monthly field, on its own clock
    if (day !== lastHeatDay) {
      lastHeatDay = day
      setStoryHeatTime(map, day)
    }

    // ruler
    ruler.style.opacity = String(easeOut(span(t, 0.1, 0.8)))
    setRuler(Math.max(day, DAY_START))

    // cards: the latest node whose time has come holds the stage
    let cur = -1
    for (let i = 0; i < cards.length; i++) if (t >= cards[i].tIn) cur = i
    const FADE = 0.45
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      let op = 0
      let dy = 0
      if (i === cur) {
        const k = easeOut(span(t, c.tIn, c.tIn + FADE))
        op = k
        dy = (1 - k) * 18
      } else if (i === cur - 1) {
        const k = span(t, cards[cur].tIn, cards[cur].tIn + FADE * 0.7)
        op = 1 - k
        dy = -k * 10
      }
      c.step.style.opacity = String(op)
      c.step.style.transform = `translateY(${dy.toFixed(1)}px)`
      c.step.style.visibility = op > 0.001 ? 'visible' : 'hidden'
      // the card's own art plays from the moment it arrives
      if (c.motion && op > 0) {
        const ms = (t - c.tIn) * 1000
        if (ms >= c.motion.end * MASTER_MS) c.motion.rest()
        else c.motion.paint(Math.max(0, ms) / MASTER_MS)
      }
    }
    const node = cur >= 0 ? cards[cur].ev.id : ''
    if (node !== shownNode) {
      shownNode = node
      showNodeMarks(cur >= 0 ? cards[cur].ev : null)
    }
    // the Story's breathing outline, on the shot's clock
    if (map.getLayer('landmark-outline'))
      map.setPaintProperty('landmark-outline', 'line-opacity', 0.5 + 0.45 * ((Math.sin(t * 2.7) + 1) / 2))
  },
}

let baseCam: { center: [number, number]; zoom: number } = { center: [107.4, 12.9], zoom: 6.3 }
