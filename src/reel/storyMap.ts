// The Story's map, built the way Story.tsx builds it, for any reel shot that
// speaks in the Story's language: theme, curated labels, the quiet ground,
// relief, the brand-orange heat field, military-region tags, the country
// label, landmark outlines, and the node marks (pulsing dots, area chips).
import maplibregl from 'maplibre-gl'
import { mapConfig } from '../config/mapConfig'
import {
  resolveMapStyle,
  applyMapTheme,
  addHillshade,
  setHillshade,
  STORY_WATER,
  addStoryHeat,
  addMilitaryRegions,
  addIslandMarks,
  STORY_HEAT_LAYER,
} from '../components/mapTheme'
import { applyLabelCuration } from '../components/labelLayers'
import { quietBasemap, addVietnamLabel } from '../components/volumeGrid'
import { loadHeat } from '../data/heat'
import { loadSpray, type SprayDataset } from '../data/spray'
import type { FACTS_EVENTS } from '../content/facts/events'
import { json } from './util'

export type StoryEv = (typeof FACTS_EVENTS)[number]

export const HEAT_SRC = 'spray-heat'
export const LANDMARK_SOURCE = 'landmarks'
const DEM_SOURCE = 'terrain-dem'
const RELIEF_FLAT = 0.28

export interface StoryMap {
  map: maplibregl.Map
  spray: SprayDataset
  landmarks: GeoJSON.FeatureCollection
}

export async function buildStoryMap(
  mapEl: HTMLElement,
  cam: { center: [number, number]; zoom: number },
  heatDay: number,
  opts: { militaryRegions?: boolean } = {},
): Promise<StoryMap> {
  const style = await resolveMapStyle()
  const map = new maplibregl.Map({
    container: mapEl,
    style,
    ...cam,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    maxPitch: mapConfig.view.maxPitch,
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
  })
  const [spray, heat, mrGeo, mrLabelsGeo, landmarks] = await Promise.all([
    loadSpray(),
    loadHeat(),
    json<GeoJSON.FeatureCollection>('/data/military-region-dividers.geojson'),
    json<GeoJSON.FeatureCollection>('/data/military-region-labels.geojson'),
    json<GeoJSON.FeatureCollection>('/data/landmarks.geojson'),
    new Promise<void>((r) => map.once('load', () => r())),
  ])
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
  addStoryHeat(map, HEAT_SRC, heatDay)
  if (opts.militaryRegions !== false) addMilitaryRegions(map, mrGeo, mrLabelsGeo, STORY_HEAT_LAYER)
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
  return { map, spray, landmarks }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** A pulsing dot with its pointer chip (Story.css `.map-dot`). */
export function dotMarker(map: maplibregl.Map, lngLat: [number, number], label: string, cls = 'map-dot') {
  const el = document.createElement('div')
  el.className = cls
  el.innerHTML = `<span class="map-dot-ring"></span><span class="map-dot-core"></span><span class="map-dot-label">${esc(label)}</span>`
  return new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map)
}

/** A node's landmarks and pilot crosses, exactly as the Story draws them. */
export function showNodeMarks(sm: StoryMap, ev: StoryEv | null, prev: maplibregl.Marker[] = []): maplibregl.Marker[] {
  for (const m of prev) m.remove()
  const markers: maplibregl.Marker[] = []
  const src = sm.map.getSource(LANDMARK_SOURCE) as maplibregl.GeoJSONSource
  if (!ev) {
    src.setData({ type: 'FeatureCollection', features: [] })
    return markers
  }
  for (const c of ev.crosses ?? []) {
    const m = dotMarker(sm.map, [c.lng, c.lat], c.label, c.leader ? 'map-dot map-dot--leader' : c.below ? 'map-dot map-dot--below' : 'map-dot')
    if (c.leader) m.getElement().style.setProperty('--leader', `${c.leader}px`)
    markers.push(m)
  }
  const feats = (ev.landmarks ?? [])
    .filter((l) => l.boundaryId)
    .map((l) => sm.landmarks.features.find((f) => (f.properties as { id?: string } | null)?.id === l.boundaryId))
    .filter((f): f is GeoJSON.Feature => !!f)
  src.setData({ type: 'FeatureCollection', features: feats })
  for (const l of ev.landmarks ?? []) {
    if (!l.point) continue
    if (l.boundaryId) {
      const el = document.createElement('div')
      el.className = 'map-area-label'
      el.innerHTML = `<span class="map-dot-label">${esc(l.name)}</span>`
      markers.push(new maplibregl.Marker({ element: el }).setLngLat(l.point).addTo(sm.map))
    } else markers.push(dotMarker(sm.map, l.point, l.name))
  }
  return markers
}
