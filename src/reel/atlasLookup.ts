// ── shot 7 · within 5 km of Cát Tiên, in the Atlas's own language ────────
// The Atlas exactly as it draws the record at the near zoom: the same ground,
// relief and labels, the runs as tracks in their agents' colours with width by
// gallons per kilometre and the taper from the first waypoint (trackLayers).
// Then the Location Lookup, as the Atlas runs it (MapView): the record steps
// back, a paper veil falls outside the circle, the dashed ring and the pin go
// down, the hits are redrawn on the lookup's own layers, and the lookup panel
// itself (LocationLookup) answers. The only liberty is the ring's radius,
// opened continuously from 0 to 5 km so the answer arrives run by run.
//
//   0.0 – 1.4   the record around Cát Tiên
//   1.4 – 5.6   the lookup opens to 5 km
//   5.6 – 10    hold on the answer
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import '../fonts.css'
import '../index.css'
import '../App.css'
import '../fontsGeist.css'
import '../ArchiveSkinV2.css'
import './reel-site.css'
import { mapConfig } from '../config/mapConfig'
import { resolveMapStyle, applyMapTheme, addHillshade, setHillshade, addIslandMarks } from '../components/mapTheme'
import { applyLabelCuration } from '../components/labelLayers'
import { quietBasemap, addVietnamLabel, agentIndexColors, DOTS } from '../components/volumeGrid'
import { buildAgentChoices } from '../components/agentChoices'
import {
  addTrackLayers,
  setTrackAgents,
  setHighlightByFeature,
  taperGradient,
  hitWidthRamp,
  hitMarkRamp,
  TRACK_LAYER,
  TRACK_HUE_LAYERS,
  TRACK_DIM_LAYER,
  TRACK_NIL_LAYER,
  TRACK_MARK_LAYER,
  TRACK_END_LAYER,
} from '../components/trackLayers'
import { loadSpray } from '../data/spray'
import { loadTracks, type TrackDataset } from '../data/tracks'
import { queryLookup, indexMissions, circlePolygon, veilPolygon, type LookupHit } from '../components/lookup'
import LocationLookup, { type LookupState } from '../components/LocationLookup'
import type { Shot } from './main'
import { span, easeInOut, lerp } from './util'

const PLACE = { name: 'Cát Tiên', lng: 107.36215, lat: 11.58321 }
const R_MAX = 5
const DURATION = 10
const RELIEF_FLAT = 0.28
const DEM_SOURCE = 'terrain-dem'

// MapView's own lookup layers, verbatim ids and paints.
const LOOKUP_VEIL_SRC = 'lookup-veil'
const LOOKUP_CIRCLE_SRC = 'lookup-circle'
const LOOKUP_HI_SRC = 'lookup-hi'
const LOOKUP_VEIL_LAYER = 'lookup-veil-fill'
const LOOKUP_CIRCLE_LAYER = 'lookup-circle-line'
const LOOKUP_HI_PT = 'lookup-hi-pt'
const LOOKUP_HI_COLOURS = Array.from(new Set(mapConfig.agents.map((g) => g.color)))
const LOOKUP_HI_LINES = LOOKUP_HI_COLOURS.map((_, i) => `lookup-hi-line-${i}`)
const RECORD_TIERS = [TRACK_LAYER, ...TRACK_HUE_LAYERS, TRACK_DIM_LAYER, TRACK_NIL_LAYER, TRACK_MARK_LAYER, TRACK_END_LAYER]

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features })

let map: maplibregl.Map
let tracks: TrackDataset
let allHits: LookupHit[] = []
let groups: { label: string; color: string }[] = []
let missions: ReturnType<typeof indexMissions>
let root: Root
let pin: maplibregl.Marker
let lastR = -1
let recordOn = true

const camAt = (t: number) => ({
  // the circle sits left of centre, clear of the lookup panel on the right
  center: [lerp(PLACE.lng + 0.035, PLACE.lng + 0.03, t / DURATION), PLACE.lat] as [number, number],
  zoom: lerp(11.45, 11.75, easeInOut(t / DURATION)),
})

function renderPanel(r: number, hits: LookupHit[] | null) {
  const state: LookupState = {
    center: r > 0 ? { lng: PLACE.lng, lat: PLACE.lat } : null,
    radiusKm: R_MAX,
    from: '1961-01',
    to: '1971-12',
    picking: false,
    place: r > 0 ? { name: PLACE.name, coarse: false, low: false } : undefined,
  }
  const noop = () => {}
  flushSync(() =>
    root.render(
      createElement(
        'aside',
        { className: 'archive-key', 'aria-label': 'Place' },
        createElement(LocationLookup, {
          state,
          results: hits,
          groups,
          onPickToggle: noop,
          onRadius: noop,
          onClear: noop,
          onOpen: noop,
          onPlace: noop,
          onMission: noop,
          missions,
        }),
      ),
    ),
  )
}

