import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { AgentChoice } from './agentChoices'
import { dayToDate, dateToDay, type SprayDataset } from '../data/spray'

// ── the Explorer's control panel ──────────────────────────────────────────
// One frosted-glass card, top-left, in the story's paper language: identity
// block, transport (play / pause / reset), the monthly-volume chart as the
// scrubber, and the agent filter. The chart speaks the map's own encoding —
// one hue for the whole record, the selection tinted and the rest grey.

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
  missionCount: number
  runCount: number
  gallons: number
  agentChoices: AgentChoice[]
  activeAgentKey: string
  volume: VolumeChart | null
  onScrub: (day: number) => void
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSelectAgent: (key: string) => void
}

const fmtGallons = (g: number) =>
  g >= 1_000_000 ? `${(g / 1_000_000).toFixed(1)}M` : g >= 1000 ? `${Math.round(g / 1000)}K` : `${g}`

/** Grey for de-emphasised volume — the same DIM the map uses. */
const CHART_DIM = '#c9cdc4'

/** One-line primers per agent choice, shown in a fixed-height slot under the
 *  chips (all ≤2 lines at panel width, so the card never changes height). */
const AGENT_NOTES: Record<string, string> = {
  all: 'Four herbicide families, one decade. Pick an agent to isolate its share of the 19.5 million gallons.',
  O: 'The workhorse defoliant, a 2,4-D and 2,4,5-T mix contaminated with TCDD dioxin: 12.1M gallons, 62% of all spraying.',
  W: 'A slower 2,4-D and picloram mix with no dioxin, 5.4M gallons; it increasingly replaced Orange late in the war.',
  B: 'Arsenic-based cacodylic acid, the crop killer: 1.3M gallons aimed at rice fields and food supplies.',
  other:
    'The early mixes, Purple and Pink, dioxin-heavier than Orange, plus a tail of unattributed runs; mostly before 1965.',
}

