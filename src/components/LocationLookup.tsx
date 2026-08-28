import { useMemo, useRef, useState } from 'react'
import { dayToDate } from '../data/spray'
import { loadGazetteer, searchGazetteer, type GazPlace, type LookupHit } from './lookup'

// ── location lookup: the panel section ────────────────────────────────────
// An archive query, phrased as one: search a place or pick a point, choose a
// radius and a date range, read the runs that passed. Two texts are
// load-bearing and NOT decoration — the fixed-wing caveat above the list and
// the empty-state line — because the record's biggest silence (helicopter,
// ground and perimeter spraying) is exactly where a reader is most likely to
// over-read an empty answer.

export interface LookupState {
  center: { lng: number; lat: number } | null
  radiusKm: number
  /** 'YYYY-MM', inclusive. Fixed at the full record since the panel's own
   *  timeline already owns time; kept in state so a range UI can return
   *  without a schema change. */
  from: string
  to: string
  picking: boolean
  /** Set when the center came from the place search — carries the two hints
   *  the brief requires (coarse city-level query, inferred coordinate).
   *  Cleared the moment the reader re-picks or drags: the hint describes the
   *  place, and the point is no longer the place. */
  place?: { name: string; coarse: boolean; low: boolean }
}

interface Props {
  state: LookupState
  results: LookupHit[] | null
  groupLabels: string[]
  /** Query took this long, ms — printed small, it is part of the method. */
  queryMs: number | null
  onPickToggle: () => void
  onRadius: (km: number) => void
  onClear: () => void
  onOpen: (hit: LookupHit) => void
  onPlace: (place: GazPlace) => void
}

const RADII = [1, 2, 5, 10]

const TYPE_LABEL: Record<string, string> = {
  airbase: 'Air base',
  army_base: 'Army base',
  marine_base: 'Marine base',
  firebase: 'Firebase',
  lz: 'Landing zone',
  camp: 'Camp',
  city: 'City',
  town: 'Town',
  other: 'Site',
}

const fmtDay = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

const fmtCenter = (c: { lng: number; lat: number }) =>
  `${Math.abs(c.lat).toFixed(3)}°${c.lat >= 0 ? 'N' : 'S'} ${Math.abs(c.lng).toFixed(3)}°${c.lng >= 0 ? 'E' : 'W'}`

export default function LocationLookup({
  state,
  results,
  groupLabels,
  queryMs,
  onPickToggle,
  onRadius,
  onClear,
  onOpen,
  onPlace,
}: Props) {
  const { center, radiusKm, picking, place } = state

  // ── the place search ────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const gazRef = useRef<GazPlace[] | null>(null)
  const [gazReady, setGazReady] = useState(false)

  const ensureGaz = () => {
    if (gazRef.current) return
    loadGazetteer().then((places) => {
      gazRef.current = places
      setGazReady(true)
    })
  }

  const matches = useMemo(
    () => (gazRef.current && query ? searchGazetteer(gazRef.current, query) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gazRef flips once, tracked by gazReady
    [query, gazReady],
  )

  const choose = (pl: GazPlace) => {
    setQuery(pl.n)
    setOpen(false)
    onPlace(pl)
  }

  const shown = useMemo(() => results?.slice(0, 200) ?? null, [results])
  const truncated = results != null && results.length > 200

  return (
    <div className="lookup">
      <p className="explorer-section-label">Location Lookup</p>

      <div className="lookup-search">
        <input
          type="text"
          value={query}
          // The brief's scope, stated where the reader types: places, not
          // unit numbers.
          placeholder="Bases, firebases, place names…"
          aria-label="Search bases, firebases and place names"
          onFocus={() => {
            ensureGaz()
            setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHi(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHi((h) => Math.min(h + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHi((h) => Math.max(h - 1, 0))
            } else if (e.key === 'Enter' && matches[hi]) {
              choose(matches[hi])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {open && matches.length > 0 && (
          <ul className="lookup-search-drop" role="listbox">
            {matches.map((pl, i) => (
              <li key={pl.n}>
                <button
                  className={`lookup-search-item${i === hi ? ' is-hi' : ''}`}
                  role="option"
                  aria-selected={i === hi}
                  // mousedown, not click: the input's blur closes the list
                  // before a click would land.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(pl)
                  }}
                  onMouseEnter={() => setHi(i)}
                >
                  <span className="lookup-place-name">{pl.n}</span>
                  <span className="lookup-place-meta">
                    {TYPE_LABEL[pl.t] ?? pl.t}
                    {pl.p ? ` · ${pl.p}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() !== '' && gazReady && matches.length === 0 && (
          <p className="lookup-search-none">
            No match. The index covers bases, firebases and place names — not unit numbers.
          </p>
        )}
      </div>

      <div className="lookup-controls">
        <button
          className={`lookup-pick${picking ? ' is-armed' : ''}`}
          onClick={onPickToggle}
          aria-pressed={picking}
        >
          {picking ? 'Click the map…' : center ? 'Move the point' : 'Pick a point on the map'}
        </button>
        {center && (
          <button className="lookup-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lookup-row">
        <span className="lookup-row-label">Within</span>
        <div className="lookup-radii" role="group" aria-label="Search radius">
          {RADII.map((r) => (
            <button
              key={r}
              className={`lookup-chip${r === radiusKm ? ' is-active' : ''}`}
              aria-pressed={r === radiusKm}
              onClick={() => onRadius(r)}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      {place?.coarse && (
        <p className="lookup-place-hint">
          City-level place — the radius is set to 10 km and the answer is correspondingly coarse.
        </p>
      )}
      {place?.low && (
        <p className="lookup-place-hint">
          This place&apos;s coordinate is inferred — check the pin against the map before reading
          the list.
        </p>
      )}

      {center && results != null && (
        <>
          <p className="lookup-caveat">
            Fixed-wing (Ranch Hand) records only — no helicopter, ground or base-perimeter
            spraying.
          </p>
          <p className="lookup-summary">
            <strong>{results.length}</strong>
            {results.length === 1 ? ' run' : ' runs'} within {radiusKm} km of{' '}
            {place ? place.name : fmtCenter(center)}
            {queryMs != null && <span className="lookup-ms"> · {queryMs.toFixed(0)} ms</span>}
          </p>
          {results.length === 0 ? (
            <p className="lookup-empty">
              No fixed-wing spray records in this range. That does not mean the area was not
              sprayed.
            </p>
          ) : (
            <ol className="lookup-list">
              {shown!.map((h) => (
                <li key={h.key}>
                  <button className="lookup-item" onClick={() => onOpen(h)}>
                    <span className="lookup-item-id">
                      M{h.mission}
                      {h.run !== h.mission ? `·R${h.run}` : ''}
                    </span>
                    <span className="lookup-item-date">{fmtDay(h.day)}</span>
                    <span className="lookup-item-agent">{groupLabels[h.gi] ?? '?'}</span>
                    <span className="lookup-item-dist">{h.distanceKm.toFixed(1)} km</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {truncated && (
            <p className="lookup-truncated">
              Nearest 200 shown of {results.length}. Narrow the radius or the dates for the rest.
            </p>
          )}
        </>
      )}
    </div>
  )
}
