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
  /** The agent groups' colours. With nothing isolated the map draws every run
   *  and every dot in its own agent's colour, so the key has to show four —
   *  a red swatch over a four-colour map is the same fault as a dot over a
   *  map of lines. */
  hues?: string[]
  /** SPIKE A — the map is drawing tracks, not dots, so the key must describe
   *  lines. A key that shows a dot over a map of lines is not a smaller
   *  problem than a key with the wrong words on it. */
  tracks?: boolean
  /** Where the key is standing.
   *
   *  'panel' is the shipped home: a stacked block in the left column. Its
   *  fault is that the key's LENGTH is a function of the zoom — four rows over
   *  the grid, five over the tracks, and a note that runs to two lines in one
   *  state and one in the other. Everything below it in that column (the
   *  chart, the agent chips, the note) steps up and down as the reader zooms,
   *  which is motion the reader did not ask for in a part of the panel they
   *  were not looking at.
   *
   *  'bar' lays the same rows out along the bottom of the map. The row count
   *  still changes; it just changes the bar's WIDTH, and a legend that grows
   *  sideways under the map does not move anything else on the screen. */
  layout?: 'panel' | 'bar'
}

export default function ArchiveKey({
  map,
  ready,
  is3D,
  onToggle3D,
  tint,
  filtered,
  hues,
  tracks = false,
  layout = 'panel',
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
  /** The colour is carrying the agent only while nothing is isolated: with a
   *  chip on, it means "the one you picked" and the chip already says so. */
  const byAgent = !filtered && (hues?.length ?? 0) > 0

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

  // One row, two homes: in place while it is saying something, at the foot
  // of the list while it is only holding its height open.
  const otherAgents = (
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
  )
  const placeholder = (
    <li className="is-placeholder" aria-hidden="true">
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
  )

  // The three pieces, built once and placed by whichever layout is asking.
  const viewSwitch = (
    <>
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
    </>
  )

  /* The encoding, once. Width is gallons per KM, not gallons — the only
     quantity comparable between a 2 km run and a 40 km one — and it is
     recorded spray density, which is Stellman's own term for gallons over
     path length. It is NOT swath width: a reader who takes a 14 px stroke for
     the width of the spray has read the one thing this key must forbid.
     The fade follows the letters: for a connected aerial path A is where
     spraying began and the later letters are turns and the stop (Stellman et
     al., 2003, EHP), so the taper is the recorded sequence, not a bearing.
     The halo is the coordinate accuracy of the record, about 500 m
     (Stellman et al., 2004), which is why it is a soft band and not a corridor
     with an edge. The last sentence only while the colour is carrying the
     agent: with a chip on, colour means "the one you picked". */
  const note =
    (onTracks
      ? 'Stroke width is recorded spray density in gallons per kilometre, not swath width. Each run fades along its recorded waypoint sequence from A. The soft band is the roughly 500 m positional accuracy of HERBS coordinates, not spray width.'
      : 'Dot area is the gallons that fell in the cell, counted along every run that crossed it.') +
    (byAgent
      ? onTracks
        ? ' Colour is the agent that flew it.'
        : ' Colour is the agent that sprayed the most in that cell.'
      : '')

  /* ON THE ROW IT EXPLAINS, not at the end of the bar.
     The note opens by describing this one mark — how wide a stroke is, how big
     a dot is — so the marker for it belongs against that row rather than after
     the last one, where it read as a footnote to the whole key and sat closest
     to "National Border", which it says nothing about. */
  /* The PANEL cannot live in the row with its button.
     The inline list is `overflow-x: auto` so the bar can never break into two
     lines, and an overflow container clips its descendants — the panel opened
     inside it and was cut to the height of a legend row. So the button stays
     on the row it explains and the panel hangs off the group, which has no
     overflow to escape; `:has()` keeps the two connected without a wrapper
     that would put the clip back. */
  const infoPanel =
    layout === 'bar' ? (
      <span id="map-key-note-pop" role="tooltip" className="map-key-info-pop">
        {note}
      </span>
    ) : null

  const infoMark = (
    <span className="map-key-info">
      <button
        type="button"
        aria-label="How the marks are drawn"
        aria-describedby="map-key-note-pop"
      >
        {/* Material Symbols "info", 300 weight, optical size 24 — the outlined
            ring rather than a filled disc, which would have been the heaviest
            mark on a bar whose own swatches are 4px dots. Material's own
            viewBox: the origin sits on the baseline, so the artwork runs from
            y −960 to 0. */}
        <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
          <path d="M450-290h60v-230h-60v230Zm52.92-307.75q9.39-9.29 9.39-23.02t-9.29-23.02q-9.29-9.28-23.02-9.28t-23.02 9.28q-9.29 9.29-9.29 23.02t9.39 23.02q9.38 9.29 22.92 9.29 13.54 0 22.92-9.29ZM480.07-100q-78.84 0-148.21-29.92t-120.68-81.21q-51.31-51.29-81.25-120.63Q100-401.1 100-479.93q0-78.84 29.92-148.21t81.21-120.68q51.29-51.31 120.63-81.25Q401.1-860 479.93-860q78.84 0 148.21 29.92t120.68 81.21q51.31 51.29 81.25 120.63Q860-558.9 860-480.07q0 78.84-29.92 148.21t-81.21 120.68q-51.29 51.31-120.63 81.25Q558.9-100 480.07-100Zm-.07-60q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
        </svg>
      </button>
    </span>
  )
  const onRow = layout === 'bar' ? infoMark : null

  /* SHORT ROWS, ONE FOOTNOTE.
          Every row used to carry its own justification — "Single Run · gal/km,
          from its first waypoint" is three facts in a label — and a key read
          top-to-bottom like prose stops being scannable, which is the one job
          it has. The rows now NAME the marks and the note below explains the
          encoding once. Nothing was dropped: every claim that was in a label is
     still on screen, just not in the reader's way. */
  /* Exposed: this list and the note under it are the only place the map's
     marks are NAMED, and aria-hidden left the AX tree with zero nodes
     carrying the legend. The swatches alone stay decorative. */
  const list = (
    <ul className={layout === 'bar' ? 'map-key-list is-inline' : 'map-key-list'}>
        {!onTracks && (
          <li>
            <span className="key-swatch" aria-hidden="true">
              {byAgent ? (
                // Three of the four, at the sizes the map actually draws: a
                // single dot in one colour would name one agent rather than
                // the encoding.
                <span className="key-dot-row">
                  {hues!.slice(0, 3).map((h) => (
                    <span key={h} className="key-dot is-small" style={{ background: h }} />
                  ))}
                </span>
              ) : (
                <span className="key-dot" style={{ background: tint }} />
              )}
            </span>
            Sprayed Volume
            {onRow}
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
                className={byAgent ? 'key-line is-hues' : 'key-line'}
                style={{
                  // One line through all four hues, not four stubs of one
                  // each: four segments in a 24px bar read as a DASHED stroke,
                  // and the map draws none. The taper survives as a mask that
                  // stops where the strokes stop — at 1 − TRACKS.taper, not at
                  // nothing, or it would fade out exactly the half of the bar
                  // Blue and Other live in.
                  background: byAgent
                    ? `linear-gradient(90deg, ${hues!.join(', ')})`
                    : `linear-gradient(90deg, ${tint}, ${tint}00)`,
                }}
              />
            </span>
            Spray Run
            {onRow}
          </li>
        )}
        {/* 2,829 of the 11,273 runs are logged against ONE grid reference, so
            there is no line to draw and the record is a point. Left out of the
            key, a reader took them for leftovers of the tier below. */}
        {onTracks && (
          <li>
            <span className="key-swatch" aria-hidden="true">
              {/* These are drawn by the mark layer, which reads the feature's
                  own colour like the strokes do — so the swatch has to carry
                  the same four. */}
              {byAgent ? (
                <span className="key-dot-row">
                  {hues!.slice(0, 3).map((h) => (
                    <span key={h} className="key-dot is-small" style={{ background: h }} />
                  ))}
                </span>
              ) : (
                <span className="key-dot" style={{ background: tint }} />
              )}
            </span>
            Logged at One Point
          </li>
        )}
        {/* The positional halo. Named in the key or it reads as a printing
            fault: a grey smear under every stroke that the legend does not
            mention. Gated on the same flag as the layer, like the nil row. */}
        {onTracks && TRACKS.halo.shown && (
          <li>
            <span className="key-swatch" aria-hidden="true">
              <span className="key-halo" />
            </span>
            Position Uncertainty
          </li>
        )}
        {filtered && otherAgents}
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
        {/* The same row, holding its height open at the FOOT of the list while
            it has nothing to say. It applies only with an agent isolated, but
            appearing on the chip press grew the panel by a row and stepped the
            chart, the chips and the note down with it — and reserving the space
            IN PLACE left a hole in the middle of the legend that read as a
            missing item. At the foot it reads as the padding it is.
            The bar has no height to hold open — a row arriving there costs
            width, which is the whole point of the bar — so it does not
            reserve one. */}
        {!filtered && layout === 'panel' && placeholder}
      </ul>
  )
  // ── the bar ────────────────────────────────────────────────────────────
  // Same rows, laid along the bottom of the map. The note cannot come with
  // them: two lines of prose would set the bar's height by its longest
  // sentence and put the height problem back, one axis over. It becomes the
  // one thing in the key a reader has to ask for.
  if (layout === 'bar') {
    /* `archive-key-legend` comes along because every swatch in this key — the
       dot, the tapered line, the dash, the ring, the border rule — is drawn by
       a rule scoped to that class. Dropping it left the rows labelled and
       blank. The bar's own rules undo the block layout it also carries. */
    return (
      <div className="archive-key-legend map-key-bar" role="group" aria-label="Map key">
        <div className="map-key-bar-group">{viewSwitch}</div>
        <div className="map-key-bar-group is-legend">
          <p className="map-key-view-label">Map Key</p>
          {list}
          {infoPanel}
        </div>
      </div>
    )
  }

  return (
    <div className="archive-key-legend">
      {viewSwitch}
      {list}
      <p className="map-key-note">{note}</p>
    </div>
  )
}
