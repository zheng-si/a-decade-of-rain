import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'
// The key's shared furniture. Both surfaces render these classes, so the
// stylesheet travels with the components rather than with either route.
import { computeScale } from './mapScale'
import { InfoMark, InfoPop } from './InfoMark'
import './MapKey.css'

// ── the key's note: the encoding, nothing else ────────────────────────────
// The same rule as the Atlas's key: one (i) on the Map Key label, and it says
// how the marks are drawn. The field is the gallons logged along every run
// that crossed each cell (the runs as lines, docs/methods.md §3), month by
// month up to the node's date, blurred by the heatmap; the handover node
// draws the runs themselves at one width.
const KEY_NOTE = {
  heat: 'Colour is the gallons logged along every run that crossed each 3 km cell, month by month up to the date shown, blurred into one field. Darker is more; all agents share one hue.',
  tracks: 'Each line is one recorded run, drawn at one width. Darker is where runs overlap.',
}

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
        {/* aria-pressed, matching the Archive's identical pair (ArchiveKey):
            the selection lived only in a CSS class, so a screen reader heard
            two unlabelled buttons and no way to tell which view the map was
            in — the exact fault the Archive's copy fixed and this one kept. */}
        <button
          type="button"
          className={`map-key-view-btn${is3D ? '' : ' is-active'}`}
          aria-pressed={!is3D}
          onClick={() => is3D && onToggle3D()}
        >
          Flat
        </button>
        <button
          type="button"
          className={`map-key-view-btn${is3D ? ' is-active' : ''}`}
          aria-pressed={is3D}
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
          <span className="map-key-compass-dial">
            <span className="map-key-compass-needle" />
          </span>
        </div>
      </div>

      {/* The legend's own label, with the note behind its (i). The host is the
          label alone, so the note opens under it over the swatches, the way
          the Atlas's model note opens over its switch. */}
      <div className="map-key-pop-host">
        <p className="map-key-view-label has-info">
          Map Key
          <InfoMark id="story-key-note-pop" label="How the marks are drawn" />
        </p>
        <InfoPop id="story-key-note-pop" text={tracks ? KEY_NOTE.tracks : KEY_NOTE.heat} below />
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

      {/* The list itself is exposed now — it is the only place the marks are
          named, and hiding it left zero AX nodes carrying the legend. Only
          the swatches stay decorative. */}
      <ul className="map-key-list">
        <li>
          <span className="key-swatch key-mr" aria-hidden="true" />
          Military region
        </li>
        <li>
          <span className="key-swatch key-border" aria-hidden="true" />
          National border
        </li>
        <li>
          <span className="key-swatch key-pilot" aria-hidden="true" />
          Marked site
        </li>
        <li>
          <span className="key-swatch key-area" aria-hidden="true" />
          Highlighted area
        </li>
      </ul>
    </div>
  )
}
