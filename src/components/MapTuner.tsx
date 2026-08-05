// ─────────────────────────────────────────────────────────────────────────
//  Map tuner — a local Studio.
//
//  Every number that governs how this map behaves with zoom lives in a handful
//  of named constants (mapConfig's Z_MID / Z_NEAR / maxZoom, mapTheme's
//  Z_TYPE_FLOOR / Z_TYPE_TOP, and four textSizeRamp calls). That is what makes
//  a console like this tractable at all: there is a small, closed set of knobs
//  to expose, not a style sheet to re-derive.
//
//  It writes straight to the running MapLibre style. Nothing here feeds back
//  into source — "Copy for commit" produces a paste-ready block naming the file
//  and constant for every value you changed, which is the only thing that makes
//  a tuner worth using twice.
//
//  NOT SHOWN TO READERS. Dev builds always; production only with `?tune=1`, so
//  it can be reached on a Vercel preview without putting a control panel in
//  front of someone reading about herbicide.
//
//  TO REMOVE: delete this file and MapTuner.css, then drop the import and the
//  <MapTuner> element from MapView.tsx. Nothing else references it.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { mapConfig, Z_MID, Z_NEAR } from '../config/mapConfig'
import {
  WATER_FILL,
  VEGETATION_RE,
  WATER_FILL_RE,
  WATER_LINE_RE,
  VN_LABEL_LAYER,
  VOL_COARSE_LAYER,
  VOL_FINE_LAYER,
  VOL_RAW_LAYER,
  gridDegrees,
  setGridDegrees,
} from './volumeGrid'
import {
  LABEL_TIERS,
  LABEL_GROUPS,
  LABEL_TIER_NAME,
  RANKED,
  labelTierOf,
  geomGroupOf,
  GEOM_NAME,
  GEOM_GROUPS,
  type LabelTier,
  type GeomGroup,
  type LabelStyle,
  type LayerLike,
} from './mapTaxonomy'
import './MapTuner.css'

const STORE_KEY = 'adr-map-tuner'

/** Run `fn` as soon as the style is usable, and DO run it.
 *
 *  Both effects below used to do `if (isStyleLoaded()) fn(); else once('idle',
 *  fn)`, which has a hole: `idle` fires when the map finishes a frame, so if
 *  the map has already settled by the time the listener is attached, no
 *  further frame is scheduled and the callback never runs at all. That is what
 *  made the panel's behaviour depend on deviceScaleFactor — at DPR 2 the extra
 *  render work pushed `isStyleLoaded()` false at mount, the tune was applied
 *  once with an unseeded `hidden`, and the corrected pass that should have
 *  followed was waiting on an idle that had already happened. Hidden layers
 *  came back visible.
 *
 *  Polling the animation frame has no such hole: there is no event to miss,
 *  and it stops the moment the style answers. */
function whenStyleReady(map: maplibregl.Map, fn: () => void): () => void {
  let cancelled = false
  const tick = () => {
    if (cancelled) return
    if (map.isStyleLoaded()) fn()
    else requestAnimationFrame(tick)
  }
  tick()
  return () => {
    cancelled = true
  }
}

/** A size ramp: [size at Z_TYPE_FLOOR, size at Z_TYPE_TOP]. */
type Ramp = [number, number]

/** Everything the map says about ONE tier of label. Sizes, colour and halo
 *  travel together because they are judged together — a colour that works at
 *  9.5px stops working at 14. */
type Tier = LabelStyle

interface Tune {
  // ── palette ──
  land: string
  water: string
  veg: string
  vegOn: boolean
  font: string
  // ── zoom ──
  zMid: number
  zNear: number
  maxZoom: number
  /** How far below the fitted home camera the reader may still pull out. The
   *  floor itself is derived per viewport, so this margin is the only part of
   *  it that is a decision rather than a measurement. */
  minZoomMargin: number
  /** Aggregation cell sizes in degrees — the SIZE of the grid squares, which
   *  is a separate decision from the zoom at which one hands off to the next. */
  coarseDeg: number
  fineDeg: number
  // ── type scale ──
  typeFloor: number
  typeTop: number
  tiers: Record<TierKey, Tier>
  // ── per-layer overrides ──
  /** Basemap symbol layers forced off, by id. Seeded from what quietBasemap
   *  already hides, so the ticks describe the shipped map rather than
   *  overriding it — see the read effect. */
  hidden: string[]
  /** Has `hidden` been seeded from the live style yet? Stored, so a tune saved
   *  before this existed still gets seeded once on the next load. */
  seeded: boolean
  /** Per-layer [minzoom, maxzoom] overrides. `null` in a slot means "leave the
   *  layer's own value alone" — an override of 0 is a real instruction and must
   *  not be confused with "unset". */
  zoomRanges: Record<string, [number | null, number | null]>
}

/** Label faces with self-hosted SDF glyphs under public/fonts/. A name not in
 *  this list has no glyphs to fetch and every label on the map disappears, so
 *  this is a closed list, not free text. Every one covers Vietnamese natively
 *  (checked against ầ ư Đ ễ ợ ắ ộ) — a face that didn't would render place
 *  names half in itself and half in the Noto fallback. */
const FONTS = [
  'Roboto Condensed Light',
  'Roboto Condensed Regular',
  'Roboto Condensed',
  'Roboto Condensed Bold',
  'Cuprum',
  'Public Sans Medium',
  'Familjen Grotesk',
  'Westgate',
  'Danh Da',
]

/** Shown next to a stack name so "which of these is the weight I want" does not
 *  have to be inferred from the name. 'Roboto Condensed' IS the medium — it
 *  predates the other three and keeps its bare name so no committed style
 *  breaks. */
