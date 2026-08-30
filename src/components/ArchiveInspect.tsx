import { dayToDate, fmtGallons } from '../data/spray'

// ── click-to-inspect card ─────────────────────────────────────────────────
// Clicking a grid dot opens this card with the cell's FULL-record story:
// totals, the agent mix, a per-year sparkline and the first/last spray
// dates. Clicking a raw event (near zoom) shows that single run instead.

export interface GroupInfo {
  label: string
  color: string
}

export interface CellInspect {
  kind: 'cell'
  center: [number, number]
  cellKm: number
  gallons: number
  runs: number
  missions: number
  firstDay: number
  lastDay: number
  byGroup: number[]
  byYear: number[]
  /** Sprayings that CROSSED this cell, and the number of distinct days they
   *  fell on — carried on the binned feature itself rather than recomputed.
   *
   *  Present only when the grids were binned from the lines. `missions` above
   *  counts runs whose FIRST WAYPOINT lands in the cell box, which is what the
   *  point data can answer and is not the same question: a run is an 11 km line
   *  across three or four fine cells, so counting starts undercounts every cell
   *  the run merely crossed. Where the dot is sized by crossings, the card has
   *  to report crossings or it is describing a different mark. */
  crossings?: number
  days?: number
}

export interface RunInspect {
  kind: 'run'
  coords: [number, number]
  day: number
  groupIndex: number
  gallons: number
  /** Set when the subject is a TRACK — the whole run as a line — rather than a
   *  single waypoint from the raw dot tier. Their presence is what switches the
   *  card between the two, because the difference is real: a waypoint has a
   *  position and a run has an extent, and printing one coordinate for an 11 km
   *  line would claim the run happened at a point. */
  km?: number
  gpk?: number
  /** HERBS run identity, when the feature carries it — the citation that lets
   *  a reader find this row in the source record. */
  mission?: number
  run?: number
  /** Aircraft count (FWAC, read as its last two digits — hea-v's own
   *  reading). 0/absent = not recorded. */
  fwac?: number
}

export type Inspect = CellInspect | RunInspect

// Imported and re-exported, not redefined: this card uses it, and MapView
// imports it from here for the popups it builds, whose figures have to be the
// ones the card beside them shows.
export { fmtGallons }

