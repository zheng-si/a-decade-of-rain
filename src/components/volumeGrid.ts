// ── Explorer M2 · gridded proportional symbols ────────────────────────────
// One representational language at every zoom — the dot — with only the
// aggregation cell size changing (CLEVER°FRANKE model; see
// docs/explorer-m2-plan.md). Two grid tiers are re-binned at runtime from
// the ~20k spray events; the near tier draws the raw events themselves.

import type maplibregl from 'maplibre-gl'
import type { SprayDataset } from '../data/spray'
import { mapConfig, LABEL_FONT, Z_MID, Z_NEAR } from '../config/mapConfig'
import { firstLabelLayerId, textSizeRamp } from './mapTheme'
import { labelTierOf, LABEL_TIERS, type LayerLike } from './mapTaxonomy'

export const VOL_COARSE_SOURCE = 'vol-coarse'
export const VOL_FINE_SOURCE = 'vol-fine'
export const VOL_RAW_LAYER = 'vol-raw'
export const VOL_COARSE_LAYER = 'vol-coarse-l'
export const VOL_FINE_LAYER = 'vol-fine-l'
const VN_LABEL_SOURCE = 'vn-country-label'
/** Exported so the tuner can put this on the same size ramp as the basemap's
 *  own country tier — the whole point of COUNTRY_TEXT is that the two cannot
 *  drift, and a tuner that moved one would break that. */
export const VN_LABEL_LAYER = 'vn-country-label-l'

/** The Archive's own water tones. Land and vegetation come from
 *  `mapConfig.theme`; water is overridden here because the explorer wants a
 *  cooler, quieter sea than the story's. */
export const WATER_FILL = '#d1dee6'
/** Waterways read in the SAME tone as the sea, not two steps darker.
 *
 *  They used to be `#c0d0db`, on the argument that a river should read against
 *  the land it crosses rather than against the sea it flows into. In practice
 *  the Mekong delta is where the record is densest, and a darker river there
 *  competed with the spray dots for the eye — the basemap has one job on this
 *  page, which is to recede. One tone for all water. */
export const WATER_LINE = WATER_FILL
/** The layer sets the basemap treatment works on, exported so a tuner can
 *  reach exactly the same ones without re-deriving them. `building` is
 *  deliberately absent from the vegetation pattern — it is hidden outright,
 *  and a tuner must not revive it while colouring the greenery. */
export const WATER_FILL_RE = /water|sea|ocean|river|lake/
export const WATER_LINE_RE = /water|river|lake/
export const VEGETATION_RE = /wood|forest|park|grass|green|landcover|landuse|vegetation/
/** Water NAMES, as opposed to the water itself. Exported for the same reason. */
export const WATER_NAME_RE = /water|sea|ocean|marine|river|lake|bay/

/** Grid cell sizes, in degrees. Mutable ONLY so the tuner can try other values
 *  on the running map — nothing in the app writes them. The committed numbers
 *  are the two below; `setGridDegrees` is dev tooling and is not called from
 *  any shipping path. */
let COARSE_DEG = 0.12
let FINE_DEG = 0.03

/** Live cell sizes, for a readout. */
export const gridDegrees = () => ({ coarse: COARSE_DEG, fine: FINE_DEG })

/** Tuner hook. The caller must re-run `updateVolume` afterwards — this only
 *  changes what the next bin will use, it does not re-bin by itself. */
export function setGridDegrees(next: { coarse?: number; fine?: number }) {
  if (next.coarse && next.coarse > 0) COARSE_DEG = next.coarse
  if (next.fine && next.fine > 0) FINE_DEG = next.fine
}
// Both hand-off zooms are declared in mapConfig — see the note there.
const Z_FAR_TO_MID = Z_MID
const Z_MID_TO_NEAR = Z_NEAR

/** Per-agent-index colour, resolved once from the dataset's agent table. */
export function agentIndexColors(spray: SprayDataset): string[] {
  const byCode: Record<string, string> = {}
  for (const g of mapConfig.agents) for (const c of g.codes) byCode[c] = g.color
  const other = mapConfig.agents.find((g) => g.key === 'other')?.color ?? '#9a6cc4'
  return spray.agents.map((a) => byCode[a.code] ?? other)
}

