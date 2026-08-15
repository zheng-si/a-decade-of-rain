// Applies the editable mapConfig to a live MapLibre map: recolours the basemap
// from the theme tokens, and builds one heatmap layer per agent group so each
// herbicide shows in its own colour.
import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { mapConfig, LABEL_FONT, Z_NEAR, type MapTheme } from '../config/mapConfig'
import type { AgentChoice } from './agentChoices'

/** Resolve the map style: a URL, or the style JSON with a custom glyph endpoint
 *  swapped in when mapConfig.glyphsUrl is set. Shared by every map instance. */
export async function resolveMapStyle(): Promise<string | maplibregl.StyleSpecification> {
  if (!mapConfig.glyphsUrl) return mapConfig.baseStyleUrl
  const resp = await fetch(mapConfig.baseStyleUrl)
  const style = (await resp.json()) as maplibregl.StyleSpecification
  style.glyphs = mapConfig.glyphsUrl
  return style
}

// ── colour helpers ────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
function mixHex(c: [number, number, number], towards: [number, number, number], t: number) {
  return [mix(c[0], towards[0], t), mix(c[1], towards[1], t), mix(c[2], towards[2], t)] as const
}
const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

/** Heatmap colour ramp: transparent → light tint → base, staying near the base
 *  hue at the centre (only a gentle deepen) so dense cores don't read as dark. */
function agentRamp(baseHex: string): ExpressionSpecification {
  const base = hexToRgb(baseHex)
  const light = mixHex(base, [255, 255, 255], 0.5)
  const deep = mixHex(base, [30, 30, 36], 0.16)
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(0,0,0,0)',
    0.12, rgba(light, 0.5),
    0.45, rgba(base, 0.85),
    0.75, rgba(base, 0.95),
    1, rgba(deep, 1),
  ]
}

const stops = (pairs: [number, number][]): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], ...pairs.flat()] as ExpressionSpecification

// ── basemap theming ───────────────────────────────────────────────────────
// OpenFreeMap styles follow the OpenMapTiles schema, so we recolour layers by
// matching their ids/types. Tweak the buckets here if a base style differs.
function classify(id: string): keyof MapTheme | 'label' | null {
  if (id === 'background') return 'land'
  if (/water|sea|ocean|river|lake/.test(id)) return 'water'
  if (/wood|forest|park|grass|green|landcover|landuse|vegetation/.test(id)) return 'greenspace'
  if (/building/.test(id)) return 'building'
  if (/boundary|admin|border/.test(id)) return 'boundary'
  if (/road|highway|transportation|street|bridge|tunnel|motorway/.test(id)) return 'road'
  return null
}

/**
 * Scale a paint value by `factor` where `test` holds, without ever nesting a
 * zoom expression.
 *
 * The obvious form — `['case', test, ['*', base, factor], base]` — is invalid
 * whenever `base` is a zoom ramp, which is what every real basemap style uses
 * for `line-width`. MapLibre allows `["zoom"]` only as the input to a SINGLE
 * top-level `step`/`interpolate`, so wrapping the ramp in anything makes the
 * write fail validation. It fails quietly: `setPaintProperty` fires an error
 * event rather than throwing, so the property keeps its old value and the call
 * looks like it worked.
 *
 * So the case goes on the OUTPUTS and the ramp stays where it is. Same shape as
 * `hiWidthRamp()` in trackLayers.ts, which folds its bump inside each stop for
 * exactly this reason.
 *
 * Returns null for a shape we can't rewrite safely — better to leave the width
 * alone than to write an expression the style will refuse.
 */
function thinOutputs(
  base: number | ExpressionSpecification,
  test: ExpressionSpecification,
  factor: number,
): ExpressionSpecification | null {
  if (typeof base === 'number') {
    return ['case', test, base * factor, base] as ExpressionSpecification
  }
  const op = base[0]
  if (op !== 'interpolate' && op !== 'interpolate-hcl' && op !== 'interpolate-lab' && op !== 'step') {
    return null
  }
  // interpolate: [op, type, input, stop, out, ...]   step: [op, input, fallback, stop, out, ...]
  const head = op === 'step' ? 3 : 3
  const out = base.slice(0, head) as unknown[]
  const scale = (v: unknown) =>
    typeof v === 'number' ? v * factor : (['*', v, factor] as unknown)
  const wrap = (v: unknown) => ['case', test, scale(v), v] as unknown
  if (op === 'step') out[2] = wrap(out[2]) // the step's fallback output
  for (let i = head; i < base.length; i += 2) {
    out.push(base[i]) // stop
    if (i + 1 < base.length) out.push(wrap(base[i + 1]))
  }
  return out as unknown as ExpressionSpecification
}

