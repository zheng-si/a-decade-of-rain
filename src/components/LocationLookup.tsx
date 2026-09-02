import { useEffect, useMemo, useRef, useState } from 'react'
import { dayToDate } from '../data/spray'
import type { ReactNode } from 'react'
import {
  loadGazetteer,
  searchGazetteer,
  parseMissionQuery,
  type GazPlace,
  type LookupHit,
  type MissionSummary,
} from './lookup'
import { fmtGallons, tint } from './ArchiveInspect'
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
  /** A HERBS mission number typed into the search. The other kind of query:
   *  by the record's own key rather than by place. Exclusive with `center` —
   *  setting either clears the other, because the panel answers one question
   *  at a time and the map draws one answer. */
  mission?: number | null
}

interface Props {
  state: LookupState
  results: LookupHit[] | null
  /** Label and colour per agent group — the same objects the record card
   *  takes, because the two draw the same bars. */
  groups: GroupInfo[]
  /** A record card is open below. The answer folds to a way back, because the
   *  card is the reader's subject now and two summaries of the same place
   *  stacked is a worse answer than either. */
  cardOpen?: boolean
  onPickToggle: () => void
  onRadius: (km: number) => void
  onClear: () => void
  onOpen: (hit: LookupHit) => void
  onPlace: (place: GazPlace) => void
  /** A mission chosen from the search. */
  onMission: (mission: number) => void
  /** What each mission is, for the suggestion row; null until the record has
   *  loaded. */
  missions: Map<number, MissionSummary> | null
  onBack?: () => void
  /** `mission|run` of the record open INLINE in the list (desktop), plus the
   *  card to render there. The card expands under its own row — the reader
   *  compares a record against its neighbours without leaving the list. */
  detailKey?: string | null
  detail?: ReactNode
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
  cardOpen = false,
  detailKey = null,
  detail = null,
  onPickToggle,
  onRadius,
  onClear,
  onOpen,
  onPlace,
  onMission,
  missions,
  onBack,
}: Props) {
  const { center, radiusKm, picking, place } = state
  const mission = state.mission ?? null

  // ── the place search ────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const gazRef = useRef<GazPlace[] | null>(null)
  const [gazReady, setGazReady] = useState(false)
  /** The records, folded by default — see the note at the top. */
  const [listOpen, setListOpen] = useState(false)
  /** What the two charts COUNT. Volume by default: gallons are what the whole
   *  surface is about, and the record card next door already speaks them. Runs
   *  stay one press away — they are the honest unit when volumes are partial
   *  (a fifth of hit runs can carry 0 logged gallons). */
  const [unit, setUnit] = useState<'volume' | 'runs'>('volume')
  /** The year column under the pointer, and whether the method note is open.
   *  Both live here rather than in CSS because both carry TEXT that has to be
   *  built from the data. */
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  /** The list scrolls the inline-open record into view — a map click can open
   *  a row the reader has never scrolled to. */
  const openRowRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    if (!detailKey) return
    setListOpen(true)
    const t = window.setTimeout(
      () => openRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      60,
    )
    return () => window.clearTimeout(t)
  }, [detailKey])

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

  /** A number in the box is a mission number, not a place. The gazetteer
   *  holds no digits-only names, so the two kinds of query cannot collide. */
  const missionQ = useMemo(() => parseMissionQuery(query), [query])
  const missionHit = missionQ != null && missions ? (missions.get(missionQ) ?? null) : null
  /** The largest mission number in the record, for the no-match line. Read
   *  off the index rather than typed: the number is the file's, not ours. */
  const maxMission = useMemo(() => (missions ? Math.max(0, ...missions.keys()) : 0), [missions])
  const chooseMission = (m: MissionSummary) => {
    setQuery(`Mission ${m.mission}`)
    setOpen(false)
    onMission(m.mission)
  }
  /** How many rows the popup holds, whichever kind of query is in the box. */
  const optionCount = missionQ != null ? (missionHit ? 1 : 0) : matches.length

  const shown = useMemo(() => results?.slice(0, 200) ?? null, [results])
  const truncated = results != null && results.length > 200

  /** The answer's shape: runs per agent, runs per year. Counted over ALL the
   *  hits, not the 200 the list caps at — the shape is of the answer, not of
   *  the page of it that fits. */
  const shape = useMemo(() => {
    /* Both units computed once: byAgent[gi], and byYear[yearIdx][gi] so the
       year bars can stack in agent colours. Gallons are each hit run's WHOLE
       recorded volume (LookupHit.gallons says so) — the caveat under the
       charts owns that honesty. */
    if (!results?.length) return null
    const years = YEAR_TO - YEAR_FROM + 1
    const agentRuns = groups.map(() => 0)
    const agentGal = groups.map(() => 0)
    const yearRuns = Array.from({ length: years }, () => groups.map(() => 0))
    const yearGal = Array.from({ length: years }, () => groups.map(() => 0))
    for (const h of results) {
      const gi = h.gi >= 0 && h.gi < groups.length ? h.gi : -1
      const y = dayToDate(h.day).getUTCFullYear() - YEAR_FROM
      if (gi >= 0) {
        agentRuns[gi]++
        agentGal[gi] += h.gallons
      }
      if (gi >= 0 && y >= 0 && y < years) {
        yearRuns[y][gi]++
        yearGal[y][gi] += h.gallons
      }
    }
    return { agentRuns, agentGal, yearRuns, yearGal }
  }, [results, groups])

  /* The × in this row used to clear the field as well as the circle, and the
     map's own Clear could not reach in here to do the same — so the same act
     through the other door would have left the box saying "Bien Hoa" over a
     record with no circle on it. One rule instead, for both doors: no circle,
     no query. Typing does not change `center`, so this cannot fire mid-word. */
  useEffect(() => {
    if (!center && mission == null) setQuery('')
  }, [center, mission])

  /* And the other half of the same rule: a centre that is no longer THE PLACE
     stops wearing its name. Dragging the pin clears `place` but the field kept
     saying "Bien Hoa Air Base" over a circle 25 km from it. Keyed on the
     centre's coordinates, so it fires on the drag (centre moved, place gone)
     and never while the reader is merely typing. */
  useEffect(() => {
    if (center && !place) setQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lng, center?.lat, place])

  return (
    <div className="lookup">
      <p className="explorer-section-label">Location Lookup</p>
      {/* The answer replaces most of the panel, and nothing announced that.
          A persistent polite region (conditional rendering would unmount it
          between announcements) that repeats the summary sentence, off
          screen. */}
      <div className="sr-live" aria-live="polite">
        {mission != null && results != null
          ? `${results.length} ${results.length === 1 ? 'run' : 'runs'} on HERBS mission ${mission}`
          : center && results != null
            ? `${results.length} ${results.length === 1 ? 'run' : 'runs'} within ${radiusKm} km`
            : ''}
      </div>

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
          // The scope, stated where the reader types. "Firebases" went: to
          // anyone outside the period's vocabulary it reads as two words, and
          // one of them is a Google product. These are the things the index
          // actually holds.
          // Two kinds of query in one field, and the placeholder names both:
          // the gazetteer's places, or the record's own key. "No." rather than
          // "number" because the field is 218px wide and the pin beside it
          // has already spent its share.
          placeholder="Search a place or mission no.…"
          aria-label="Search air bases, camps, towns and HERBS mission numbers"
          // The full ARIA 1.2 combobox contract, not just a listbox floating
          // in space: without these four the popup, the arrow-key highlight
          // and the open/closed state all existed only visually — a screen
          // reader heard a plain text field and nothing else.
          role="combobox"
          aria-expanded={open && optionCount > 0}
          aria-controls="lookup-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            open && optionCount > 0 ? `lookup-search-opt-${hi}` : undefined
          }
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
              setHi((h) => Math.min(h + 1, optionCount - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHi((h) => Math.max(h - 1, 0))
            } else if (e.key === 'Enter' && missionQ != null) {
              if (missionHit) chooseMission(missionHit)
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
          {/* A pin on its own is a picture of a place, not an instruction. It
              carried the whole meaning of the second way to ask a question
              here, and the row it sits in is otherwise a search box — so it
              read as an ornament on the end of a field. The word is measured
              to fit: the placeholder renders at 161px inside a 218px box, so
              there are 57px spare and this spends about 26 of them. */}
          <span className="lookup-search-word">Pick</span>
        </button>
        {(center || mission != null || query) && (
          <button
            className="lookup-search-btn"
            aria-label="Clear the search"
            title="Clear"
            onClick={onClear}
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
        {/* A mission number gets one row: the mission, with what it is. The
            row is the same element the places use, so it sits, highlights
            and answers the keyboard the same way. */}
        {open && missionQ != null && missionHit && (
          <ul className="lookup-search-drop" id="lookup-search-listbox" role="listbox">
            <li key={`m${missionHit.mission}`}>
              <button
                className="lookup-search-item is-hi"
                id="lookup-search-opt-0"
                role="option"
                aria-selected
                onMouseDown={(e) => {
                  e.preventDefault()
                  chooseMission(missionHit)
                }}
              >
                <span className="lookup-place-name">Mission {missionHit.mission}</span>
                <span className="lookup-place-meta">
                  {missionHit.runs} {missionHit.runs === 1 ? 'run' : 'runs'} · {fmtDay(missionHit.day)} ·{' '}
                  {groups[missionHit.gi]?.label ?? '?'}
                </span>
              </button>
            </li>
          </ul>
        )}
        {open && missionQ != null && !missionHit && missions && (
          <p className="lookup-search-none">
            No mission {missionQ} in the record. Mission numbers run from 1 to{' '}
            {maxMission.toLocaleString()}, and not every number is used.
          </p>
        )}
        {open && missionQ == null && matches.length > 0 && (
          <ul className="lookup-search-drop" id="lookup-search-listbox" role="listbox">
            {matches.map((pl, i) => (
              <li key={pl.n}>
                <button
                  className={`lookup-search-item${i === hi ? ' is-hi' : ''}`}
                  id={`lookup-search-opt-${i}`}
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
        {open && missionQ == null && query.trim() !== '' && gazReady && matches.length === 0 && (
          <p className="lookup-search-none">
            No match. The index covers air bases, army and marine bases, firebases, landing
            zones, camps and towns. It does not cover unit numbers. A HERBS mission number
            (M4493, or just 4493) lists that mission&apos;s runs.
          </p>
        )}
      </div>

      {/* No radius for a mission: the answer is the mission's own tracks, not
          what fell within a distance of anything. */}
      {mission == null && (
      <div className="lookup-row">
        {/* "Radius", not "Within": the row is a property of the search and the
            label names it, rather than starting a sentence the chips have to
            finish. Cased like the panel's other structural labels. */}
        <span className="lookup-row-label">Radius</span>
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
      )}

      {place?.coarse && (
        <p className="lookup-place-hint">
          City-level place, so the radius is set to 10 km and the answer is correspondingly
          coarse.
        </p>
      )}
      {place?.low && (
        <p className="lookup-place-hint">
          This place&apos;s coordinate is inferred. Check the pin against the map before reading
          the list.
        </p>
      )}

      {/* ── the mission's answer ──────────────────────────────────────────
          One sentence, then the tracks themselves as the list, open. The
          circle's answer folds its records because sixty rows are evidence
          rather than an answer; a mission's rows ARE the answer — the reader
          asked for this mission, and what it is, is its tracks. No By Agent
          and no By Year: one mission is one agent on one day. */}
      {mission != null && results != null && (
        <>
          {cardOpen && results.length > 0 ? (
            <button className="lookup-back" onClick={onBack}>
              ← Back to {results.length} {results.length === 1 ? 'result' : 'results'}
            </button>
          ) : (
            <>
              <p className="lookup-summary">
                <strong>{results.length}</strong>
                {results.length === 1 ? ' run' : ' runs'} on{' '}
                <span className="lookup-where">HERBS mission {mission}</span>
              </p>
              {results.length === 0 ? (
                <p className="lookup-empty">No mission {mission} in the record.</p>
              ) : (
                (() => {
                  const first = results[0]
                  const gallons = results.reduce((a, h) => a + h.gallons, 0)
                  const km = results.reduce((a, h) => a + (h.km ?? 0), 0)
                  return (
                    <p className="lookup-mission-meta">
                      {fmtDay(first.day)} · {groups[first.gi]?.label ?? '?'}
                      {first.fwac > 0 ? ` · ${first.fwac} aircraft` : ''}
                      {' · '}
                      {gallons > 0 ? `${fmtGallons(gallons)} gallons` : 'no volume logged'}
                      {km > 0 ? ` · ${km.toFixed(1)} km` : ''}
                    </p>
                  )
                })()
              )}
              {results.length > 0 && (
                <p className="lookup-caveat">
                  Every HERBS record, not only Ranch Hand: fixed-wing flights carry 95% of the
                  gallons, helicopter and ground spraying the rest. Gallons are the
                  mission&apos;s logged volume, spread along its tracks by length.
                </p>
              )}
            </>
          )}
          {results.length > 0 && !cardOpen && (
            <>
              <div className="lookup-head" aria-hidden="true">
                <span>Mission·Run</span>
                <span>Date</span>
                <span>Agent</span>
                <span>Length</span>
              </div>
              <ol className="lookup-list">
                {results.map((h) => {
                  const isOpen = detailKey === `${h.mission}|${h.run}`
                  const hue = groups[h.gi]?.color
                  return (
                    <li key={h.key} ref={isOpen ? openRowRef : undefined}>
                      <button
                        className={`lookup-item${isOpen ? ' is-open' : ''}`}
                        aria-expanded={isOpen}
                        style={isOpen ? { background: tint(hue, 0.16) } : undefined}
                        onClick={() => onOpen(h)}
                      >
                        <span className="lookup-item-id">
                          M{h.mission}
                          {h.run !== h.mission ? `·R${h.run}` : ''}
                        </span>
                        <span className="lookup-item-date">{fmtDay(h.day)}</span>
                        <span className="lookup-item-agent">{groups[h.gi]?.label ?? '?'}</span>
                        <span className="lookup-item-dist">
                          {h.km && h.km > 0 ? `${h.km.toFixed(1)} km` : 'point'}
                        </span>
                      </button>
                      {isOpen && detail != null && (
                        <div
                          className="lookup-detail"
                          style={{ background: tint(hue, 0.08), borderColor: tint(hue, 0.3) }}
                        >
                          {detail}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </>
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
                <span className="lookup-where">{place ? place.name : fmtCenter(center)}</span>
              </p>

              {results.length === 0 ? (
                <p className="lookup-empty">
                  No spray records in this range. That does not mean the area was not sprayed.
                </p>
              ) : (
                shape &&
                (() => {
                  const byAgent = unit === 'volume' ? shape.agentGal : shape.agentRuns
                  const byYear = unit === 'volume' ? shape.yearGal : shape.yearRuns
                  const yearTotals = byYear.map((gs) => gs.reduce((a, b) => a + b, 0))
                  const yearMax = Math.max(1, ...yearTotals)
                  const agentMax = Math.max(1, ...byAgent)
                  const fmt = (v: number) => (unit === 'volume' ? fmtGallons(v) : String(v))
                  return (
                    <>
                      {/* One unit for both charts, and the reader holds the
                          switch. Volume by default — gallons are what this
                          surface is about, and the record card next door
                          already speaks them; runs stay one press away for
                          the hits that carry no logged volume. */}
                      <div className="inspect-section-row">
                        <p className="inspect-section-label">
                          By Agent · {unit === 'volume' ? 'gallons' : 'runs'}
                        </p>
                        <div className="lookup-unit" role="group" aria-label="Chart unit">
                          <button
                            className={unit === 'volume' ? 'is-active' : ''}
                            aria-pressed={unit === 'volume'}
                            onClick={() => setUnit('volume')}
                          >
                            Gallons
                          </button>
                          <button
                            className={unit === 'runs' ? 'is-active' : ''}
                            aria-pressed={unit === 'runs'}
                            onClick={() => setUnit('runs')}
                          >
                            Runs
                          </button>
                        </div>
                      </div>
                      <div className="inspect-groups">
                        {/* Skip only agents with NOTHING here. One whose runs
                            all carry zero logged gallons keeps its row in
                            volume mode — a zero the reader can see is the
                            honest answer; a vanished row says it never flew. */}
                        {groups.map((g, gi) => {
                          if (!shape.agentRuns[gi]) return null
                          const v = byAgent[gi]
                          return (
                            <div key={g.label} className="inspect-group-row">
                              <span className="inspect-group-label">{g.label}</span>
                              <span className="inspect-bar-track">
                                <span
                                  className="inspect-bar"
                                  style={{ width: `${(v / agentMax) * 100}%`, background: g.color }}
                                />
                              </span>
                              <span className="inspect-group-value">{fmt(v)}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* No rule over this one: it heads the second half of a
                          single answer, not a new section, and the divider
                          made two charts read as two subjects. */}
                      <p className="inspect-section-label is-plain">
                        By Year · {unit === 'volume' ? 'gallons' : 'runs'}
                      </p>
                      {/* The bars are aria-hidden and nothing else carried the
                          numbers, so a screen reader heard the heading and
                          then silence. One hidden sentence, zero years skipped
                          that have runs. */}
                      <p className="sr-live">
                        {yearTotals
                          .map((v, i) => (v > 0 ? `${YEAR_FROM + i}: ${fmt(v)}` : null))
                          .filter(Boolean)
                          .join(', ') || 'Nothing in any year'}
                      </p>
                      {/* Stacked in the agent colours — the year bars answered
                          "when" and said nothing about "what", while the agent
                          palette was already this panel's vocabulary one block
                          up. Segment order is the group order, Orange at the
                          base. */}
                      <div className="lookup-years-wrap" onMouseLeave={() => setHoverYear(null)}>
                        {/* The readout rides ABOVE the bars rather than
                            floating over them: eleven columns in 275px are
                            too narrow to host a box that would cover its own
                            neighbours, and a fixed slot means nothing jumps.
                            It holds the row's place when nothing is hovered,
                            so the chart does not shift under the pointer. */}
                        <p className={`lookup-year-readout${hoverYear == null ? ' is-idle' : ''}`}>
                          {hoverYear == null ? (
                            'Hover a year'
                          ) : (
                            <>
                              <strong>{YEAR_FROM + hoverYear}</strong>
                              <span>{fmt(yearTotals[hoverYear])}</span>
                              {byYear[hoverYear].map((v, gi) =>
                                v > 0 ? (
                                  <span key={gi} className="lookup-year-part">
                                    <i style={{ background: groups[gi]?.color }} />
                                    {groups[gi]?.label} {fmt(v)}
                                  </span>
                                ) : null,
                              )}
                            </>
                          )}
                        </p>
                        <div className="inspect-years is-tall" aria-hidden="true">
                          {byYear.map((gs, i) => (
                            <span
                              key={i}
                              className={`inspect-year-col${hoverYear === i ? ' is-hi' : ''}`}
                              onMouseEnter={() => setHoverYear(i)}
                            >
                              <span
                                className="inspect-year-stack"
                                style={{
                                  height: `${Math.max(yearTotals[i] > 0 ? 2 : 0, (yearTotals[i] / yearMax) * 100)}%`,
                                }}
                              >
                                {gs.map((v, gi) =>
                                  v > 0 ? (
                                    <span
                                      key={gi}
                                      className="inspect-year-seg"
                                      style={{ flexGrow: v, background: groups[gi]?.color }}
                                    />
                                  ) : null,
                                )}
                              </span>
                            </span>
                          ))}
                        </div>
                        {/* Every other year carries a label, and only the
                            labelled ticks are full-length: two end-labels left
                            the reader counting columns to place a bar. */}
                        <div className="inspect-year-ticks" aria-hidden="true">
                          {byYear.map((_, i) => (
                            <span
                              key={i}
                              className={`inspect-year-tick${i % 2 === 0 ? ' is-major' : ''}`}
                            />
                          ))}
                        </div>
                        <div className="lookup-year-axis" aria-hidden="true">
                          {byYear.map((_, i) => (
                            <span key={i}>{i % 2 === 0 ? YEAR_FROM + i : ''}</span>
                          ))}
                        </div>
                      </div>
                    </>
                  )
                })()
              )}

              <p className="lookup-caveat">
                Every HERBS record, not only Ranch Hand: fixed-wing flights carry 95% of the
                gallons, helicopter and ground spraying the rest.
                {results.length > 0 &&
                  unit === 'volume' &&
                  ' Gallons are each run’s share of its mission’s logged volume, spread along the track by length, not the share that fell inside this circle.'}
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
                  {/* Four columns with no names read as a code table. The
                      header is aria-hidden: the buttons below already carry
                      their own reading order, and a screen reader announcing
                      four headings for a list of links helps nobody. */}
                  <div className="lookup-head" aria-hidden="true">
                    <span>Mission·Run</span>
                    <span>Date</span>
                    <span>Agent</span>
                    <span>Distance</span>
                  </div>
                  <ol className="lookup-list">
                    {shown!.map((h) => {
                      const isOpen = detailKey === `${h.mission}|${h.run}`
                      const hue = groups[h.gi]?.color
                      return (
                        <li key={h.key} ref={isOpen ? openRowRef : undefined}>
                          <button
                            className={`lookup-item${isOpen ? ' is-open' : ''}`}
                            aria-expanded={isOpen}
                            style={isOpen ? { background: tint(hue, 0.16) } : undefined}
                            onClick={() => onOpen(h)}
                          >
                            <span className="lookup-item-id">
                              M{h.mission}
                              {h.run !== h.mission ? `·R${h.run}` : ''}
                            </span>
                            <span className="lookup-item-date">{fmtDay(h.day)}</span>
                            <span className="lookup-item-agent">{groups[h.gi]?.label ?? '?'}</span>
                            <span className="lookup-item-dist">{h.distanceKm.toFixed(1)} km</span>
                          </button>
                          {/* The record opens UNDER its own row instead of
                              replacing the panel: the reader keeps the list,
                              the neighbours and the place their eye was — the
                              card was a page-turn where a fold answers. */}
                          {isOpen && detail != null && (
                            <div
                              className="lookup-detail"
                              style={{ background: tint(hue, 0.08), borderColor: tint(hue, 0.3) }}
                            >
                              {detail}
                            </div>
                          )}
                        </li>
                      )
                    })}
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