/** Grey for de-emphasised (non-selected) volume. A neutral #808080 was tried
 *  and read too heavy — de-emphasised volume competed with the selection —
 *  so this stays the original soft green-grey and leans on the raised
 *  circle-opacity (DOT_OPACITY) for its legibility instead of a darker value. */
const DIM = '#c9cdc4'

/** Bin events up to `day` into a grid. With a selection, each cell emits a
 *  grey feature for the other agents' volume UNDER a tinted feature for the
 *  selected agent's — context stays visible, the selection reads on top.
 *  Both features also carry the cell's totals (gt/rt), dominant agent group
 *  (dom), and first/last spray day (d0/d1) for the hover tooltip. */
function binGrid(
  spray: SprayDataset,
  day: number,
  indices: number[] | null,
  cellDeg: number,
  tint: string,
): GeoJSON.FeatureCollection {
  const sel = indices ? new Set(indices) : null
  interface Cell {
    x: number
    y: number
    inSel: number
    out: number
    runs: number
    byGroup: number[]
    d0: number
    d1: number
  }
  const cells = new Map<string, Cell>()
  for (const f of spray.features.features) {
    const p = f.properties as { day: number; agent: number; gallons: number; gi?: number }
    if (p.day > day) continue
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates
    const x = Math.floor(lng / cellDeg)
    const y = Math.floor(lat / cellDeg)
    const key = `${x}|${y}`
    let cell = cells.get(key)
    if (!cell) {
      cell = { x, y, inSel: 0, out: 0, runs: 0, byGroup: [0, 0, 0, 0], d0: Infinity, d1: -Infinity }
      cells.set(key, cell)
    }
    if (!sel || sel.has(p.agent)) cell.inSel += p.gallons
    else cell.out += p.gallons
    cell.runs++
    if (p.gi != null && p.gi >= 0) cell.byGroup[p.gi] += p.gallons
    if (p.day < cell.d0) cell.d0 = p.day
    if (p.day > cell.d1) cell.d1 = p.day
  }
  const features: GeoJSON.Feature[] = []
  for (const cell of cells.values()) {
    const coords: [number, number] = [(cell.x + 0.5) * cellDeg, (cell.y + 0.5) * cellDeg]
    let dom = 0
    for (let i = 1; i < cell.byGroup.length; i++) if (cell.byGroup[i] > cell.byGroup[dom]) dom = i
    const shared = {
      gt: Math.round(cell.inSel + cell.out),
      rt: cell.runs,
      dom,
      d0: cell.d0,
      d1: cell.d1,
    }
    if (sel && cell.out > 0)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { g: Math.round(cell.out), c: DIM, s: 0, ...shared },
      })
    if (cell.inSel > 0)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { g: Math.round(cell.inSel), c: tint, s: 1, ...shared },
      })
  }
  return { type: 'FeatureCollection', features }
}

/** The aggregation cell size in effect at a zoom level (null = raw events). */
export function cellDegAt(zoom: number): number | null {
  if (zoom < Z_FAR_TO_MID) return COARSE_DEG
  if (zoom < Z_MID_TO_NEAR) return FINE_DEG
  return null
}

/** Area-true radius: k·√gallons, capped so dots stay inside their cell.
 *  MapLibre requires the zoom interpolate to be the OUTERMOST expression,
 *  so the cap is applied inside each stop's output. */
const gridRadius = (kStops: [number, number][], cap: number): maplibregl.ExpressionSpecification =>
  [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...kStops.flatMap(([z, k]) => [z, ['min', ['*', k, ['sqrt', ['get', 'g']]], cap]]),
  ] as unknown as maplibregl.ExpressionSpecification

/** Radial falloff on every dot.
 *
 *  MapLibre has no gradient fill for circles; `circle-blur` is the equivalent —
 *  it feathers the disc inward from its edge, so `1` fades the whole radius and
 *  `0` is the hard disc we shipped before. At 0.75 a dot reads as deposition
 *  rather than as a plotted symbol.
 *
 *  It is not free, and the trade was made with the comparison renders in hand:
 *  the softer edge costs some of the area→gallons read (two dots of noticeably
 *  different size look closer in weight than they are), and because every dot
 *  becomes a similar soft blob it makes the 0.12°/0.03° binning lattice more
 *  visible in the dense areas. Opacity is lifted from 0.72 to compensate for
 *  the energy the falloff spreads out. Set BLUR to 0 to get the old discs back. */
