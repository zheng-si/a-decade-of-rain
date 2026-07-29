import { useEffect, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'

// ── the Explorer's map key ────────────────────────────────────────────────
// Top-right panel in the story MapKey's language (near-opaque paper, small
// tracked furniture): Flat/3D switch, share, scale bar and the legend for the
// volume-symbol encoding — dot area ∝ gallons, tint = the current selection,
// grey = the rest of the record kept as context.

interface Props {
  map: maplibregl.Map | null
  ready: boolean
  is3D: boolean
  onToggle3D: () => void
  onShare: () => void
  shared: boolean
  /** Colour of the current selection (an agent colour, or the brand red). */
  tint: string
  /** Whether an agent is isolated (shows the grey-context legend row). */
  filtered: boolean
  /** Extra section rendered below the legend (the inspect card). */
  children?: ReactNode
}

// Round down to a 1/2/3/5 × 10ⁿ value for a clean scale-bar label.
function niceRound(x: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(x)))
  const f = x / pow
  const n = f >= 5 ? 5 : f >= 3 ? 3 : f >= 2 ? 2 : 1
  return n * pow
}

const fmtDist = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${Math.round(m)} m`)

function computeScale(map: maplibregl.Map): { label: string; w: number } {
  const el = map.getContainer()
  const y = el.clientHeight / 2
  const target = 92 // px we'd like the bar to be near
  const meters = map.unproject([12, y]).distanceTo(map.unproject([12 + target, y]))
  if (!isFinite(meters) || meters <= 0) return { label: '', w: 0 }
  const nice = niceRound(meters)
  return { label: fmtDist(nice), w: Math.round((nice / meters) * target) }
}

export default function ArchiveKey({
  map,
  ready,
  is3D,
  onToggle3D,
  onShare,
  shared,
  tint,
  filtered,
  children,
}: Props) {
  const [scale, setScale] = useState<{ label: string; w: number }>({ label: '', w: 0 })

  useEffect(() => {
    if (!ready || !map) return
    const update = () => setScale(computeScale(map))
    update()
    map.on('move', update)
    window.addEventListener('resize', update)
    return () => {
      map.off('move', update)
      window.removeEventListener('resize', update)
    }
  }, [ready, map])

  return (
    <div className="archive-key">
      <p className="map-key-view-label">Map View</p>
      <div className="map-key-view" role="group" aria-label="Map view">
        <button
          type="button"
          className={`map-key-view-btn${is3D ? '' : ' is-active'}`}
          onClick={() => is3D && onToggle3D()}
        >
          Flat
        </button>
        <button
          type="button"
          className={`map-key-view-btn${is3D ? ' is-active' : ''}`}
          onClick={() => !is3D && onToggle3D()}
        >
          3D
        </button>
      </div>
      <button type="button" className="archive-key-share" onClick={onShare} aria-live="polite">
        {shared ? '✓ Link Copied' : 'Share This View'}
      </button>

      <div className="map-key-top" aria-hidden="true">
        <div className="map-key-scale">
          <div className="map-key-scale-bar" style={{ width: `${scale.w}px` }} />
          <span className="map-key-scale-label">{scale.label}</span>
        </div>
        <div className="map-key-compass" title="North">
          <span className="map-key-compass-n">N</span>
          <span className="map-key-compass-dial">
            <span className="map-key-compass-needle" />
          </span>
        </div>
      </div>

      <ul className="map-key-list" aria-hidden="true">
        <li>
          <span className="key-swatch">
            <span className="key-dot" style={{ background: tint }} />
          </span>
          Sprayed Volume
        </li>
        {filtered && (
          <li>
            <span className="key-swatch">
              <span className="key-dot key-dot-dim" />
            </span>
            Other Agents
          </li>
        )}
        <li>
          <span className="key-swatch key-mr" />
          Military Region
        </li>
        <li>
          <span className="key-swatch key-border" />
          National Border
        </li>
      </ul>
      {children}
    </div>
  )
}
