import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import scrollama from 'scrollama'
import { Link } from 'react-router-dom'
import { loadSpray, dateToDay, dayToDate, fmtGallons, type SprayDataset } from '../data/spray'
import { loadHeat } from '../data/heat'
import { loadTracks } from '../data/tracks'
import { mapConfig } from '../config/mapConfig'
import {
  resolveMapStyle,
  applyMapTheme,
  addStoryHeat,
  setStoryHeatTime,
  setStoryHeatVisible,
  addHillshade,
  setHillshade,
  addMilitaryRegions,
  addIslandMarks,
  addStoryTracks,
  crossfadeStoryMarks,
  resetStoryMarks,
  STORY_HEAT_LAYER,
  STORY_WATER,
} from '../components/mapTheme'
import { FACTS_EVENTS, type StoryEvent } from '../content/facts/events'
import { HOOK } from '../content/facts/hook'
import { SOURCES } from '../content/sources'
import RainCanvas from '../components/RainCanvas'
import usaidInk from '../assets/brand/usaid-ink.png'
import TimelineRuler from '../components/TimelineRuler'
import MapKey from '../components/MapKey'
import RainbowHerbicides, { type AgentSeries } from '../components/RainbowHerbicides'
import EcosystemsFigure from '../components/EcosystemsFigure'
import ConsequencesInterlude from '../components/ConsequencesInterlude'
import ActionsSection from '../components/ActionsSection'
import AlternativesSection from '../components/AlternativesSection'
import MethodsSection from '../components/MethodsSection'
import TimelineSection from '../components/TimelineSection'
import CloseSection from '../components/CloseSection'
import StoryNav from '../components/StoryNav'
import { applyLabelCuration } from '../components/labelLayers'
import { quietBasemap } from '../components/volumeGrid'
import './Story.css'
// v3 skin — one scoped file over Story.css. See the header of StorySkinV3.css.
import '../StorySkinV3.css'
// Geist @font-face declarations (shared with the Archive spike).
import '../fontsGeist.css'

const SPRAY_SOURCE = 'spray'
const LANDMARK_SOURCE = 'landmark-boundary'
const DEM_SOURCE = 'terrain-dem'

// Hillshade strength flat vs tilted — the Archive's values, so the ground
// reads the same on both surfaces.
const RELIEF_FLAT = 0.28
const RELIEF_TILTED = 0.6

// Left-rail nav anchors: which story nodes carry a jump target.
const NAV_ANCHOR: Record<string, string | undefined> = {
  begins: 'sec-facts',
  'warzone-d': 'sec-missions',
}

// Empty polygon collection — the landmark-boundary source when no boundary is shown.
const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }


// Cumulative gallons at the end of each month from January of the first data
// year — drives the timeline ruler's stacked bars and its scan-line readout.
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
  // Aggressive trim: cut the long near-flat tail. End the ruler at the first
  // month that reaches 99% of the grand total, and fold the remaining trickle
  // into that last month so the running total still reads the true ~19.5M.
  const total = months[N - 1]
  let cut = 0
  while (cut < N - 1 && months[cut] < 0.99 * total) cut++
  const kept = months.slice(0, cut + 1)
  kept[kept.length - 1] = total
  return { months: kept, yearStart }
}


const PHONE_MQ = '(max-width: 640px)'

/**
 * A node's quote — open on desktop, collapsed behind a tap on a phone.
 *
 * Measured at 390×844: node cards run 294–487px and the quote block is
 * 86–132px of that. Collapsed, most nodes fit inside the phone card cap with
 * no inner scrolling — which matters because an inner scroll competes with the
 * page's own scroll for the same gesture.
 *
 * Initial state reads the media query rather than defaulting closed, so a
 * desktop reader never sees the toggle flash; the listener re-opens it if the
 * viewport crosses the breakpoint (rotation, or a resized window).
 */
