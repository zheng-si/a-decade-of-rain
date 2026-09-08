import { useEffect, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'
import { TRACK_LAYER, TRACKS } from './trackLayers'
import { hitRamp } from '../data/proximity'
import { InfoMark, InfoPop } from './InfoMark'
// The key's shared furniture. Both surfaces render these classes, so the
// stylesheet travels with the components rather than with either route.
import './MapKey.css'

// ── the Explorer's map key ────────────────────────────────────────────────
// The block under the panel's title that says what the map is showing and
// how to read it: which model is drawn (the record's own marks, or the
// Stellmans' hit grid), Flat or 3D, the agent filter, and the legend for
// whichever model is up.
//
// WHAT IS SAID WHERE. One line under the model switch says what the model is,
// always visible, the way the agent note sits under the chips. The (i) marks
// carry the rest, each one owning one question: the model's source and its
// limits on the switch, the bands on the distance row, the encoding on the
// key's first row. Nothing is said twice.
//
// It went out to a bar along the bottom of the map for a while, to stop the
// panel's height stepping as the zoom changed the row count. The bar cost
// readability and the hit grid's key did not fit it; it is back in the
// column, and the row count is fixed instead (see recordRows).

interface Props {
  map: maplibregl.Map | null
  ready: boolean
  is3D: boolean
  onToggle3D: () => void
  /** Colour of the current selection (an agent colour, or the brand red). */
  tint: string
  /** Whether an agent is isolated. */
  filtered: boolean
  /** The agent groups' colours. With nothing isolated the map draws every run
   *  and every dot in its own agent's colour, so the key has to show four. */
  hues?: string[]
  /** The map is drawing tracks at its near zoom, so the key must describe
   *  lines there. */
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
   *  under the two switches because they apply to both models. */
  agents?: ReactNode
}

/** The five classes of the count ramp, matching hitRamp / HIT_CLASS_LABELS. */
const HIT_LABELS = ['1–2 hits', '3–5 hits', '6–10 hits', '11–20 hits', '21+ hits']

// ── the notes ─────────────────────────────────────────────────────────────
const MODEL_LINE = {
  record: 'The record itself: every spray run in HERBS, drawn where it was flown and weighted by the gallons logged per kilometre.',
  grid: "Stellman and Stellman's model: how often a recorded path came within a set distance of each 1 km cell, whole record.",
}
const MODEL_NOTE = {
  record:
    'The revised HERBS file behind Stellman et al. (2003): 9,141 missions, 11,273 runs. Waypoints are joined by straight lines; coordinates are accurate to roughly 500 m. Flight paths, not where herbicide landed.',
  grid: "Their 2004 model on their 0.01° grid, from the same file. A hit is a spray-path leg passing within the chosen distance of a cell. Proximity, not deposition or exposure. The timeline does not apply.",
}
const BAND_NOTE =
  "The 2004 paper's four bands. They nest: a hit within 0.5 km is also one within 5 km. Paths of one mission count separately."

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
  /** Whether the TRACK layer is drawing right now. Asked of the MAP rather
   *  than computed from Z_NEAR: a layer's own minzoom cannot drift from the
   *  layer. */
  const [onTracks, setOnTracks] = useState(false)
  /** The colour is carrying the agent only while nothing is isolated. */
  const byAgent = !filtered && (hues?.length ?? 0) > 0

  useEffect(() => {
    if (!ready || !map) return
    const update = () => {
      const layer = map.getLayer(TRACK_LAYER)
      setOnTracks(tracks && layer != null && map.getZoom() >= (layer.minzoom ?? 0))
    }
    update()
    map.on('move', update)
    // And when the LAYERS arrive, not just when the camera does: a deep link
    // never moves the map. `styledata` fires when a layer is added.
    map.on('styledata', update)
    window.addEventListener('resize', update)
    return () => {
      map.off('move', update)
      map.off('styledata', update)
      window.removeEventListener('resize', update)
    }
  }, [ready, map, tracks])

  const onProximity = proximity && proximityReady
  const mode = proximity ? 'grid' : 'record'

  // ── the controls ─────────────────────────────────────────────────────────
  // Two labelled switches on one row, then one line saying what the model
  // is. The model comes first because it decides what the rest of the key
  // describes; the view only decides how the ground is tilted.
  const controls = (
    <>
      <div className="map-key-controls">
        {onToggleProximity && (
          <div className="map-key-control is-grow map-key-pop-host">
            <p className="map-key-view-label has-info">
              Visualisation Model
              <InfoMark id="map-key-model-pop" label="About this model" />
            </p>
            <InfoPop id="map-key-model-pop" text={MODEL_NOTE[mode]} below />
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
      {onToggleProximity && <p className="map-key-line">{MODEL_LINE[mode]}</p>}
    </>
  )

  // The band row, because the band is part of what the colour means: "hits
  // within 1 km" is a different map from "hits within 5 km".
  const gridControls = proximity ? (
    <div className="map-key-control map-key-pop-host">
      <p className="map-key-view-label has-info">
        Hit distance
        <InfoMark id="map-key-band-pop" label="About the distance bands" />
      </p>
      <InfoPop id="map-key-band-pop" text={BAND_NOTE} below />
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
  ) : null

  // ── the key's own note: the encoding, nothing else ───────────────────────
  const keyNote = onProximity
    ? 'Colour is the number of hits within the chosen distance, in five classes.' +
      (filtered ? ' An isolated agent counts only its own paths.' : '')
    : (onTracks
        ? 'Width is gallons per kilometre. Each run fades from A, where spraying began. A run logged at one point is drawn as a point.'
        : 'Dot area is the gallons recorded along every run that crossed the cell.') +
      (byAgent
        ? onTracks
          ? ' Colour is the agent.'
          : ' Colour is the agent that sprayed the most in the cell.'
        : filtered
          ? ' Other agents stay on the map in grey.'
          : '')
  const keyInfo = <InfoMark id="map-key-note-pop" label="How the marks are drawn" />

  // ── the rows ─────────────────────────────────────────────────────────────
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
  const border = (
    <li key="border">
      <span className="key-swatch key-border" aria-hidden="true" />
      National Border
    </li>
  )

  /* TWO ROWS, ALWAYS. The key's row count used to follow the zoom (two over
     the dots, three over the strokes) and the filter (one more with an agent
     isolated), and every change stepped the transport and the chart below
     it. Now one row names the marks — the dots' one mark, or the strokes'
     two in one swatch — and one names the border. No Other Agents row: with
     an agent isolated the chips already say which one, and the note says the
     rest stay grey. Nothing is padded and nothing moves. */
  const markRows: ReactNode[] = []
  if (!onTracks)
    markRows.push(
      <li key="vol">
        <span className="key-swatch" aria-hidden="true">
          {byAgent ? hueDots : <span className="key-dot" style={{ background: tint }} />}
        </span>
        Sprayed Volume
        {keyInfo}
      </li>,
    )
  // One row for the stroke tier's two marks: a run with length is a line and
  // a run logged at one grid reference is a point, and the swatch shows
  // both — 2,829 of the 11,273 runs are points, and left out of the key a
  // reader took them for leftovers of the tier below.
  if (onTracks)
    markRows.push(
      <li key="run">
        <span className="key-swatch" aria-hidden="true">
          <span className="key-run">
            {runLine}
            <span className="key-dot is-small" style={{ background: byAgent ? hues![0] : tint }} />
          </span>
        </span>
        Spray Run
        {keyInfo}
      </li>,
    )
  // The no-volume mark, only while the layer that draws it is on.
  if ((onTracks && TRACKS.nil.shown) || !tracks)
    markRows.push(
      <li key="nil">
        <span className="key-swatch" aria-hidden="true">
          {onTracks ? (
            <span className="key-line-dash" style={{ borderColor: tint }} />
          ) : (
            <span className="key-ring" style={{ borderColor: tint }} />
          )}
        </span>
        {onTracks ? 'Flown, No Volume' : 'Flight Path Point'}
      </li>,
    )
  markRows.push(border)
  const recordRows = <>{markRows}</>

  const ramp = hitRamp(tint)
  const gridRows = (
    <>
      {HIT_LABELS.map((label, i) => (
        <li key={label}>
          <span className="key-swatch" aria-hidden="true">
            <span className="key-cell" style={{ background: ramp[i] }} />
          </span>
          {label}
          {i === 0 ? keyInfo : null}
        </li>
      ))}
      {border}
    </>
  )

  /* Exposed: this list and the notes are the only place the map's marks are
     NAMED, and aria-hidden left the AX tree with zero nodes carrying the
     legend. The swatches alone stay decorative. */
  return (
    <div className={`archive-key-legend${onProximity ? ' is-grid' : ''}`}>
      {controls}
      {agents}
      {gridControls}
      <p className="map-key-view-label">Map Key</p>
      <div className="map-key-rows map-key-pop-host">
        <ul className="map-key-list">{onProximity ? gridRows : recordRows}</ul>
        <InfoPop id="map-key-note-pop" text={keyNote} />
      </div>
    </div>
  )
}
