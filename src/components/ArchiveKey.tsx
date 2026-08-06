import { useEffect, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'
import { TRACK_LAYER } from './trackLayers'

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
          <span className="map-key-compass-dial">
            <span className="map-key-compass-needle" />
          </span>
        </div>
      </div>

      <ul className="map-key-list" aria-hidden="true">
        {/* The hybrid draws BOTH marks — dots where the data on screen is a
            cell total, tracks where it is one run — so with tracks on the key
            has to carry both and say which is which. Listing only the line
            would leave the far view's dots unexplained, which is the same
            fault as the ring had. */}
        {!onTracks && (
          <li>
            <span className="key-swatch">
              <span className="key-dot" style={{ background: tint }} />
            </span>
            Sprayed Volume{tracks ? ' · per cell' : ''}
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
            {/* Width is gallons per KM, not gallons — the only quantity
                comparable between a 2 km run and a 40 km one. The fade names
                the run's FIRST WAYPOINT ON FILE (leg 1A, the row the gallons
                are booked against), not a verified heading — HERBS records no
                bearing, so "direction of flight" would be a claim the record
                does not make. */}
            Single Run · gal/km, from its first waypoint
          </li>
        )}
        {/* The track map draws circles too, and they are not cell totals: 2,829
            of the 11,273 runs are logged against ONE grid reference, so there
            is no line to draw and the record is a point. Measured at Đồng Xoài,
            652 of them are on screen at z9.5 and 145 at z10.4 — enough that a
            reader sees dots among the strokes, which is exactly the question
            this map has been asked. Leaving them out of the key made the reader
            take them for leftovers of the tier below. */}
        {onTracks && (
          <li>
            <span className="key-swatch">
              <span className="key-dot" style={{ background: tint }} />
            </span>
            Run Logged at One Point
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
        {/* These rings are the WAYPOINTS of a spray run, not runs whose volume
            went unrecorded — see the note on DotStyle.zero in volumeGrid. HERBS
            gives each run a track (leg 1A → 1B → …) and books the whole run's
            gallons against 1A, so every other waypoint reads 0. This row said
            "No Volume Recorded" first, which described the record as having a
            gap in it; the record has no gap, we were reading a line as a heap
            of points. */}
        {/* The no-volume mark exists in both encodings, but only the dot map
            draws it below the hand-off. */}
        {(onTracks || !tracks) && (
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
      {children}
    </div>
  )
}