function StoryQuote({
  quote,
  src,
}: {
  quote: { text: string; speaker: string }
  src?: { url: string; publisher: string }
}) {
  const [open, setOpen] = useState(() => !window.matchMedia(PHONE_MQ).matches)

  useEffect(() => {
    const m = window.matchMedia(PHONE_MQ)
    const sync = () => setOpen(!m.matches)
    m.addEventListener('change', sync)
    return () => m.removeEventListener('change', sync)
  }, [])

  return (
    <blockquote className={`story-quote${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="story-quote-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide the account' : 'Read an account'}
      </button>
      <div className="story-quote-body">
        <p>“{quote.text}”</p>
        <cite>
          — {quote.speaker}
          {src && (
            <>
              {', '}
              <a href={src.url} target="_blank" rel="noreferrer">
                {src.publisher}
              </a>
            </>
          )}
        </cite>
      </div>
    </blockquote>
  )
}

export default function Story() {
  const containerRef = useRef<HTMLDivElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dataRef = useRef<SprayDataset | null>(null)
  const readyRef = useRef(false)
  const crossMarkersRef = useRef<maplibregl.Marker[]>([])
  const is3DRef = useRef(false)
  const dayRef = useRef(0) // the day currently SHOWN by the heat filter (animated)
  const heatAnimRef = useRef<number | null>(null)
  const pendingSweepRef = useRef<(() => void) | null>(null) // cancels a bloom armed on camera arrival
  const pulseRef = useRef<number | null>(null)
  // Mirror active/started for the load handler, whose closure would otherwise
  // read stale state if the reader scrolled while the map was still loading.
  const startedRef = useRef(false)
  const activeRef = useRef(0)
  const landmarksRef = useRef<FeatureCollection | null>(null)
  /** Whether the current node wants the track layer — read by the (async)
   *  track load, so arriving before the data does still ends up correct. */
  const wantTracksRef = useRef(false)
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([])
  const veilRef = useRef<HTMLDivElement>(null)

  const [active, setActive] = useState(0)
  const [started, setStarted] = useState(false)
  // The phone deck exists only while the reader is inside the story steps:
  // `started` opens it (step 0 entered) and `ended` closes it (last step
  // exited downward). Both come from scrollama, so visibility is owned by the
  // same events that own the camera — the fixed-sheet attempt died of tying
  // visibility to is-active alone, which knows nothing about hero or tail.
  const [ended, setEnded] = useState(false)
  const [is3D, setIs3D] = useState(false)
  const [monthlyCum, setMonthlyCum] = useState<number[]>([])
  const [yearStart, setYearStart] = useState(1961)
  const [mapReady, setMapReady] = useState(false)

  // Each node's position on the ruler (0–1), from its playhead date.
  const nodeFracs = useMemo(() => {
    const N = monthlyCum.length || 132
    return FACTS_EVENTS.map((ev) => {
      const dt = new Date(`${ev.date}T00:00:00Z`)
      const mi = (dt.getUTCFullYear() - yearStart) * 12 + dt.getUTCMonth()
      return Math.min(1, Math.max(0, (mi + 0.5) / N))
    })
  }, [monthlyCum.length, yearStart])

  // Per-agent yearly gallons for the Rainbow Herbicides figure — aggregated once
  // from the loaded spray dataset (stack order: largest volume at the bottom).
  const agentSeries = useMemo<{ years: number[]; series: AgentSeries[] } | null>(() => {
    const spray = dataRef.current
    if (!mapReady || !spray) return null
    const codeToKey: Record<string, string> = {}
    for (const g of mapConfig.agents) for (const c of g.codes) codeToKey[c] = g.key
    const idxToKey = spray.agents.map((a) => codeToKey[a.code] ?? 'other')
    const order = mapConfig.agents.map((g) => g.key) // O, W, B, other
    const yMin = spray.yearMin
    const allYears = Array.from({ length: spray.yearMax - yMin + 1 }, (_, i) => yMin + i)
    const byKey: Record<string, number[]> = Object.fromEntries(order.map((k) => [k, allYears.map(() => 0)]))
    for (const f of spray.features.features) {
      const yi = dayToDate(f.properties.day).getUTCFullYear() - yMin
      if (yi < 0 || yi >= allYears.length) continue
      byKey[idxToKey[f.properties.agent] ?? 'other'][yi] += f.properties.gallons
    }
    // Keep every year 1961–1971 (the axis shows the full span, incl. the quiet
    // start and the 1971 wind-down).
    const series: AgentSeries[] = order.map((key) => {
      const g = mapConfig.agents.find((a) => a.key === key)!
      const values = byKey[key]
      return { key: key as AgentSeries['key'], name: g.label, color: g.color, total: values.reduce((s, v) => s + v, 0), values }
    })
    return { years: allYears, series }
  }, [mapReady])

  function clearCrosses() {
    crossMarkersRef.current.forEach((m) => m.remove())
    crossMarkersRef.current = []
  }

  // Pilot / test-spray sites where the volume is too small to read as heat:
  // an orange dot with a periodically pulsing ring, plus a label. The pulse
  // animates CHILD elements — MapLibre owns the marker root's transform.
  function showCrosses(
    crosses: { lng: number; lat: number; label: string; below?: boolean; leader?: number }[] | undefined,
  ) {
    const map = mapRef.current
    if (!map) return
    clearCrosses()
    if (!crosses) return
    for (const c of crosses) {
      const el = document.createElement('div')
      el.className = c.leader ? 'map-dot map-dot--leader' : c.below ? 'map-dot map-dot--below' : 'map-dot'
      if (c.leader) el.style.setProperty('--leader', `${c.leader}px`)
      el.innerHTML =
        '<span class="map-dot-ring"></span><span class="map-dot-core"></span>' +
        `<span class="map-dot-label">${c.label}</span>`
      crossMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map))
    }
  }

  // Vietnam's border stays on throughout; only the disputed-island labels are
  // overview-only (they're off-screen once zoomed into the story anyway).
  function setSVVisible(on: boolean) {
    const map = mapRef.current
    if (!map) return
    for (const id of ['island-dot', 'island-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
  }

  // Pulse the boundary outline's opacity with a sine wave, so the highlighted
  // area gently breathes and draws the eye. Uses setPaintProperty per frame.
  function stopPulse() {
    if (pulseRef.current != null) {
      cancelAnimationFrame(pulseRef.current)
      pulseRef.current = null
    }
  }
  function startPulse() {
    const map = mapRef.current
    if (!map) return
    stopPulse()
    // Reduced motion: hold the outline steady instead of breathing.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t = 0
    const tick = () => {
      const m = mapRef.current
      if (!m || !m.getLayer('landmark-outline')) {
        pulseRef.current = null
        return
      }
      t += 0.045
      const s = (Math.sin(t) + 1) / 2 // 0..1
      try {
        m.setPaintProperty('landmark-outline', 'line-opacity', 0.5 + 0.45 * s)
      } catch {
        /* layer gone */
      }
      pulseRef.current = requestAnimationFrame(tick)
    }
    pulseRef.current = requestAnimationFrame(tick)
  }

  function clearLandmarkPoints() {
    landmarkMarkersRef.current.forEach((m) => m.remove())
    landmarkMarkersRef.current = []
  }

  // Highlight the node's representative references: real boundaries (Cà Mau,
  // A Lưới) get a pulsing orange outline + a floating label chip; point
  // landmarks with no authoritative boundary (War Zone C/D, the Iron Triangle,
  // Biên Hòa airbase) get a labelled orange ring marker. Shown in 3D too —
  // the outline drapes over the terrain and markers track its elevation.
  function applyLandmarks(ev: StoryEvent | null) {
    const map = mapRef.current
    if (!map || !map.getSource(LANDMARK_SOURCE)) return
    const src = map.getSource(LANDMARK_SOURCE) as maplibregl.GeoJSONSource
    clearLandmarkPoints()
    const landmarks = ev ? ev.landmarks : undefined
    if (!landmarks || !landmarks.length) {
      stopPulse()
      src.setData(EMPTY_FC)
      return
    }
    // Real boundary outlines, looked up in landmarks.geojson by id.
    const all = landmarksRef.current
    const feats = landmarks
      .filter((l) => l.boundaryId)
      .map((l) => all?.features.find((f) => (f.properties as { id?: string } | null)?.id === l.boundaryId))
      .filter((f): f is FeatureCollection['features'][number] => !!f)
    src.setData({ type: 'FeatureCollection', features: feats })
    if (feats.length) startPulse()
    else stopPulse()
    // Labels/markers — HTML chips (map glyphs lack Vietnamese diacritics).
    // Point landmarks use the same pulsing dot + pointer chip as test-spray
    // sites; boundary landmarks float a pointer-less chip (the pulsing outline
    // is the pointer).
    for (const l of landmarks) {
      if (!l.point) continue
      const el = document.createElement('div')
      if (l.boundaryId) {
        el.className = 'map-area-label'
        el.innerHTML = `<span class="map-dot-label">${l.name}</span>`
      } else {
        el.className = 'map-dot'
        el.innerHTML =
          '<span class="map-dot-ring"></span><span class="map-dot-core"></span>' +
          `<span class="map-dot-label">${l.name}</span>`
      }
      landmarkMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(l.point).addTo(map))
    }
  }

  // Keep framed content clear of the card (left on desktop, bottom on mobile).
  // The story card floats over the map's left (its right edge sits ~740px in).
  // On big screens the auto-framed focus clears it, but on laptop widths the
  // centred focus falls behind the card, so we pad the map's left by roughly
  // the card's reach — the map re-centres its focus into the clear area to the
  // right (industry-standard for scrollytelling maps with a side panel).
  function framePadding(i?: number): maplibregl.PaddingOptions {
    const w = window.innerWidth
    if (w <= 640) {
      // The phone deck card shows its full content (no inner scroll), so its
      // height varies by node. Reserve the rendered box of the node being
      // framed — deck cards are hidden with `visibility`, never `display`,
      // precisely so they stay measurable here. Safety-capped at half the
      // screen; fallback if the card is somehow not in the DOM yet.
      const card = i != null ? document.querySelectorAll('.story-card')[i] : null
      const box = card ? card.getBoundingClientRect().height : 0
      const h = Math.round(Math.min(box > 0 ? box : window.innerHeight * 0.36, window.innerHeight * 0.5))
      return { left: 16, right: 16, top: 40, bottom: h + 28 }
    }
    // A modest left bias nudges the focus (and its westmost label chips) clear
    // of the card's right edge; too much and Vietnam is shoved to the far edge
    // and bbox nodes zoom out. 280 ≈ a ~105px rightward shift vs symmetric.
    if (w <= 1800) return { left: 280, top: 70, right: 70, bottom: 70 }
    return { left: 70, top: 70, right: 70, bottom: 70 }
  }

  // Cancel any in-flight heat-sweep animation.
  function cancelHeatAnim() {
    if (heatAnimRef.current != null) {
      cancelAnimationFrame(heatAnimRef.current)
      heatAnimRef.current = null
    }
  }

  // Cancel a bloom that's been armed but hasn't started yet (waiting for the
  // camera to arrive).
  function cancelPendingSweep() {
    if (pendingSweepRef.current) {
      pendingSweepRef.current()
      pendingSweepRef.current = null
    }
  }

  // Arm the bloom to start once the camera has FINISHED flying to the node.
  // The camera fly and the bloom used to run together, so on long flights the
  // bloom finished mid-flight and was over by the time the reader arrived. Now
  // the old extent stays put during the flight and the new area grows in only
  // after the camera lands, so the reveal is always seen. A fallback timer
  // covers the rare case where 'moveend' doesn't fire (e.g. a no-op move).
  function armSweepOnArrival(map: maplibregl.Map, toDay: number) {
    cancelHeatAnim()
    cancelPendingSweep()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      dayRef.current = toDay
      setStoryHeatTime(map, toDay)
      return
    }
    let done = false
    const fire = () => {
      if (done) return
      done = true
      window.clearTimeout(fallback)
      map.off('moveend', fire)
      pendingSweepRef.current = null
      sweepHeatTo(map, toDay)
    }
    const fallback = window.setTimeout(fire, 1900)
    pendingSweepRef.current = () => {
      done = true
      window.clearTimeout(fallback)
      map.off('moveend', fire)
    }
    map.once('moveend', fire)
  }

  // Advance the cumulative heat window from wherever it is now (dayRef) to the
  // target day by ANIMATING the time filter, so the newly sprayed area blooms
  // outward in real chronological order — the reader sees how much the spray
  // grew between one event and the next, instead of it popping in at once. The
  // reverse (scrolling up) recedes symmetrically. Reduced motion → jump.
  function sweepHeatTo(map: maplibregl.Map, toDay: number) {
    cancelHeatAnim()
    const fromDay = dayRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || fromDay === toDay) {
      dayRef.current = toDay
      setStoryHeatTime(map, toDay)
      return
    }
    const data = dataRef.current
    const span = data ? data.dayMax - data.dayMin : 3650
    const jump = Math.abs(toDay - fromDay)
    // Slow enough that the growth reads as growth: ~1.5s for a typical
    // event-to-event gap, up to ~2.8s for the biggest jumps. One gesture.
    const duration = Math.min(2800, Math.max(1500, (jump / span) * 5600))
    // Throttle setFilter so a full reveal re-tessellates the heatmap ~60×, not
    // once per frame (60fps × 24k points is what lagged the free-play map).
    const step = Math.max(2, Math.round(jump / 60))
    const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic: quick bloom, soft settle
    const start = performance.now()
    let lastBucket = Number.NaN
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const d = fromDay + (toDay - fromDay) * ease(t)
      dayRef.current = d
      const bucket = Math.round(d / step)
      if (bucket !== lastBucket) {
        lastBucket = bucket
        setStoryHeatTime(map, d)
      }
      if (t < 1) {
        heatAnimRef.current = requestAnimationFrame(tick)
      } else {
        dayRef.current = toDay
        setStoryHeatTime(map, toDay) // land exactly on the event date
        heatAnimRef.current = null
      }
    }
    heatAnimRef.current = requestAnimationFrame(tick)
  }

  // Opening state: NO spray drawn yet (so nothing vanishes on the first scroll);
  // spray then builds from 1962.
  function setHookState() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    cancelHeatAnim()
    cancelPendingSweep()
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : 0
    // No `padding` here or anywhere — see the PADDING RULE above applyStep.
    // (Symmetric padding shifts nothing anyway; this camera is a plain centre.)
    map.flyTo({ ...HOOK.camera, pitch, bearing: 0, duration: 1200, essential: true })
    dayRef.current = 0
    setStoryHeatTime(map, 0) // before 1962 → nothing shown
    setStoryHeatVisible(map, true)
    wantTracksRef.current = false
    // Back at the hook, so no dissolve to preserve: park the lines and give
    // the heat its alpha back outright.
    resetStoryMarks(map)
    setSVVisible(true)
    clearCrosses()
    applyLandmarks(null)
  }

  /**
   * PADDING RULE — never set persistent camera padding on this map.
   *
   * MapLibre's `flyTo({padding})` stores the padding on the transform, and
   * `cameraForBounds` then subtracts BOTH that stored padding AND the padding
   * option it is given:
   *
   *   availableHeight = tr.height - (edgePadding.top + edgePadding.bottom
   *                                  + padding.top + padding.bottom)
   *
   * Every step here frames with the full card reservation, so on a phone the
   * double count exceeds the screen: 844 − 2×(40 + card + 20) goes negative,
   * at which point fitBounds logs a warning, returns undefined, and the
   * camera silently does not move at all — three consecutive nodes shared one
   * frame. When the doubled figure stays barely positive the fit degenerates
   * instead: zoom clamps to minZoom and the centre lands in the sea. Desktop
   * only ever paid a subtle over-zoom-out and a ~105px sideways drift, which
   * is why the bug survived every desktop review.
   *
   * So: point nodes fly with an `offset` (pure per-call geometry, stores
   * nothing), and bbox fits get the padding as their option, counted once
   * against a transform whose stored padding is always zero.
   */
  const frameOffset = (pad: maplibregl.PaddingOptions): [number, number] => [
    ((pad.left ?? 0) - (pad.right ?? 0)) / 2,
    ((pad.top ?? 0) - (pad.bottom ?? 0)) / 2,
  ]

  /**
   * Our own bbox fit — zoom and centre for a box inside the padded area.
   *
   * fitBounds is not used any more, for a measured reason: when its maxZoom
   * clamp engages (the hotspots bbox is 0.22° wide), MapLibre applies the
   * padding's centre-offset with the wrong sign and the subject lands BELOW
   * the reserved band by exactly twice the offset. The math it should do is
   * twelve lines, so both node kinds now go through the one call shape that
   * measured correct on every viewport: flyTo with a per-call `offset`.
   */
  function fitCamera(
    map: maplibregl.Map,
    bbox: [number, number, number, number],
    pad: maplibregl.PaddingOptions,
  ): { center: [number, number]; zoom: number } {
    const nw = maplibregl.MercatorCoordinate.fromLngLat([bbox[0], bbox[3]])
    const se = maplibregl.MercatorCoordinate.fromLngLat([bbox[2], bbox[1]])
    const dx = Math.abs(se.x - nw.x)
    const dy = Math.abs(se.y - nw.y)
    const availW = window.innerWidth - Number(pad.left ?? 0) - Number(pad.right ?? 0)
    const availH = window.innerHeight - Number(pad.top ?? 0) - Number(pad.bottom ?? 0)
    // world size is 512·2^z px; the box spans dx·world px on screen.
    const zoom = Math.log2(Math.min(availW / dx, availH / dy) / 512)
    const mid = new maplibregl.MercatorCoordinate((nw.x + se.x) / 2, (nw.y + se.y) / 2, 0)
    const c = mid.toLngLat()
    return {
      center: [c.lng, c.lat],
      zoom: Math.min(Math.max(zoom, map.getMinZoom()), map.getMaxZoom()),
    }
  }

  function applyStep(i: number) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const ev = FACTS_EVENTS[i]
    if (!ev) return
    const pad = framePadding(i)
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : ev.camera.pitch ?? 0
    const cam = ev.bbox
      ? { ...fitCamera(map, ev.bbox, pad), bearing: 0 }
      : { center: ev.camera.center, zoom: ev.camera.zoom, bearing: ev.camera.bearing ?? 0 }
    map.flyTo({
      ...cam,
      pitch,
      offset: frameOffset(pad),
      duration: 1500,
      essential: true,
    })
    // The handover node swaps the binned field for the runs themselves.
    const wasTracks = wantTracksRef.current
    wantTracksRef.current = !!ev.tracks

    // Pilot nodes show crosses instead of a (near-invisible) heatmap.
    const isPilot = !!ev.crosses
    const day = dateToDay(ev.date)
    // WHICH MARK is drawn, decided before and independently of what the heat
    // is doing. Entering or leaving the handover dissolves between the two;
    // every other step just parks the tracks and restores the heat's alpha,
    // which the fade leaves at 0 when the lines win.
    if (ev.tracks || wasTracks) crossfadeStoryMarks(map, !!ev.tracks)
    else resetStoryMarks(map)

    if (ev.tracks) {
      // The same country, redrawn as the record. The camera does not move
      // between the reckoning and here — they share a bbox — so the dissolve
      // IS the transition the reader gets.
      cancelHeatAnim()
      cancelPendingSweep()
      dayRef.current = day
      setStoryHeatTime(map, day)
      clearCrosses()
    } else if (isPilot) {
      // No heat here; keep the filter in sync (invisibly) so the next heat node
      // blooms from the right starting point, and show the pulsing crosses.
      cancelHeatAnim()
      cancelPendingSweep()
      dayRef.current = day
      setStoryHeatTime(map, day)
      setStoryHeatVisible(map, false)
      showCrosses(ev.crosses)
    } else {
      // Bloom the newly sprayed area into view — but only AFTER the camera has
      // flown to the node, so it's never missed on a long flight.
      setStoryHeatVisible(map, true)
      clearCrosses()
      armSweepOnArrival(map, day)
    }
    applyLandmarks(ev)
    setSVVisible(false)
  }

  // Create the map once; it's a passive stage driven by scroll.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    resolveMapStyle().then((style) => {
      if (cancelled || !containerRef.current) return
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: HOOK.camera.center,
        zoom: HOOK.camera.zoom,
        // A phone frames each node in the band above the card (~430px of an
        // 844px screen), which changes two limits the shared config assumes:
        // the opening whole-South-Vietnam fit needs z≈5.1 (below the 5.6
        // floor), and placing that frame's centre in the band puts the
        // viewport's bottom edge at ~0.7°N — south of the leash at 2°N, which
        // otherwise clamps the centre and silently shoves the whole opener
        // ~67px down into the card. Desktop keeps the shared limits.
        minZoom: window.innerWidth <= 640 ? 5.0 : mapConfig.view.minZoom,
        maxZoom: mapConfig.view.maxZoom,
        maxBounds:
          window.innerWidth <= 640
            ? ([
                [94.0, -2.0],
                [122.0, 26.0],
              ] as [[number, number], [number, number]])
            : mapConfig.view.maxBounds,
        maxPitch: mapConfig.view.maxPitch,
        interactive: false,
        attributionControl: { compact: true },
      })
      mapRef.current = map

      /**
       * Collapse the credit line to its ⓘ.
       *
       * MapLibre's compact attribution renders EXPANDED and folds on the map's
       * `drag` event — that is the only thing bound to
       * `_updateCompactMinimize`. The Archive therefore folds itself the first
       * time a reader pans, but this map is `interactive: false`, so the drag
       * never comes and the full "OpenFreeMap © OpenMapTiles Data from
       * OpenStreetMap" string sat across the corner for the whole story.
       *
       * Timing is the whole difficulty. The class is not there at load: traced
       * against this style, MapLibre adds it once at ~2.3s, when the source's
       * attribution first resolves. Anything that fires earlier — `load`,
       * `idle` — removes a class that has not been added yet and silently does
       * nothing, which is exactly how the first attempt failed. So watch for
       * it instead, fold it the moment it appears, and disconnect: one add,
       * one removal, and the reader's own click on the ⓘ still works.
       */
      const attribEl = map.getContainer().querySelector('.maplibregl-ctrl-attrib')
      if (attribEl) {
        const obs = new MutationObserver(() => {
          if (attribEl.classList.contains('maplibregl-compact-show')) {
            attribEl.classList.remove('maplibregl-compact-show')
            obs.disconnect()
          }
        })
        obs.observe(attribEl, { attributes: true, attributeFilter: ['class'] })
      }

      const asset = (f: string) => fetch(`${import.meta.env.BASE_URL}${f}`).then((r) => r.json())
      Promise.all([
        loadSpray(),
        loadHeat(),
        asset('data/military-region-dividers.geojson'),
        asset('data/military-region-labels.geojson'),
        asset('data/landmarks.geojson'),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray, heat, mrGeo, mrLabelsGeo, landmarksGeo]) => {
        if (!mapRef.current) return
        dataRef.current = spray
        landmarksRef.current = landmarksGeo as FeatureCollection
        const mc = monthlyCumulative(spray)
        setMonthlyCum(mc.months)
        setYearStart(mc.yearStart)
        applyMapTheme(map)

        // Curated labels — shared with the Archive (see labelLayers.ts).
        applyLabelCuration(map)

        // …and the same GROUND as the Archive. This map used to stop at
        // applyMapTheme, so the sea sat a point or two off the land and the
        // coastline barely read, today's forest cover showed as green blobs on
        // a map about defoliation, and every minor road was still drawn. The
        // ground pass fixes all three; `labels: false` keeps the Story's own
        // label policy, which shows the province and town names the Archive
        // deliberately hides.
        quietBasemap(map, { labels: false, water: STORY_WATER })


        // Real terrain relief from free AWS Terrarium tiles. Added first so it
        // sits beneath the spray heatmap. Soft relief is always on, as on the
        // Archive: the highlands are why the valleys were sprayed, and a map
        // that only shows them once you press 3D hides that for the whole
        // story. The toggle deepens it rather than switching it on.
        if (mapConfig.terrain && !map.getSource(DEM_SOURCE)) {
          map.addSource(DEM_SOURCE, {
            type: 'raster-dem',
            tiles: [mapConfig.terrain.demUrl],
            tileSize: 256,
            encoding: mapConfig.terrain.encoding,
            maxzoom: 15,
          })
          addHillshade(map, DEM_SOURCE)
          setHillshade(map, true, is3DRef.current ? RELIEF_TILTED : RELIEF_FLAT)
        }

        // One combined, brand-orange heatmap (all agents merged) — no muddy
        // per-agent overlap.
        //
        // Fed by the LINE binning, not by `spray`. `spray` is one point per
        // HERBS waypoint carrying the gallons booked against waypoint 1A, and a
        // heat field built on that answers "where were the accounts kept"
        // rather than "where did it fall" — at this map's smoothing radius
        // (3–7 km on the ground) that is 42–58% of the volume in the wrong
        // place. docs/methods.md §3. `spray` still drives everything the Story
        // computes over TIME, where no spatial convention applies.
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: heat.features })
        addStoryHeat(map, SPRAY_SOURCE, heat.dayMax)

        // Military-region dividers + tags — shared with the Archive.
        addMilitaryRegions(map, mrGeo, mrLabelsGeo, STORY_HEAT_LAYER)

        // Per-node landmark boundary: the active node's representative area
        // (Cà Mau, A Lưới) outlined in pulsing orange. Labels are HTML chips
        // (markers) — the self-hosted glyphs miss Vietnamese diacritics, so a
        // symbol layer would render "A LƯỚI" as "A LI".
        map.addSource(LANDMARK_SOURCE, { type: 'geojson', data: EMPTY_FC })
        map.addLayer({
          id: 'landmark-outline',
          type: 'line',
          source: LANDMARK_SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#e8443a', 'line-width': 3, 'line-opacity': 0.95 },
        })

        // Disputed-island labels — shared with the Archive.
        addIslandMarks(map)

        // The handover node's mark: the individual runs. Loaded AFTER the map
        // is up and drawing, not alongside the story's own data — it is 560 kB
        // serving the last card, and making the first card wait on it would be
        // the wrong trade. If the reader gets there before it lands, applyStep
        // has already set the flag and the load turns the layer on itself.
        loadTracks([], [], `${import.meta.env.BASE_URL}data/spray-tracks.json`)
          .then((t) => {
            if (!mapRef.current) return
            addStoryTracks(map, t.lines)
            // The reader can reach the handover before this 560 kB lands, in
            // which case the lines still arrive by dissolve rather than pop.
            if (wantTracksRef.current) crossfadeStoryMarks(map, true)
          })
          .catch((e) => console.error('story tracks failed to load', e))

        readyRef.current = true
        setMapReady(true)
        // If the reader already scrolled into the story while we were loading,
        // catch the map up to that node instead of resetting to the hook.
        if (startedRef.current) applyStep(activeRef.current)
        else setHookState()
      })
    })

    return () => {
      cancelled = true
      stopPulse()
      cancelHeatAnim()
      cancelPendingSweep()
      clearCrosses()
      clearLandmarkPoints()
      mapRef.current?.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dissolve the banner's frosted veil once the reader scrolls past ~35% of a
  // viewport, and bring it back at the top. IMPORTANT: never fade this with
  // opacity — opacity < 1 turns a backdrop-filter element into its own
  // backdrop root and it instantly stops sampling the map (goes clear). The
  // CSS transitions blur(N) -> blur(0) instead, which is animatable and, with
  // a static backdrop, flicker-free.
  useEffect(() => {
    const onScroll = () => {
      veilRef.current?.classList.toggle('is-off', window.scrollY > window.innerHeight * 0.35)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scrollama: each step drives the map.
  useEffect(() => {
    const scroller = scrollama()
    scroller
      .setup({ step: '.story-step', offset: 0.6 })
      .onStepEnter(({ index }: { index: number }) => {
        const first = !startedRef.current
        setStarted(true)
        startedRef.current = true
        setEnded(false)
        // iOS Safari collapses and expands its toolbar WHILE the page scrolls,
        // firing resize each time; a recomputed trigger line can re-enter the
        // step the reader is already on. Restarting the 1500ms flight on every
        // such re-entry means the camera never arrives and tiles never load —
        // the map freezes on whatever was cached. Same node → nothing to do.
        if (!first && index === activeRef.current) return
        setActive(index)
        activeRef.current = index
        applyStep(index)
      })
      .onStepExit(({ index, direction }: { index: number; direction: string }) => {
        if (index === 0 && direction === 'up') {
          setStarted(false)
          startedRef.current = false
          setHookState()
        }
        if (index === FACTS_EVENTS.length - 1 && direction === 'down') setEnded(true)
      })
    // Recompute step thresholds only for real geometry changes. The iOS
    // toolbar shrinks and grows innerHeight by ~60–110px during ordinary
    // scrolling; letting each of those recompute the 0.6-offset trigger line
    // makes the line jump across the reader's position mid-scroll and fire
    // spurious enters (see the guard above — this attacks the same failure
    // from the other side). Width changes and real rotations still resize.
    let lastW = window.innerWidth
    let lastH = window.innerHeight
    const onResize = () => {
      const dW = window.innerWidth !== lastW
      const dH = Math.abs(window.innerHeight - lastH)
      if (dW || dH > 150) {
        lastW = window.innerWidth
        lastH = window.innerHeight
        scroller.resize()
      }
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      scroller.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // DECK DRIVE (phones): the caption deck follows the finger. Each card's
  // horizontal position is a pure function of scrollY — no discrete events, so
  // there is nothing to mis-fire or flicker. The function writes ONE custom
  // property (--deck-f, the fractional node index) on the story root per
  // animation frame; the cards' transforms are CSS calc() against it, so React
  // never re-renders during scroll. The slide happens across the middle 40% of
  // the gap between two steps, centred exactly on scrollama's 0.6 trigger
  // line, so the camera departs at the same moment the card is mid-hand-off.
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ)
    let steps: HTMLElement[] = []
    let start = 0
    let stepH = 1
    let raf = 0
    const measure = () => {
      steps = Array.from(document.querySelectorAll<HTMLElement>('.story-step'))
      if (steps.length >= 2) {
        const a = steps[0].getBoundingClientRect().top + window.scrollY
        const b = steps[1].getBoundingClientRect().top + window.scrollY
        start = a
        stepH = b - a || window.innerHeight
      }
    }
    const apply = () => {
      raf = 0
      if (!mq.matches || steps.length < 2) return
      const g = (window.scrollY + window.innerHeight * 0.6 - start) / stepH
      const N = FACTS_EVENTS.length
      const fRaw = Math.min(Math.max(g - 0.5, 0), N - 1)
      const i0 = Math.floor(fRaw)
      const t = fRaw - i0
      const tt = t < 0.3 ? 0 : t > 0.7 ? 1 : (t - 0.3) / 0.4
      let f = i0 + tt * tt * (3 - 2 * tt)
      // Tail: the story's exit line is g = N, but the section after it is
      // already rising through the bottom 40% of the screen before that — the
      // last card would float over its heading. So the card slides off to the
      // left across the final half-step, under the finger like every other
      // hand-off, finishing exactly at the exit line (where `ended` takes over).
      const u = Math.min(Math.max((g - (N - 0.4)) / 0.4, 0), 1)
      if (u > 0) f = N - 1 + u * u * (3 - 2 * u)
      storyRef.current?.style.setProperty('--deck-f', f.toFixed(4))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    measure()
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    const onResize = () => {
      measure()
      onScroll()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3D view tilts the camera and turns on real terrain relief; the flat heatmap
  // drapes over it (no columns).
  function toggle3D() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    is3DRef.current = next
    map.easeTo({ pitch: next ? mapConfig.view.pitch3d : 0, duration: 800 })
    if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
      try {
        map.setTerrain(next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null)
        // Relief stays on in both views; tilting only deepens it.
        setHillshade(map, true, next ? RELIEF_TILTED : RELIEF_FLAT)
      } catch {
        /* terrain is optional */
      }
    }
    // Landmarks stay on in 3D (they drape over the relief).
    applyLandmarks(started ? FACTS_EVENTS[active] : null)
  }

  return (
    <div className={`story${started && !ended ? ' story-deck-live' : ''}`} ref={storyRef}>
      <StoryNav />

      <div className="story-graphic">
        <div ref={containerRef} className={`story-map${mapReady ? ' is-ready' : ''}`} />
        {/* Progressive frosted blur for the banner. It lives INSIDE the sticky
            container so it never moves relative to the map it blurs — the
            blurred result rasterizes once instead of every scroll frame (which
            was the flicker). It fades out via opacity (compositor-only) as the
            banner scrolls away; see the scroll effect below. */}
        <div ref={veilRef} className="story-map-veil" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      </div>

      <MapKey
        map={mapRef.current}
        ready={mapReady}
        started={started}
        is3D={is3D}
        onToggle3D={toggle3D}
        tracks={!!FACTS_EVENTS[active]?.tracks}
      />

      <TimelineRuler
        monthlyCum={monthlyCum}
        yearStart={yearStart}
        nodeFracs={nodeFracs}
        fmt={fmtGallons}
        storyRef={storyRef}
      />

      <div className="story-scroll">
        <section className="story-hook">
          <div className="story-hook-blur" aria-hidden="true" />
          <div className="story-hook-wash" aria-hidden="true" />
          <RainCanvas />
          <div className="story-hook-inner">
            <p className="story-hook-credit">
              <span>Built on data &amp; reporting from</span>
              <img src={usaidInk} alt="USAID" />
              <span>UNDP · U.S. National Archives</span>
            </p>
            <h1 className="story-hook-title">{HOOK.title}</h1>
            <p className="story-hook-sub">{HOOK.subtitle}</p>
            <p className="story-hook-dek">{HOOK.dek}</p>
            <button
              className="story-hook-cta"
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
            >
              {HOOK.cue}
              <span className="story-hook-cta-arrow" aria-hidden="true">
                ↓
              </span>
            </button>
          </div>
        </section>

        {FACTS_EVENTS.map((ev, i) => {
          const src = ev.quote ? SOURCES[ev.quote.sourceId] : undefined
          return (
            <Fragment key={ev.id}>
              <section className="story-step" data-index={i} id={NAV_ANCHOR[ev.id]}>
                <article
                  className={`story-card${i === active ? ' is-active' : ''}`}
                  style={{ '--card-i': i } as React.CSSProperties}
                >
                  <p className="story-eyebrow">{ev.period}</p>
                  <h2 className="story-name">{ev.name}</h2>
                  <p className="story-dek">{ev.dek}</p>
                  <p className="story-body">{ev.body}</p>
                  {ev.stat && (
                    <p className="story-stat">
                      <strong>{ev.stat.value}</strong> {ev.stat.label}
                    </p>
                  )}
                  {ev.quote && <StoryQuote quote={ev.quote} src={src} />}
                  {ev.cta && (
                    <Link className="story-card-cta" to={ev.cta.to}>
                      {ev.cta.label}
                      <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </article>
              </section>
            </Fragment>
          )
        })}

        {/* Summary figures — the two full-screen breakdowns close Act I,
            after the reckoning node. */}
        {agentSeries && (
          <div id="sec-rainbow">
            <RainbowHerbicides years={agentSeries.years} series={agentSeries.series} />
          </div>
        )}
        <div id="sec-ecosystems">
          <EcosystemsFigure />
        </div>

        {/* Interlude + Act II. Skeleton editorial sections; details to be
            refined. Each renders its own id'd .story-fullscreen. */}
        <ConsequencesInterlude />
        <ActionsSection />
        <AlternativesSection />
        <MethodsSection />
        <TimelineSection />
        <CloseSection />
      </div>
    </div>
  )
}
