import { useEffect, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'
import { TRACK_LAYER, TRACKS } from './trackLayers'
// The key's shared furniture. Both surfaces render these classes, so the
// stylesheet travels with the components rather than with either route.
import { computeScale } from './mapScale'
import './MapKey.css'

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
  /** Colour of the current selection (an agent colour, or the brand red). */
  tint: string
  /** Whether an agent is isolated (shows the grey-context legend row). */
  filtered: boolean
  /** SPIKE A — the map is drawing tracks, not dots, so the key must describe
   *  lines. A key that shows a dot over a map of lines is not a smaller
   *  problem than a key with the wrong words on it. */
  tracks?: boolean
  /** Extra section rendered below the legend (the inspect card). */
  children?: ReactNode
}

export default function ArchiveKey({
  map,
  ready,
  is3D,
  onToggle3D,
  tint,
  filtered,
  tracks = false,
  children,
}: Props) {
  const [scale, setScale] = useState<{ label: string; w: number }>({ label: '', w: 0 })
  /** Whether the TRACK layer is drawing right now.
   *
   *  Which MARKS exist depends on the zoom: at the shipped hand-off the fine
   *  grid draws 948 dots at z9.4 and none at z9.6, where 2,054 strokes take
   *  over. The two never share the screen, and the key named both at every zoom
   *  until this existed — so a reader looking at a map of lines was told there
   *  were cells on it too, and looking for the cells found the endpoint beads
   *  and took those for cells.
   *
   *  Asked of the MAP rather than computed from Z_NEAR. Comparing against the
   *  imported constant made the key a third owner of the hand-off, alongside
   *  volumeGrid and trackLayers. That held only while the number was fixed:
   *  once the console could move it, dragging Z_NEAR down put the whole country
   *  in strokes while the key went on saying "Sprayed Volume · per cell",
   *  because the constant had not moved. A layer's own minzoom cannot drift
   *  from the layer — whatever moved it moved this.
   */
  const [onTracks, setOnTracks] = useState(false)

  useEffect(() => {
    if (!ready || !map) return
    const update = () => {
      setScale(computeScale(map))
      const layer = map.getLayer(TRACK_LAYER)
      setOnTracks(tracks && layer != null && map.getZoom() >= (layer.minzoom ?? 0))
    }
    update()
    map.on('move', update)
    window.addEventListener('resize', update)
    return () => {
      map.off('move', update)
      window.removeEventListener('resize', update)
    }
  }, [ready, map, tracks])

  return (
    <div className="archive-key">
      <p className="map-key-view-label">Map View</p>
      <div className="map-key-view" role="group" aria-label="Map view">
        {/* aria-pressed, not the class alone: `is-active` is a paint
            instruction and carries nothing to a screen reader, which was
            hearing two unlabelled buttons and no way to tell which view the
            map was in. The house pattern already — EcosystemsFigure,
            ActionsMap, ConsequencesInterlude and AlternativesSection all set
            it; this control and the agent chips were the two that did not. */}
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

      {/* SHORT ROWS, ONE FOOTNOTE.
          Every row used to carry its own justification — "Single Run · gal/km,
          from its first waypoint" is three facts in a label — and a key read
          top-to-bottom like prose stops being scannable, which is the one job
          it has. The rows now NAME the marks and the note below explains the
          encoding once. Nothing was dropped: every claim that was in a label is
          still on screen, just not in the reader's way. */}
      <ul className="map-key-list" aria-hidden="true">
        {!onTracks && (
          <li>
            <span className="key-swatch">
              <span className="key-dot" style={{ background: tint }} />
            </span>
            Sprayed Volume
          </li>
        )}
        {onTracks && (
          <li>
            <span className="key-swatch">
              {/* The swatch fades because the map's strokes do (TRACKS.taper).
                  A flat swatch over tapered strokes would be the same fault as
                  the ring and the military regions: a key describing a mark
                  that is not on the map. */}
              <span
                className="key-line"
                style={{ background: `linear-gradient(90deg, ${tint}, ${tint}00)` }}
              />
            </span>
            Spray Run
          </li>
        )}
        {/* 2,829 of the 11,273 runs are logged against ONE grid reference, so
            there is no line to draw and the record is a point. Left out of the
            key, a reader took them for leftovers of the tier below. */}
        {onTracks && (
          <li>
            <span className="key-swatch">
              <span className="key-dot" style={{ background: tint }} />
            </span>
            Logged at One Point
          </li>
        )}
        {filtered && (
          <li>
            <span className="key-swatch">
              <span className="key-dot key-dot-dim" />
            </span>
            Other Agents
          </li>
        )}
        {/* The no-volume mark: a dashed track above the hand-off, a hollow ring
            below it. Above, it is drawn only while TRACKS.nil.shown — turning
            that off in the console and leaving the row here would put the key
            back to naming a mark the map is not drawing, which is the fault
            this file has now corrected four separate times. */}
        {((onTracks && TRACKS.nil.shown) || !tracks) && (
          <li>
            <span className="key-swatch">
              {onTracks ? (
                <span className="key-line-dash" style={{ borderColor: tint }} />
              ) : (
                <span className="key-ring" style={{ borderColor: tint }} />
              )}
            </span>
            {onTracks ? 'Flown, No Volume' : 'Flight Path Point'}
          </li>
        )}
        {/* No military-region row: the Archive no longer draws them (see
            SHOW_MILITARY_REGIONS in MapView). A legend that names something
            the map cannot show is worse than a shorter legend. */}
        <li>
          <span className="key-swatch key-border" />
          National Border
        </li>
      </ul>
      {/* The encoding, once. Width is gallons per KM, not gallons — the only
          quantity comparable between a 2 km run and a 40 km one. The fade names
          each run's FIRST WAYPOINT ON FILE (leg 1A, the row the gallons are
          booked against), not a verified heading: HERBS records no bearing, so
          "direction of flight" would be a claim the record does not make. */}
      <p className="map-key-note" aria-hidden="true">
        {onTracks
          ? 'Stroke width is gallons per kilometre. Each run fades away from its first waypoint on file.'
          : 'Dot area is the gallons that fell in the cell, counted along every run that crossed it.'}
      </p>
      {children}
    </div>
  )
}
