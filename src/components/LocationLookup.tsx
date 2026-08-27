import { useMemo } from 'react'
import { dayToDate } from '../data/spray'
import type { LookupHit } from './lookup'

// ── location lookup: the panel section ────────────────────────────────────
// An archive query, phrased as one: pick a point, a radius and a date range,
// read the runs that passed. Two texts are load-bearing and NOT decoration —
// the fixed-wing caveat above the list and the empty-state line — because the
// record's biggest silence (helicopter, ground and perimeter spraying) is
// exactly where a reader is most likely to over-read an empty answer.

export interface LookupState {
  center: { lng: number; lat: number } | null
  radiusKm: number
  /** 'YYYY-MM', inclusive. */
  from: string
  to: string
  picking: boolean
}

interface Props {
  state: LookupState
  results: LookupHit[] | null
  groupLabels: string[]
  /** Query took this long, ms — printed small, it is part of the method. */
  queryMs: number | null
  onPickToggle: () => void
  onRadius: (km: number) => void
  onRange: (from: string, to: string) => void
  onClear: () => void
  onOpen: (hit: LookupHit) => void
}

const RADII = [1, 2, 5, 10]
const MIN_MONTH = '1961-01'
const MAX_MONTH = '1971-12'

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
  onRange,
  onClear,
  onOpen,
}: Props) {
  const { center, radiusKm, from, to, picking } = state

  const shown = useMemo(() => results?.slice(0, 200) ?? null, [results])
  const truncated = results != null && results.length > 200

  return (
    <div className="lookup">
      <p className="explorer-section-label">Location Lookup</p>

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

      <div className="lookup-row">
        <span className="lookup-row-label">Between</span>
        <div className="lookup-dates">
          <input
            type="month"
            value={from}
            min={MIN_MONTH}
            max={to}
            aria-label="From month"
            onChange={(e) => onRange(e.target.value || MIN_MONTH, to)}
          />
          <span className="lookup-dates-sep">–</span>
          <input
            type="month"
            value={to}
            min={from}
            max={MAX_MONTH}
            aria-label="To month"
            onChange={(e) => onRange(from, e.target.value || MAX_MONTH)}
          />
        </div>
      </div>

      {center && results != null && (
        <>
          <p className="lookup-caveat">
            Fixed-wing (Ranch Hand) records only — no helicopter, ground or base-perimeter
            spraying.
          </p>
          <p className="lookup-summary">
            <strong>{results.length}</strong>
            {results.length === 1 ? ' run' : ' runs'} within {radiusKm} km of {fmtCenter(center)}
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