export function applyMapTheme(map: maplibregl.Map, theme: MapTheme = mapConfig.theme) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    try {
      // Symbol layers = labels (and icons). Recolour their text.
      if (layer.type === 'symbol') {
        if (map.getLayoutProperty(id, 'text-field') == null) continue
        map.setPaintProperty(id, 'text-color', theme.label.color)
        map.setPaintProperty(id, 'text-halo-color', theme.label.halo)
        map.setPaintProperty(id, 'text-halo-width', theme.label.haloWidth)
        // Lay the labels on the ground plane so they tilt with the map in 3D
        // (at pitch 0 this is identical to viewport, so it needs no toggling).
        map.setLayoutProperty(id, 'text-pitch-alignment', 'map')
        if (theme.label.font) map.setLayoutProperty(id, 'text-font', theme.label.font)
        if (theme.label.sizeScale !== 1) {
          const size = map.getLayoutProperty(id, 'text-size')
          if (size != null) map.setLayoutProperty(id, 'text-size', ['*', size, theme.label.sizeScale])
        }
        continue
      }

      const bucket = classify(id)
      if (!bucket || bucket === 'label') continue
      const color = theme[bucket] as string
      if (layer.type === 'background') map.setPaintProperty(id, 'background-color', color)
      else if (layer.type === 'fill') map.setPaintProperty(id, 'fill-color', color)
      else if (layer.type === 'line') {
        map.setPaintProperty(id, 'line-color', color)
        // Sub-national admin lines (province/district, admin_level ≥ 3) clutter
        // the map, so knock them back a level: lighter + thinner + more
        // transparent. The national border (admin_level ≤ 2) stays full-strength.
        if (bucket === 'boundary') {
          const subLevel: ExpressionSpecification = ['>=', ['coalesce', ['to-number', ['get', 'admin_level']], 4], 3]
          map.setPaintProperty(id, 'line-color', ['case', subLevel, '#b9bcb2', color] as ExpressionSpecification)
          const w = map.getPaintProperty(id, 'line-width') as number | ExpressionSpecification | undefined
          const thinned = thinOutputs(w != null ? w : 1, subLevel, 0.55)
          if (thinned != null) map.setPaintProperty(id, 'line-width', thinned)
          map.setPaintProperty(id, 'line-opacity', ['case', subLevel, 0.5, 0.9] as ExpressionSpecification)
        }
      } else if (layer.type === 'fill-extrusion') {
        map.setPaintProperty(id, 'fill-extrusion-color', color)
      }
    } catch {
      /* layer doesn't support this property — skip */
    }
  }
}

// ── per-agent spray heatmap layers ────────────────────────────────────────
export const agentLayerId = (key: string) => `spray-heat-${key}`

/** Only the real agent groups (skip the synthetic "All" choice). */
const groups = (choices: AgentChoice[]) => choices.filter((c) => c.indices && c.color)

function timeFilter(day: number, indices: number[]): ExpressionSpecification {
  return ['all', ['<=', ['get', 'day'], day], ['in', ['get', 'agent'], ['literal', indices]]]
}

/** First label layer, so overlays can slot in beneath it (labels stay on top). */
export function firstLabelLayerId(map: maplibregl.Map): string | undefined {
  for (const l of map.getStyle().layers ?? []) {
    if (l.type === 'symbol') return l.id
  }
  return undefined
}

// ── label type scale ──────────────────────────────────────────────────────
// The zoom at which the ramp starts. Every viewport's zoom floor lands near
// here (the fitted home is ~5.3 on a phone and ~6.2 on a desktop, minus the
// 0.35 margin), so this is the size a reader meets the map at.
const Z_TYPE_FLOOR = 5
/** …and the far end, the map's maxZoom. */
const Z_TYPE_TOP = 11

