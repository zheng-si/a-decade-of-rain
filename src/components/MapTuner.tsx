// ─────────────────────────────────────────────────────────────────────────
//  TEMPORARY — basemap colour tuner.
//
//  A live control for the three basemap tones (land, water, vegetation) so the
//  palette can be judged on the real map instead of guessed at in a hex
//  editor. It writes straight to the running MapLibre style; nothing here
//  feeds back into source, so whatever you settle on has to be copied into
//  `mapConfig.theme` (land, greenspace) and `volumeGrid.ts` (WATER_FILL /
//  WATER_LINE) by hand.
//
//  TO REMOVE: delete this file and MapTuner.css, then drop the import and the
//  <MapTuner> element from MapView.tsx. Nothing else references it.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { mapConfig } from '../config/mapConfig'
import { WATER_FILL, VEGETATION_RE, WATER_FILL_RE, WATER_LINE_RE } from './volumeGrid'
import './MapTuner.css'

const STORE_KEY = 'adr-map-tuner'

interface Tune {
  land: string
  water: string
  veg: string
  vegOn: boolean
  font: string
}

/** Label faces with self-hosted SDF glyphs under public/fonts/. A name not in
 *  this list has no glyphs to fetch and every label on the map disappears, so
 *  this is a closed list, not free text. Every one covers Vietnamese natively
 *  (checked against ầ ư Đ ễ ợ ắ ộ) — a face that didn't would render place
 *  names half in itself and half in the Noto fallback. */
const FONTS = [
  'Cuprum',
  'Public Sans Medium',
  'Fira Sans',
  'Roboto Condensed',
  'Geist',
  'IBM Plex Sans',
]

type ColorKey = 'land' | 'water' | 'veg'

const DEFAULTS: Tune = {
  land: mapConfig.theme.land,
  water: WATER_FILL,
  veg: mapConfig.theme.greenspace,
  // The explorer draws vegetation; the checkbox is here so it can be taken
  // away again to see what the map looks like without it.
  vegOn: true,
  font: 'Cuprum',
}

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

export default function MapTuner({ map }: { map: maplibregl.Map | null }) {
  const [open, setOpen] = useState(false)
  const [tune, setTune] = useState<Tune>(readStore)
  const [copied, setCopied] = useState(false)
  // Text fields hold whatever is being typed, including half-finished hexes;
  // only a valid value is pushed to the map. Colour keys only — the checkbox
  // and the font picker have no intermediate state to hold.
  const [draft, setDraft] = useState<Record<ColorKey, string>>({
    land: tune.land,
    water: tune.water,
    veg: tune.veg,
  })
  const mapRef = useRef(map)
  mapRef.current = map

  // Apply on every change, and once on mount so a stored tune survives reload.
  useEffect(() => {
    const m = map
    if (!m) return
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(tune))
    } catch {
      /* private mode — the tune just won't persist */
    }

    const apply = () => {
      const line = deriveLine(tune.water)
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
  }, [tune, map])

  const set = (key: ColorKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (hexToRgb(value)) setTune((t) => ({ ...t, [key]: value.startsWith('#') ? value : '#' + value }))
  }

  const reset = () => {
    setTune(DEFAULTS)
    setDraft({ land: DEFAULTS.land, water: DEFAULTS.water, veg: DEFAULTS.veg })
  }

  const summary =
    `land ${tune.land}\n` +
    `water ${tune.water}  (river line ${deriveLine(tune.water)})\n` +
    `vegetation ${tune.veg}${tune.vegOn ? '' : '  (hidden)'}\n` +
    `label font ${tune.font}`

  const copy = () => {
    navigator.clipboard?.writeText(summary).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      },
      () => setCopied(false),
    )
  }

  if (!open) {
    return (
      <button className="tuner-tab" onClick={() => setOpen(true)}>
        Tune basemap
      </button>
    )
  }

  const rows: { key: ColorKey; label: string }[] = [
    { key: 'land', label: 'Land' },
    { key: 'water', label: 'Water' },
    { key: 'veg', label: 'Vegetation' },
  ]

  return (
    <div className="tuner">
      <div className="tuner-head">
        <span className="tuner-title">Basemap tuner</span>
        <button className="tuner-x" onClick={() => setOpen(false)} aria-label="Collapse">
          ×
        </button>
      </div>

      {rows.map(({ key, label }) => (
        <label className="tuner-row" key={key}>
          <span className="tuner-label">{label}</span>
          <input
            className="tuner-swatch"
            type="color"
            value={tune[key]}
            onChange={(e) => set(key, e.target.value)}
          />
          <input
            className="tuner-hex"
            type="text"
            spellCheck={false}
            value={draft[key]}
            onChange={(e) => set(key, e.target.value)}
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
            {contrast(tune.water, tune.land).toFixed(2)}:1 · {coolness(tune.water, tune.land) > 0 ? '+' : ''}
            {coolness(tune.water, tune.land)} cooler
          </dd>
        </div>
        <div>
          <dt>Land vs Orange</dt>
          <dd>{contrast(tune.land, mapConfig.agents[0].color).toFixed(2)}:1</dd>
        </div>
      </dl>

      <div className="tuner-foot">
        <button onClick={copy}>{copied ? 'Copied' : 'Copy values'}</button>
        <button onClick={reset}>Reset</button>
      </div>
      <p className="tuner-note">
        Temporary. Values live in your browser only — tell me the numbers and I'll commit them.
      </p>
    </div>
  )
}
