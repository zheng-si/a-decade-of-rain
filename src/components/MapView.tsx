import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HOTSPOTS } from '../data/hotspots'
import { loadSpray, dayToDate, type SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'
import Timeline from './Timeline'
import { buildAgentChoices, type AgentChoice } from './agentChoices'
import { applyMapTheme, addSprayLayers, setSprayTime, setAgentVisibility } from './mapTheme'

const SPRAY_SOURCE = 'spray'

// Target wall-clock duration for a full 1961→1971 play-through.
const PLAY_DURATION_MS = 28_000

const monthLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

/** Cumulative run count + gallons up to `day`, restricted to `indices`. */
function cumulative(data: SprayDataset, day: number, indices: number[] | null) {
  let runs = 0
  let gallons = 0
  const set = indices ? new Set(indices) : null
  for (const f of data.features.features) {
    const p = f.properties
    if (p.day > day) continue // features are day-sorted, but cheap enough to scan
    if (set && !set.has(p.agent)) continue
    runs++
    gallons += p.gallons
  }
  return { runs, gallons }
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dataRef = useRef<SprayDataset | null>(null)

  const [ready, setReady] = useState(false)
  const [bounds, setBounds] = useState({ min: 0, max: 0 })
  const [choices, setChoices] = useState<AgentChoice[]>([])
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [agentKey, setAgentKey] = useState('all')

  // Refs mirror state for the animation loop to avoid stale closures.
  const dayRef = useRef(0)
  const playingRef = useRef(false)
  dayRef.current = day
  playingRef.current = playing

  // One-time map + data setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    // Resolve the style: a plain URL, or — when a custom glyph endpoint is
    // configured — the style JSON with its `glyphs` swapped to it.
    async function resolveStyle(): Promise<string | maplibregl.StyleSpecification> {
      if (!mapConfig.glyphsUrl) return mapConfig.baseStyleUrl
      const resp = await fetch(mapConfig.baseStyleUrl)
      const style = (await resp.json()) as maplibregl.StyleSpecification
      style.glyphs = mapConfig.glyphsUrl
      return style
    }

    resolveStyle().then((style) => {
      if (cancelled || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: mapConfig.view.center,
        zoom: mapConfig.view.zoom,
        minZoom: mapConfig.view.minZoom,
        maxZoom: mapConfig.view.maxZoom,
        maxBounds: mapConfig.view.maxBounds,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

      Promise.all([
        loadSpray(),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray]) => {
        if (!mapRef.current) return
        dataRef.current = spray

        applyMapTheme(map)

        const agentChoices = buildAgentChoices(spray.agents)
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        addSprayLayers(map, SPRAY_SOURCE, agentChoices, spray.dayMax)

        setChoices(agentChoices)
        setBounds({ min: spray.dayMin, max: spray.dayMax })
        setDay(spray.dayMax) // start showing the full record
        setReady(true)
      })

      HOTSPOTS.forEach((h) => {
        const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
          `<strong>${h.name}</strong><br/><span style="font-size:12px;color:#555">${h.note}</span>`,
        )
        new maplibregl.Marker({ color: '#d6453d' })
          .setLngLat([h.lng, h.lat])
          .setPopup(popup)
          .addTo(map)
      })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  const activeIndices = choices.find((c) => c.key === agentKey)?.indices ?? null

  // Advance the cumulative time window on every agent layer.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setSprayTime(map, choices, day)
  }, [ready, day, choices])

  // Toggle which agent layers are visible.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    setAgentVisibility(map, choices, agentKey)
  }, [ready, agentKey, choices])

  // Animation loop: advance the playhead in real time while playing.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let prev = performance.now()
    const span = bounds.max - bounds.min
    // If we're at (or past) the end, restart from the beginning.
    if (dayRef.current >= bounds.max) setDay(bounds.min)

    const tick = (now: number) => {
      const dt = now - prev
      prev = now
      const next = dayRef.current + (span * dt) / PLAY_DURATION_MS
      if (next >= bounds.max) {
        setDay(bounds.max)
        setPlaying(false)
        return
      }
      setDay(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, bounds.min, bounds.max])

  const stats = dataRef.current
    ? cumulative(dataRef.current, day, activeIndices)
    : { runs: 0, gallons: 0 }

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-root" />
      {ready && (
        <Timeline
          day={day}
          dayMin={bounds.min}
          dayMax={bounds.max}
          playing={playing}
          dateLabel={monthLabel(day)}
          runCount={stats.runs}
          gallons={stats.gallons}
          agentChoices={choices}
          activeAgentKey={agentKey}
          onScrub={(d) => {
            setPlaying(false)
            setDay(d)
          }}
          onTogglePlay={() => setPlaying((p) => !p)}
          onSelectAgent={setAgentKey}
        />
      )}
    </div>
  )
}
