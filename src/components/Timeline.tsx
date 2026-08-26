import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { AgentChoice } from './agentChoices'
import { dayToDate, dateToDay, fmtGallons, type SprayDataset } from '../data/spray'

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
  gallons: number
  agentChoices: AgentChoice[]
  activeAgentKey: string
  volume: VolumeChart | null
  /** SPIKE A — the map is drawing tracks. The dek describes the encoding, so
   *  it cannot stay the same sentence when the encoding changes. */
  tracks?: boolean
  /** The 3D state and its toggle, mirrored from the key panel. On a phone the
   *  key panel is hidden, and with it the only way into the terrain view —
   *  so the transport row carries a small 3D chip there (CSS keeps it off
   *  desktop, where the key panel already owns this control). */
  is3D?: boolean
  onToggle3D?: () => void
  /** A record card is open (phone: it stacks on top of this sheet). Opening
   *  one auto-drops the panel to its peek; the handle still expands it, and
   *  an expanded panel under an open card reads as two stacked cards. */
  inspectOpen?: boolean
  onScrub: (day: number) => void
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSelectAgent: (key: string) => void
}

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
  gallons,
  agentChoices,
  activeAgentKey,
  volume,
  tracks = false,
  is3D = false,
  onToggle3D,
  inspectOpen = false,
  onScrub,
  onPlay,
  onPause,
  onReset,
  onSelectAgent,
}: TimelineProps) {
  // ── the phone sheet ─────────────────────────────────────────────────────
  // On a phone the panel is a bottom sheet with two heights: expanded (the
  // full card) and peeked (one identity line + the transport). The class is
  // set unconditionally and desktop CSS simply never reads it, so no
  // matchMedia is needed. Pressing play collapses to the peek — the reader
  // asked to watch the map, so the card gets out of the way of the map.
  const [expanded, setExpanded] = useState(true)
  // ── why a phase machine and not a class swap ────────────────────────────
  // The peek is a DIFFERENT LAYOUT (children hidden, identity inlined), and
  // a layout has no in-between states: swapping classes directly made the
  // collapse an instant 330px snap — the content vanished, so the height hit
  // the floor before the max-height transition produced a single frame —
  // while the expand animated. The fix is to pass through `is-collapsing`,
  // which keeps the FULL content and only clamps max-height to the peek's
  // height, so the box glides shut clipping its content, and the layout swap
  // happens off-stage at the end. Expanding runs the same ramp backwards:
  // two rAFs let the clamped box paint once before the lid lifts.
  const [phase, setPhase] = useState<'open' | 'closing' | 'peek' | 'preopen'>('open')
  useEffect(() => {
    if (expanded) {
      setPhase((p) => (p === 'open' ? 'open' : 'preopen'))
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setPhase('open')),
      )
      return () => cancelAnimationFrame(raf)
    }
    setPhase('closing')
    const id = window.setTimeout(() => setPhase('peek'), 270)
    return () => window.clearTimeout(id)
  }, [expanded])
  useEffect(() => {
    if (playing) setExpanded(false)
  }, [playing])
  // A record card stacks on top of this sheet, so the panel drops to the
  // peek the moment one opens — the card gets the room first. The handle
  // keeps its one job either way: expanding the panel under an open card
  // simply stacks two full cards over the map, which is a reading the
  // design accepts (the reader asked for both).
  useEffect(() => {
    if (inspectOpen) setExpanded(false)
  }, [inspectOpen])

  const groups = agentChoices.filter((c) => c.indices && c.color)
  const selGi = groups.findIndex((g) => g.key === activeAgentKey)
  const tint = selGi >= 0 ? groups[selGi].color! : 'var(--accent)'
  // Stat figures take the selected agent's colour (default red via CSS).
  const statStyle = selGi >= 0 ? { color: groups[selGi].color! } : undefined
  const span = Math.max(1, dayMax - dayMin)
  const pct = ((day - dayMin) / span) * 100

  // ── what playback re-renders, and what it must not ──────────────────────
  // The rAF loop calls setDay on EVERY frame, so this component renders ~60
  // times a second for the whole 28s play-through. The chart is 120 months of
  // up to two <rect> each and the axis another 60 spans — around 500 SVG nodes
  // rebuilt and diffed per frame to move one playhead.
  //
  // The bars do depend on the playhead, but only through a boundary: a month is
  // either past or future. Depending on the COUNT of past months instead of on
  // `day` turns 60 changes a second into one a month — 120 over the whole
  // record — and React skips the subtree entirely on every other frame, because
  // the memo hands back the same element reference.
  const playedThrough = useMemo(() => {
    if (!volume) return 0
    let n = 0
    while (n < volume.monthStart.length && volume.monthStart[n] <= day) n++
    return n
  }, [volume, day])

  const bars = useMemo(() => {
    if (!volume) return null
    return volume.months.map((m, i) => {
      const total = m.reduce((a, b) => a + b, 0)
      if (!total) return null
      const played = i < playedThrough
      // The chart mirrors the map: one hue for the whole field; with a
      // selection, the selected agent's share sits tinted on the baseline and
      // the rest stacks grey above it.
      const sel = selGi >= 0 ? m[selGi] : total
      const other = total - sel
      const hSel = (sel / volume.max) * 100
      const hOther = (other / volume.max) * 100
      return (
        <g key={i} className={played ? undefined : 'is-future'}>
          {other > 0 && selGi >= 0 && (
            <rect x={i + 0.12} y={100 - hSel - hOther} width={0.76} height={hOther} fill={CHART_DIM} />
          )}
          {sel > 0 && (
            <rect x={i + 0.12} y={100 - hSel} width={0.76} height={hSel} fill={tint} opacity={0.85} />
          )}
        </g>
      )
    })
  }, [volume, playedThrough, selGi, tint])

  // The ruler does not depend on the playhead at all — it was only ever rebuilt
  // because it sits in a component the playhead re-renders.
  const axis = useMemo(() => {
    if (!volume) return null
    return (
      <>
        {/* Ruler: a major tick each year (labelled), a minor tick each
            quarter — month-level reading comes from the playhead date. */}
        {volume.monthStart.map((d0, i) => {
          const date = dayToDate(d0)
          const m = date.getUTCMonth()
          if (m % 3 !== 0) return null
          return (
            <span
              key={`t${i}`}
              className={`axis-tick${m === 0 ? ' is-major' : ''}`}
              style={{ left: `${((d0 - dayMin) / span) * 100}%` }}
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
      </>
    )
  }, [volume, dayMin, span])

  return (
    <section
      className={`explorer-panel${
        phase === 'peek' ? ' is-peek' : phase === 'open' ? '' : ' is-collapsing'
      }`}
      aria-label="Archive controls"
    >
      {/* The sheet's grab handle — phone only (desktop CSS hides it). A
          button, not a div with listeners: the toggle is the whole gesture,
          and a button gives it focus, Enter/Space, and a name for free. */}
      <button
        className="sheet-toggle"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse the archive controls' : 'Expand the archive controls'}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="sheet-grab" aria-hidden="true" />
      </button>
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
          behind Stellman et&nbsp;al. (2003): 8,360 Operation Ranch Hand spray runs carrying a
          recorded volume, logged as 24,604 track points.{' '}
          {tracks ? (
            <>
              Zoomed out, each dot is a grid cell&apos;s total, counted along every run that
              crossed it. Zoom past a spray run&apos;s own scale and the dots give way to the
              lines themselves, drawn at the gallons laid down per kilometre — so where the
              aircraft turned and came back, the ink stacks.
            </>
          ) : (
            <>
              HERBS records each run as a line and books its whole volume against the line&apos;s
              first point, so a filled dot&apos;s area is the gallons for an entire run and the
              rings mark the rest of its track.
            </>
          )}{' '}
          Press play to watch the decade fall month by month, isolate an agent to grey out the
          rest, or tilt the terrain into 3D. Every view is shareable straight from its URL.
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
          {onToggle3D && (
            <button
              className="transport-btn is-ghost sheet-3d"
              aria-pressed={is3D}
              aria-label={is3D ? 'Flatten the terrain' : 'Tilt the terrain into 3D'}
              onClick={onToggle3D}
            >
              3D
            </button>
          )}
        </div>
        {/* The buttons sit beside a two-line readout: what is being counted
            and when, then the counts themselves. Heading and date share a
            line because together they name one thing — this month's volume. */}
        <div className="transport-readout">
          <p className="transport-head">
            {volume && <span className="explorer-section-label">Spraying Volume</span>}
            <span className="explorer-date">{dateLabel}</span>
          </p>
          {/* Two counts, not three. "Track Points" was the waypoint count, and
              it earned its place when the near tier drew a dot per waypoint —
              the reader could see the marks it was counting. Now that tier
              draws lines, so it counted something the map no longer shows, and
              it was the widest pair on the row. Runs and gallons are the two
              quantities every other surface here reports.

              With it gone the pair fits the readout column again (175px of
              250), which is why it sits back under the heading instead of
              spanning the panel: the counts are what SPRAYING VOLUME · DEC 1971
              resolves to, and a full-width row put a rule's worth of distance
              between the label and its own figures. */}
          {volume && (
            <span className="explorer-statline">
              <span className="stat-pair">
                <strong style={statStyle}>{missionCount.toLocaleString()}</strong> Spray Runs
              </span>
              <span className="stat-pair">
                <strong style={statStyle}>{fmtGallons(gallons)}</strong> Gallons
              </span>
            </span>
          )}
        </div>
      </div>

      {volume && (
        <div className="explorer-chart">
          <svg
            viewBox={`0 0 ${volume.months.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {bars}
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
          {axis}
        </div>
      )}

      <p className="explorer-section-label">Spraying Agents</p>
      <div className="explorer-agents">
        {agentChoices.map((c) => {
          const active = c.key === activeAgentKey
          return (
            <button
              key={c.key}
              className={`agent-chip${active ? ' is-active' : ''}`}
              // The selected agent was announced by a class name and an inline
              // background, neither of which reaches assistive tech: five
              // chips, all read identically, none of them saying which one the
              // map is filtered to.
              aria-pressed={active}
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

      {/* The phone's whole legend. The key panel — dot scale, compass, view
          toggle — is hidden below 640px, which also took away any hint that
          the dots can be opened. One line carries the two things a phone
          reader cannot otherwise learn: what size encodes, and that a tap
          answers with the record. Desktop CSS hides it; the key panel is the
          legend there. */}
      <p className="explorer-maplegend">
        Dot size is a cell&apos;s gallons. Tap any dot to open its record.
      </p>

      <p className="explorer-links">
        <Link to="/">← Read the Story</Link>
      </p>
    </section>
  )
}