export default function Timeline({
  day,
  dayMin,
  dayMax,
  playing,
  dateLabel,
  missionCount,
  runCount,
  gallons,
  agentChoices,
  activeAgentKey,
  volume,
  onScrub,
  onPlay,
  onPause,
  onReset,
  onSelectAgent,
}: TimelineProps) {
  const groups = agentChoices.filter((c) => c.indices && c.color)
  const selGi = groups.findIndex((g) => g.key === activeAgentKey)
  const tint = selGi >= 0 ? groups[selGi].color! : 'var(--accent)'
  // Stat figures take the selected agent's colour (default red via CSS).
  const statStyle = selGi >= 0 ? { color: groups[selGi].color! } : undefined
  const span = Math.max(1, dayMax - dayMin)
  const pct = ((day - dayMin) / span) * 100

  return (
    <section className="explorer-panel" aria-label="Archive controls">
      <header className="explorer-head">
        <p className="explorer-eyebrow">1961–1971</p>
        <h1 className="explorer-title">The Archive</h1>
        <p className="explorer-subtitle">The Decade of Defoliation, Replayable.</p>
        <p className="explorer-dek">
          The complete{' '}
          <a
            href="https://github.com/andrewstellman/hea-v"
            target="_blank"
            rel="noopener noreferrer"
          >
            HERBS record
          </a>{' '}
          behind Stellman et&nbsp;al. (2003): 8,360 missions of
          Operation Ranch Hand, flown as 24,604 recorded spray runs, each dot&apos;s area
          proportional to the gallons that fell there. Press play to watch the decade fall month
          by month, isolate an agent to grey out the rest, or tilt the terrain into 3D. Every
          view is shareable straight from its URL.
        </p>
      </header>

      <div className="explorer-transport">
        <div className="transport-buttons">
          <button
            className="transport-btn is-primary"
            onClick={playing ? onPause : onPlay}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.4" y="1.8" width="2.4" height="8.4" />
                <rect x="7.2" y="1.8" width="2.4" height="8.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 1.5 L10.5 6 L2.5 10.5 Z" />
              </svg>
            )}
          </button>
          <button className="transport-btn is-ghost" onClick={onReset} aria-label="Reset to start">
            {/* Material Symbols "refresh" (wght 300), mirrored horizontally. */}
            <svg viewBox="0 -960 960 960" className="icon-reset" aria-hidden="true">
              <g transform="translate(960 0) scale(-1 1)">
                <path d="M481.54-180q-125.63 0-212.81-87.17-87.19-87.17-87.19-212.77 0-125.6 87.19-212.83Q355.91-780 481.54-780q70.15 0 132.77 31.19 62.61 31.2 104.15 88.04V-780h60v244.61H533.85v-59.99h158q-31.62-57.93-87.7-91.27Q548.08-720 481.54-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h63.23q-27.23 97.92-107.27 158.96Q583.46-180 481.54-180Z" />
              </g>
            </svg>
          </button>
        </div>
        <p className="explorer-date">{dateLabel}</p>
      </div>

      {volume && (
        <p className="explorer-statline">
          <strong style={statStyle}>{missionCount.toLocaleString()}</strong> <span>Missions</span>{' '}
          · <strong style={statStyle}>{runCount.toLocaleString()}</strong> <span>Runs</span> ·{' '}
          <strong style={statStyle}>{fmtGallons(gallons)}</strong> <span>Gallons</span>
        </p>
      )}

      {volume && (
        <div className="explorer-chart">
          <svg
            viewBox={`0 0 ${volume.months.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {volume.months.map((m, i) => {
              const total = m.reduce((a, b) => a + b, 0)
              if (!total) return null
              const played = volume.monthStart[i] <= day
              // The chart mirrors the map: one hue for the whole field; with a
              // selection, the selected agent's share sits tinted on the
              // baseline and the rest stacks grey above it.
              const sel = selGi >= 0 ? m[selGi] : total
              const other = total - sel
              const hSel = (sel / volume.max) * 100
              const hOther = (other / volume.max) * 100
              return (
                <g key={i} className={played ? undefined : 'is-future'}>
                  {other > 0 && selGi >= 0 && (
                    <rect
                      x={i + 0.12}
                      y={100 - hSel - hOther}
                      width={0.76}
                      height={hOther}
                      fill={CHART_DIM}
                    />
                  )}
                  {sel > 0 && (
                    <rect
                      x={i + 0.12}
                      y={100 - hSel}
                      width={0.76}
                      height={hSel}
                      fill={tint}
                      opacity={0.85}
                    />
                  )}
                </g>
              )
            })}
          </svg>

          <div className="explorer-playhead" style={{ left: `${pct}%` }} />

          <input
            className="explorer-slider"
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
        <div className="explorer-axis" aria-hidden="true">
          {/* Ruler: a major tick each year (labelled), a minor tick each
              quarter — month-level reading comes from the playhead date. */}
          {volume.monthStart.map((d0, i) => {
            const date = dayToDate(d0)
            const m = date.getUTCMonth()
            if (m % 3 !== 0) return null
            const left = `${((d0 - dayMin) / span) * 100}%`
            return (
              <span
                key={`t${i}`}
                className={`axis-tick${m === 0 ? ' is-major' : ''}`}
                style={{ left }}
              />
            )
          })}
          {volume.monthStart.map((d0, i) => {
            const date = dayToDate(d0)
            if (date.getUTCMonth() !== 0 || date.getUTCFullYear() % 2 !== 0) return null
            return (
              <span
                key={`y${i}`}
                className="axis-year"
                style={{ left: `${((d0 - dayMin) / span) * 100}%` }}
              >
                {date.getUTCFullYear()}
              </span>
            )
          })}
        </div>
      )}

      <div className="explorer-agents">
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

      <p className="explorer-agent-note">{AGENT_NOTES[activeAgentKey] ?? ''}</p>

      <p className="explorer-links">
        <Link to="/">← Read the Story</Link>
      </p>
    </section>
  )
}
