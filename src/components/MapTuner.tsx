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
} from './volumeGrid'
import './MapTuner.css'

const STORE_KEY = 'adr-map-tuner'

/** A size ramp: [size at Z_TYPE_FLOOR, size at Z_TYPE_TOP]. */
type Ramp = [number, number]

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
  // ── type scale ──
  typeFloor: number
  typeTop: number
  place: Ramp
  country: Ramp
  mr: Ramp
  island: Ramp
  // ── per-layer overrides ──
  /** Basemap symbol layers forced off, by id. */
  hidden: string[]
}

/** Label faces with self-hosted SDF glyphs under public/fonts/. A name not in
 *  this list has no glyphs to fetch and every label on the map disappears, so
 *  this is a closed list, not free text. Every one covers Vietnamese natively
 *  (checked against ầ ư Đ ễ ợ ắ ộ) — a face that didn't would render place
 *  names half in itself and half in the Noto fallback. */
const FONTS = ['Roboto Condensed', 'Cuprum', 'Public Sans Medium']

type ColorKey = 'land' | 'water' | 'veg'
type RampKey = 'place' | 'country' | 'mr' | 'island'

const DEFAULTS: Tune = {
  land: mapConfig.theme.land,
  water: WATER_FILL,
  veg: mapConfig.theme.greenspace,
  vegOn: true,
  font: 'Roboto Condensed',
  zMid: Z_MID,
  zNear: Z_NEAR,
  maxZoom: mapConfig.view.maxZoom,
  typeFloor: 5,
  typeTop: 12,
  place: [9.5, 14],
  country: [12.5, 15],
  mr: [12, 16],
  island: [8.5, 11],
  hidden: [],
}

const RAMP_ROWS: { key: RampKey; label: string; where: string }[] = [
  { key: 'place', label: 'Places · water', where: 'volumeGrid quietBasemap' },
  { key: 'country', label: 'Country · VIET NAM', where: 'volumeGrid COUNTRY_TEXT.size' },
  { key: 'mr', label: 'Military region', where: 'mapTheme addMilitaryRegions' },
  { key: 'island', label: 'Island notes', where: 'mapTheme addIslandMarks' },
]

const clampByte = (n: number) => Math.max(0, Math.min(255, n))

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return null
  const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const rgbToHex = (c: [number, number, number]) =>
  '#' + c.map((v) => clampByte(Math.round(v)).toString(16).padStart(2, '0')).join('')

/** Rivers sit two steps down from the sea in the same hue, so a waterway reads
 *  against the land it crosses rather than against the sea it flows into. Same
 *  offset the committed pair uses (#d1dee6 → #c0d0db). */
function deriveLine(waterHex: string): string {
  const c = hexToRgb(waterHex)
  if (!c) return waterHex
  return rgbToHex([c[0] - 17, c[1] - 14, c[2] - 11])
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
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Tune>) }
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

/** Our own annotation layers, which are not part of the basemap and must not
 *  appear in its visibility list — hiding `mr-label` from here would look like
 *  a basemap decision and be impossible to find again. */
const OWN_LAYERS = new Set(['mr-label', 'island-label', VN_LABEL_LAYER])