const BLUR = 0.75
const DOT_OPACITY = 0.9

/** Add the three-tier symbol stack. Returns the bottom layer id (for
 *  inserting reference overlays beneath the symbols). */
export function addVolumeLayers(map: maplibregl.Map, spraySource: string): string {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
  map.addSource(VOL_COARSE_SOURCE, { type: 'geojson', data: empty })
  map.addSource(VOL_FINE_SOURCE, { type: 'geojson', data: empty })

  // Insert beneath the basemap's first label layer so place names stay
  // legible over the data rather than the reverse (a plain addLayer with no
  // beforeId appends to the very top of the stack, above every label).
  const labelId = firstLabelLayerId(map)

  // No strokes; overlap darkens by alpha stacking — the closest WebGL gets
  // to a multiply blend (MapLibre layers have no CSS-style blend modes).
  // pitch-alignment 'map' lays each disc flat on the map plane, so in the
  // 3D view the dots foreshorten into ellipses instead of billboarding.
  const shared = {
    'circle-color': ['get', 'c'] as unknown as maplibregl.ExpressionSpecification,
    'circle-opacity': DOT_OPACITY,
    'circle-blur': BLUR,
    'circle-pitch-alignment': 'map' as const,
    'circle-pitch-scale': 'map' as const,
  }
  const sharedLayout = { 'circle-sort-key': ['get', 's'] as unknown as maplibregl.ExpressionSpecification }

  map.addLayer(
    {
      id: VOL_COARSE_LAYER,
      type: 'circle',
      source: VOL_COARSE_SOURCE,
      maxzoom: Z_FAR_TO_MID,
      layout: sharedLayout,
      paint: {
        ...shared,
        'circle-radius': gridRadius(
          [
            [5.6, 0.03],
            [7.0, 0.069],
          ],
          13,
        ),
      },
    },
    labelId,
  )

  map.addLayer(
    {
      id: VOL_FINE_LAYER,
      type: 'circle',
      source: VOL_FINE_SOURCE,
      minzoom: Z_FAR_TO_MID,
      maxzoom: Z_MID_TO_NEAR,
      layout: sharedLayout,
      paint: {
        ...shared,
        'circle-radius': gridRadius(
          [
            [7.0, 0.037],
            [9.2, 0.1],
          ],
          12,
        ),
      },
    },
    labelId,
  )

  // Near tier: the raw events themselves (single runs are ~1k gallons).
  map.addLayer(
    {
      id: VOL_RAW_LAYER,
      type: 'circle',
      source: spraySource,
      minzoom: Z_MID_TO_NEAR,
      paint: {
        'circle-color': ['get', 'c'] as unknown as maplibregl.ExpressionSpecification,
        'circle-opacity': DOT_OPACITY,
        'circle-blur': BLUR,
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9.2,
          ['min', ['*', 0.14, ['sqrt', ['get', 'gallons']]], 18],
          12,
          ['min', ['*', 0.34, ['sqrt', ['get', 'gallons']]], 18],
        ] as unknown as maplibregl.ExpressionSpecification,
      },
    },
    labelId,
  )
  return VOL_COARSE_LAYER
}

/** Re-bin both grid tiers and re-filter the raw tier for a new playhead /
 *  agent selection. Called from the throttled day effect (not per frame). */
