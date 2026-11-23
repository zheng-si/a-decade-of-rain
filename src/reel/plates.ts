// ── keyframe plates · the Story's map under each film keyframe ───────────
// One still per keyframe of the film board, the map alone: the Story's heat
// field (not the tracks), the Story's labels and node marks. Type and the drop
// fields are laid over these in Figma as editable layers.
//
//   /reel/?shot=plate&id=peak       (render at 1600×900)
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../fonts.css'
import '../index.css'
import '../App.css'
import '../pages/Story.css'
import '../StorySkinV3.css'
import '../fontsGeist.css'
import './reel-site.css'
import { setStoryHeatTime, STORY_HEAT_LAYER } from '../components/mapTheme'
import { dateToDay } from '../data/spray'
import { FACTS_EVENTS } from '../content/facts/events'
import type { Shot } from './main'
import { buildStoryMap, showNodeMarks, dotMarker, type StoryMap } from './storyMap'

type Bbox = [number, number, number, number]
interface Plate {
  /** The ground to frame, and the screen kept clear for the type. */
  bbox: Bbox
  pad: { left: number; right: number; top: number; bottom: number }
  /** Heat field shown up to this date; null = none yet. */
  heatTo: string | null
  /** A Story node whose marks to draw. */
  node?: string
  /** Free marks: a dot and chip, and an optional ring in km. */
  dot?: { lngLat: [number, number]; label: string; ringKm?: number }
  /** Heat field opacity override (the Story's own is mapConfig.heatmap). */
  heatOpacity?: number
  /** Fixed zoom instead of fitting the bbox. */
  zoom?: number
  center?: [number, number]
}

const COUNTRY: Bbox = [104.4, 8.4, 109.4, 17.1]
/** The sprayed south, cropped at the DMZ's latitude for the title frames. */
const SOUTH: Bbox = [104.3, 8.45, 109.5, 16.2]
const PLATES: Record<string, Plate> = {
  opening: { bbox: SOUTH, pad: { left: 640, right: 160, top: 10, bottom: 10 }, heatTo: null },
  peak: { bbox: [105.75, 10.35, 107.75, 12.1], pad: { left: 560, right: 60, top: 40, bottom: 40 }, heatTo: '1967-07-31', node: 'peak' },
  'a-sau': { bbox: [106.55, 15.75, 107.95, 16.85], pad: { left: 560, right: 60, top: 40, bottom: 40 }, heatTo: '1969-11-30', node: 'a-sau' },
  'cat-tien': {
    bbox: [107.2, 11.45, 107.5, 11.7],
    pad: { left: 560, right: 60, top: 40, bottom: 40 },
    center: [107.2, 11.58321],
    zoom: 10.1,
    heatTo: '1971-12-31',
    heatOpacity: 0.5,
    dot: { lngLat: [107.36215, 11.58321], label: 'Cát Tiên', ringKm: 5 },
  },
  rainbow: { bbox: COUNTRY, pad: { left: 20, right: 1110, top: 30, bottom: 30 }, heatTo: '1971-12-31' },
  closing: { bbox: SOUTH, pad: { left: 640, right: 160, top: 10, bottom: 10 }, heatTo: '1971-12-31' },
}

function ringFeature(lng: number, lat: number, km: number): GeoJSON.Feature {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180)
  const pts: [number, number][] = []
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2
    pts.push([lng + (Math.cos(a) * km) / kx, lat + (Math.sin(a) * km) / 110.57])
  }
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} }
}

const id = new URLSearchParams(location.search).get('id') ?? 'opening'
let sm: StoryMap

export const shot: Shot = {
  duration: 0,
  stageClass: 'story',
  async setup(mapEl) {
    const p = PLATES[id]
    if (!p) throw new Error(`unknown plate ${id}`)
    sm = await buildStoryMap(mapEl, { center: [107, 12], zoom: 6 }, p.heatTo ? dateToDay(p.heatTo) : 0)
    const map = sm.map
    if (p.center && p.zoom != null) map.jumpTo({ center: p.center, zoom: p.zoom })
    else map.jumpTo(map.cameraForBounds(p.bbox, { padding: p.pad })!)
    if (!p.heatTo) setStoryHeatTime(map, 0)
    if (p.heatOpacity != null) map.setPaintProperty(STORY_HEAT_LAYER, 'heatmap-opacity', p.heatOpacity)
    if (p.node) showNodeMarks(sm, FACTS_EVENTS.find((e) => e.id === p.node) ?? null)
    if (p.dot) {
      dotMarker(map, p.dot.lngLat, p.dot.label)
      if (p.dot.ringKm) {
        map.addSource('plate-ring', { type: 'geojson', data: ringFeature(p.dot.lngLat[0], p.dot.lngLat[1], p.dot.ringKm) })
        map.addLayer({
          id: 'plate-ring',
          type: 'line',
          source: 'plate-ring',
          // The Atlas lookup's ring: forest, dashed (MapView LOOKUP_CIRCLE_LAYER).
          paint: { 'line-color': '#213528', 'line-width': 2, 'line-dasharray': [3, 2] },
        })
      }
    }
    return map as maplibregl.Map
  },
  apply() {},
}
