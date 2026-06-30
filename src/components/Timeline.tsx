import type { AgentChoice } from './agentChoices'

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
  onScrub,
  onTogglePlay,
  onSelectAgent,
}: TimelineProps) {
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
          <span className="timeline-date">{dateLabel}</span>
          <span className="timeline-stat">
            {runCount.toLocaleString()} runs · {fmtGallons(gallons)} gal cumulative
          </span>
        </div>
      </div>

      <input
        className="timeline-slider"
        type="range"
        min={dayMin}
        max={dayMax}
        value={day}
        onChange={(e) => onScrub(Number(e.target.value))}
      />

      <div className="timeline-agents">
        {agentChoices.map((c) => (
          <button
            key={c.key}
            className={`agent-chip${c.key === activeAgentKey ? ' is-active' : ''} chip-${c.key}`}
            onClick={() => onSelectAgent(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}
