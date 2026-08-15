import { useState } from 'react'
import { AGENTS, RAINBOW, type AgentInfo } from '../content/facts/agents'
import { SOURCES } from '../content/sources'
import { fmtGallons } from '../data/spray'
import { BIOHAZARD } from './biohazard'

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

type Sel = 'all' | AgentInfo['key']

// Agent colours nudged where needed to pass AA as small text on the forest card
// (the chart colours themselves are fine as large fills / big numbers).
const TEXT_SAFE: Record<AgentInfo['key'], string> = { O: '#ef7409', W: '#a9adb3', B: '#2f83c8', other: '#b28cd6' }
// Darkened agent colours that stay visible on the white card (the icon). The
// "White" herbicide has no vivid hue, so it takes a neutral slate.
const PAPER_SAFE: Record<AgentInfo['key'], string> = { O: '#b8560b', W: '#6b6f68', B: '#2872b3', other: '#7d52b0' }

function Biohazard() {
  return (
    <svg viewBox="0 0 38 35" className="rainbow-card-icon" fill="currentColor" aria-hidden="true">
      {BIOHAZARD.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

// ── stacked-area geometry ─────────────────────────────────────────────────
const W = 640
const H = 360
const M = { top: 18, right: 20, bottom: 34, left: 44 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom
const BASE = M.top + PH // y-pixel of the zero baseline

function niceMax(v: number): number {
  return Math.max(1e6, Math.ceil((v * 1.04) / 1e6) * 1e6)
}

// Compact axis label: 0 · 5M · 1.5M (no trailing .0).
function fmtAxis(v: number): string {
  if (v === 0) return '0'
  const m = v / 1e6
  return (Number.isInteger(m) ? `${m}` : m.toFixed(1)) + 'M'
}

// Catmull-Rom → densely sampled points; each boundary reads as a smooth curve.
// Sampled y is clamped to the plot so spline overshoot can't dip below the axis.
function smooth(pts: [number, number][], perSeg = 14): [number, number][] {
  if (pts.length < 3) return pts
  const clamp = (v: number) => Math.max(M.top, Math.min(BASE, v))
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
      out.push([fx, clamp(fy)])
    }
  }
  const last = pts[pts.length - 1]
  out.push([last[0], clamp(last[1])])
  return out
}

export default function RainbowHerbicides({ years, series }: Props) {
  const [sel, setSel] = useState<Sel>('all')
  const [mode, setMode] = useState<'cum' | 'year'>('cum')

  // Cumulative mode: each series value is its running total up to that year.
  const plot =
    mode === 'cum'
      ? series.map((s) => {
          let run = 0
          return { ...s, values: s.values.map((v) => (run += v)) }
        })
      : series

  const n = years.length
  const x = (i: number) => M.left + (n === 1 ? PW / 2 : (i / (n - 1)) * PW)
  const totals = years.map((_, i) => plot.reduce((s, ser) => s + ser.values[i], 0))
  const yMax = niceMax(Math.max(...totals, 1))
  const y = (v: number) => M.top + PH - (v / yMax) * PH

  const boundary = (k: number) =>
    smooth(years.map((_, i) => [x(i), y(plot.slice(0, k).reduce((s, s2) => s + s2.values[i], 0))]))
  const bands = plot.map((ser, si) => {
    const top = boundary(si + 1)
    const bottom = boundary(si)
    const d = `M ${top.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')} L ${bottom
      .slice()
      .reverse()
      .map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' L ')} Z`
    return { key: ser.key, color: ser.color, d }
  })

  // ~5 nice gridline steps whatever the scale (6M → 1M; 21M → 5M).
  const rawStep = yMax / 5
  const stepPow = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const sf = rawStep / stepPow
  const yStep = (sf < 1.5 ? 1 : sf < 3 ? 2 : sf < 7 ? 5 : 10) * stepPow
  const yTicks: number[] = []
  for (let t = 0; t <= yMax + 1; t += yStep) yTicks.push(t)

  const grandTotal = series.reduce((s, x2) => s + x2.total, 0)
  const active = sel === 'all' ? null : AGENTS.find((a) => a.key === sel) ?? null
  const activeSeries = sel === 'all' ? null : series.find((s) => s.key === sel)
  const cardColor = activeSeries?.color ?? 'var(--accent)'
  const cardText = active ? TEXT_SAFE[active.key] : 'var(--accent-bright)'
  const cardInk = active ? PAPER_SAFE[active.key] : 'var(--accent-deep)'

  return (
    <section className="story-fullscreen rainbow" aria-label={RAINBOW.title}>
      <div className="fs-inner">
        <header className="fs-head">
          <h2 className="fs-title">{RAINBOW.title}</h2>
        </header>
        <div className="rainbow-grid">
          <div className="rainbow-main">
            <p className="fs-dek">{RAINBOW.dek}</p>
            <figure className="rainbow-chart">
              <div className="rainbow-chart-top">
                <figcaption className="rainbow-chart-title">
                  {RAINBOW.chartTitle} <span>· {RAINBOW.chartUnit}</span>
                </figcaption>
                <div className="rainbow-mode" role="tablist" aria-label="Chart mode">
                  <button role="tab" aria-selected={mode === 'cum'} className={`rainbow-mode-btn${mode === 'cum' ? ' is-active' : ''}`} onClick={() => setMode('cum')}>
                    Accumulation
                  </button>
                  <button role="tab" aria-selected={mode === 'year'} className={`rainbow-mode-btn${mode === 'year' ? ' is-active' : ''}`} onClick={() => setMode('year')}>
                    Each year
                  </button>
                </div>
              </div>
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
                {yTicks.map((t) => (
                  <g key={t}>
                    <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="rainbow-grid-line" />
                    <text x={M.left - 9} y={y(t)} className="rainbow-axis-label" textAnchor="end" dominantBaseline="middle">
                      {fmtAxis(t)}
                    </text>
                  </g>
                ))}
                <line x1={M.left} x2={M.left} y1={M.top} y2={BASE} className="rainbow-axis-line" />
                <line x1={M.left} x2={W - M.right} y1={BASE} y2={BASE} className="rainbow-axis-line" />
                {bands.map((b) => {
                  const dim = sel !== 'all' && sel !== b.key
                  return (
                    <path
                      key={b.key}
                      d={b.d}
                      fill={dim ? 'url(#rb-grad-dim)' : `url(#rb-grad-${b.key})`}
                      className="rainbow-band"
                      onClick={() => setSel(b.key)}
                    />
                  )
                })}
                {years.map((yr, i) => (
                  <text key={yr} x={x(i)} y={H - 11} className="rainbow-axis-label" textAnchor="middle">
                    {yr}
                  </text>
                ))}
              </svg>

              <div className="rainbow-switch" role="tablist" aria-label="Choose an agent">
                <button
                  role="tab"
                  aria-selected={sel === 'all'}
                  className={`rainbow-chip${sel === 'all' ? ' is-active' : ''}`}
                  onClick={() => setSel('all')}
                >
                  <span
                    className="rainbow-chip-dot"
                    style={{ background: `linear-gradient(135deg, ${series.map((s) => s.color).join(', ')})` }}
                  />
                  All agents
                </button>
                {series.map((s) => (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={sel === s.key}
                    className={`rainbow-chip${sel === s.key ? ' is-active' : ''}`}
                    style={sel === s.key ? { background: s.color, borderColor: s.color } : undefined}
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

          {/* Card: outer stays mounted (colours tween); inner crossfades on change. */}
          <aside className="rainbow-card" style={{ ['--agent' as string]: cardColor, ['--agent-text' as string]: cardText, ['--agent-ink' as string]: cardInk }}>
            <div className="rainbow-card-inner" key={sel}>
              <div className="rainbow-card-head">
                <Biohazard />
                <div>
                  <h3 className="rainbow-card-name">{active ? active.name : 'All four agents'}</h3>
                  <p className="rainbow-card-tag">{active ? active.tagline : 'The rainbow herbicides, together'}</p>
                </div>
              </div>
              <div className="rainbow-card-body">
                <p className="rainbow-stat">
                  <strong>{fmtGallons(active ? activeSeries?.total ?? 0 : grandTotal)}</strong>
                  <span>gallons sprayed</span>
                </p>
                {active ? (
                  <>
                    <dl className="rainbow-defs">
                      <dt>Make-Up</dt>
                      <dd>{active.makeup}</dd>
                      <dt>Use</dt>
                      <dd>{active.use}</dd>
                      <dt>What It Left Behind</dt>
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
                  </>
                ) : (
                  <ul className="rainbow-breakdown">
                    {series.map((s) => (
                      <li key={s.key}>
                        <span className="rainbow-bd-dot" style={{ background: s.color }} />
                        <span className="rainbow-bd-name">{s.name.replace(/^Agents? /, '')}</span>
                        <span className="rainbow-bd-val">{fmtGallons(s.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
