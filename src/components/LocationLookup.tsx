import { useMemo, useRef, useState } from 'react'
import { dayToDate } from '../data/spray'
import { loadGazetteer, searchGazetteer, type GazPlace, type LookupHit } from './lookup'
import type { GroupInfo } from './ArchiveInspect'

// ── location lookup: the place column's query and its answer ──────────────
// An archive query, phrased as one: search a place or pick a point, choose a
// radius, read the runs that passed. Two texts are load-bearing and NOT
// decoration — the fixed-wing caveat above the list and the empty-state line —
// because the record's biggest silence (helicopter, ground and perimeter
// spraying) is exactly where a reader is most likely to over-read an empty
// answer.
//
// The answer is told in three layers: one sentence, then its SHAPE (which
// agents, which years), then the records themselves behind a fold. Sixty rows
// of "M5821·R7086 · Mar 5, 1969 · White · 0.1 km" is evidence, and evidence is
// what a reader opens on purpose — it is not the answer to "was my village
// sprayed". The mission numbers stay one click away, never further: they are
// what makes the answer checkable against HERBS.
//
// By Agent and By Year are the RECORD CARD's own blocks, class for class. A
// cell you click and a circle you draw are the same kind of object — a place,
// summarised — and the vocabulary is learned once. The unit differs and says
// so: the card counts gallons, which the source bins per cell; a circle can
// only count RUNS, because the record books each run's whole volume against
// its first waypoint and cannot say how much of it fell inside a radius.

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
  /** Label and colour per agent group — the same objects the record card
   *  takes, because the two draw the same bars. */
  groups: GroupInfo[]
  /** Query took this long, ms — printed small, it is part of the method. */
  queryMs: number | null
  /** A record card is open below. The answer folds to a way back, because the
   *  card is the reader's subject now and two summaries of the same place
   *  stacked is a worse answer than either. */
  cardOpen?: boolean
  onPickToggle: () => void
  onRadius: (km: number) => void
  onClear: () => void
  onOpen: (hit: LookupHit) => void
  onPlace: (place: GazPlace) => void
  onBack?: () => void
}

const RADII = [1, 2, 5, 10]