/**
 * Label size as a function of zoom.
 *
 * Labels used to sit at one flat number at every zoom, which made them shout
 * at the overview — the one view where the data should be doing the talking —
 * and left nothing for zooming in to reveal. A place name is not a UI chip: it
 * belongs to the ground, so it should grow as the ground does.
 *
 * A straight line between the two ends, deliberately: extra stops would imply
 * a rhythm the type does not actually have, and the two things that DO change
 * gear (Z_MID, Z_NEAR) already change what is on screen rather than how big it
 * is.
 */
export function textSizeRamp(atFloor: number, atTop: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], Z_TYPE_FLOOR, atFloor, Z_TYPE_TOP, atTop]
}

export const HILLSHADE_LAYER = 'hillshade'

/** Add a hillshade layer (hidden until 3D) that shades the DEM relief, so the
 *  terrain is clearly visible — not just a tilted flat map. Sits under labels
 *  and under the spray heatmap (added afterwards). */
export function addHillshade(map: maplibregl.Map, demSource: string) {
  if (map.getLayer(HILLSHADE_LAYER)) return
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: demSource,
      layout: { visibility: 'none' },
      paint: {
        'hillshade-exaggeration': 0.6,
        'hillshade-shadow-color': '#4f4a42',
        'hillshade-accent-color': '#6b6052',
        'hillshade-highlight-color': '#ffffff',
      },
    },
    firstLabelLayerId(map),
  )
}

/** Toggle the relief, optionally restrengthening it in the same call. The
 *  layer-existence check lives here so callers never have to guard. */
export function setHillshade(map: maplibregl.Map, on: boolean, exaggeration?: number) {
  if (!map.getLayer(HILLSHADE_LAYER)) return
  map.setLayoutProperty(HILLSHADE_LAYER, 'visibility', on ? 'visible' : 'none')
  if (exaggeration != null) {
    map.setPaintProperty(HILLSHADE_LAYER, 'hillshade-exaggeration', exaggeration)
  }
}

export function addSprayLayers(map: maplibregl.Map, sourceId: string, choices: AgentChoice[], day: number) {
  const { radius, intensity, opacity } = mapConfig.heatmap
  const beforeId = firstLabelLayerId(map)
  for (const c of groups(choices)) {
    map.addLayer(
      {
        id: agentLayerId(c.key),
        type: 'heatmap',
        source: sourceId,
        filter: timeFilter(day, c.indices as number[]),
        paint: {
          'heatmap-weight': ['get', 'w'],
          'heatmap-intensity': stops(intensity),
          'heatmap-radius': stops(radius),
          'heatmap-opacity': opacity,
          'heatmap-color': agentRamp(c.color as string),
        },
      },
      beforeId,
    )
  }
}

// ── shared reference overlays (Story + Archive) ───────────────────────────
// Both maps carry the same cartographic furniture so they read as one system.

/** The four Corps Tactical Zones / Military Regions — only the three INTERNAL
 *  dividers are drawn (bold orange dashed; the outer edges trace the national
 *  border / coast and would clash with the basemap's own lines), plus the
 *  uppercase orange region tags, overview only. Pass `beforeId` to keep the
 *  dividers under the spray heat. */
export function addMilitaryRegions(
  map: maplibregl.Map,
  mrGeo: GeoJSON.GeoJSON,
  mrLabelsGeo: GeoJSON.GeoJSON,
  beforeId?: string,
) {
  if (map.getLayer('mr-borders')) return
  map.addSource('military-regions', { type: 'geojson', data: mrGeo })
  map.addLayer(
    {
      id: 'mr-borders',
      type: 'line',
      source: 'military-regions',
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#9a7263', 'line-width': 1.2, 'line-opacity': 0.55, 'line-dasharray': [2.4, 1.8] },
    },
    beforeId,
  )
  map.addSource('military-region-labels', { type: 'geojson', data: mrLabelsGeo })
  map.addLayer({
    id: 'mr-label',
    type: 'symbol',
    source: 'military-region-labels',
    // Pinned to the second hand-off rather than its own 8.5, so the map has
    // two zoom events instead of five. The tags stay through the whole mid
    // range — that is where a reader is comparing one region against another.
    maxzoom: Z_NEAR,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': [LABEL_FONT],
      // Reads as a heading over the region it names, so it sits a little above
      // the place-name ramp at both ends.
      'text-size': textSizeRamp(8, 14),
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.1,
      // A region tag names ground, so it lies on the ground (see applyMapTheme).
      'text-pitch-alignment': 'map',
    },
    paint: { 'text-color': '#77503f', 'text-halo-color': 'rgba(250,249,244,0.95)', 'text-halo-width': 2 },
  })
}