const FONT_NOTE: Record<string, string> = {
  'Roboto Condensed Light': '300',
  'Roboto Condensed Regular': '400',
  'Roboto Condensed': '500 · default',
  'Roboto Condensed Bold': '700',
}

type ColorKey = 'land' | 'water' | 'veg'
/** The basemap's own tiers plus the two this project draws itself. `place` is
 *  gone: it used to cover capital, city, town and village at once, which is
 *  exactly why none of them could be styled apart. */
type TierKey = LabelTier

const DEFAULTS: Tune = {
  land: mapConfig.theme.land,
  water: WATER_FILL,
  veg: mapConfig.theme.greenspace,
  // False, matching quietBasemap: vegetation is hidden outright now. A default
  // of `true` here would make "Reset" reveal layers the map does not ship with
  // — the same class of lie the layer-visibility seeding just fixed.
  vegOn: false,
  font: 'Roboto Condensed',
  zMid: Z_MID,
  zNear: Z_NEAR,
  maxZoom: mapConfig.view.maxZoom,
  minZoomMargin: mapConfig.view.minZoomMargin,
  coarseDeg: gridDegrees().coarse,
  fineDeg: gridDegrees().fine,
  typeFloor: 5,
  typeTop: 11,
  // Read off quietBasemap / mapTheme as committed, so "Reset" really is the
  // shipped map rather than a second opinion about it.
  // Every tier SPREAD from the shipped table rather than retyped, so "Reset"
  // cannot drift from the map by one edit. rankSpread now lives per tier, in
  // that table, so there is no global copy of it here.
  tiers: JSON.parse(JSON.stringify(LABEL_TIERS)) as Record<TierKey, Tier>,
  hidden: [],
  seeded: false,
  zoomRanges: {},
}


function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return null
  const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The waterway line colour for a given sea colour.
 *
 *  It used to darken by (17, 14, 11), matching a committed pair of #d1dee6 →
 *  #c0d0db. That pair is gone: WATER_LINE is now WATER_FILL, one tone for all
 *  water, because a darker river through the Mekong delta competed with the
 *  spray dots exactly where the record is densest.
 *
 *  Kept as a function rather than inlined, so that if the two are ever pulled
 *  apart again there is one place to say how — and so the panel's readout and
 *  the copy block cannot disagree about it. */
function deriveLine(waterHex: string): string {
  return waterHex
}

/** WCAG contrast, purely for the readout — it is the number that decides
 *  whether the basemap still recedes behind the data. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = hexToRgb(hex)
    if (!c) return 0
    const f = c.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Blue-minus-red: how much cooler the water is than the land. Hue difference,
 *  not lightness — this is what makes the sea read as sea. */
function coolness(a: string, b: string): number {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return 0
  return x[2] - x[0] - (y[2] - y[0])
}

function readStore(): Tune {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Tune> & Record<string, unknown>
    const t: Tune = { ...DEFAULTS, ...parsed }
    // Tiers deep-merge, so a stored tune written before a field existed keeps
    // the rest of its work instead of being thrown away wholesale.
    t.tiers = { ...DEFAULTS.tiers }
    for (const k of Object.keys(DEFAULTS.tiers) as TierKey[]) {
      const stored = (parsed.tiers as Record<string, Partial<Tier>> | undefined)?.[k]
      if (stored) t.tiers[k] = { ...DEFAULTS.tiers[k], ...stored }
    }
    // Stored tunes carry two older shapes. Both are migrated rather than
    // dropped, because the panel is tuned live and "my settings reset
    // themselves" is the likely outcome of doing nothing.
    //
    //   v2  one `place` tier covering capital / city / town / village
    //   v3  seven tiers, plus ONE global `rankSpread`
    //
    // `place` lands on `city`: that was the visible layer, so it is the one
    // the tuning was done against. The capital inherits the stored COLOUR
    // decisions only — inheriting the face would undo the weight split those
    // tiers exist for. A v3 global rankSpread is copied onto the ranked tiers,
    // which is where it now lives.
    const storedTiers = parsed.tiers as Record<string, Partial<Tier>> | undefined
    const storedPlace = storedTiers?.place
    if (storedPlace) {
      t.tiers.city = { ...t.tiers.city, ...storedPlace }
      const { color, halo, haloWidth } = { ...DEFAULTS.tiers.city, ...storedPlace }
      t.tiers.capital = { ...t.tiers.capital, color, halo, haloWidth }
    }
    // v3 named the sea tier `waterName` and the province tier `admin`.
    if (storedTiers?.waterName) t.tiers.sea = { ...t.tiers.sea, ...storedTiers.waterName }
    if (storedTiers?.admin) t.tiers.province = { ...t.tiers.province, ...storedTiers.admin }
    const legacySpread = (parsed as { rankSpread?: number }).rankSpread
    if (typeof legacySpread === 'number' && legacySpread > 0) {
      for (const k of RANKED) t.tiers[k] = { ...t.tiers[k], rankSpread: legacySpread }
    }
    return t
  } catch {
    return DEFAULTS
  }
}

/** Should this panel exist at all on this page load? */
function tunerEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).has('tune')
  } catch {
    return false
  }
}

/** Our own annotation layers. They ARE in the visibility list — the military
 *  region tags and their dashed borders are exactly the kind of thing you want
 *  to switch off and look without — but they are marked, so a reader of the
 *  list can tell which switches touch the record's own annotation rather than
 *  positron's basemap. */
const OWN_LAYERS = new Set(['mr-label', 'island-label', VN_LABEL_LAYER])