export function updateVolume(
  map: maplibregl.Map,
  spray: SprayDataset,
  day: number,
  indices: number[] | null,
  tint?: string | null,
) {
  const coarse = map.getSource(VOL_COARSE_SOURCE) as maplibregl.GeoJSONSource | undefined
  const fine = map.getSource(VOL_FINE_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!coarse || !fine) return
  // One hue at a time: brand red for the whole field, an agent's colour
  // when isolated — and the rest of the record dims to grey rather than
  // vanishing, so the selection keeps its context.
  const c = tint ?? '#ff5449'
  coarse.setData(binGrid(spray, day, indices, COARSE_DEG, c))
  fine.setData(binGrid(spray, day, indices, FINE_DEG, c))
  if (map.getLayer(VOL_RAW_LAYER)) {
    map.setFilter(VOL_RAW_LAYER, ['<=', ['get', 'day'], day] as never)
    map.setPaintProperty(
      VOL_RAW_LAYER,
      'circle-color',
      indices
        ? (['case', ['in', ['get', 'agent'], ['literal', indices]], c, DIM] as never)
        : c,
    )
    map.setLayoutProperty(
      VOL_RAW_LAYER,
      'circle-sort-key',
      indices ? (['case', ['in', ['get', 'agent'], ['literal', indices]], 1, 0] as never) : 0,
    )
  }
}

/** Stamp each raw event feature with its resolved colour (`c`) and agent
 *  group index (`gi`) so the near tier can colour by agent without a runtime
 *  match expression and the bins can tally a dominant group per cell. */
export function stampEventColors(spray: SprayDataset, colors: string[], groupOf?: number[]) {
  for (const f of spray.features.features) {
    const p = f.properties as { agent: number; c?: string; gi?: number }
    p.c = colors[p.agent]
    if (groupOf) p.gi = groupOf[p.agent] ?? -1
  }
}


/** CF-style quiet basemap for the explorer: buildings off, water carrying its
 *  own blue, town-and-below labels gone, remaining labels set as small tracked
 *  grey caps so the data owns the page. */