/** Disputed-island reference marks (the basemap already draws the grey
 *  borders). These sit outside the spray record (occupied by China, Taiwan
 *  et al.) and were never sprayed; shown as reference, no sovereignty
 *  assigned. Names use the common English forms + Vietnamese in parentheses. */
const ISLANDS_FC = {
  type: 'FeatureCollection',
  features: [
    // "disputed" sits on its own line rather than after an interpunct: the
    // house rule is that `·` joins phrases of equal rank, and a name with a
    // parenthetical already carries internal hierarchy.
    { type: 'Feature', properties: { name: 'Paracel Is. (Hoàng Sa)\ndisputed' }, geometry: { type: 'Point', coordinates: [112.0, 16.5] } },
    { type: 'Feature', properties: { name: 'Spratly Is. (Trường Sa)\ndisputed' }, geometry: { type: 'Point', coordinates: [114.0, 9.8] } },
  ],
} as GeoJSON.FeatureCollection

export function addIslandMarks(map: maplibregl.Map) {
  if (map.getLayer('island-label')) return
  map.addSource('islands', { type: 'geojson', data: ISLANDS_FC })
  // Text only — no marker ring. These are notes about sovereignty, not data
  // points, and an outlined circle read as one more symbol on a map whose
  // whole visual language is "a circle is sprayed volume".
  map.addLayer({
    id: 'island-label',
    type: 'symbol',
    source: 'islands',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': [LABEL_FONT],
      // The quietest thing on the map, at every zoom.
      'text-size': textSizeRamp(8.5, 11),
      'text-anchor': 'center',
      'text-max-width': 9,
      'text-pitch-alignment': 'map',
    },
    // Deliberately the quietest tier on the map (4.4:1): these are notes about
    // sovereignty, not geography, and they should sit a step behind the place
    // names. Still a clear step darker than the old #8a8d85 (3.0:1).
    paint: { 'text-color': '#6b7268', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
  })
}

/**
 * The Story's sea — green where the Archive's is blue, and deliberately so.
 *
 * The two pages run one cartography now, but they do not run one palette: the
 * Story is built out of orange (the spray) against green (the forest it fell
 * on), and a blue sea is the one thing on that map belonging to neither. The
 * Archive is an instrument and takes the neutral cool blue.
 *
 * This is NOT the old story water (#e9ece7). That one failed for a measured
 * reason: it sat 3% below the land in luminance and 5 apart in green-minus-red,
 * so the sea read only as "very slightly darker paper" and the coastline
 * dissolved. What matters is the SEPARATION, and this tone has it: 7.6% below
 * the land, against the Archive's 9.3% and the old tone's 3.1%.
 *
 * Chroma 9, down from a first pass at 11 (#d5e0d6) that read as too saturated
 * a sage — a sea should be the quietest surface on a map whose subject is what
 * was sprayed onto the land. The hue stays out of the Archive's blue
 * (blue-minus-red +7 against its +21) while sitting a touch cooler than pure
 * green, which is what keeps it reading as water rather than as pale forest.
 */
export const STORY_WATER = '#d9e2e0'

// ── story mode: one combined heatmap in the brand orange ──────────────────
// The scrollytelling uses a single, all-agents heatmap (no per-agent layers
// stacking into a muddy overlap). A warm ramp keeps dense cores orange rather
// than darkening to grey.
export const STORY_HEAT_LAYER = 'spray-heat-story'

