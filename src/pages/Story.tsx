import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Polygon } from 'geojson'
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
  addHillshade,
  setHillshade,
} from '../components/mapTheme'
import { buildAgentChoices, type AgentChoice } from '../components/agentChoices'
import { HOTSPOTS } from '../data/hotspots'
import { FACTS_EVENTS, type City } from '../content/facts/events'
import { HOOK } from '../content/facts/hook'
import { SOURCES } from '../content/sources'
import './Story.css'

const SPRAY_SOURCE = 'spray'
const REGION_SOURCE = 'regions'
const DEM_SOURCE = 'terrain-dem'

// Region rectangles (from each event's bbox) for the outline layers.
function bboxPolygon(bbox: [number, number, number, number], id: string) {
  const [w, s, e, n] = bbox
  return {
    type: 'Feature' as const,
    properties: { id },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  }
}
const REGION_FC: FeatureCollection<Polygon, { id: string }> = {
  type: 'FeatureCollection',
  features: FACTS_EVENTS.filter((e) => e.bbox).map((e) => bboxPolygon(e.bbox!, e.id)),
}

export default function Story() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const choicesRef = useRef<AgentChoice[]>([])
  const dataRef = useRef<SprayDataset | null>(null)
  const readyRef = useRef(false)
  const cityMarkersRef = useRef<maplibregl.Marker[]>([])
  const is3DRef = useRef(false)
  const [active, setActive] = useState(0)
  const [started, setStarted] = useState(false)
  const [is3D, setIs3D] = useState(false)

  function clearCities() {
    cityMarkersRef.current.forEach((m) => m.remove())
    cityMarkersRef.current = []
  }

  function showCities(cities: City[] | undefined) {
    const map = mapRef.current
    if (!map) return
    clearCities()
    if (!cities) return
    for (const c of cities) {
      const el = document.createElement('div')
      el.className = 'city-pin'
      el.innerHTML = `<span class="city-pin-dot"></span><span class="city-pin-label">${c.name}</span>`
      cityMarkersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([c.lng, c.lat]).addTo(map),
      )
    }
  }

  function setRegionActive(id: string | null) {
    const map = mapRef.current
    if (!map) return
    const f: maplibregl.FilterSpecification = ['==', ['get', 'id'], id ?? '__none__']
    if (map.getLayer('region-fill')) map.setFilter('region-fill', f)
    if (map.getLayer('region-active')) map.setFilter('region-active', f)
  }

  // Keep the framed content clear of the narrative card (left on desktop,
  // bottom sheet on mobile).
  function framePadding(): maplibregl.PaddingOptions {
    return window.innerWidth > 640
      ? { left: 460, top: 70, right: 70, bottom: 70 }
      : { left: 24, right: 24, top: 48, bottom: 340 }
  }

  // Opening state under the hook: whole sprayed south, the full decade down,
  // all war-zone outlines faintly visible. (Hook text is centred, so no bias.)
  function setHookState() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : 0
    const pad = { top: 40, right: 40, bottom: 40, left: 40 }
    map.flyTo({ ...HOOK.camera, pitch, bearing: 0, padding: pad, duration: 1200, essential: true })
    const data = dataRef.current
    if (data) setSprayTime(map, choicesRef.current, data.dayMax)
    setAgentVisibility(map, choicesRef.current, 'all')
    setRegionActive(null)
    clearCities()
  }

  // Map state for a given step: camera + cumulative time + agent + region + pins.
  function applyStep(i: number) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const ev = FACTS_EVENTS[i]
    if (!ev) return
    const pad = framePadding()
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : ev.camera.pitch ?? 0
    if (ev.bbox) {
      // Frame the region's bbox — auto-zooms to fit any viewport aspect.
      map.fitBounds(
        [
          [ev.bbox[0], ev.bbox[1]],
          [ev.bbox[2], ev.bbox[3]],
        ],
        { padding: pad, maxZoom: 11, pitch, bearing: 0, duration: 1500, essential: true },
      )
    } else {
      map.flyTo({
        center: ev.camera.center,
        zoom: ev.camera.zoom,
        pitch,
        bearing: ev.camera.bearing ?? 0,
        padding: pad,
        duration: 1500,
        essential: true,
      })
    }
    setSprayTime(map, choicesRef.current, dateToDay(ev.date))
    setAgentVisibility(map, choicesRef.current, ev.agent)
    setRegionActive(ev.bbox ? ev.id : null)
    showCities(ev.cities)
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
        minZoom: mapConfig.view.minZoom,
        maxZoom: mapConfig.view.maxZoom,
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

        if (mapConfig.terrain && !map.getSource(DEM_SOURCE)) {
          map.addSource(DEM_SOURCE, {
            type: 'raster-dem',
            tiles: [mapConfig.terrain.demUrl],
            tileSize: 256,
            encoding: mapConfig.terrain.encoding,
            maxzoom: 15,
          })
          addHillshade(map, DEM_SOURCE)
        }

        const choices = buildAgentChoices(spray.agents)
        choicesRef.current = choices
        map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
        addSprayLayers(map, SPRAY_SOURCE, choices, spray.dayMax)

        // Region outlines: faint context for every war zone + a highlighted
        // fill/stroke for the active one.
        map.addSource(REGION_SOURCE, { type: 'geojson', data: REGION_FC })
        map.addLayer({
          id: 'region-context',
          type: 'line',
          source: REGION_SOURCE,
          paint: { 'line-color': '#8f9188', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.5 },
        })
        map.addLayer({
          id: 'region-fill',
          type: 'fill',
          source: REGION_SOURCE,
          filter: ['==', ['get', 'id'], '__none__'],
          paint: { 'fill-color': mapConfig.agents[0].color, 'fill-opacity': 0.1 },
        })
        map.addLayer({
          id: 'region-active',
          type: 'line',
          source: REGION_SOURCE,
          filter: ['==', ['get', 'id'], '__none__'],
          paint: { 'line-color': '#2f322c', 'line-width': 2 },
        })

        HOTSPOTS.forEach((h) => {
          const el = document.createElement('div')
          el.className = 'hotspot-marker'
          new maplibregl.Marker({ element: el }).setLngLat([h.lng, h.lat]).addTo(map)
        })

        readyRef.current = true
        setHookState()
      })
    })

    return () => {
      cancelled = true
      clearCities()
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
        setStarted(true)
        setActive(index)
        applyStep(index)
      })
      .onStepExit(({ index, direction }: { index: number; direction: string }) => {
        if (index === 0 && direction === 'up') {
          setStarted(false)
          setHookState()
        }
      })
    const onResize = () => scroller.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      scroller.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle3D() {
    const map = mapRef.current
    if (!map) return
    const next = !is3D
    setIs3D(next)
    is3DRef.current = next
    if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
      map.setTerrain(next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null)
      setHillshade(map, next)
    }
    map.easeTo({ pitch: next ? mapConfig.view.pitch3d : 0, duration: 800 })
  }

  const activeEvent = FACTS_EVENTS[active]

  return (
    <div className="story">
      <div className="story-graphic">
        <div ref={containerRef} className="story-map" />
        <div className={`story-period${started ? '' : ' is-hidden'}`}>{activeEvent?.period}</div>
        {started && (
          <button className="view-toggle story-view-toggle" onClick={toggle3D}>
            {is3D ? '▦ Flat' : '⛰ 3D'}
          </button>
        )}
      </div>

      <div className="story-scroll">
        <section className="story-hook">
          <div className="story-hook-inner">
            <p className="story-hook-eyebrow">{HOOK.eyebrow}</p>
            <h1 className="story-hook-title">{HOOK.title}</h1>
            <p className="story-hook-dek">{HOOK.dek}</p>
            <p className="story-hook-cue">{HOOK.cue}</p>
          </div>
        </section>

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