const fmtCoords = ([lng, lat]: [number, number]) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`

const month = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

const fullDate = (day: number) =>
  dayToDate(day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

interface Props {
  data: Inspect
  groups: GroupInfo[]
  /** Hidden when the panel above already carries a way back to the results
   *  the card came from — two controls that do the same thing, a hand's width
   *  apart, is one more than the reader needs to read. */
  showClose?: boolean
  /** Rendered inside the lookup's own list, under the row it belongs to.
   *  The row above already prints Mission·Run under a MISSION·RUN header, so
   *  the citation line would say the identifier twice; the aircraft count,
   *  which is the only other thing that line carried, joins the agent. */
  compact?: boolean
  onClose: () => void
}

export default function ArchiveInspect({
  data,
  groups,
  showClose = true,
  compact = false,
  onClose,
}: Props) {
  return (
    <aside className="archive-inspect" aria-label="Inspect">
      {showClose && (
        <button className="inspect-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      )}

      {data.kind === 'cell' ? (
        <>
          {/* The card's subject, not its geometry. '13 km Grid Cell' named the
              container and left the reader to infer the contents — and worse,
              left them to guess the span, since the panel opposite is showing
              one month. The title says both: everything, all years. The cell
              size is an attribute of the place, so it joins the coordinates. */}
          <p className="inspect-kicker">Total Sprayed Here</p>
          {/* Where and when first, then how much. The span used to trail the
              figures, which made it read as a footnote to the counts rather
              than as the other half of the question the title asks — the
              reader needs to know it is a decade's worth BEFORE the number,
              not after. */}
          <p className="inspect-coords">
            {fmtCoords(data.center)} · {data.cellKm} km Cell
          </p>
          <p className="inspect-coords is-span">
            {month(data.firstDay)} – {month(data.lastDay)}
          </p>
          <p className="inspect-figure">
            <strong>{fmtGallons(data.gallons)}</strong>
            <span className="inspect-figure-unit">Gallons</span>
          </p>
          <p className="inspect-sub is-stats">
            {data.crossings != null ? (
              <>
                <span className="stat-pair">
                  <strong>{data.crossings.toLocaleString()}</strong> Sprayings
                </span>
                <span className="stat-pair">
                  <strong>{(data.days ?? 0).toLocaleString()}</strong> Days
                </span>
              </>
            ) : (
              <>
                <span className="stat-pair">
                  <strong>{data.missions.toLocaleString()}</strong> Missions
                </span>
                <span className="stat-pair">
                  <strong>{data.runs.toLocaleString()}</strong> Runs
                </span>
              </>
            )}
          </p>

          {/* Two headings the card did without: the bars and the sparkline were
              unlabelled, so what they broke the total down BY had to be
              inferred from the row names. Same 10px tier as the panel's own
              SPRAYING VOLUME / SPRAYING AGENTS. */}
          <p className="inspect-section-label">By Agent</p>
          <div className="inspect-groups">
            {(() => {
              const max = Math.max(1, ...data.byGroup)
              return groups.map((g, gi) => {
                const v = data.byGroup[gi]
                if (!v) return null
                return (
                  <div key={g.label} className="inspect-group-row">
                    <span className="inspect-group-label">{g.label}</span>
                    <span className="inspect-bar-track">
                      <span
                        className="inspect-bar"
                        style={{ width: `${(v / max) * 100}%`, background: g.color }}
                      />
                    </span>
                    <span className="inspect-group-value">{fmtGallons(v)}</span>
                  </div>
                )
              })
            })()}
          </div>

          <p className="inspect-section-label">By Year</p>
          <div className="inspect-years" aria-hidden="true">
            {(() => {
              const max = Math.max(1, ...data.byYear)
              return data.byYear.map((v, i) => (
                <span key={i} className="inspect-year-col">
                  <span
                    className="inspect-year-bar"
                    style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%` }}
                  />
                </span>
              ))
            })()}
          </div>
          {/* One tick per year, so the two ends are read off a ruler rather
              than guessed at from two labels. */}
          <div className="inspect-year-ticks" aria-hidden="true">
            {data.byYear.map((_, i) => (
              <span key={i} className="inspect-year-tick" />
            ))}
          </div>
          <div className="inspect-year-labels" aria-hidden="true">
            <span>1961</span>
            <span>1971</span>
          </div>
        </>
      ) : (
        <>
          <p className="inspect-kicker">Single Spray Run</p>
          {/* The same four blocks the cell card sets, in the same order:
              title · locating pair · headline figure · stats. It had been
              title · one line · figure · agent · stats, which put the agent
              between the total and the counts that decompose it and skipped
              the 12px break that separates the locating block from the figure
              — so the whole card read tighter and in a different rhythm than
              the one the reader had just closed.

              A line's "where" is its date; the waypoint card keeps the
              coordinate because a waypoint really is one place. */}
          <p className="inspect-coords">
            {data.km != null ? fullDate(data.day) : fmtCoords(data.coords)}
          </p>
          <p className="inspect-coords is-span">
            <span
              className="inspect-dot"
              style={{ background: groups[data.groupIndex]?.color ?? '#999' }}
            />{' '}
            {groups[data.groupIndex]?.label ?? 'Unknown'}
            {data.km == null && <> · {fullDate(data.day)}</>}
            {compact && data.fwac != null && data.fwac > 0 && <> · {data.fwac} aircraft</>}
          </p>
          <p className="inspect-figure">
            {data.gallons > 0 ? (
              <>
                <strong>{fmtGallons(data.gallons)}</strong>
                <span className="inspect-figure-unit">Gallons</span>
              </>
            ) : data.mission != null && data.mission > 0 ? (
              // A whole run with nothing booked against it — the key's "Flown,
              // No Volume". Distinct from the line below, which is one WAYPOINT
              // of a run whose gallons sit on another of its legs.
              'No volume logged'
            ) : (
              'Flight path point'
            )}
          </p>
          {/* Length and dose, in the cell card's own stats grammar. The second
              figure is the one the stroke's width encodes, so the card names
              the quantity the reader is looking at rather than leaving them to
              divide the first two. */}
          {data.km != null && (
            <p className="inspect-sub is-stats">
              {/* Bare units, not "km Flown" and "Gal / km". The card is 210px
                  wide and the longer pair of words broke each figure away from
                  its own label — "23.8 km / Flown" over two lines, with the
                  slash in "Gal / km" left dangling at the end of the first. A
                  figure and its unit are one atom, so they get nowrap and short
                  enough words to keep it. */}
              <span className="stat-pair">
                <strong>{data.km.toFixed(1)}</strong> km
              </span>
              {data.gpk != null && data.gpk > 0 && (
                <span className="stat-pair">
                  <strong>{Math.round(data.gpk).toLocaleString()}</strong> Gal/km
                </span>
              )}
            </p>
          )}
          {/* The run IS the subject and it carries no volume: say that, rather
              than the waypoint explanation below, which describes a piece of a
              run whose gallons are elsewhere. Reached from the map now that the
              single-point runs are clickable, where it read as a claim about a
              longer flight this record does not have. */}
          {data.gallons === 0 && data.km == null && data.mission != null && data.mission > 0 && (
            <p className="inspect-note">
              Logged against one grid reference, with no volume recorded against it. The record
              carries the flight; it does not say what fell.
            </p>
          )}
          {data.gallons === 0 && data.km == null && !(data.mission != null && data.mission > 0) && (
            <p className="inspect-note">
              A waypoint on a spray run&apos;s track. HERBS records the run as a line of legs
              (1A, 1B, 1C) and books its whole volume against 1A, so every later waypoint reads
              zero.
            </p>
          )}
          {data.gallons === 0 && data.km != null && (
            <p className="inspect-note">
              A leg the record carries no volume against. The aircraft flew it, but the gallons
              were booked to another leg of the same run.
            </p>
          )}
          {/* The citation, in the LIST's own notation. A lookup result has to
              be checkable against the source, and Mission + Run is exactly the
              key HERBS files the row under. It used to spell the two words out
              here and abbreviate them in the list two inches away, so the same
              identifier read as two different things: M704·R877 in the row the
              reader clicked, "Mission 704 · Run 877" on the card it opened.
              One notation, and HERBS stays to say whose numbers these are. */}
          {!compact && data.mission != null && data.mission > 0 && (
            <p className="inspect-coords is-runid">
              HERBS M{data.mission}
              {data.run !== data.mission ? `·R${data.run}` : ''}
              {data.fwac != null && data.fwac > 0 && (
                <> · {data.fwac} aircraft</>
              )}
            </p>
          )}
        </>
      )}
    </aside>
  )
}