function warmRamp(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(163,115,99,0)',
    0.12, 'rgba(163,115,99,0.32)',
    0.35, 'rgba(163,115,99,0.62)',
    0.65, 'rgba(255,96,52,0.85)',
    1, 'rgba(214,54,40,0.96)',
  ]
}

const dayFilter = (day: number): ExpressionSpecification => ['<=', ['get', 'day'], day]

export function addStoryHeat(map: maplibregl.Map, sourceId: string, day: number) {
  if (map.getLayer(STORY_HEAT_LAYER)) return
  const { radius, intensity, opacity } = mapConfig.heatmap
  map.addLayer(
    {
      id: STORY_HEAT_LAYER,
      type: 'heatmap',
      source: sourceId,
      filter: dayFilter(day),
      paint: {
        'heatmap-weight': ['get', 'w'],
        'heatmap-intensity': stops(intensity),
        'heatmap-radius': stops(radius),
        'heatmap-opacity': opacity,
        'heatmap-color': warmRamp(),
      },
    },
    firstLabelLayerId(map),
  )
}

export function setStoryHeatTime(map: maplibregl.Map, day: number) {
  if (map.getLayer(STORY_HEAT_LAYER)) map.setFilter(STORY_HEAT_LAYER, dayFilter(day))
}

export function setStoryHeatVisible(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(STORY_HEAT_LAYER)) {
    map.setLayoutProperty(STORY_HEAT_LAYER, 'visibility', on ? 'visible' : 'none')
  }
}

// ── story mode: the record itself, as flight paths ────────────────────────
// The closing node hands the reader over to the Archive, and the handover is
// made ON the map: the heat field it has been reading for seven nodes gives way
// to the 8,753 individual runs the field was binned FROM. Same country, same
// frame, different mark — "what you have been looking at is a summary; here is
// the record."
//
// Deliberately NOT the Archive's track layers. Those are a tuned instrument —
// zoom-gated at Z_NEAR, four layers deep, hover highlight, direction taper,
// per-agent tint — and none of that survives at the whole-country zoom this
// node sits at, where they would simply draw nothing. This is one line layer at
// one width: texture, not an instrument. The instrument is one click away.
export const STORY_TRACK_LAYER = 'spray-track-story'

export function addStoryTracks(map: maplibregl.Map, lines: GeoJSON.GeoJSON) {
  if (map.getLayer(STORY_TRACK_LAYER)) return
  map.addSource(STORY_TRACK_LAYER, { type: 'geojson', data: lines })
  map.addLayer(
    {
      id: STORY_TRACK_LAYER,
      type: 'line',
      source: STORY_TRACK_LAYER,
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': '#77503f',
        // Hairline at the overview: at 0.5px and 8,753 strokes the mass is
        // what reads, and any thicker turns the dense south into a solid slab.
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 11, 1.6],
        // Alpha is what makes this a density map rather than a silhouette.
        // Strokes composite as 1 − (1 − a)ⁿ, so at the old 0.5 any pixel
        // carrying four or more runs was already solid: War Zone D and the
        // coastal strip read as flat slabs with no gradient inside them, and
        // the difference between "flown twice" and "flown forty times" was
        // invisible. Measured at 0.5 / 0.32 / 0.22 / 0.15 on the record node:
        // 0.22 is where the dense cores keep visible internal structure while a
        // single isolated flight in the north still reads against the paper
        // (at 0.15 those lone runs drop out).
        'line-opacity': TRACK_OPACITY,
      },
    },
    firstLabelLayerId(map),
  )
}

/** Resting alpha of a single run. Named because the cross-fade below has to
 *  return to exactly this number, and two copies would drift. */
export const TRACK_OPACITY = 0.22

let xfadeRaf: number | null = null

/** Stop a cross-fade mid-flight. Called before starting another and on the
 *  hook reset, so a fast scroll cannot leave two fades writing the same
 *  paint properties. */
export function cancelStoryXfade() {
  if (xfadeRaf != null) {
    cancelAnimationFrame(xfadeRaf)
    xfadeRaf = null
  }
}

