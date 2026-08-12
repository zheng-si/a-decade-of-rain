import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'
// The key's shared furniture. Both surfaces render these classes, so the
// stylesheet travels with the components rather than with either route.
import { computeScale } from './mapScale'
import './MapKey.css'

interface Props {
  map: maplibregl.Map | null
  ready: boolean
  started: boolean
  is3D: boolean
  onToggle3D: () => void
  /** The handover node swaps the binned heat field for the 8,753 individual
   *  runs, so the key has to swap with it: a gradient ramp explains nothing
   *  about a map that is no longer drawing a gradient. */
  tracks?: boolean
}

// One top-right panel: the Flat/3D view switch, scale bar and curated legend
// together (they were two stacked panels before).
export default function MapKey({ map, ready, started, is3D, onToggle3D, tracks }: Props) {
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

      {tracks ? (
        // One stroke = one run, and the darkness is the overlap: the same fact
        // the ramp used to state, but stated in the mark the map is actually
        // drawing. The samples are the track colour at one and at many passes.
        <div className="map-key-heat" aria-hidden="true">
          <span className="map-key-track-bar">
            <i className="is-one" />
            <i className="is-many" />
          </span>
          <div className="map-key-heat-labels">
            <span>One run</span>
            <span>Flown repeatedly</span>
          </div>
        </div>
      ) : (
        <div className="map-key-heat" aria-hidden="true">
          <span className="map-key-heat-bar" />
          <div className="map-key-heat-labels">
            <span>Less</span>
            <span>More sprayed</span>
          </div>
        </div>
      )}

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
