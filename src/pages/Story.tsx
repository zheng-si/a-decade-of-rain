import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Polygon, Point } from 'geojson'
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
import { FACTS_EVENTS, type City } from '../content/facts/events'
import { HOOK } from '../content/facts/hook'
import { CTZ_REGIONS, NODE_CTZ } from '../content/facts/regions'
import { SOURCES } from '../content/sources'
import { TopBar } from '../App'
import LabelPanel from '../components/LabelPanel'
import { readLabelGroups, setGroupVisible, type LabelGroup } from '../components/labelLayers'
import './Story.css'

const SPRAY_SOURCE = 'spray'
const REGION_SOURCE = 'regions'
const VN_SOURCE = 'vietnam'
const ISLAND_SOURCE = 'islands'
const DEM_SOURCE = 'terrain-dem'

// Neutral treatment: the offshore archipelagos are disputed (China, Vietnam,
// Taiwan et al.) and were never sprayed; shown as reference, no sovereignty
// assigned. Names use the common English forms + Vietnamese in parentheses.
const ISLANDS_FC: FeatureCollection<Point, { name: string }> = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Paracel Is. (Hoàng Sa) — disputed' }, geometry: { type: 'Point', coordinates: [112.0, 16.5] } },
    { type: 'Feature', properties: { name: 'Spratly Is. (Trường Sa) — disputed' }, geometry: { type: 'Point', coordinates: [114.0, 9.8] } },
  ],
}

// Region outlines = the four Corps Tactical Zones (Military Regions I–IV).
const REGION_FC: FeatureCollection<Polygon, { id: string }> = {
  type: 'FeatureCollection',
  features: Object.entries(CTZ_REGIONS).map(([z, ring]) => ({
    type: 'Feature',
    properties: { id: `ctz-${z}` },
    geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
  })),
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
  const [labelGroups, setLabelGroups] = useState<LabelGroup[]>([])

  function toggleLabelGroup(key: string) {
    const map = mapRef.current
    if (!map) return
    setLabelGroups((prev) =>
      prev.map((g) => {
        if (g.key !== key) return g
        const visible = !g.visible
        setGroupVisible(map, g.layerIds, visible)
        return { ...g, visible }
      }),
    )
  }

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
      el.innerHTML = `<span class="city-pin-label">${c.name}</span>`
      cityMarkersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -6] })
          .setLngLat([c.lng, c.lat])
          .addTo(map),
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

  // The bold Vietnam border + disputed-island labels are overview-only.
  function setSVVisible(on: boolean) {
    const map = mapRef.current
    if (!map) return
    for (const id of ['vietnam-outline', 'island-dot', 'island-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
  }

  // Keep framed content clear of the card (left on desktop, bottom on mobile).
  function framePadding(): maplibregl.PaddingOptions {
    return window.innerWidth > 640
      ? { left: 460, top: 70, right: 70, bottom: 70 }
      : { left: 24, right: 24, top: 48, bottom: 340 }
  }

  // Opening state: whole sprayed south outlined, NO spray drawn yet (so nothing
  // vanishes on the first scroll); spray then builds from 1962.
  function setHookState() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : 0
    map.flyTo({ ...HOOK.camera, pitch, bearing: 0, padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 1200, essential: true })
    setSprayTime(map, choicesRef.current, 0) // before 1962 → nothing shown
    setAgentVisibility(map, choicesRef.current, 'all')
    setRegionActive(null)
    setSVVisible(true)
    clearCities()
  }

  function applyStep(i: number) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const ev = FACTS_EVENTS[i]
    if (!ev) return
    const pad = framePadding()
    const pitch = is3DRef.current ? mapConfig.view.pitch3d : ev.camera.pitch ?? 0
    if (ev.bbox) {
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
    const ctz = NODE_CTZ[ev.id]
    setRegionActive(ctz ? `ctz-${ctz}` : null)
    setSVVisible(false)
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
        interactive: false,
        attributionControl: { compact: true },
      })
      mapRef.current = map

      Promise.all([
        loadSpray(),
        fetch(`${import.meta.env.BASE_URL}data/vietnam.geojson`).then((r) => r.json()),
        new Promise<void>((resolve) => map.once('load', () => resolve())),
      ]).then(([spray, vnGeo]) => {
        if (!mapRef.current) return
        dataRef.current = spray
        applyMapTheme(map)

        // Enumerate label tiers; hide the granular ones (wards/hamlets/POI).
        const groups = readLabelGroups(map)
        groups.forEach((g) => {
          if (!g.visible) setGroupVisible(map, g.layerIds, false)
        })
        setLabelGroups(groups)

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

        // Bold Vietnam national border + disputed-island labels (overview only).
        map.addSource(VN_SOURCE, { type: 'geojson', data: vnGeo })
        map.addLayer({
          id: 'vietnam-outline',
          type: 'line',
          source: VN_SOURCE,
          layout: { 'line-join': 'round' },
          paint: { 'line-color': '#2f322c', 'line-width': 1.6, 'line-opacity': 0.9 },
        })
        map.addSource(ISLAND_SOURCE, { type: 'geojson', data: ISLANDS_FC })
        map.addLayer({
          id: 'island-dot',
          type: 'circle',
          source: ISLAND_SOURCE,
          paint: {
            'circle-radius': 4,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#8a8d85',
            'circle-stroke-width': 1.2,
          },
        })
        map.addLayer({
          id: 'island-label',
          type: 'symbol',
          source: ISLAND_SOURCE,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Switzer Medium'],
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
            'text-max-width': 9,
          },
          paint: { 'text-color': '#8a8d85', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
        })

        // Per-node region (convex hull of the node's spray), highlighted on step.
        map.addSource(REGION_SOURCE, { type: 'geojson', data: REGION_FC })
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
    map.easeTo({ pitch: next ? mapConfig.view.pitch3d : 0, duration: 800 }) // always tilt
    if (mapConfig.terrain && map.getSource(DEM_SOURCE)) {
      try {
        map.setTerrain(next ? { source: DEM_SOURCE, exaggeration: mapConfig.terrain.exaggeration } : null)
        setHillshade(map, next)
      } catch {
        /* terrain is optional */
      }
    }
  }

  const activeEvent = FACTS_EVENTS[active]

  return (
    <div className="story">
      <TopBar>
        {started && (
          <button className="site-nav-link site-nav-btn" onClick={toggle3D}>
            {is3D ? 'Flat' : '3D'}
          </button>
        )}
      </TopBar>

      <div className="story-graphic">
        <div ref={containerRef} className="story-map" />
        <div className={`story-period${started ? '' : ' is-hidden'}`}>{activeEvent?.period}</div>
        {started && <LabelPanel groups={labelGroups} onToggle={toggleLabelGroup} />}
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