/**
 * Dissolve between the binned heat field and the 8,753 runs it was binned
 * from — the handover from the story's summary to the record underneath it.
 *
 * This used to be two `visibility` writes in the same tick: the heat vanished
 * and the lines appeared, in one frame, on a camera that does not move between
 * those two nodes (they share a bbox). The reader saw the map change without
 * seeing it happen, which is exactly backwards for the one moment whose whole
 * point is that these are the same gallons drawn two ways.
 *
 * So both layers stay VISIBLE for the length of the fade and opacity does the
 * work; whichever one loses is parked at the end so it costs nothing and
 * cannot flash on the next step. Deliberately a true cross-fade rather than
 * out-then-in: the muddy middle where both are drawn is the frame that says
 * "same data", and it is worth more than a clean hand-off.
 */
export function crossfadeStoryMarks(map: maplibregl.Map, toTracks: boolean, duration = 900) {
  cancelStoryXfade()
  if (!map.getLayer(STORY_HEAT_LAYER)) return
  const hasTracks = !!map.getLayer(STORY_TRACK_LAYER)
  map.setLayoutProperty(STORY_HEAT_LAYER, 'visibility', 'visible')
  if (hasTracks) map.setLayoutProperty(STORY_TRACK_LAYER, 'visibility', 'visible')

  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration)
    const e = t * t * (3 - 2 * t) // smoothstep, so it eases at both ends
    const heatA = toTracks ? 1 - e : e
    const trackA = toTracks ? e : 1 - e
    map.setPaintProperty(STORY_HEAT_LAYER, 'heatmap-opacity', mapConfig.heatmap.opacity * heatA)
    if (hasTracks) map.setPaintProperty(STORY_TRACK_LAYER, 'line-opacity', TRACK_OPACITY * trackA)
    if (t < 1) {
      xfadeRaf = requestAnimationFrame(step)
      return
    }
    xfadeRaf = null
    if (toTracks) map.setLayoutProperty(STORY_HEAT_LAYER, 'visibility', 'none')
    else if (hasTracks) map.setLayoutProperty(STORY_TRACK_LAYER, 'visibility', 'none')
  }
  xfadeRaf = requestAnimationFrame(step)
}

/**
 * Put the two marks back to their resting values without animating.
 *
 * The fade leaves the heat at opacity 0 when the tracks win. Any node that is
 * NOT the handover has to undo that, and most of them are nowhere near it —
 * jumping from the record to Act I via the rail should not play a 900ms
 * dissolve on a map that is flying somewhere else entirely.
 */
export function resetStoryMarks(map: maplibregl.Map) {
  cancelStoryXfade()
  if (map.getLayer(STORY_HEAT_LAYER)) {
    map.setPaintProperty(STORY_HEAT_LAYER, 'heatmap-opacity', mapConfig.heatmap.opacity)
  }
  if (map.getLayer(STORY_TRACK_LAYER)) {
    map.setPaintProperty(STORY_TRACK_LAYER, 'line-opacity', TRACK_OPACITY)
    map.setLayoutProperty(STORY_TRACK_LAYER, 'visibility', 'none')
  }
}

export function setStoryTracksVisible(map: maplibregl.Map, on: boolean) {
  if (map.getLayer(STORY_TRACK_LAYER)) {
    map.setLayoutProperty(STORY_TRACK_LAYER, 'visibility', on ? 'visible' : 'none')
  }
}

/** Update the cumulative time window on every agent layer. */
export function setSprayTime(map: maplibregl.Map, choices: AgentChoice[], day: number) {
  for (const c of groups(choices)) {
    const id = agentLayerId(c.key)
    if (map.getLayer(id)) map.setFilter(id, timeFilter(day, c.indices as number[]))
  }
}

/** Show every group for "all", otherwise just the selected one. Toggles opacity
 *  (a cheap paint change) rather than visibility, so switching agents doesn't
 *  re-tessellate the heatmap. */
export function setAgentVisibility(map: maplibregl.Map, choices: AgentChoice[], activeKey: string) {
  for (const c of groups(choices)) {
    const id = agentLayerId(c.key)
    if (!map.getLayer(id)) continue
    const visible = activeKey === 'all' || activeKey === c.key
    map.setPaintProperty(id, 'heatmap-opacity', visible ? mapConfig.heatmap.opacity : 0)
  }
}
