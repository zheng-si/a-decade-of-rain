import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HOTSPOTS, VIETNAM_VIEW } from '../data/hotspots'
import { loadSpray, dayToDate, type SprayDataset } from '../data/spray'
import Timeline from './Timeline'
import { buildAgentChoices, type AgentChoice } from './agentChoices'

// OpenFreeMap provides free vector tiles + styles with no API key required.
// https://openfreemap.org
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

const SPRAY_SOURCE = 'spray'
const SPRAY_LAYER = 'spray-heat'

// Target wall-clock duration for a full 1961→1971 play-through.
const PLAY_DURATION_MS = 28_000

const monthLabel = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

/** MapLibre filter: cumulative up to `day`, optionally restricted to agents. */
function sprayFilter(day: number, indices: number[] | null): ExpressionSpecification {
  const time: ExpressionSpecification = ['<=', ['get', 'day'], day]
  if (!indices) return time
  return ['all', time, ['in', ['get', 'agent'], ['literal', indices]]]
}

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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: VIETNAM_VIEW.center,
      zoom: VIETNAM_VIEW.zoom,
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

      map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
      map.addLayer({
        id: SPRAY_LAYER,
        type: 'heatmap',
        source: SPRAY_SOURCE,
        paint: {
          'heatmap-weight': ['get', 'w'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 9, 2.5],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 7, 18, 10, 40],
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.15, 'rgba(254,235,178,0.55)',
            0.4, 'rgb(254,196,79)',
            0.65, 'rgb(240,128,40)',
            0.85, 'rgb(214,69,40)',
            1, 'rgb(150,20,20)',
          ],
        },
      })

      setChoices(buildAgentChoices(spray.agents))
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

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const activeIndices = choices.find((c) => c.key === agentKey)?.indices ?? null

  // Re-apply the heatmap filter whenever the playhead or agent selection moves.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map?.getLayer(SPRAY_LAYER)) return
    map.setFilter(SPRAY_LAYER, sprayFilter(day, activeIndices))
  }, [ready, day, activeIndices])

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
