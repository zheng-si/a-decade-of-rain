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
const M = { top: 18, right: 20, bottom: 34, left: 62 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom

// Round up to the next 1M so the plot fills its height (max ≈5.1M → 6M) and
// gridlines land on whole millions.
function niceMax(v: number): number {
  return Math.max(1e6, Math.ceil((v * 1.04) / 1e6) * 1e6)
}

// Catmull-Rom → densely sampled points, so a boundary reads as a smooth curve.
// Sampling (rather than emitting béziers) lets each band be a simple polygon
// between two smoothed boundaries, with no risk of the fills crossing.
function smooth(pts: [number, number][], perSeg = 14): [number, number][] {
  if (pts.length < 3) return pts
  const out: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg
      const t2 = t * t
      const t3 = t2 * t
      const fx =
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const fy =
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      out.push([fx, fy])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export default function RainbowHerbicides({ years, series }: Props) {
  const [sel, setSel] = useState<AgentInfo['key']>('O')

  const n = years.length
  const x = (i: number) => M.left + (n === 1 ? PW / 2 : (i / (n - 1)) * PW)
  const totals = years.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0))
  const yMax = niceMax(Math.max(...totals, 1))
  const y = (v: number) => M.top + PH - (v / yMax) * PH

  // Cumulative boundaries (bottom → top); each band sits between two smoothed
  // boundaries so the curved fills tile seamlessly.
  const boundary = (k: number) =>
    smooth(years.map((_, i) => [x(i), y(series.slice(0, k).reduce((s, s2) => s + s2.values[i], 0))]))
  const bands = series.map((ser, si) => {
    const top = boundary(si + 1)
    const bottom = boundary(si)
    const d = `M ${top.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')} L ${bottom
      .slice()
      .reverse()
      .map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' L ')} Z`
    return { key: ser.key, color: ser.color, d }
  })

  const active = AGENTS.find((a) => a.key === sel) ?? AGENTS[0]
  const activeSeries = series.find((s) => s.key === sel)
  const yStep = yMax / 1e6 <= 6 ? 1e6 : 2e6 // gridline every 1M (or 2M if tall)
  const yTicks: number[] = []
  for (let t = 0; t <= yMax + 1; t += yStep) yTicks.push(t)

  return (
    <section className="story-fullscreen rainbow" aria-label={RAINBOW.title}>
      <div className="fs-inner">
        <div className="rainbow-grid">
          <div className="rainbow-main">
            <header className="fs-head">
              <p className="fs-eyebrow">{RAINBOW.eyebrow}</p>
              <h2 className="fs-title">{RAINBOW.title}</h2>
              <p className="fs-dek">{RAINBOW.dek}</p>
            </header>
            <figure className="rainbow-chart">
            <figcaption className="rainbow-chart-title">
              {RAINBOW.chartTitle} <span>· {RAINBOW.chartUnit}</span>
            </figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={RAINBOW.chartTitle} className="rainbow-svg">
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`rb-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.55" />
                  </linearGradient>
                ))}
                <linearGradient id="rb-grad-dim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cfcec6" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#cfcec6" stopOpacity="0.28" />
                </linearGradient>
              </defs>
              {/* y gridlines + labels (every 1M) */}
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="rainbow-grid-line" />
                  <text x={M.left - 10} y={y(t)} className="rainbow-axis-label" textAnchor="end" dominantBaseline="middle">
                    {fmtGallons(t)}
                  </text>
                </g>
              ))}
              {/* stacked bands (smoothed, gradient-filled) */}
              {bands.map((b) => {
                const dim = sel !== b.key
                return (
                  <path
                    key={b.key}
                    d={b.d}
                    fill={dim ? 'url(#rb-grad-dim)' : `url(#rb-grad-${b.key})`}
                    stroke={dim ? '#b7b6ad' : b.color}
                    strokeWidth={dim ? 0.6 : 1.1}
                    strokeLinejoin="round"
                    className="rainbow-band"
                    onClick={() => setSel(b.key)}
                  />
                )
              })}
              {/* x labels — all years 61–71 */}
              {years.map((yr, i) => (
                <text key={yr} x={x(i)} y={H - 12} className="rainbow-axis-label" textAnchor="middle">
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
          </div>

          <aside className="rainbow-card" key={active.key}>
            <div className="rainbow-card-head" style={{ ['--agent' as string]: activeSeries?.color ?? '#ef7d1a' }}>
              {/* Interim mark (a herbicide droplet) — swap for the SVG you send. */}
              <svg viewBox="0 0 24 24" className="rainbow-card-icon" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2.5c3.2 4 6 7.2 6 10.9a6 6 0 1 1-12 0c0-3.7 2.8-6.9 6-10.9Z"
                  opacity="0.92"
                />
                <circle cx="12" cy="14" r="2.4" fill="#213528" />
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