export default function MapTuner({ map }: { map: maplibregl.Map | null }) {
  const enabled = useMemo(tunerEnabled, [])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'palette' | 'zoom' | 'type' | 'layers'>('palette')
  const [tune, setTune] = useState<Tune>(readStore)
  const [copied, setCopied] = useState(false)
  const [symbolLayers, setSymbolLayers] = useState<string[]>([])
  // Text fields hold whatever is being typed, including half-finished hexes;
  // only a valid value is pushed to the map.
  const [draft, setDraft] = useState<Record<ColorKey, string>>({
    land: tune.land,
    water: tune.water,
    veg: tune.veg,
  })
  const mapRef = useRef(map)
  mapRef.current = map

  // Which basemap symbol layers exist is ASKED, never assumed. Hardcoding a
  // list is what produced findings §7.1/§7.3 in docs/map-zoom-and-labels.md,
  // and then the same bug again in the Mapbox spike.
  useEffect(() => {
    if (!map || !enabled) return
    const read = () => {
      const ids = (map.getStyle().layers ?? [])
        .filter((l) => l.type === 'symbol' && !OWN_LAYERS.has(l.id))
        .map((l) => l.id)
        .filter((id) => {
          try {
            return map.getLayoutProperty(id, 'text-field') != null
          } catch {
            return false
          }
        })
      setSymbolLayers(ids)
    }
    if (map.isStyleLoaded()) read()
    else map.once('idle', read)
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

    const ramp = (r: Ramp) =>
      ['interpolate', ['linear'], ['zoom'], tune.typeFloor, r[0], tune.typeTop, r[1]] as never

    const rampFor = (id: string): Ramp => {
      if (/country/.test(id) || id === VN_LABEL_LAYER) return tune.country
      if (id === 'mr-label') return tune.mr
      if (id === 'island-label') return tune.island
      return tune.place
    }

    const apply = () => {
      const line = deriveLine(tune.water)
      m.setMaxZoom(tune.maxZoom)

      // The two hand-off zooms, applied everywhere they are wired.
      const setRange = (id: string, min: number, max: number) => {
        try {
          if (m.getLayer(id)) m.setLayerZoomRange(id, min, max)
        } catch {
          /* layer gone — skip */
        }
      }
      setRange(VOL_COARSE_LAYER, 0, tune.zMid)
      setRange(VOL_FINE_LAYER, tune.zMid, tune.zNear)
      setRange(VOL_RAW_LAYER, tune.zNear, 24)
      setRange('mr-label', 0, tune.zNear)
      setRange(VN_LABEL_LAYER, 0, tune.zMid)

      for (const layer of m.getStyle().layers ?? []) {
        const id = layer.id
        try {
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
            m.setLayoutProperty(id, 'text-font', [tune.font])
            m.setLayoutProperty(id, 'text-size', ramp(rampFor(id)))
            if (!OWN_LAYERS.has(id)) {
              m.setLayoutProperty(id, 'visibility', tune.hidden.includes(id) ? 'none' : 'visible')
            }
            // The country tier steps aside at the first hand-off, same as the
            // shipped rule — otherwise moving zMid would leave it behind.
            if (/country/.test(id)) setRange(id, 0, tune.zMid)
            else if (/town/.test(id)) setRange(id, tune.zMid, 22)
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

    // On the mount pass the style is usually still settling, and `tune` never
    // changes again on its own — so a plain early return would silently drop a
    // stored tune on every reload. Wait for the map instead.
    if (m.isStyleLoaded()) apply()
    else m.once('idle', apply)
    return () => {
      m.off('idle', apply)
    }
  }, [tune, map, enabled])

  const setColor = (key: ColorKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (hexToRgb(value)) setTune((t) => ({ ...t, [key]: value.startsWith('#') ? value : '#' + value }))
  }

  const setNum = (key: 'zMid' | 'zNear' | 'maxZoom' | 'typeFloor' | 'typeTop', v: number) =>
    setTune((t) => ({ ...t, [key]: v }))

  const setRampEnd = (key: RampKey, end: 0 | 1, v: number) =>
    setTune((t) => {
      const next: Ramp = [...t[key]] as Ramp
      next[end] = v
      return { ...t, [key]: next }
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
    const changed = <T,>(a: T, b: T) => JSON.stringify(a) !== JSON.stringify(b)

    const cfg: string[] = []
    if (tune.land !== DEFAULTS.land) cfg.push(`theme.land: '${tune.land}',`)
    if (tune.veg !== DEFAULTS.veg) cfg.push(`theme.greenspace: '${tune.veg}',`)
    if (tune.font !== DEFAULTS.font) cfg.push(`LABEL_FONT = '${tune.font}'`)
    if (tune.zMid !== DEFAULTS.zMid) cfg.push(`Z_MID = ${tune.zMid}`)
    if (tune.zNear !== DEFAULTS.zNear) cfg.push(`Z_NEAR = ${tune.zNear}`)
    if (tune.maxZoom !== DEFAULTS.maxZoom) cfg.push(`view.maxZoom: ${tune.maxZoom},`)
    push('src/config/mapConfig.ts', cfg)

    const vol: string[] = []
    if (tune.water !== DEFAULTS.water) {
      vol.push(`WATER_FILL = '${tune.water}'`, `WATER_LINE = '${deriveLine(tune.water)}'`)
    }
    if (changed(tune.place, DEFAULTS.place)) vol.push(`quietBasemap places → ${r(tune.place)}`)
    if (changed(tune.country, DEFAULTS.country)) vol.push(`COUNTRY_TEXT.size → ${r(tune.country)}`)
    if (tune.hidden.length) {
      vol.push(`quietBasemap — also hide: ${tune.hidden.join(', ')}`)
    }
    if (!tune.vegOn) vol.push('quietBasemap — hide vegetation entirely')
    push('src/components/volumeGrid.ts', vol)

    const theme: string[] = []
    if (tune.typeFloor !== DEFAULTS.typeFloor) theme.push(`Z_TYPE_FLOOR = ${tune.typeFloor}`)
    if (tune.typeTop !== DEFAULTS.typeTop) theme.push(`Z_TYPE_TOP = ${tune.typeTop}`)
    if (changed(tune.mr, DEFAULTS.mr)) theme.push(`mr-label text-size → ${r(tune.mr)}`)
    if (changed(tune.island, DEFAULTS.island)) theme.push(`island-label text-size → ${r(tune.island)}`)
    push('src/components/mapTheme.ts', theme)

    return out.length ? out.join('\n').trimEnd() : 'Nothing changed from the committed values.'
  }, [tune])

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
    key: 'zMid' | 'zNear' | 'maxZoom' | 'typeFloor' | 'typeTop',
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
          <p className="tuner-note">
            The zoom FLOOR is derived per viewport from recordBounds, not set here — a single number
            is wrong at both ends (5.29 on a phone, 6.65 on a 27&quot;).
          </p>
        </>
      )}

      {tab === 'type' && (
        <>
          {num('Ramp floor · Z_TYPE_FLOOR', 'typeFloor', 3, 8, 0.1)}
          {num('Ramp top · Z_TYPE_TOP', 'typeTop', 9, 16, 0.5)}
          {RAMP_ROWS.map(({ key, label, where }) => (
            <div className="tuner-ramp" key={key}>
              <span className="tuner-ramp-name">
                {label} <em>{where}</em>
              </span>
              <div className="tuner-ramp-ends">
                {([0, 1] as const).map((end) => (
                  <label key={end}>
                    <span>{end === 0 ? 'at floor' : 'at top'}</span>
                    <input
                      type="number"
                      min={4}
                      max={40}
                      step={0.5}
                      value={tune[key][end]}
                      onChange={(e) => setRampEnd(key, end, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'layers' && (
        <>
          <p className="tuner-note">
            {symbolLayers.length} basemap label layers, read from the live style. Unticking one is a
            candidate for a `visibility: none` in quietBasemap — it shows up in the copy block.
          </p>
          <div className="tuner-layers">
            {symbolLayers.map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={!tune.hidden.includes(id)}
                  onChange={() => toggleLayer(id)}
                />
                <span>{id}</span>
              </label>
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
