import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'

interface Props {
  map: maplibregl.Map | null
  ready: boolean
  started: boolean
  is3D: boolean
  onToggle3D: () => void
}

// Round down to a 1/2/3/5 × 10ⁿ value for a clean scale-bar label.
function niceRound(x: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(x)))
  const f = x / pow
  const n = f >= 5 ? 5 : f >= 3 ? 3 : f >= 2 ? 2 : 1
  return n * pow
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${m / 1000} km` : `${Math.round(m)} m`
}

function computeScale(map: maplibregl.Map): { label: string; w: number } {
  const el = map.getContainer()
  const y = el.clientHeight / 2
  const target = 92 // px we'd like the bar to be near
  const meters = map.unproject([12, y]).distanceTo(map.unproject([12 + target, y]))
  if (!isFinite(meters) || meters <= 0) return { label: '', w: 0 }
  const nice = niceRound(meters)
  return { label: fmtDist(nice), w: Math.round((nice / meters) * target) }
}

// One top-right panel: the Flat/3D view switch, scale bar and curated legend
// together (they were two stacked panels before).
export default function MapKey({ map, ready, started, is3D, onToggle3D }: Props) {
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
    <div className={`map-key${started ? ' is-visible' : ''}`}>
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

      <div className="map-key-heat" aria-hidden="true">
        <span className="map-key-heat-bar" />
        <div className="map-key-heat-labels">
          <span>Less</span>
          <span>More sprayed</span>
        </div>
      </div>

      <ul className="map-key-list" aria-hidden="true">
        <li>
          <span className="key-swatch key-mr" />
          Military region
        </li>
        <li>
          <span className="key-swatch key-border" />
          National border
        </li>
        <li>
          <span className="key-swatch key-pilot" />
          Marked site
        </li>
        <li>
          <span className="key-swatch key-area" />
          Highlighted area
        </li>
      </ul>
    </div>
  )
}
