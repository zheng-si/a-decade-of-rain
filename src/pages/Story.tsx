import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import scrollama from 'scrollama'
import { loadSpray, dateToDay, type SprayDataset } from '../data/spray'
import { mapConfig } from '../config/mapConfig'
import {
  resolveMapStyle,
  applyMapTheme,
  addSprayLayers,
  setSprayTime,
  setAgentVisibility,
} from '../components/mapTheme'
import { buildAgentChoices, type AgentChoice } from '../components/agentChoices'
import { HOTSPOTS } from '../data/hotspots'
import { FACTS_EVENTS } from '../content/facts/events'
import { SOURCES } from '../content/sources'
import './Story.css'

const SPRAY_SOURCE = 'spray'

export default function Story() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const choicesRef = useRef<AgentChoice[]>([])
  const dataRef = useRef<SprayDataset | null>(null)
  const readyRef = useRef(false)
  const [active, setActive] = useState(0)

  // Apply the map state for a given step (camera + cumulative time + agent).
  function applyStep(i: number) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const ev = FACTS_EVENTS[i]
    if (!ev) return
    map.flyTo({
      center: ev.camera.center,
      zoom: ev.camera.zoom,
      pitch: ev.camera.pitch ?? 0,
      bearing: ev.camera.bearing ?? 0,
      duration: 1500,
      essential: true,
    })
    setSprayTime(map, choicesRef.current, dateToDay(ev.date))
    setAgentVisibility(map, choicesRef.current, ev.agent)
  }

  // Create the map once; it's a passive stage driven by scroll.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    resolveMapStyle().then((style) => {
      if (cancelled || !containerRef.current) return
      const first = FACTS_EVENTS[0].camera
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: first.center,
        zoom: first.zoom,
        maxBounds: mapConfig.view.maxBounds,
        maxPitch: mapConfig.view.maxPitch,
        interactive: false, // scroll drives the camera, not the user
        attributionControl: { compact: true },
      })
      mapRef.current = map

      Promise.all([
        loadSpray(),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray]) => {
        if (!mapRef.current) return
        dataRef.current = spray
        applyMapTheme(map)
        const choices = buildAgentChoices(spray.agents)
        choicesRef.current = choices
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        addSprayLayers(map, SPRAY_SOURCE, choices, spray.dayMax)

        HOTSPOTS.forEach((h) => {
          const el = document.createElement('div')
          el.className = 'hotspot-marker'
          new maplibregl.Marker({ element: el }).setLngLat([h.lng, h.lat]).addTo(map)
        })

        readyRef.current = true
        applyStep(active)
      })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scrollama: each step drives the map.
  useEffect(() => {
    const scroller = scrollama()
    scroller
      .setup({ step: '.story-step', offset: 0.6 })
      .onStepEnter(({ index }: { index: number }) => {
        setActive(index)
        applyStep(index)
      })
    const onResize = () => scroller.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      scroller.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeEvent = FACTS_EVENTS[active]

  return (
    <div className="story">
      <div className="story-graphic">
        <div ref={containerRef} className="story-map" />
        <div className="story-period">{activeEvent?.period}</div>
      </div>

      <div className="story-steps">
        {FACTS_EVENTS.map((ev, i) => {
          const src = ev.quote ? SOURCES[ev.quote.sourceId] : undefined
          return (
            <section className="story-step" key={ev.id} data-index={i}>
              <article className={`story-card${i === active ? ' is-active' : ''}`}>
                <p className="story-eyebrow">
                  {ev.period}
                  {ev.stat && (
                    <span className="story-stat">
                      {' · '}
                      <strong>{ev.stat.value}</strong> {ev.stat.label}
                    </span>
                  )}
                </p>
                <h2 className="story-name">{ev.name}</h2>
                <p className="story-dek">{ev.dek}</p>
                <p className="story-body">{ev.body}</p>
                {ev.quote && (
                  <blockquote className="story-quote">
                    <p>“{ev.quote.text}”</p>
                    <cite>
                      — {ev.quote.speaker}
                      {src && (
                        <>
                          {', '}
                          <a href={src.url} target="_blank" rel="noreferrer">
                            {src.publisher}
                          </a>
                        </>
                      )}
                    </cite>
                  </blockquote>
                )}
              </article>
            </section>
          )
        })}
      </div>
    </div>
  )
}
