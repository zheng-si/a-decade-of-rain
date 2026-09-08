import { useEffect, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'
import { TRACK_LAYER, TRACKS } from './trackLayers'
import { hitRamp } from '../data/proximity'
// The key's shared furniture. Both surfaces render these classes, so the
// stylesheet travels with the components rather than with either route.
import './MapKey.css'

// ── the Explorer's map key ────────────────────────────────────────────────
// The block under the panel's title that says what the map is showing and
// how to read it: which model is drawn (the record's own marks, or the
// Stellmans' hit grid), Flat or 3D, and the legend for whichever is up.
//
// It went out to a bar along the bottom of the map for a while, to stop the
// panel's height stepping as the zoom changed the row count. The bar cost
// readability — a legend read sideways, one row at a time, with its note
// behind a hover — and the hit grid's key did not fit it at all. It is back
// in the column, at the top, where a reader looks first; the rows below it
// may step, and that is the smaller cost.
//
// The scale bar and compass stay with the MAP itself (maplibre's own control,
// bottom-right): a scale belongs against the thing it measures.

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
  /** The map is drawing tracks at its near zoom, so the key must describe
   *  lines there. A key that shows a dot over a map of lines is not a smaller
   *  problem than a key with the wrong words on it. */
  tracks?: boolean
  /** The hit grid — Stellman & Stellman's table drawn in place of the dots.
   *  `proximityReady` is whether it has landed: the switch is live before
   *  that, and the key must not describe a grid that is not up yet. */
  proximity?: boolean
  proximityReady?: boolean
  onToggleProximity?: () => void
  band?: number
  bands?: number[]
  onSetBand?: (km: number) => void
  /** The agent chips, composed by the panel that owns their state. They sit
   *  under the two switches because they apply to both models: a filter on
   *  the record and a filter on the grid are the same choice. */
  agents?: ReactNode
}

/** The five classes of the count ramp, matching hitRamp / HIT_CLASS_LABELS. */
const HIT_LABELS = ['1–2 hits', '3–5 hits', '6–10 hits', '11–20 hits', '21+ hits']

/* Material Symbols "info", 300 weight, optical size 24 — the outlined ring
   rather than a filled disc. Material's own viewBox: the origin sits on the
   baseline, so the artwork runs from y −960 to 0. */
const INFO_PATH =
  'M450-290h60v-230h-60v230Zm52.92-307.75q9.39-9.29 9.39-23.02t-9.29-23.02q-9.29-9.28-23.02-9.28t-23.02 9.28q-9.29 9.29-9.29 23.02t9.39 23.02q9.38 9.29 22.92 9.29 13.54 0 22.92-9.29ZM480.07-100q-78.84 0-148.21-29.92t-120.68-81.21q-51.31-51.29-81.25-120.63Q100-401.1 100-479.93q0-78.84 29.92-148.21t81.21-120.68q51.29-51.31 120.63-81.25Q401.1-860 479.93-860q78.84 0 148.21 29.92t120.68 81.21q51.31 51.29 81.25 120.63Q860-558.9 860-480.07q0 78.84-29.92 148.21t-81.21 120.68q-51.29 51.31-120.63 81.25Q558.9-100 480.07-100Zm-.07-60q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z'

