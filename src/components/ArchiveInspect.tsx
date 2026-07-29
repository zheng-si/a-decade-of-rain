import { dayToDate } from '../data/spray'

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
}

export interface RunInspect {
  kind: 'run'
  coords: [number, number]
  day: number
  groupIndex: number
  gallons: number
}

export type Inspect = CellInspect | RunInspect

export const fmtGallons = (g: number) =>
  g >= 1_000_000 ? `${(g / 1_000_000).toFixed(1)}M` : g >= 1000 ? `${Math.round(g / 1000)}K` : `${g}`

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
  onClose: () => void
}

export default function ArchiveInspect({ data, groups, onClose }: Props) {
  return (
    <aside className="archive-inspect" aria-label="Inspect">
      <button className="inspect-close" onClick={onClose} aria-label="Close">
        ×
      </button>

      {data.kind === 'cell' ? (
        <>
          <p className="inspect-kicker">Grid Cell · ≈{data.cellKm} km</p>
          <p className="inspect-coords">{fmtCoords(data.center)}</p>
          <p className="inspect-figure">
            <strong>{fmtGallons(data.gallons)}</strong> gallons
          </p>
          <p className="inspect-sub">
            {data.missions.toLocaleString()} missions · {data.runs.toLocaleString()} runs
          </p>
          <p className="inspect-sub">
            {month(data.firstDay)} – {month(data.lastDay)}
          </p>

          <div className="inspect-groups">
            {(() => {
              const max = Math.max(1, ...data.byGroup)
              return groups.map((g, gi) => {
                const v = data.byGroup[gi]
                if (!v) return null
                return (
                  <div key={g.label} className="inspect-group-row">
                    <span className="inspect-dot" style={{ background: g.color }} />
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
          <div className="inspect-year-labels" aria-hidden="true">
            <span>1961</span>
            <span>1971</span>
          </div>
        </>
      ) : (
        <>
          <p className="inspect-kicker">Single Spray Run</p>
          <p className="inspect-coords">{fmtCoords(data.coords)}</p>
          <p className="inspect-figure">
            {data.gallons > 0 ? (
              <>
                <strong>{fmtGallons(data.gallons)}</strong> gallons
              </>
            ) : (
              'Continuation leg'
            )}
          </p>
          <p className="inspect-sub">
            <span
              className="inspect-dot"
              style={{ background: groups[data.groupIndex]?.color ?? '#999' }}
            />{' '}
            {groups[data.groupIndex]?.label ?? 'Unknown'} · {fullDate(data.day)}
          </p>
          {data.gallons === 0 && (
            <p className="inspect-note">
              Gallons are recorded on a mission&apos;s first leg; this run continues one.
            </p>
          )}
        </>
      )}
    </aside>
  )
}
