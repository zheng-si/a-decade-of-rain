import type { CSSProperties } from 'react'
import type { AgentChoice } from './agentChoices'
import { dayToDate, dateToDay, type SprayDataset } from '../data/spray'

// ── the scrubber IS a chart ───────────────────────────────────────────────
// The Archive's playback bar carries the data itself: monthly spray volume,
// stacked by agent colour — the horizontal sibling of the story's vertical
// cumulative ruler. Months right of the playhead dim ("still to fall"), and
// the date chip rides the playhead instead of sitting in a separate readout.

export interface VolumeChart {
  /** Gallons per month per agent group (group order = the coloured choices). */
  months: number[][]
  /** First day (epoch day number) of each month bucket. */
  monthStart: number[]
  /** Largest monthly total, for the shared y-scale. */
  max: number
}

/** Bucket the dataset into monthly per-group gallon totals. */
export function buildVolume(data: SprayDataset, choices: AgentChoice[]): VolumeChart {
  const groups = choices.filter((c) => c.indices && c.color)
  const groupOf = new Map<number, number>()
  groups.forEach((g, gi) => (g.indices as number[]).forEach((ai) => groupOf.set(ai, gi)))

  const start = dayToDate(data.dayMin)
  const end = dayToDate(data.dayMax)
  const startY = start.getUTCFullYear()
  const startM = start.getUTCMonth()
  const nMonths = (end.getUTCFullYear() - startY) * 12 + end.getUTCMonth() - startM + 1

  const months = Array.from({ length: nMonths }, () => groups.map(() => 0))
  const monthStart = Array.from({ length: nMonths }, (_, i) =>
    dateToDay(new Date(Date.UTC(startY, startM + i, 1)).toISOString().slice(0, 10)),
  )
  for (const f of data.features.features) {
    const p = f.properties
    const d = dayToDate(p.day)
    const mi = (d.getUTCFullYear() - startY) * 12 + d.getUTCMonth() - startM
    const gi = groupOf.get(p.agent)
    if (mi >= 0 && mi < nMonths && gi != null) months[mi][gi] += p.gallons
  }
  const max = Math.max(1, ...months.map((m) => m.reduce((a, b) => a + b, 0)))
  return { months, monthStart, max }
}

interface TimelineProps {
  day: number
  dayMin: number
  dayMax: number
  playing: boolean
  dateLabel: string
  runCount: number
  gallons: number
  agentChoices: AgentChoice[]
  activeAgentKey: string
  volume: VolumeChart | null
  onScrub: (day: number) => void
  onTogglePlay: () => void
  onSelectAgent: (key: string) => void
}

const fmtGallons = (g: number) =>
  g >= 1_000_000 ? `${(g / 1_000_000).toFixed(1)}M` : g >= 1000 ? `${Math.round(g / 1000)}K` : `${g}`

export default function Timeline({
  day,
  dayMin,
  dayMax,
  playing,
  dateLabel,
  runCount,
  gallons,
  agentChoices,
  activeAgentKey,
  volume,
  onScrub,
  onTogglePlay,
  onSelectAgent,
}: TimelineProps) {
  const groups = agentChoices.filter((c) => c.indices && c.color)
  const span = Math.max(1, dayMax - dayMin)
  const pct = ((day - dayMin) / span) * 100

  return (
    <div className="timeline">
      <div className="timeline-row">
        <button
          className="timeline-play"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="timeline-readout">
          <span className="timeline-stat">
            {runCount.toLocaleString()} runs · {fmtGallons(gallons)} gal cumulative
          </span>
        </div>
      </div>

      {volume && (
        <div className="timeline-chart">
          <svg
            viewBox={`0 0 ${volume.months.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* year seams, to hang the axis labels on */}
            {volume.monthStart.map((d0, i) =>
              i > 0 && dayToDate(d0).getUTCMonth() === 0 ? (
                <rect key={`y${i}`} x={i - 0.05} y={0} width={0.1} height={100} className="timeline-grid" />
              ) : null,
            )}
            {volume.months.map((m, i) => {
              const total = m.reduce((a, b) => a + b, 0)
              if (!total) return null
              const played = volume.monthStart[i] <= day
              let y = 100
              return (
                <g key={i} className={played ? undefined : 'is-future'}>
                  {m.map((g, gi) => {
                    if (!g) return null
                    const h = (g / volume.max) * 100
                    y -= h
                    const dim = activeAgentKey !== 'all' && groups[gi]?.key !== activeAgentKey
                    return (
                      <rect
                        key={gi}
                        x={i + 0.09}
                        y={y}
                        width={0.82}
                        height={h}
                        fill={groups[gi]?.color ?? '#999'}
                        className={dim ? 'is-dim' : undefined}
                      />
                    )
                  })}
                </g>
              )
            })}
          </svg>

          <div className="timeline-playhead" style={{ left: `${pct}%` }} />
          <div
            className="timeline-chip"
            style={{ left: `${Math.min(95, Math.max(5, pct))}%` }}
            aria-hidden="true"
          >
            {dateLabel}
          </div>

          <input
            className="timeline-slider"
            type="range"
            min={dayMin}
            max={dayMax}
            value={day}
            aria-label="Timeline"
            aria-valuetext={dateLabel}
            style={{ '--progress': `${pct}%` } as CSSProperties}
            onChange={(e) => onScrub(Number(e.target.value))}
          />
        </div>
      )}

      {volume && (
        <div className="timeline-axis" aria-hidden="true">
          {volume.monthStart.map((d0, i) => {
            const date = dayToDate(d0)
            if (date.getUTCMonth() !== 0) return null
            return (
              <span key={i} style={{ left: `${((d0 - dayMin) / span) * 100}%` }}>
                {date.getUTCFullYear()}
              </span>
            )
          })}
        </div>
      )}

      <div className="timeline-agents">
        {agentChoices.map((c) => {
          const active = c.key === activeAgentKey
          return (
            <button
              key={c.key}
              className={`agent-chip${active ? ' is-active' : ''}`}
              style={active && c.color ? { background: c.color, borderColor: c.color } : undefined}
              onClick={() => onSelectAgent(c.key)}
            >
              {c.color && <span className="agent-dot" style={{ background: c.color }} />}
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
