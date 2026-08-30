import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { TRACK_LAYER, TRACKS } from './trackLayers'
// The key's shared furniture. Both surfaces render these classes, so the
// stylesheet travels with the components rather than with either route.
import './MapKey.css'

// ── the Explorer's map key ────────────────────────────────────────────────
// Flat/3D switch and the legend for the volume-symbol
// encoding — dot area ∝ gallons, tint = the current selection, grey = the rest
// of the record kept as context.
//
// The scale bar and compass left for the MAP itself (maplibre's own control,
// bottom-right): a scale belongs against the thing it measures, not in a
// panel two hundred pixels away from it.
//
// It sits in the LEFT panel, under the agent filter. The key describes how to
// read the map's marks; it changes with the zoom and with the selection, and
// with nothing the reader clicks or searches. That put it in the wrong column
// once the right-hand panel became the place column, where every block is an
// answer to something the reader just did.

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
}

export default function ArchiveKey({
  map,
  ready,
  is3D,
  onToggle3D,
  tint,
  filtered,
  tracks = false,
}: Props) {
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
      const layer = map.getLayer(TRACK_LAYER)
      setOnTracks(tracks && layer != null && map.getZoom() >= (layer.minzoom ?? 0))
    }
    update()
    map.on('move', update)
    // ── and when the LAYERS arrive, not just when the camera does ─────────
    // The track layers are added after spray-tracks.json lands, which is well
    // after this mounts: at that moment `getLayer` returns null, onTracks is
    // false, and nothing asks again until the reader moves the map. Deep links
    // never move the map — and every shared Location Lookup URL is a deep link
    // at z9-ish, i.e. straight into the state where the key says "Sprayed
    // Volume · dot area is the gallons that fell in the cell" over a map
    // drawing flight tracks. That is exactly the fault the rest of this file
    // exists to prevent, arriving through the one door nobody watched.
    // `styledata` fires when a layer is added or its zoom range is set, so it
    // is the event that says "the thing you are describing now exists".
    map.on('styledata', update)
    window.addEventListener('resize', update)
    return () => {
      map.off('move', update)
      map.off('styledata', update)
      window.removeEventListener('resize', update)
    }
  }, [ready, map, tracks])

  return (
    <div className="archive-key-legend">
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
      {/* SHORT ROWS, ONE FOOTNOTE.
          Every row used to carry its own justification — "Single Run · gal/km,
          from its first waypoint" is three facts in a label — and a key read
          top-to-bottom like prose stops being scannable, which is the one job
          it has. The rows now NAME the marks and the note below explains the
          encoding once. Nothing was dropped: every claim that was in a label is
          still on screen, just not in the reader's way. */}
      {/* Exposed: this list and the note under it are the only place the
          map's marks are NAMED, and aria-hidden left the AX tree with zero
          nodes carrying the legend. The swatches alone stay decorative. */}
      <ul className="map-key-list">
        {!onTracks && (
          <li>
            <span className="key-swatch" aria-hidden="true">
              <span className="key-dot" style={{ background: tint }} />
            </span>
            Sprayed Volume
          </li>
        )}
        {onTracks && (
          <li>
            <span className="key-swatch" aria-hidden="true">
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
            <span className="key-swatch" aria-hidden="true">
              <span className="key-dot" style={{ background: tint }} />
            </span>
            Logged at One Point
          </li>
        )}
        {filtered && (
          <li>
            <span className="key-swatch" aria-hidden="true">
              {/* A line above the hand-off, a dot below it — the same split
                  the tiers themselves make. Measured with an agent isolated
                  at track zoom: 1,834 de-emphasised runs drawn as grey LINES
                  against 167 grey points, and the key showed a dot. The grey
                  line fades like the coloured one, because the dim twin
                  carries the same taper. */}
              {onTracks ? (
                <span
                  className="key-line"
                  style={{ background: 'linear-gradient(90deg, #c9cdc4, rgba(201, 205, 196, 0))' }}
                />
              ) : (
                <span className="key-dot key-dot-dim" />
              )}
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
            <span className="key-swatch" aria-hidden="true">
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
          <span className="key-swatch key-border" aria-hidden="true" />
          National Border
        </li>
      </ul>
      {/* The encoding, once. Width is gallons per KM, not gallons — the only
          quantity comparable between a 2 km run and a 40 km one. The fade names
          each run's FIRST WAYPOINT ON FILE (leg 1A, the row the gallons are
          booked against), not a verified heading: HERBS records no bearing, so
          "direction of flight" would be a claim the record does not make. */}
      <p className="map-key-note">
        {onTracks
          ? 'Stroke width is gallons per kilometre. Each run fades away from its first waypoint on file.'
          : 'Dot area is the gallons that fell in the cell, counted along every run that crossed it.'}
      </p>
    </div>
  )
}
