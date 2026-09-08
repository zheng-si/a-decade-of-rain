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
 *
 * Three knobs, so the size can be judged on the real page without a
 * redeploy (the Atlas's dots are sized to sit inside their cell, which is
 * not what a field wants):
 *
 *   &k=2.5      radius scale on the Atlas's k, cap and floor together (1 =
 *               the Atlas's own dot; soft defaults to 1.6)
 *   &blur=0.7   circle-blur, 0 hard to 1 faded from the centre (dots 0.25,
 *               soft 1 by default)
 *   &alpha=0.7  circle-opacity (dots 0.9, soft 0.7 by default)
 *   &tier=8     the zoom at which the 0.03° tier takes over from the 0.12°
 *               tier (the Atlas's Z_MID, 7, by default)
 *
 * The hit grid was tried here and set aside: the shipped table carries no
 * time, and a Story without the playhead is not the Story.
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

export type StoryMark = 'heat' | 'dots' | 'soft'

const query = () =>
  typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

export function storyMarkFromUrl(): StoryMark {
  const m = query().get('mark')
  return m === 'dots' || m === 'soft' ? m : 'heat'
}

/** A numeric knob from the URL, or its default. */
function knob(name: string, fallback: number): number {
  const v = parseFloat(query().get(name) ?? '')
  return Number.isFinite(v) ? v : fallback
}

const COARSE_DEG = 0.12
const FINE_DEG = 0.03
/** A step with no successor is valid to the end of time. */
const FOREVER = 1e7

export const STORY_DOTS_COARSE = 'story-dots-coarse'
export const STORY_DOTS_FINE = 'story-dots-fine'

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
  const k = knob('k', soft ? 1.6 : 1)
  const blur = knob('blur', soft ? 1 : DOTS.blur)
  const alpha = knob('alpha', soft ? 0.7 : DOTS.opacity)
  const tierZoom = knob('tier', Z_MID)
  const paint = (tier: 'coarse' | 'fine') => ({
    'circle-color': DOTS.tint,
    'circle-opacity': alpha,
    'circle-blur': blur,
    'circle-radius': radius(tier, k),
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
      maxzoom: tierZoom,
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
      minzoom: tierZoom,
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
