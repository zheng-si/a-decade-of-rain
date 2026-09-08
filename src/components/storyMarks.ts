/**
 * storyMarks.ts — a PROTOTYPE switch for the Story's field, behind `?mark=`.
 *
 * The Story's heat field is the one encoding on the site that is neither the
 * record's own marks (the Atlas's dots and strokes) nor the authors' own model
 * (the hit grid): its last step, √(gallons / p90) into a blurred density with
 * a radius and an intensity of our choosing, needs its own paragraph in the
 * methods. This module draws the same (cell, month) gallons the field is
 * built from with the Atlas's own marks instead, so the two can be compared
 * on the real page before anything is decided (docs/decisions.md, standing
 * rules). Nothing here runs unless the URL says so:
 *
 *   ?mark=dots   the Atlas's dots: area is the gallons logged in the cell up
 *                to the date shown (the same k·√g, cap and floor as
 *                volumeGrid.ts), the coarse 0.12° tier below Z_MID and the
 *                fine 0.03° tier above it, at cell centres.
 *   ?mark=soft   the same dots with a soft edge (circle-blur 1, radius ×1.6,
 *                opacity 0.7), placed at the cell's gallons-weighted centroid,
 *                so overlaps compose into a field without a kernel.
 *   ?mark=hits   the Stellmans' hit grid (proximity.json, the 1 km band, all
 *                agents), whole decade — the shipped table carries no time.
 *
 * Time: each cell's months are turned into a cumulative series once, and a
 * step is a feature valid from its month until the next one, so the playhead
 * is one filter (`from <= day < to`) and nothing is re-binned in the browser.
 */
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { Z_MID } from '../config/mapConfig'
import { DOTS, DOT_ANCHORS } from './volumeGrid'
import { firstLabelLayerId } from './mapTheme'
import type { HeatDataset } from '../data/heat'
import { loadProximity, renderProximity, hitRamp } from '../data/proximity'

export type StoryMark = 'heat' | 'dots' | 'soft' | 'hits'

export function storyMarkFromUrl(): StoryMark {
  if (typeof window === 'undefined') return 'heat'
  const m = new URLSearchParams(window.location.search).get('mark')
  return m === 'dots' || m === 'soft' || m === 'hits' ? m : 'heat'
}

const COARSE_DEG = 0.12
const FINE_DEG = 0.03
/** A step with no successor is valid to the end of time. */
const FOREVER = 1e7

export const STORY_DOTS_COARSE = 'story-dots-coarse'
export const STORY_DOTS_FINE = 'story-dots-fine'
export const STORY_HITS_LAYER = 'story-hits'
const STORY_HITS_SOURCE = 'story-hits-src'

interface Month {
  g: number
  x: number
  y: number
}

/** The field's (cell, month) gallons re-binned to `cellDeg` and turned into a
 *  cumulative series per cell: one feature per month the cell was sprayed in,
 *  carrying the gallons logged there up to and including that month. */
function cumulativeCells(
  heat: HeatDataset,
  cellDeg: number,
  centroid: boolean,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const byCell = new Map<string, Map<number, Month>>()
  for (const f of heat.features.features) {
    const [lon, lat] = f.geometry.coordinates
    const { day, gallons } = f.properties as { day: number; gallons: number }
    const key = `${Math.floor(lon / cellDeg)},${Math.floor(lat / cellDeg)}`
    let months = byCell.get(key)
    if (!months) {
      months = new Map()
      byCell.set(key, months)
    }
    const m = months.get(day)
    if (m) {
      m.g += gallons
      m.x += lon * gallons
      m.y += lat * gallons
    } else months.set(day, { g: gallons, x: lon * gallons, y: lat * gallons })
  }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [key, months] of byCell) {
    const [cx, cy] = key.split(',').map(Number)
    const centre: [number, number] = [(cx + 0.5) * cellDeg, (cy + 0.5) * cellDeg]
    const days = [...months.keys()].sort((a, b) => a - b)
    let g = 0
    let x = 0
    let y = 0
    days.forEach((day, i) => {
      const m = months.get(day)!
      g += m.g
      x += m.x
      y += m.y
      const pos = centroid ? [x / g, y / g] : centre
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [+pos[0].toFixed(4), +pos[1].toFixed(4)] },
        properties: { from: day, to: i + 1 < days.length ? days[i + 1] : FOREVER, g: Math.round(g) },
      })
    })
  }
  return { type: 'FeatureCollection', features }
}