export const shot: Shot = {
  duration: DURATION,
  stageClass: 'map-wrap',

  async setup(mapEl, overlay) {
    const style = await resolveMapStyle()
    map = new maplibregl.Map({
      container: mapEl,
      style,
      ...camAt(0),
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      maxZoom: mapConfig.view.maxZoom,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
    })
    const [spray] = await Promise.all([loadSpray(), new Promise<void>((r) => map.once('load', () => r()))])

    // The Atlas's map setup (MapView.tsx), minus the dot tiers, which never
    // show at this zoom.
    applyMapTheme(map)
    applyLabelCuration(map)
    quietBasemap(map)
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
    addVietnamLabel(map)
    addIslandMarks(map)

    const choices = buildAgentChoices(spray.agents)
    const colors = agentIndexColors(spray)
    const gs = choices.filter((c) => c.indices && c.color)
    const groupOf: number[] = []
    gs.forEach((g, gi) => (g.indices as number[]).forEach((ai) => (groupOf[ai] = gi)))
    groups = gs.map((c) => ({ label: c.label, color: c.color! }))
    const groupHues = gs.map((c) => c.color!)

    tracks = await loadTracks(colors, groupOf)
    addTrackLayers(map, tracks, tracks.dayMax, DOTS.tint)
    setTrackAgents(map, null, DOTS.tint, DOTS.dim, groupHues)
    missions = indexMissions(tracks)

    // The full answer once; the ring reveals it by distance.
    allHits = queryLookup(tracks, {
      lng: PLACE.lng,
      lat: PLACE.lat,
      radiusKm: R_MAX,
      dayFrom: 1,
      dayTo: tracks.dayMax + 1,
    })
    console.log('reel atlas', { runs: allHits.length, gallons: allHits.reduce((s, x) => s + x.gallons, 0) })

    // The lookup's layers, as MapView adds them.
    map.addSource(LOOKUP_VEIL_SRC, { type: 'geojson', data: fc([]) })
    map.addSource(LOOKUP_CIRCLE_SRC, { type: 'geojson', data: fc([]) })
    map.addSource(LOOKUP_HI_SRC, { type: 'geojson', data: fc([]), lineMetrics: true })
    map.addLayer({
      id: LOOKUP_VEIL_LAYER,
      type: 'fill',
      source: LOOKUP_VEIL_SRC,
      paint: { 'fill-color': '#faf9f4', 'fill-opacity': 0.32 },
    })
    map.addLayer({
      id: LOOKUP_CIRCLE_LAYER,
      type: 'line',
      source: LOOKUP_CIRCLE_SRC,
      paint: { 'line-color': '#213528', 'line-width': 1.4, 'line-dasharray': [3, 2] },
    })
    LOOKUP_HI_COLOURS.forEach((colour, i) => {
      const taper = taperGradient(colour)
      map.addLayer({
        id: LOOKUP_HI_LINES[i],
        type: 'line',
        source: LOOKUP_HI_SRC,
        filter:
          i === LOOKUP_HI_COLOURS.length - 1
            ? [
                'all',
                ['==', ['geometry-type'], 'LineString'],
                ['!', ['in', ['get', 'c'], ['literal', LOOKUP_HI_COLOURS.slice(0, -1)]]],
              ]
            : ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'c'], colour]],
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': colour,
          ...(taper ? { 'line-gradient': taper as never } : {}),
          'line-width': hitWidthRamp(1.2) as never,
        },
      })
    })
    map.addLayer({
      id: LOOKUP_HI_PT,
      type: 'circle',
      source: LOOKUP_HI_SRC,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': ['get', 'c'],
        'circle-radius': hitMarkRamp(2.2) as never,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    })
    setHighlightByFeature(map, true)

    const el = document.createElement('div')
    el.className = 'lookup-center-pin'
    pin = new maplibregl.Marker({ element: el }).setLngLat([PLACE.lng, PLACE.lat])

    const host = document.createElement('div')
    overlay.appendChild(host)
    root = createRoot(host)
    renderPanel(0, null)
    return map
  },

  apply(t) {
    map.jumpTo(camAt(t))
    const r = R_MAX * easeInOut(span(t, 1.4, 5.6))
    const up = r > 0

    // the record steps back the moment the lookup engages
    if (up === recordOn) {
      recordOn = !up
      for (const id of RECORD_TIERS)
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', up ? 'none' : 'visible')
      if (up) pin.addTo(map)
      else pin.remove()
    }

    if (Math.abs(r - lastR) > 1e-4) {
      lastR = r
      const hits = up ? allHits.filter((x) => x.distanceKm <= r) : null
      ;(map.getSource(LOOKUP_VEIL_SRC) as maplibregl.GeoJSONSource).setData(
        fc(up ? [veilPolygon(PLACE.lng, PLACE.lat, r)] : []),
      )
      ;(map.getSource(LOOKUP_CIRCLE_SRC) as maplibregl.GeoJSONSource).setData(
        fc(up ? [circlePolygon(PLACE.lng, PLACE.lat, r)] : []),
      )
      const hi: GeoJSON.Feature[] = []
      for (const x of hits ?? []) {
        for (const i of x.lineIdx) hi.push(tracks.lines.features[i])
        for (const i of x.markIdx) hi.push(tracks.marks.features[i])
      }
      ;(map.getSource(LOOKUP_HI_SRC) as maplibregl.GeoJSONSource).setData(fc(hi))
      renderPanel(r, hits)
    }
  },
}
