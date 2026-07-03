import { useState } from 'react'
import { AGENTS, RAINBOW, type AgentInfo } from '../content/facts/agents'
import { SOURCES } from '../content/sources'
import { fmtGallons } from '../data/spray'

export interface AgentSeries {
  key: AgentInfo['key']
  name: string
  color: string
  total: number
  values: number[] // aligned to `years`
}

interface Props {
  years: number[]
  series: AgentSeries[] // stack order: bottom → top
}

// ── stacked-area geometry ─────────────────────────────────────────────────
const W = 640
const H = 360
const M = { top: 18, right: 18, bottom: 34, left: 58 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom

function niceMax(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / pow
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return n * pow
}

export default function RainbowHerbicides({ years, series }: Props) {
  const [sel, setSel] = useState<AgentInfo['key']>('O')

  const n = years.length
  const x = (i: number) => M.left + (n === 1 ? PW / 2 : (i / (n - 1)) * PW)
  const totals = years.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0))
  const yMax = niceMax(Math.max(...totals, 1))
  const y = (v: number) => M.top + PH - (v / yMax) * PH

  // Cumulative baselines per series (bottom → top).
  const bands = series.map((ser, si) => {
    const below = years.map((_, i) => series.slice(0, si).reduce((s, s2) => s + s2.values[i], 0))
    const top = below.map((b, i) => b + ser.values[i])
    const up = top.map((t, i) => `${x(i)},${y(t)}`).join(' ')
    const down = below.map((_, i) => `${x(n - 1 - i)},${y(below[n - 1 - i])}`).join(' ')
    return { key: ser.key, color: ser.color, points: `${up} ${down}` }
  })

  const active = AGENTS.find((a) => a.key === sel) ?? AGENTS[0]
  const activeSeries = series.find((s) => s.key === sel)
  const yTicks = [0, yMax / 2, yMax]

  return (
    <section className="story-fullscreen rainbow" aria-label={RAINBOW.title}>
      <div className="fs-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{RAINBOW.eyebrow}</p>
          <h2 className="fs-title">{RAINBOW.title}</h2>
          <p className="fs-dek">{RAINBOW.dek}</p>
        </header>

        <div className="rainbow-grid">
          <figure className="rainbow-chart">
            <figcaption className="rainbow-chart-title">
              {RAINBOW.chartTitle} <span>· {RAINBOW.chartUnit}</span>
            </figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={RAINBOW.chartTitle} className="rainbow-svg">
              {/* y gridlines + labels */}
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="rainbow-grid-line" />
                  <text x={M.left - 8} y={y(t)} className="rainbow-axis-label" textAnchor="end" dominantBaseline="middle">
                    {fmtGallons(t)}
                  </text>
                </g>
              ))}
              {/* stacked bands */}
              {bands.map((b) => {
                const dim = sel !== b.key
                return (
                  <polygon
                    key={b.key}
                    points={b.points}
                    fill={dim ? '#c9c8c0' : b.color}
                    fillOpacity={dim ? 0.35 : 0.92}
                    stroke={dim ? '#b7b6ad' : b.color}
                    strokeWidth={0.75}
                    className="rainbow-band"
                    onClick={() => setSel(b.key)}
                  />
                )
              })}
              {/* x labels — every other year to avoid crowding */}
              {years.map((yr, i) => (
                <text
                  key={yr}
                  x={x(i)}
                  y={H - 12}
                  className="rainbow-axis-label"
                  textAnchor="middle"
                  opacity={n > 8 && i % 2 === 1 ? 0 : 1}
                >
                  {String(yr).slice(2)}
                </text>
              ))}
            </svg>

            {/* agent switcher */}
            <div className="rainbow-switch" role="tablist" aria-label="Choose an agent">
              {series.map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={sel === s.key}
                  className={`rainbow-chip${sel === s.key ? ' is-active' : ''}`}
                  onClick={() => setSel(s.key)}
                >
                  <span className="rainbow-chip-dot" style={{ background: s.color }} />
                  {s.name.replace(/^Agents? /, '')}
                </button>
              ))}
            </div>
            <p className="rainbow-chart-note">{RAINBOW.chartNote}</p>
          </figure>

          <aside className="rainbow-card" key={active.key}>
            <div className="rainbow-card-head" style={{ ['--agent' as string]: activeSeries?.color ?? '#ef7d1a' }}>
              <svg viewBox="0 0 24 24" className="rainbow-card-icon" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a4.5 4.5 0 0 1 4.34 5.7 4.5 4.5 0 0 1 2.03 7.03 4.5 4.5 0 1 1-8.74.02 4.5 4.5 0 0 1-2.03-7.05A4.5 4.5 0 0 1 12 2Zm0 6.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z"
                />
              </svg>
              <div>
                <h3 className="rainbow-card-name">{active.name}</h3>
                <p className="rainbow-card-tag">{active.tagline}</p>
              </div>
            </div>
            <div className="rainbow-card-body">
              <p className="rainbow-stat">
                <strong style={{ color: activeSeries?.color }}>{fmtGallons(activeSeries?.total ?? 0)}</strong>
                <span>gallons sprayed</span>
              </p>
              <dl className="rainbow-defs">
                <dt>Make-up</dt>
                <dd>{active.makeup}</dd>
                <dt>Use</dt>
                <dd>{active.use}</dd>
                <dt>What it left behind</dt>
                <dd>{active.legacy}</dd>
              </dl>
              <p className="rainbow-card-src">
                {active.sourceIds.map((id, i) => {
                  const s = SOURCES[id]
                  return (
                    s && (
                      <span key={id}>
                        {i > 0 && ' · '}
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.publisher}
                        </a>
                      </span>
                    )
                  )
                })}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