/** The record's own span, and the axis of the card's By Year block. */
const YEAR_FROM = 1961
const YEAR_TO = 1971

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
  groups,
  queryMs,
  cardOpen = false,
  onPickToggle,
  onRadius,
  onClear,
  onOpen,
  onPlace,
  onBack,
}: Props) {
  const { center, radiusKm, picking, place } = state

  // ── the place search ────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const gazRef = useRef<GazPlace[] | null>(null)
  const [gazReady, setGazReady] = useState(false)
  /** The records, folded by default — see the note at the top. */
  const [listOpen, setListOpen] = useState(false)

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

  /** The answer's shape: runs per agent, runs per year. Counted over ALL the
   *  hits, not the 200 the list caps at — the shape is of the answer, not of
   *  the page of it that fits. */
  const shape = useMemo(() => {
    if (!results?.length) return null
    const byAgent = groups.map(() => 0)
    const byYear = new Array(YEAR_TO - YEAR_FROM + 1).fill(0)
    for (const h of results) {
      if (h.gi >= 0 && h.gi < byAgent.length) byAgent[h.gi]++
      const y = dayToDate(h.day).getUTCFullYear()
      if (y >= YEAR_FROM && y <= YEAR_TO) byYear[y - YEAR_FROM]++
    }
    return { byAgent, byYear }
  }, [results, groups])

  return (
    <div className="lookup">
      <p className="explorer-section-label">Location Lookup</p>

      {/* ── one row, one act ──────────────────────────────────────────────
          Typing a name and pointing at the map are two ways of saying where,
          so they are one control: the field, then the pin that arms the map,
          then the clear. They were three rows of buttons that read as three
          different features. */}
      <div className="lookup-search">
        <span className="lookup-search-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="12" height="12">
            <circle cx="6.8" cy="6.8" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.3 10.3 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
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
        <span className="lookup-search-sep" aria-hidden="true" />
        <button
          className={`lookup-search-btn${picking ? ' is-armed' : ''}`}
          aria-pressed={picking}
          aria-label={picking ? 'Click the map to set the point' : 'Pick a point on the map'}
          title={picking ? 'Click the map to set the point' : 'Pick a point on the map'}
          onClick={onPickToggle}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M8 1.4c-2.4 0-4.3 1.9-4.3 4.3 0 3.2 4.3 8.9 4.3 8.9s4.3-5.7 4.3-8.9c0-2.4-1.9-4.3-4.3-4.3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <circle cx="8" cy="5.7" r="1.5" fill="currentColor" />
          </svg>
        </button>
        {(center || query) && (
          <button
            className="lookup-search-btn"
            aria-label="Clear the search"
            title="Clear"
            onClick={() => {
              setQuery('')
              onClear()
            }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
              <path
                d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
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

      {picking && <p className="lookup-place-hint">Click the map to set the point.</p>}

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
          {/* A record is open: the answer stands down to a way back, and the
              card renders right under it (ArchiveKey puts children after this
              slot). Reopening the list is one press away below. */}
          {cardOpen && results.length > 0 ? (
            <button className="lookup-back" onClick={onBack}>
              ← Back to {results.length} {results.length === 1 ? 'result' : 'results'}
            </button>
          ) : (
            <>
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
                shape && (
                  <>
                    {/* The unit is in the label because the same bars mean
                        gallons on the record card. */}
                    <p className="inspect-section-label">By Agent · runs</p>
                    <div className="inspect-groups">
                      {groups.map((g, gi) => {
                        const v = shape.byAgent[gi]
                        if (!v) return null
                        const max = Math.max(1, ...shape.byAgent)
                        return (
                          <div key={g.label} className="inspect-group-row">
                            <span className="inspect-group-label">{g.label}</span>
                            <span className="inspect-bar-track">
                              <span
                                className="inspect-bar"
                                style={{ width: `${(v / max) * 100}%`, background: g.color }}
                              />
                            </span>
                            <span className="inspect-group-value">{v}</span>
                          </div>
                        )
                      })}
                    </div>

                    <p className="inspect-section-label">By Year</p>
                    <div className="inspect-years" aria-hidden="true">
                      {shape.byYear.map((v, i) => {
                        const max = Math.max(1, ...shape.byYear)
                        return (
                          <span key={i} className="inspect-year-col">
                            <span
                              className="inspect-year-bar"
                              style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%` }}
                            />
                          </span>
                        )
                      })}
                    </div>
                    <div className="inspect-year-ticks" aria-hidden="true">
                      {shape.byYear.map((_, i) => (
                        <span key={i} className="inspect-year-tick" />
                      ))}
                    </div>
                    <div className="inspect-year-labels" aria-hidden="true">
                      <span>{YEAR_FROM}</span>
                      <span>{YEAR_TO}</span>
                    </div>
                  </>
                )
              )}

              <p className="lookup-caveat">
                Fixed-wing (Ranch Hand) records only — no helicopter, ground or base-perimeter
                spraying.
              </p>
            </>
          )}

          {/* Not while a record is open: the card renders after this slot, and
              a sixty-row list between the two would push it off the panel.
              The list keeps its open/closed state, so coming back returns the
              reader to where they were. */}
          {results.length > 0 && !cardOpen && (
            <>
              <button
                className="lookup-fold"
                aria-expanded={listOpen}
                onClick={() => setListOpen((v) => !v)}
              >
                <span>
                  {results.length} {results.length === 1 ? 'record' : 'records'}, with mission
                  numbers
                </span>
                <span className="lookup-fold-mark" aria-hidden="true">
                  {listOpen ? '▾' : '▸'}
                </span>
              </button>
              {listOpen && (
                <>
                  <ol className="lookup-list">
                    {shown!.map((h) => (
                      <li key={h.key}>
                        <button className="lookup-item" onClick={() => onOpen(h)}>
                          <span className="lookup-item-id">
                            M{h.mission}
                            {h.run !== h.mission ? `·R${h.run}` : ''}
                          </span>
                          <span className="lookup-item-date">{fmtDay(h.day)}</span>
                          <span className="lookup-item-agent">{groups[h.gi]?.label ?? '?'}</span>
                          <span className="lookup-item-dist">{h.distanceKm.toFixed(1)} km</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  {truncated && (
                    <p className="lookup-truncated">
                      Nearest 200 shown of {results.length}. Narrow the radius for the rest.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