export default function MapTuner({
  map,
  onRegrid,
}: {
  map: maplibregl.Map | null
  /** Ask MapView to re-bin. Changing a cell size only changes what the NEXT
   *  bin uses; without this the new value would not reach the screen until the
   *  reader happened to scrub the timeline. */
  onRegrid?: () => void
}) {
  const enabled = useMemo(tunerEnabled, [])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'palette' | 'zoom' | 'type' | 'layers'>('palette')
  const [tune, setTune] = useState<Tune>(readStore)
  const [copied, setCopied] = useState(false)
  const [labelsOnly, setLabelsOnly] = useState(true)
  /** Every layer in the style with the facts the panel shows about it. */
  const [allLayers, setAllLayers] = useState<
    {
      id: string
      type: string
      isLabel: boolean
      /** Ours, not positron's — worth marking so a reader of the list knows
       *  which switches change the record's own annotation. */
      ours: boolean
      /** Which label tier this layer belongs to (labels only), and which
       *  geometry group (everything else). Stored at read time because the
       *  classifier needs `source-layer`, which getLayer() does not return —
       *  the whole reason the id-matching version got it wrong. */
      tier: LabelTier | null
      geom: GeomGroup | null
      minzoom: number
      maxzoom: number
    }[]
  >([])
  /** What quietBasemap already hides, read once from the live style. Kept apart
   *  from `tune.hidden` so the copy block can tell "you turned this off" from
   *  "it was already off". */
  const [baselineHidden, setBaselineHidden] = useState<string[]>([])
  // Text fields hold whatever is being typed, including half-finished hexes;
  // only a valid value is pushed to the map.
  const [draft, setDraft] = useState<Record<ColorKey, string>>({
    land: tune.land,
    water: tune.water,
    veg: tune.veg,
  })
  const mapRef = useRef(map)
  mapRef.current = map
  /** The fit-derived home zoom, recovered once from the floor MapView set
   *  (`home − minZoomMargin`). Captured BEFORE the tuner touches minZoom,
   *  otherwise each apply would re-derive from its own last output and the
   *  floor would walk away on every slider tick. */
  const homeZoomRef = useRef<number | null>(null)
  // Held in a ref so `apply` does not have to list it as a dependency and
  // re-run every time MapView re-creates the callback.
  const onRegridRef = useRef(onRegrid)
  onRegridRef.current = onRegrid

  // Which basemap symbol layers exist is ASKED, never assumed. Hardcoding a
  // list is what produced findings §7.1/§7.3 in docs/map-zoom-and-labels.md,
  // and then the same bug again in the Mapbox spike.
  //
  // The visibility SEED matters as much as the list. quietBasemap has already
  // hidden three of these (label_village, label_state, and — by accident —
  // highway-shield-us-interstate). The first version wrote `visible` to every
  // layer the user had not ticked off, which un-hid all three the moment the
  // panel mounted: the map gained labels it does not ship with, and the ticks
  // claimed a state that was not true. So the shipped visibility is read once
  // and folded into `hidden`, and the checkboxes start out honest.
  useEffect(() => {
    if (!map || !enabled) return
    const read = () => {
      const rows: typeof allLayers = []
      const offNow: string[] = []
      for (const l of map.getStyle().layers ?? []) {
        if (l.type === 'background') continue
        try {
          const isLabel = l.type === 'symbol' && map.getLayoutProperty(l.id, 'text-field') != null
          rows.push({
            id: l.id,
            type: l.type,
            isLabel,
            ours: OWN_LAYERS.has(l.id) || l.id === 'mr-borders' || l.id.startsWith('vol-'),
            tier: isLabel ? labelTierOf(l as LayerLike) : null,
            geom: isLabel ? null : geomGroupOf(l as LayerLike),
            minzoom: l.minzoom ?? 0,
            maxzoom: l.maxzoom ?? 24,
          })
          // `hidden` is now ONLY the per-layer override. A label tier being
          // off is the tier's own `shown`, applied below — folding it in here
          // as well gave one fact two owners, so turning a tier on in TYPE did
          // nothing because the layer was still ticked off in `hidden`.
          //
          // Labels are therefore excluded from the live read: their off-ness is
          // already described by the tier table, and reading it back here would
          // re-import it as a per-layer override on the first mount.
          const off = !isLabel && (map.getLayoutProperty(l.id, 'visibility') === 'none' || VEGETATION_RE.test(l.id))
          if (off) offNow.push(l.id)
        } catch {
          /* layer doesn't answer — leave it out */
        }
      }
      if (homeZoomRef.current == null) {
        homeZoomRef.current = map.getMinZoom() + DEFAULTS.minZoomMargin
      }
      setAllLayers(rows)
      setBaselineHidden(offNow)
      setTune((t) =>
        t.seeded ? t : { ...t, seeded: true, hidden: [...new Set([...t.hidden, ...offNow])] },
      )
    }
    return whenStyleReady(map, read)
  }, [map, enabled])

  // Apply on every change, and once on mount so a stored tune survives reload.
  useEffect(() => {
    const m = map
    if (!m || !enabled) return
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(tune))
    } catch {
      /* private mode — the tune just won't persist */
    }

    /** Size as a function of zoom, and — for settlements — of importance.
     *
     *  OpenMapTiles ships `rank` on the place layer (1 = most important) and we
     *  were spending it only on collision order, so Hồ Chí Minh City and a
     *  district seat rendered at exactly the same size. `spread` reintroduces
     *  the hierarchy: 0 keeps today's flat scale, 0.4 puts a rank-10 place at
     *  60% of a rank-1 one. The zoom interpolate has to stay OUTERMOST, so the
     *  rank factor multiplies inside each stop. */
    const ramp = (r: Ramp, spread = 0) => {
      if (!spread) {
        return ['interpolate', ['linear'], ['zoom'], tune.typeFloor, r[0], tune.typeTop, r[1]] as never
      }
      const mul = [
        '-',
        1,
        ['*', spread, ['/', ['-', ['min', ['coalesce', ['to-number', ['get', 'rank']], 10], 10], 1], 9]],
      ]
      return [
        'interpolate',
        ['linear'],
        ['zoom'],
        tune.typeFloor,
        ['*', r[0], mul],
        tune.typeTop,
        ['*', r[1], mul],
      ] as never
    }

    /** Which tier a label layer belongs to. The basemap layers are classified
     *  by CALLING the shipped classifier rather than by a lookalike copy of
     *  its tests — the old copy had already drifted once, and a tuner that
     *  groups layers differently from the map is a tuner for a map we do not
     *  have. Only the two layers this project draws itself are matched here,
     *  by exact id, because volumeGrid does not know about them. */
    const tierFor = (layer: LayerLike): TierKey => labelTierOf(layer)

    const apply = () => {
      const line = deriveLine(tune.water)
      m.setMaxZoom(tune.maxZoom)
      // The floor is fit-derived per viewport, so the tuner must not invent a
      // number for it — it recovers the home zoom from the floor MapView set
      // (home − committed margin) and re-derives from there.
      if (homeZoomRef.current != null) {
        m.setMinZoom(homeZoomRef.current - tune.minZoomMargin)
      }

      // The two hand-off zooms, applied everywhere they are wired.
      const setRange = (id: string, min: number, max: number) => {
        try {
          if (m.getLayer(id)) m.setLayerZoomRange(id, min, max)
        } catch {
          /* layer gone — skip */
        }
      }
      // Cell sizes go in before the ranges, so a re-bin triggered below sees
      // the new values.
      const live = gridDegrees()
      if (live.coarse !== tune.coarseDeg || live.fine !== tune.fineDeg) {
        setGridDegrees({ coarse: tune.coarseDeg, fine: tune.fineDeg })
        onRegridRef.current?.()
      }
      setRange(VOL_COARSE_LAYER, 0, tune.zMid)
      setRange(VOL_FINE_LAYER, tune.zMid, tune.zNear)
      setRange(VOL_RAW_LAYER, tune.zNear, 24)
      setRange('mr-label', 0, tune.zNear)
      setRange(VN_LABEL_LAYER, 0, tune.zMid)

      for (const layer of m.getStyle().layers ?? []) {
        const id = layer.id
        try {
          // Visibility and zoom range apply to EVERY layer, not only labels —
          // hiding a fill or clamping a road is as much a map decision as
          // hiding a place name, and used to be unreachable from here.
          if (layer.type !== 'background') {
            m.setLayoutProperty(id, 'visibility', tune.hidden.includes(id) ? 'none' : 'visible')
            const ov = tune.zoomRanges[id]
            if (ov && (ov[0] != null || ov[1] != null)) {
              setRange(id, ov[0] ?? 0, ov[1] ?? 24)
            }
          }
          if (id === 'background') {
            m.setPaintProperty(id, 'background-color', tune.land)
          } else if (layer.type === 'fill' && WATER_FILL_RE.test(id)) {
            m.setPaintProperty(id, 'fill-color', tune.water)
          } else if (layer.type === 'line' && WATER_LINE_RE.test(id)) {
            m.setPaintProperty(id, 'line-color', line)
          } else if (VEGETATION_RE.test(id) && !/building/.test(id)) {
            m.setLayoutProperty(id, 'visibility', tune.vegOn ? 'visible' : 'none')
            if (tune.vegOn && layer.type === 'fill') {
              m.setPaintProperty(id, 'fill-color', tune.veg)
            }
          }

          // Every text layer, ours included: the military-region tags and the
          // island notes are map labels too, so a comparison that left them in
          // the old face would not show what the map actually becomes.
          if (layer.type === 'symbol' && m.getLayoutProperty(id, 'text-field') != null) {
            const key = tierFor(layer as LayerLike)
            const tier = tune.tiers[key]
            // Rank only exists on the settlement layers, so the spread only
            // reaches the tiers that have it. Applying it to sea names would
            // silently shrink every one of them to the `coalesce` default.
            const spread = RANKED.has(key) ? tier.rankSpread : 0
            // Tier switch AND per-layer override. The layer wins when it is
            // ticked off, because it is the more specific instruction.
            m.setLayoutProperty(id, 'visibility', tier.shown && !tune.hidden.includes(id) ? 'visible' : 'none')
            m.setLayoutProperty(id, 'text-font', [tier.font || tune.font])
            m.setLayoutProperty(id, 'text-size', ramp(tier.size, spread))
            m.setLayoutProperty(id, 'text-letter-spacing', tier.tracking)
            m.setPaintProperty(id, 'text-color', tier.color)
            m.setPaintProperty(id, 'text-halo-color', tier.halo)
            m.setPaintProperty(id, 'text-halo-width', tier.haloWidth)

            // Staging, from the tier itself. This replaces two hard-coded
            // special cases — one for `country`, one for `town` — which was
            // why `city` had no staging control at all and the big cities
            // could not be brought forward to the opening view.
            //
            // A per-layer override in the LAYERS tab still wins: it is the
            // more specific instruction, and it is applied after this.
            if (!tune.zoomRanges[id]) setRange(id, tier.zoom[0], tier.zoom[1])
          }
        } catch {
          /* layer doesn't take this property — skip */
        }
      }
      // Required: when this runs from the `idle` handler below, MapLibre
      // applies the properties but never schedules a frame, so a restored tune
      // would sit in the style and never reach the screen.
      m.triggerRepaint()
    }

    // On the mount pass the style is usually still settling, so this cannot
    // just early-return — a stored tune would be dropped on every reload.
    return whenStyleReady(m, apply)
  }, [tune, map, enabled])

  const setColor = (key: ColorKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (hexToRgb(value)) setTune((t) => ({ ...t, [key]: value.startsWith('#') ? value : '#' + value }))
  }

  const setNum = (
    key:
      | 'zMid'
      | 'zNear'
      | 'maxZoom'
      | 'minZoomMargin'
      | 'typeFloor'
      | 'typeTop'
      | 'coarseDeg'
      | 'fineDeg',
    v: number,
  ) => setTune((t) => ({ ...t, [key]: v }))

  const setTier = (key: TierKey, patch: Partial<Tier>) =>
    setTune((t) => ({ ...t, tiers: { ...t.tiers, [key]: { ...t.tiers[key], ...patch } } }))

  const setRampEnd = (key: TierKey, end: 0 | 1, v: number) =>
    setTune((t) => {
      const next: Ramp = [...t.tiers[key].size] as Ramp
      next[end] = v
      return { ...t, tiers: { ...t.tiers, [key]: { ...t.tiers[key], size: next } } }
    })

  /** Drop every per-layer override on a tier's layers, so the tier's own
   *  settings are the only thing left speaking. */
  const clearOverrides = (layerIds: string[]) =>
    setTune((t) => {
      const zoomRanges = { ...t.zoomRanges }
      for (const id of layerIds) delete zoomRanges[id]
      return { ...t, zoomRanges, hidden: t.hidden.filter((id) => !layerIds.includes(id)) }
    })

  const setStageEnd = (key: TierKey, end: 0 | 1, v: number) =>
    setTune((t) => {
      const next: Ramp = [...t.tiers[key].zoom] as Ramp
      next[end] = v
      return { ...t, tiers: { ...t.tiers, [key]: { ...t.tiers[key], zoom: next } } }
    })

  const shownLayers = useMemo(
    () => (labelsOnly ? allLayers.filter((l) => l.isLabel) : allLayers),
    [allLayers, labelsOnly],
  )

  /** Tier → the layer ids it actually governs, off the live style. Shown on
   *  every row, because "which layers does this control" was the question the
   *  old panel could not answer — and the answer used to be wrong. */
  const ids = useMemo(() => {
    const o = {} as Record<LabelTier, string[]>
    for (const l of allLayers) if (l.tier) (o[l.tier] = o[l.tier] || []).push(l.id)
    return o
  }, [allLayers])

  /** Same, for geometry. */
  const geomIds = useMemo(() => {
    const o = {} as Record<GeomGroup, string[]>
    for (const l of allLayers) if (l.geom) (o[l.geom] = o[l.geom] || []).push(l.id)
    return o
  }, [allLayers])

  /** The LAYERS tab, sectioned: every label tier first (in panel order), then
   *  the geometry groups. Empty sections are dropped rather than shown as
   *  headings with nothing under them — the style decides which exist. */
  const layerSections = useMemo(() => {
    const keep = new Set(shownLayers.map((l) => l.id))
    const find = (id: string) => shownLayers.find((l) => l.id === id)!
    const secs: { head: string; rows: typeof shownLayers }[] = []
    for (const g of LABEL_GROUPS) {
      for (const t of g.tiers) {
        const rows = (ids[t] ?? []).filter((id) => keep.has(id)).map(find)
        if (rows.length) secs.push({ head: `${g.label} · ${LABEL_TIER_NAME[t]}`, rows })
      }
    }
    for (const g of GEOM_GROUPS) {
      const rows = (geomIds[g] ?? []).filter((id) => keep.has(id)).map(find)
      if (rows.length) secs.push({ head: GEOM_NAME[g], rows })
    }
    return secs
  }, [shownLayers, ids, geomIds])

  const setLayerZoom = (id: string, end: 0 | 1, raw: string) =>
    setTune((t) => {
      const cur = t.zoomRanges[id] ?? [null, null]
      const next: [number | null, number | null] = [cur[0], cur[1]]
      next[end] = raw === '' ? null : Number(raw)
      const cleared = next[0] == null && next[1] == null
      const ranges = { ...t.zoomRanges }
      if (cleared) delete ranges[id]
      else ranges[id] = next
      return { ...t, zoomRanges: ranges }
    })

  const toggleLayer = (id: string) =>
    setTune((t) => ({
      ...t,
      hidden: t.hidden.includes(id) ? t.hidden.filter((x) => x !== id) : [...t.hidden, id],
    }))

  const reset = () => {
    setTune(DEFAULTS)
    setDraft({ land: DEFAULTS.land, water: DEFAULTS.water, veg: DEFAULTS.veg })
  }

  /** Paste-ready, and only what CHANGED — a wall of unchanged defaults is how a
   *  tuner's output stops being read. Each line names the file and the constant
   *  so nothing has to be hunted for. */
  const summary = useMemo(() => {
    const out: string[] = []
    const push = (file: string, lines: string[]) => {
      if (lines.length) out.push(`// ${file}`, ...lines, '')
    }
    const r = (v: Ramp) => `textSizeRamp(${v[0]}, ${v[1]})`
    /** Staging is a plain [min, max] pair in the tier table — NOT a size ramp.
     *  Printing it through `r` produced `textSizeRamp(9, 24)`, which is wrong
     *  wherever it was pasted. */
    const zr = (v: Ramp) => `[${v[0]}, ${v[1]}]`
    const changed = <T,>(a: T, b: T) => JSON.stringify(a) !== JSON.stringify(b)

    const cfg: string[] = []
    if (tune.land !== DEFAULTS.land) cfg.push(`theme.land: '${tune.land}',`)
    if (tune.veg !== DEFAULTS.veg) cfg.push(`theme.greenspace: '${tune.veg}',`)
    if (tune.font !== DEFAULTS.font) cfg.push(`LABEL_FONT = '${tune.font}'`)
    if (tune.zMid !== DEFAULTS.zMid) cfg.push(`Z_MID = ${tune.zMid}`)
    if (tune.zNear !== DEFAULTS.zNear) cfg.push(`Z_NEAR = ${tune.zNear}`)
    if (tune.maxZoom !== DEFAULTS.maxZoom) cfg.push(`view.maxZoom: ${tune.maxZoom},`)
    if (tune.minZoomMargin !== DEFAULTS.minZoomMargin)
      cfg.push(`view.minZoomMargin: ${tune.minZoomMargin},`)
    push('src/config/mapConfig.ts', cfg)

    const vol: string[] = []
    if (tune.coarseDeg !== DEFAULTS.coarseDeg) vol.push(`COARSE_DEG = ${tune.coarseDeg}`)
    if (tune.fineDeg !== DEFAULTS.fineDeg) vol.push(`FINE_DEG = ${tune.fineDeg}`)
    if (tune.water !== DEFAULTS.water) {
      vol.push(`WATER_FILL = '${tune.water}'`, `WATER_LINE = '${deriveLine(tune.water)}'`)
    }
    /** The basemap tiers now live in one table, so their edits are quoted in
     *  the TABLE's field names and keyed by the row to paste into. mr and
     *  island have no table — they are raw layer specs in mapTheme — so those
     *  stay in MapLibre property names. Emitting one shape for both would
     *  make half the block wrong wherever it was pasted. */
    const tierLines = (keys: TierKey[]) => {
      const out: string[] = []
      for (const k of keys) {
        const a = tune.tiers[k]
        const b = DEFAULTS.tiers[k]
        const table = true
        const bits: string[] = []
        if (changed(a.size, b.size)) bits.push(table ? `size: ${r(a.size)}` : `text-size ${r(a.size)}`)
        if (changed(a.zoom, b.zoom)) {
          bits.push(table ? `zoom: ${zr(a.zoom)}` : `setLayerZoomRange(${a.zoom[0]}, ${a.zoom[1]})`)
        }
        if (a.font !== b.font) {
          bits.push(table ? `font: '${a.font}'` : `text-font ['${a.font || tune.font}']`)
        }
        if (a.tracking !== b.tracking) {
          bits.push(table ? `tracking: ${a.tracking}` : `text-letter-spacing ${a.tracking}`)
        }
        if (a.color !== b.color) bits.push(table ? `color: '${a.color}'` : `text-color '${a.color}'`)
        if (a.halo !== b.halo) bits.push(table ? `halo: '${a.halo}'` : `text-halo-color '${a.halo}'`)
        if (a.haloWidth !== b.haloWidth) {
          bits.push(table ? `haloWidth: ${a.haloWidth}` : `text-halo-width ${a.haloWidth}`)
        }
        if (!bits.length) continue
        const at = `LABEL_TIERS.${k}`
        out.push(`${at}: ${bits.join(' · ')}`)
      }
      return out
    }
    vol.push(...tierLines(LABEL_GROUPS.flatMap((g) => g.tiers)))
    // Only layers the reader turned off ON TOP of what quietBasemap already
    // hides are a change; listing the pre-hidden ones would read as work to do.
    const newlyHidden = tune.hidden.filter((id) => !baselineHidden.includes(id))
    if (newlyHidden.length) {
      vol.push(`quietBasemap — also hide: ${newlyHidden.join(', ')}`)
    }
    const unhidden = baselineHidden.filter((id) => !tune.hidden.includes(id))
    if (unhidden.length) {
      vol.push(`quietBasemap — STOP hiding: ${unhidden.join(', ')}`)
    }
    for (const [id, ov] of Object.entries(tune.zoomRanges)) {
      vol.push(
        `quietBasemap — setLayerZoomRange('${id}', ${ov[0] ?? 0}, ${ov[1] ?? 24})`,
      )
    }
    if (!tune.vegOn) vol.push('quietBasemap — hide vegetation entirely')
    push('src/components/volumeGrid.ts', vol)

    const theme: string[] = []
    if (tune.typeFloor !== DEFAULTS.typeFloor) theme.push(`Z_TYPE_FLOOR = ${tune.typeFloor}`)
    if (tune.typeTop !== DEFAULTS.typeTop) theme.push(`Z_TYPE_TOP = ${tune.typeTop}`)
    theme.push(...tierLines(['mr', 'island']))
    push('src/components/mapTheme.ts', theme)

    return out.length ? out.join('\n').trimEnd() : 'Nothing changed from the committed values.'
  }, [tune, baselineHidden])

  const copy = () => {
    navigator.clipboard?.writeText(summary).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      },
      () => setCopied(false),
    )
  }

  if (!enabled) return null

  if (!open) {
    return (
      <button className="tuner-tab" onClick={() => setOpen(true)}>
        Tune map
      </button>
    )
  }

  const num = (
    label: string,
    key:
      | 'zMid'
      | 'zNear'
      | 'maxZoom'
      | 'minZoomMargin'
      | 'typeFloor'
      | 'typeTop'
      | 'coarseDeg'
      | 'fineDeg',
    min: number,
    max: number,
    step: number,
    hint?: string,
  ) => (
    <label className="tuner-slider" key={key}>
      <span>
        {label} <strong>{tune[key]}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={tune[key]}
        onChange={(e) => setNum(key, Number(e.target.value))}
      />
      {hint && <em>{hint}</em>}
    </label>
  )

  return (
    <div className="tuner is-wide">
      <div className="tuner-head">
        <span className="tuner-title">Map tuner</span>
        <button className="tuner-x" onClick={() => setOpen(false)} aria-label="Collapse">
          ×
        </button>
      </div>

      <div className="tuner-tabs" role="tablist">
        {(['palette', 'zoom', 'type', 'layers'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'is-active' : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'palette' && (
        <>
          {([
            { key: 'land', label: 'Land' },
            { key: 'water', label: 'Water' },
            { key: 'veg', label: 'Vegetation' },
          ] as { key: ColorKey; label: string }[]).map(({ key, label }) => (
            <label className="tuner-row" key={key}>
              <span className="tuner-label">{label}</span>
              <input
                className="tuner-swatch"
                type="color"
                value={tune[key]}
                onChange={(e) => setColor(key, e.target.value)}
              />
              <input
                className="tuner-hex"
                type="text"
                spellCheck={false}
                value={draft[key]}
                onChange={(e) => setColor(key, e.target.value)}
                onBlur={() => setDraft((d) => ({ ...d, [key]: tune[key] }))}
              />
            </label>
          ))}

          <label className="tuner-row">
            <span className="tuner-label">Label font</span>
            <select
              className="tuner-font"
              value={tune.font}
              onChange={(e) => setTune((t) => ({ ...t, font: e.target.value }))}
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="tuner-check">
            <input
              type="checkbox"
              checked={tune.vegOn}
              onChange={(e) => setTune((t) => ({ ...t, vegOn: e.target.checked }))}
            />
            <span>Show vegetation (on in the shipped explorer)</span>
          </label>

          <dl className="tuner-read">
            <div>
              <dt>River line</dt>
              <dd>{deriveLine(tune.water)}</dd>
            </div>
            <div>
              <dt>Water vs land</dt>
              <dd>
                {contrast(tune.water, tune.land).toFixed(2)}:1 ·{' '}
                {coolness(tune.water, tune.land) > 0 ? '+' : ''}
                {coolness(tune.water, tune.land)} cooler
              </dd>
            </div>
            <div>
              <dt>Land vs Orange</dt>
              <dd>{contrast(tune.land, mapConfig.agents[0].color).toFixed(2)}:1</dd>
            </div>
          </dl>
        </>
      )}

      {tab === 'zoom' && (
        <>
          {num('First hand-off · Z_MID', 'zMid', 5, 11, 0.1, 'coarse grid → fine · towns in · country out')}
          {num('Second hand-off · Z_NEAR', 'zNear', 6, 12, 0.1, 'fine grid → raw runs · region tags out')}
          {num('Zoom ceiling · maxZoom', 'maxZoom', 9, 16, 0.5, 'the record stops carrying detail past ~12')}
          {num(
            'Zoom floor margin · minZoomMargin',
            'minZoomMargin',
            0,
            2,
            0.05,
            'how far below the fitted record you may still pull out',
          )}
          <dl className="tuner-read">
            <div>
              <dt>Fitted home (this viewport)</dt>
              <dd>{homeZoomRef.current != null ? homeZoomRef.current.toFixed(2) : '—'}</dd>
            </div>
            <div>
              <dt>Resulting floor</dt>
              <dd>
                {homeZoomRef.current != null
                  ? (homeZoomRef.current - tune.minZoomMargin).toFixed(2)
                  : '—'}
              </dd>
            </div>
          </dl>
          <p className="tuner-note">
            The floor itself is DERIVED per viewport by fitting recordBounds — 5.29 on a phone, 6.65
            on a 27&quot;. Only the margin below it is a decision, so only the margin is a knob.
          </p>
          <div className="tuner-ramp">
            <span className="tuner-ramp-name">
              Grid cell size <em>volumeGrid COARSE_DEG / FINE_DEG</em>
            </span>
            <div className="tuner-ramp-ends">
              <label>
                <span>coarse</span>
                <input
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.01}
                  value={tune.coarseDeg}
                  onChange={(e) => setNum('coarseDeg', Number(e.target.value))}
                />
              </label>
              <label>
                <span>fine</span>
                <input
                  type="number"
                  min={0.005}
                  max={0.5}
                  step={0.005}
                  value={tune.fineDeg}
                  onChange={(e) => setNum('fineDeg', Number(e.target.value))}
                />
              </label>
            </div>
            <p className="tuner-tier-read">
              ≈ {Math.round(tune.coarseDeg * 111)} km · {Math.round(tune.fineDeg * 111)} km at this
              latitude. How BIG a square is, separate from where one hands off to the next.
            </p>
          </div>
        </>
      )}

      {tab === 'type' && (
        <>
          {num('Ramp floor · Z_TYPE_FLOOR', 'typeFloor', 3, 8, 0.1)}
          {num('Ramp top · Z_TYPE_TOP', 'typeTop', 9, 16, 0.5)}
          {LABEL_GROUPS.flatMap((group) =>
            group.tiers.map((key, i) => {
              const tier = tune.tiers[key]
              return (
                <div className="tuner-ramp" key={key}>
                  {/* One heading per group, on its first tier. Fifteen tiers in
                      a flat list is a wall; grouped, it is a map legend. */}
                  {i === 0 && <h4 className="tuner-group">{group.label}</h4>}
                  <label className="tuner-ramp-name tuner-ramp-head">
                    <input
                      type="checkbox"
                      checked={tier.shown}
                      onChange={(e) => setTier(key, { shown: e.target.checked })}
                    />
                    <span>
                      {LABEL_TIER_NAME[key]}
                      <em>{ids[key]?.length ? ids[key].join(', ') : 'no layer in this style'}</em>
                    </span>
                  </label>
                <div className="tuner-ramp-ends">
                  {([0, 1] as const).map((end) => (
                    <label key={end}>
                      <span>{end === 0 ? 'size at z' + tune.typeFloor : 'size at z' + tune.typeTop}</span>
                      <input
                        type="number"
                        min={4}
                        max={40}
                        step={0.5}
                        value={tier.size[end]}
                        onChange={(e) => setRampEnd(key, end, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
                {/* SEPARATE from the two above, and labelled to say so — these
                    are the only fields that decide whether the tier is drawn at
                    all. "at floor / at top" were being read as staging. */}
                <div className="tuner-ramp-ends tuner-ramp-stage">
                  {([0, 1] as const).map((end) => (
                    <label key={end}>
                      <span>{end === 0 ? 'shows from z' : 'hides after z'}</span>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        value={tier.zoom[end]}
                        onChange={(e) => setStageEnd(key, end, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
                <div className="tuner-ramp-ends tuner-ramp-paint">
                  <label className="tuner-ramp-font">
                    <span>face</span>
                    <select
                      value={tier.font}
                      onChange={(e) => setTier(key, { font: e.target.value })}
                    >
                      <option value="">inherit ({tune.font})</option>
                      {FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                          {FONT_NOTE[f] ? ` · ${FONT_NOTE[f]}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>track</span>
                    <input
                      type="number"
                      min={-0.1}
                      max={0.6}
                      step={0.02}
                      value={tier.tracking}
                      onChange={(e) => setTier(key, { tracking: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <div className="tuner-ramp-ends tuner-ramp-paint">
                  <label>
                    <span>colour</span>
                    <input
                      className="tuner-swatch"
                      type="color"
                      value={tier.color}
                      onChange={(e) => setTier(key, { color: e.target.value })}
                    />
                    <input
                      type="text"
                      spellCheck={false}
                      value={tier.color}
                      onChange={(e) => setTier(key, { color: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>halo</span>
                    <input
                      type="number"
                      min={0}
                      max={4}
                      step={0.1}
                      value={tier.haloWidth}
                      onChange={(e) => setTier(key, { haloWidth: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <p className="tuner-tier-read">
                  {contrast(tier.color, tune.land).toFixed(2)}:1 on land
                </p>
                {/* Visibility has three possible owners — this tier, a per-layer
                    tick, and a per-layer zoom override — and the panel used to
                    show only the first. A tier reading "shown, from z0" while
                    its layer was ticked off in LAYERS looked identical to one
                    that simply was not drawing. That is a panel that lies. */}
                {(() => {
                  const mine = ids[key] ?? []
                  const off = mine.filter((id) => tune.hidden.includes(id))
                  const zov = mine.filter((id) => tune.zoomRanges[id])
                  if (!off.length && !zov.length) return null
                  return (
                    <p className="tuner-conflict">
                      <strong>Overridden per layer — this beats the settings above.</strong>
                      {off.length > 0 && <> Hidden in LAYERS: {off.join(', ')}.</>}
                      {zov.map((id) => (
                        <span key={id}>
                          {' '}{id} clamped to z{tune.zoomRanges[id][0] ?? 0}–
                          {tune.zoomRanges[id][1] ?? 24}.
                        </span>
                      ))}{' '}
                      <button type="button" onClick={() => clearOverrides(mine)}>
                        Clear override
                      </button>
                    </p>
                  )
                })()}
                {RANKED.has(key) && (
                    <label className="tuner-slider tuner-rank">
                      <span>
                        rank spread <strong>{tier.rankSpread}</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={0.6}
                        step={0.05}
                        value={tier.rankSpread}
                        onChange={(e) => setTier(key, { rankSpread: Number(e.target.value) })}
                      />
                      <em>
                        Separates features INSIDE this one tier by OpenMapTiles `rank`. Only
                        shown on tiers whose source carries rank — `label_city` holds Hồ Chí Minh
                        (rank 3) and small provincial seats (rank 7+) in the SAME layer, and
                        nothing else can tell them apart. 0 = all one size.
                      </em>
                    </label>
                  )}
                </div>
              )
            }),
          )}
        </>
      )}

      {tab === 'layers' && (
        <>
          <label className="tuner-check">
            <input
              type="checkbox"
              checked={labelsOnly}
              onChange={(e) => setLabelsOnly(e.target.checked)}
            />
            <span>Label layers only</span>
          </label>
          <p className="tuner-note">
            {shownLayers.length} of {allLayers.length} layers, read from the live style. This tab is
            for INDIVIDUAL layers — a per-layer override here beats its tier&apos;s setting in TYPE,
            because it is the more specific instruction. Text is grouped by label tier, geometry by
            what it draws. The two boxes on the right are that layer&apos;s own minzoom / maxzoom.
          </p>
          <div className="tuner-layers is-detailed">
            {layerSections.map((sec) => (
              <div className="tuner-layer-sec" key={sec.head}>
                <h4 className="tuner-group">
                  {sec.head} <em>{sec.rows.length}</em>
                </h4>
                {sec.rows.map((l) => (
              <div className="tuner-layer-row" key={l.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!tune.hidden.includes(l.id)}
                    onChange={() => toggleLayer(l.id)}
                  />
                  <span>
                    {l.id}
                    <em>{l.type}</em>
                    {l.ours && <em className="is-ours">ours</em>}
                  </span>
                </label>
                <span className="tuner-layer-z">
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={tune.zoomRanges[l.id]?.[0] ?? ''}
                    placeholder={String(l.minzoom)}
                    onChange={(e) => setLayerZoom(l.id, 0, e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={tune.zoomRanges[l.id]?.[1] ?? ''}
                    placeholder={String(l.maxzoom)}
                    onChange={(e) => setLayerZoom(l.id, 1, e.target.value)}
                  />
                </span>
              </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <pre className="tuner-out">{summary}</pre>

      <div className="tuner-foot">
        <button onClick={copy}>{copied ? 'Copied' : 'Copy for commit'}</button>
        <button onClick={reset}>Reset</button>
      </div>
      <p className="tuner-note">
        Values live in your browser only. Paste the block above and I&apos;ll commit it.
      </p>
    </div>
  )
}