export default function ArchiveKey({
  map,
  ready,
  is3D,
  onToggle3D,
  tint,
  filtered,
  hues,
  tracks = false,
  proximity = false,
  proximityReady = false,
  onToggleProximity,
  band = 1,
  bands = [0.5, 1, 2, 5],
  onSetBand,
  agents,
}: Props) {
  /** Whether the TRACK layer is drawing right now.
   *
   *  Which MARKS exist depends on the zoom: at the shipped hand-off the fine
   *  grid draws dots below it and strokes above it. The two never share the
   *  screen, and the key named both at every zoom until this existed — so a
   *  reader looking at a map of lines was told there were cells on it too.
   *
   *  Asked of the MAP rather than computed from Z_NEAR. Comparing against the
   *  imported constant made the key a third owner of the hand-off, alongside
   *  volumeGrid and trackLayers; a layer's own minzoom cannot drift from the
   *  layer. */
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
    // And when the LAYERS arrive, not just when the camera does: the track
    // layers are added after spray-tracks.json lands, and a deep link never
    // moves the map. `styledata` fires when a layer is added or its zoom range
    // is set, so it is the event that says "the thing you are describing now
    // exists".
    map.on('styledata', update)
    window.addEventListener('resize', update)
    return () => {
      map.off('move', update)
      map.off('styledata', update)
      window.removeEventListener('resize', update)
    }
  }, [ready, map, tracks])

  const onProximity = proximity && proximityReady

  // ── the controls ─────────────────────────────────────────────────────────
  // Two labelled switches on one row: which model, then Flat or 3D. The model
  // comes first because it decides what the rest of the key describes; the
  // view only decides how the ground is tilted.
  const controls = (
    <div className="map-key-controls">
      {onToggleProximity && (
        <div className="map-key-control is-grow">
          <p className="map-key-view-label">Visualisation Model</p>
          <div className="map-key-view" role="group" aria-label="Visualisation model">
            <button
              type="button"
              className={`map-key-view-btn${proximity ? '' : ' is-active'}`}
              aria-pressed={!proximity}
              onClick={() => proximity && onToggleProximity()}
            >
              Flight Track
            </button>
            <button
              type="button"
              className={`map-key-view-btn${proximity ? ' is-active' : ''}`}
              aria-pressed={proximity}
              onClick={() => !proximity && onToggleProximity()}
            >
              Hit Frequency
            </button>
          </div>
        </div>
      )}
      <div className="map-key-control is-view">
        <p className="map-key-view-label">Map View</p>
        <div className="map-key-view" role="group" aria-label="Map view">
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
      </div>
    </div>
  )

  // The grid's own controls: the band, because it is part of what the colour
  // means ("hits within 1 km" is a different map from "hits within 5 km"),
  // and the strokes as an optional reference over the model.
  const gridControls = proximity ? (
    <>
      <div className="map-key-control">
        <p className="map-key-view-label">Hit distance</p>
        <div className="map-key-view map-key-bands" role="group" aria-label="Distance band">
          {bands.map((d) => (
            <button
              key={d}
              type="button"
              className={`map-key-view-btn${d === band ? ' is-active' : ''}`}
              aria-pressed={d === band}
              onClick={() => d !== band && onSetBand?.(d)}
            >
              {d} km
            </button>
          ))}
        </div>
      </div>
      {/* The one fact the transport would otherwise carry: this model is the
          whole record, and the playhead is not part of it. */}
      <p className="map-key-line">Whole record, 1961 to 1971. The timeline does not apply to this model.</p>
    </>
  ) : null

  // ── the note ─────────────────────────────────────────────────────────────
  /* The encoding, once, behind the info mark on the first row. Width is
     gallons per KM, not gallons — the only quantity comparable between a 2 km
     run and a 40 km one. The fade names each run's FIRST WAYPOINT ON FILE
     (leg 1A, the row the gallons are booked against), not a verified
     heading: HERBS records no bearing. Over the grid the note describes the
     grid instead: whose model it is, what a hit is, and what the colour is
     not. */
  const note = onProximity
    ? `Stellman and Stellman's proximity model, 1961 to 1971, on their 0.01° grid. A hit is a recorded spray-path leg passing within ${band} km of the cell's grid point; colour is the number of hits, whole record. Proximity to a recorded path, not deposition or exposure.`
    : (onTracks
        ? 'Stroke width is gallons per kilometre. Each run fades away from its first waypoint on file.'
        : 'Dot area is the gallons that fell in the cell, counted along every run that crossed it.') +
      (byAgent
        ? onTracks
          ? ' Colour is the agent that flew it.'
          : ' Colour is the agent that sprayed the most in that cell.'
        : '')

  /* ON THE ROW IT EXPLAINS. The note opens by describing this one mark, so
     the marker for it belongs against that row rather than after the last
     one. The panel hangs off the list, which is positioned for it. */
  const infoMark = (
    <span className="map-key-info">
      <button type="button" aria-label="How the marks are drawn" aria-describedby="map-key-note-pop">
        <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
          <path d={INFO_PATH} />
        </svg>
      </button>
    </span>
  )
  const infoPanel = (
    <span id="map-key-note-pop" role="tooltip" className="map-key-info-pop">
      {note}
    </span>
  )

  // ── the rows ─────────────────────────────────────────────────────────────
  // Short rows, one footnote. The rows NAME the marks and the note explains
  // the encoding once, so the list stays scannable.
  const hueDots = (
    <span className="key-dot-row">
      {hues!.slice(0, 3).map((h) => (
        <span key={h} className="key-dot is-small" style={{ background: h }} />
      ))}
    </span>
  )
  const runLine = (
    <span
      className={byAgent ? 'key-line is-hues' : 'key-line'}
      style={{
        // One line through all four hues, not four stubs of one each: four
        // segments in a 24px bar read as a DASHED stroke, and the map draws
        // none. The taper survives as the fade at the end.
        background: byAgent
          ? `linear-gradient(90deg, ${hues!.join(', ')})`
          : `linear-gradient(90deg, ${tint}, ${tint}00)`,
      }}
    />
  )
  const otherAgents = (
    <li>
      <span className="key-swatch" aria-hidden="true">
        {/* A line above the hand-off, a dot below it — the same split the
            tiers themselves make. The grey line fades like the coloured one,
            because the dim twin carries the same taper. */}
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
  const border = (
    <li>
      <span className="key-swatch key-border" aria-hidden="true" />
      National Border
    </li>
  )

  const recordRows = (
    <>
      {!onTracks && (
        <li>
          <span className="key-swatch" aria-hidden="true">
            {byAgent ? hueDots : <span className="key-dot" style={{ background: tint }} />}
          </span>
          Sprayed Volume
          {infoMark}
        </li>
      )}
      {onTracks && (
        <li>
          <span className="key-swatch" aria-hidden="true">
            {runLine}
          </span>
          Spray Run
          {infoMark}
        </li>
      )}
      {/* 2,829 of the 11,273 runs are logged against ONE grid reference, so
          there is no line to draw and the record is a point. Left out of the
          key, a reader took them for leftovers of the tier below. */}
      {onTracks && (
        <li>
          <span className="key-swatch" aria-hidden="true">
            {byAgent ? hueDots : <span className="key-dot" style={{ background: tint }} />}
          </span>
          Logged at One Point
        </li>
      )}
      {filtered && otherAgents}
      {/* The no-volume mark, only while the layer that draws it is on. */}
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
      {border}
    </>
  )

  const ramp = hitRamp(tint)
  const gridRows = (
    <>
      {HIT_LABELS.map((label, i) => (
        <li key={label}>
          <span className="key-swatch" aria-hidden="true">
            <span className="key-cell" style={{ background: ramp[i] }} />
          </span>
          {label}
          {i === 0 ? infoMark : null}
        </li>
      ))}
      {border}
    </>
  )

  /* Exposed: this list and the note are the only place the map's marks are
     NAMED, and aria-hidden left the AX tree with zero nodes carrying the
     legend. The swatches alone stay decorative. */
  return (
    <div className={`archive-key-legend${onProximity ? ' is-grid' : ''}`}>
      {controls}
      {agents}
      {gridControls}
      <p className="map-key-view-label">Map Key</p>
      <div className="map-key-rows">
        <ul className="map-key-list">{onProximity ? gridRows : recordRows}</ul>
        {infoPanel}
      </div>
    </div>
  )
}