/** volumeGrid's area-true radius, k·√g between the tier's two zoom anchors,
 *  with one scale on k, cap and floor together so the soft variant can be
 *  drawn larger without changing the rule. Scale 1 is the Atlas's own dot. */
function radius(tier: 'coarse' | 'fine', scale: number): ExpressionSpecification {
  const { k0, k1, cap } = DOTS[tier]
  const [z0, z1] = DOT_ANCHORS[tier]
  const at = (k: number, i: 0 | 1) => [
    'max',
    DOTS.floor[i] * scale,
    ['min', ['*', k * scale, ['sqrt', ['get', 'g']]], cap * scale],
  ]
  return ['interpolate', ['linear'], ['zoom'], z0, at(k0, 0), z1, at(k1, 1)] as unknown as ExpressionSpecification
}

const timeFilter = (day: number): ExpressionSpecification => [
  'all',
  ['<=', ['get', 'from'], day],
  ['>', ['get', 'to'], day],
]

export function addStoryMarks(map: maplibregl.Map, heat: HeatDataset, mark: 'dots' | 'soft') {
  if (map.getLayer(STORY_DOTS_COARSE)) return
  const soft = mark === 'soft'
  const before = firstLabelLayerId(map)
  const paint = (tier: 'coarse' | 'fine') => ({
    'circle-color': DOTS.tint,
    'circle-opacity': soft ? 0.7 : DOTS.opacity,
    'circle-blur': soft ? 1 : DOTS.blur,
    'circle-radius': radius(tier, soft ? 1.6 : 1),
    'circle-pitch-alignment': 'map' as const,
    'circle-pitch-scale': 'map' as const,
  })
  map.addSource(STORY_DOTS_COARSE, { type: 'geojson', data: cumulativeCells(heat, COARSE_DEG, soft) })
  map.addSource(STORY_DOTS_FINE, { type: 'geojson', data: cumulativeCells(heat, FINE_DEG, soft) })
  map.addLayer(
    {
      id: STORY_DOTS_COARSE,
      type: 'circle',
      source: STORY_DOTS_COARSE,
      maxzoom: Z_MID,
      layout: { visibility: 'none' },
      filter: timeFilter(0),
      paint: paint('coarse'),
    },
    before,
  )
  // No maxzoom on the fine tier: the Atlas hands over to strokes at Z_NEAR,
  // and the Story has no strokes to hand to except at the handover, so the
  // hotspots node (z9.6) keeps the fine dots. Noted in the comparison.
  map.addLayer(
    {
      id: STORY_DOTS_FINE,
      type: 'circle',
      source: STORY_DOTS_FINE,
      minzoom: Z_MID,
      layout: { visibility: 'none' },
      filter: timeFilter(0),
      paint: paint('fine'),
    },
    before,
  )
}

export function setStoryMarksTime(map: maplibregl.Map, day: number) {
  for (const id of [STORY_DOTS_COARSE, STORY_DOTS_FINE]) {
    if (map.getLayer(id)) map.setFilter(id, timeFilter(day))
  }
}

export function setStoryMarksVisible(map: maplibregl.Map, on: boolean) {
  for (const id of [STORY_DOTS_COARSE, STORY_DOTS_FINE]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}

/** The hit grid as the Atlas draws it (proximity.ts), in the Story's hue.
 *  `alive` is asked after the load, since the map may have been torn down. */
export async function addStoryHits(map: maplibregl.Map, alive: () => boolean, visible: () => boolean) {
  const g = await loadProximity(`${import.meta.env.BASE_URL}data/proximity.json`)
  if (!alive() || map.getLayer(STORY_HITS_LAYER)) return
  const img = renderProximity(g, 1, null, hitRamp(DOTS.tint))
  map.addSource(STORY_HITS_SOURCE, { type: 'image', url: img.url, coordinates: img.coordinates })
  map.addLayer(
    {
      id: STORY_HITS_LAYER,
      type: 'raster',
      source: STORY_HITS_SOURCE,
      layout: { visibility: visible() ? 'visible' : 'none' },
      paint: { 'raster-opacity': 0.7, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 },
    },
    firstLabelLayerId(map),
  )
}

export function setStoryHitsVisible(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(STORY_HITS_LAYER)) {
    map.setLayoutProperty(STORY_HITS_LAYER, 'visibility', on ? 'visible' : 'none')
  }
}