export function quietBasemap(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    try {
      // Buildings go; vegetation stays. Footprints are noise at every zoom
      // this map opens at, but the green cover is geography the record is
      // *about* — where the canopy was is the point. `applyMapTheme` has
      // already put it at mapConfig.theme.greenspace (#e1e5d7, 1.14:1 against
      // the land), quiet enough to sit behind the circles.
      if (/building/.test(id)) {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      // Vegetation goes too. It was kept because "where the canopy was is the
      // point" — but positron's green is TODAY's cover, half a century after
      // the record, and reading it as the forest that was sprayed is exactly
      // the wrong inference to invite. Without it the land is one tone and the
      // circles have it to themselves.
      if (VEGETATION_RE.test(id)) {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      // Water carries its own blue rather than borrowing one. The old
      // near-neutral #e9edea only read as water because the land under it was
      // warm — it sat just +1 apart in blue-minus-red, so the moment land
      // lightened the sea stopped reading as sea. This blue is +27 cooler
      // than the land, and at 1.22:1 luminance it is still quiet enough that
      // the basemap recedes behind the data: the sea reads by hue, not by
      // lightness. The river line is the same hue two steps down so
      // waterways stay legible against land instead of against the sea.
      if (layer.type === 'fill' && WATER_FILL_RE.test(id)) {
        map.setPaintProperty(id, 'fill-color', WATER_FILL)
        continue
      }
      if (layer.type === 'line' && WATER_LINE_RE.test(id)) {
        map.setPaintProperty(id, 'line-color', WATER_LINE)
        continue
      }
      if (layer.type === 'line' && /highway|road|street|bridge|tunnel|transportation/.test(id)) {
        if (!/motorway|trunk|primary|major/.test(id)) {
          map.setLayoutProperty(id, 'visibility', 'none')
        } else {
          // The kept trunk network stays a hairline whisper.
          map.setPaintProperty(id, 'line-width', [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.4,
            10,
            1.1,
            14,
            2,
          ])
        }
        continue
      }
      if (/boundary|admin/.test(id) && layer.type === 'line') {
        map.setPaintProperty(id, 'line-color', '#a8ada2')
        map.setPaintProperty(id, 'line-width', 0.7)
        map.setPaintProperty(id, 'line-opacity', 0.6)
        // District/city rings are noise at this scale: draw nothing below
        // the national/provincial levels (admin_level > 4).
        const existing = map.getFilter(id)
        const levelF = ['<=', ['coalesce', ['to-number', ['get', 'admin_level']], 2], 4]
        map.setFilter(id, (existing ? ['all', existing, levelF] : levelF) as never)
        continue
      }
      // Basemap point markers go, in all three shapes positron can draw them:
      // a `circle` layer, an icon-only symbol layer, or an icon riding along
      // inside a label layer (handled below). A settlement dot next to a name
      // is redundant here — the name already marks the place — and on a map
      // whose entire visual language is "a filled circle is sprayed volume"
      // it reads as data that was never sprayed.
      if (layer.type === 'circle') {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      if (layer.type === 'symbol' && map.getLayoutProperty(id, 'text-field') == null) {
        map.setLayoutProperty(id, 'visibility', 'none')
        continue
      }
      if (layer.type === 'symbol' && map.getLayoutProperty(id, 'text-field') != null) {
        // Wards, hamlets and quarters stay gone at every zoom — post-reform
        // OSM names them things like "P.9" and they are noise here. Provinces
        // too: the military regions already divide the country for us, and two
        // competing partitions read as one confused one.
        //
        // Towns joined them. They used to arrive at the first hand-off, but on
        // a map whose subject is a spraying campaign the town tier was naming
        // places the record has nothing to say about, and crowding the cities
        // that anchor it. Cities and sea names now carry the whole basemap.
        //
        // DECIDED here, ACTED ON at the end of the block. These layers used to
        // `continue` straight past the treatment below, which meant they kept
        // positron's own casing, tracking, anchor and settlement dot — so the
        // moment one was switched back on (from the tuner, or by editing this
        // list) it arrived lowercase, unspaced and floating above its point
        // while every other label was uppercase, tracked and centred. Styling
        // something you are about to hide costs nothing; having it come back
        // wrong costs an afternoon.
        const tier = labelTierOf(layer as LayerLike)
        const style = LABEL_TIERS[tier]
        const hide = !style.shown
        const isWater = tier === 'sea' || tier === 'river'
        if (isWater) {
          // Open-sea names read in English (the site's language); coalesce
          // falls back to the local name where no translation exists.
          map.setLayoutProperty(id, 'text-field', [
            'coalesce',
            ['get', 'name:en'],
            ['get', 'name_en'],
            ['get', 'name'],
          ])
        }
        // Place names take the UI's tertiary ink (6.5:1 on the land); sea
        // names take its cool sibling, matched in luminance (6.6:1) so the two
        // read as one tier that happens to differ in temperature. Both were
        // far too pale before — the old sea grey sat at 2.6:1, barely there.
        // Every one of these five now comes from BASEMAP_TIERS instead of being
        // written flat, which is what lets the capital keep a heavier face.
        map.setPaintProperty(id, 'text-color', style.color)
        map.setPaintProperty(id, 'text-halo-color', style.halo)
        map.setPaintProperty(id, 'text-halo-width', style.haloWidth)
        map.setLayoutProperty(id, 'text-transform', 'uppercase')
        map.setLayoutProperty(id, 'text-letter-spacing', style.tracking)
        map.setLayoutProperty(id, 'text-font', [style.font || LABEL_FONT])
        // Drop any dot the label layer carries with it, and re-centre the
        // text on the point it names — positron parks the name above the
        // icon, so without this the label floats clear of its own location.
        try {
          map.setLayoutProperty(id, 'icon-image', undefined)
        } catch {
          map.setPaintProperty(id, 'icon-opacity', 0)
        }
        map.setLayoutProperty(id, 'text-anchor', 'center')
        map.setLayoutProperty(id, 'text-offset', [0, 0])
        // Which name survives a collision is now a rule rather than an
        // accident of tile order: OpenMapTiles ranks places with 1 as the most
        // important, and MapLibre places the lowest sort key first. Anything
        // without a rank sorts last.
        map.setLayoutProperty(id, 'symbol-sort-key', [
          'case',
          ['has', 'rank'],
          ['to-number', ['get', 'rank']],
          100,
        ])

        // Staged rollout, restored. A single z6.4 gate used to drop every
        // settlement onto the map at once, replacing positron's own tiering
        // with one cliff. Cities anchor the record from the opening view;
        // towns wait for the first hand-off; the country name steps aside at
        // the same moment, its job done once the places inside it are named.
        // Smaller at the overview than the old flat 12/15 — that view is the
        // record's, not the basemap's — and growing from there.
        const size = textSizeRamp(style.size[0], style.size[1])
        // Staging comes from the tier table now. It used to be a single
        // special case for the country label, which left every settlement
        // tier on from zoom 0 with no way to say otherwise.
        map.setLayerZoomRange(id, style.zoom[0], style.zoom[1])
        // Cities and water names carry no clamp at all: both earn their place
        // at the overview, and the sea names in particular are the only thing
        // labelling two-fifths of the frame.
        map.setLayoutProperty(id, 'text-size', size)

        // Last, now that the layer looks like the rest of the map.
        map.setLayoutProperty(id, 'visibility', hide ? 'none' : 'visible')
      }
    } catch {
      /* layer doesn't support the property — skip */
    }
  }
}

/** Country-label styling, matched to what `quietBasemap` does to the basemap's
 *  own country layers so ours cannot drift away from LAOS / THAILAND /
 *  CAMBODIA. Kept as one object because two places set it. */
const COUNTRY_TEXT = {
  font: [LABEL_FONT],
  size: textSizeRamp(10, 15),
  color: '#4b5a50',
  halo: 'rgba(250,249,244,0.92)',
  haloWidth: 1.1,
  /** Steps aside at the first hand-off, with the basemap's country tier. */
  maxzoom: Z_FAR_TO_MID,
} as const

/** Names positron may carry on the Vietnam country node, depending on which
 *  name field the tile serves. */
const VIETNAM_NAMES = ['Vietnam', 'Viet Nam', 'Việt Nam']

/**
 * Vietnam's own name on a map of Vietnam — the one country label the basemap
 * never manages to draw.
 *
 * Why it goes missing: MapLibre places symbols from the top of the layer stack
 * downwards (`PauseablePlacement` starts at `order.length - 1`), so whatever
 * sits highest wins a collision. `mr-label` is added above the basemap's
 * labels, and OSM puts the Vietnam place node at ~16.0°N 108.0°E — directly
 * under MILITARY REGION I. The country label loses every time.
 *
 * Letting it win instead is worse: it would land mid-coast, on top of our own
 * annotation and the densest part of the spray. So we place the name where a
 * cartographer would — the country's northern waist, clear of the record — and
 * drop Vietnam from the basemap's country layers so the two can never both
 * appear in the z8.5–9 window where `mr-label` has already faded out.
 *
 * Call this AFTER the volume layers. It goes in just under the basemap's own
 * labels, which puts it above the circles in draw order but *below* them in
 * placement order — so it can never suppress a city name, and at the overview,
 * where settlements are not drawn at all, nothing competes with it.
 */
export function addVietnamLabel(map: maplibregl.Map) {
  if (map.getLayer(VN_LABEL_LAYER)) return

  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || !/country/.test(layer.id)) continue
    try {
      const drop = [
        '!',
        ['in', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name'], ''], ['literal', VIETNAM_NAMES]],
      ]
      const existing = map.getFilter(layer.id)
      map.setFilter(layer.id, (existing ? ['all', existing, drop] : drop) as never)
    } catch {
      /* filter not settable — a duplicate at z8.5–9 is the worst case */
    }
  }

  map.addSource(VN_LABEL_SOURCE, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Viet Nam' },
          // Moved south with the framing. The home camera now fits the
          // RECORD (to ~17.7°N), not the country, so the old northern-waist
          // anchor at 19.9°N sits off the top of the map entirely. This is
          // Quảng Bình: inside Vietnam, inside the frame, and 1.3° clear of
          // the MILITARY REGION I tag at 15.98°N — which is the collision
          // that hid the basemap's own country label in the first place.
          geometry: { type: 'Point', coordinates: [106.4, 17.25] },
        },
      ],
    } as GeoJSON.FeatureCollection,
  })
  map.addLayer(
    {
      id: VN_LABEL_LAYER,
      type: 'symbol',
      source: VN_LABEL_SOURCE,
      maxzoom: COUNTRY_TEXT.maxzoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [...COUNTRY_TEXT.font],
        'text-size': COUNTRY_TEXT.size,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.2,
      },
      paint: {
        'text-color': COUNTRY_TEXT.color,
        'text-halo-color': COUNTRY_TEXT.halo,
        'text-halo-width': COUNTRY_TEXT.haloWidth,
      },
    },
    firstLabelLayerId(map),
  )
}
