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

type Sel = 'all' | AgentInfo['key']

// Agent colours nudged where needed to pass AA as small text on the forest card
// (the chart colours themselves are fine as large fills / big numbers).
const TEXT_SAFE: Record<AgentInfo['key'], string> = { O: '#ef7d1a', W: '#a9adb3', B: '#5aa6e0', other: '#b28cd6' }

// Biohazard trefoil (user-supplied), viewBox 38×35.
const BIOHAZARD = [
  'M28.0303 18.4855C27.3796 18.5134 26.749 18.6548 26.1556 18.8789C26.1662 19.0402 26.1796 19.2014 26.1796 19.3655C26.1796 22.1855 24.6168 24.6442 22.3154 25.9294C22.4061 26.3493 22.5395 26.7628 22.722 27.1601C22.8779 27.5056 23.0741 27.8242 23.2873 28.1308C26.4313 26.4668 28.5819 23.1641 28.5819 19.3666C28.5819 19.0719 28.5607 18.7826 28.5378 18.496C28.4591 18.4932 28.3818 18.4812 28.3032 18.4812L28.0303 18.4855Z',
  'M15.0203 25.9275C12.7151 24.6421 11.1536 22.1837 11.1536 19.3636C11.1536 19.1995 11.1696 19.0383 11.1804 18.877C10.5844 18.6529 9.95386 18.5129 9.30322 18.4836L9.03257 18.4783C8.95389 18.4783 8.87911 18.4903 8.80071 18.4931C8.77392 18.781 8.75662 19.0703 8.75662 19.3636C8.75662 23.1622 10.9045 26.4635 14.0488 28.1279C14.2622 27.8213 14.4581 27.5026 14.6168 27.1572C14.7937 26.7613 14.9257 26.3494 15.0203 25.9278L15.0203 25.9275Z',
  'M14.6389 13.0333C15.8054 12.2894 17.1829 11.8519 18.6657 11.8519C20.1484 11.8519 21.527 12.2891 22.6924 13.0333C23.179 12.608 23.6099 12.1091 23.9458 11.5413C24.0259 11.4041 24.0884 11.2612 24.1592 11.12C22.5859 10.0692 20.698 9.45459 18.6673 9.45459C16.638 9.45459 14.7499 10.0693 13.1779 11.12C13.246 11.2626 13.3113 11.4055 13.3885 11.5413C13.7256 12.108 14.1522 12.6066 14.6388 13.0333H14.6389Z',
  'M16.3324 19.367C16.3324 18.3123 17.0378 17.4309 17.999 17.1416V15.8561C17.9443 15.8508 17.8896 15.8522 17.835 15.8469C16.1896 15.663 14.715 14.9348 13.5724 13.8603C13.0565 13.3776 12.6031 12.8311 12.2417 12.2203C12.1924 12.1349 12.1538 12.0417 12.1059 11.9549C11.5378 10.903 11.1966 9.70829 11.1966 8.42814C11.1966 5.17757 13.2778 2.42143 16.1754 1.39493V0.00292969C11.1888 1.13629 7.46179 5.58829 7.46179 10.9172C7.46179 11.5425 7.52708 12.1505 7.62585 12.7454C6.92998 12.98 6.25114 13.2827 5.59264 13.6641C0.977995 16.3296 -1.01393 21.7827 0.499137 26.6677L1.70171 25.9718C1.14172 22.9478 2.49107 19.7679 5.30299 18.144C6.47485 17.4679 7.74828 17.168 9.00835 17.1652C9.12582 17.1652 9.24301 17.1504 9.36047 17.156C10.0538 17.1853 10.7324 17.324 11.3873 17.5413C12.95 18.0614 14.3485 19.0826 15.3019 20.5586C15.3245 20.5946 15.3485 20.6306 15.3725 20.6652L16.4459 20.0452C16.3792 19.8265 16.3323 19.6024 16.3323 19.3666L16.3324 19.367Z',
  'M31.7396 13.6612C31.0808 13.2812 30.4009 12.9773 29.7064 12.7424C29.8077 12.1478 29.8704 11.5399 29.8704 10.9143C29.8704 5.58507 26.1439 1.13143 21.1569 0V1.392C24.0556 2.41993 26.1356 5.17607 26.1356 8.42521C26.1356 9.70536 25.7969 10.9012 25.2264 11.952C25.1798 12.0388 25.1424 12.132 25.0905 12.2173C24.7305 12.8292 24.2758 13.3747 23.7623 13.8574C22.617 14.9333 21.1448 15.6616 19.497 15.844C19.4451 15.8493 19.3876 15.8479 19.3329 15.8532V17.1386C20.2941 17.428 20.9995 18.3094 20.9995 19.364C20.9995 19.6001 20.9554 19.8242 20.8876 20.0401L21.9635 20.6601C21.9861 20.6255 22.0075 20.5895 22.0315 20.5535C22.9875 19.0789 24.3862 18.0563 25.9462 17.5362C26.6022 17.3189 27.2821 17.1802 27.9715 17.1509C28.089 17.1456 28.209 17.1601 28.3262 17.1601C29.5835 17.1629 30.8594 17.4642 32.0287 18.1389C34.8407 19.7627 36.19 22.9441 35.63 25.9667L36.8326 26.6626C38.346 21.7798 36.3541 16.3262 31.7394 13.6612L31.7396 13.6612Z',
  'M20.1474 21.1533C19.7434 21.4893 19.23 21.6985 18.6662 21.6985C18.1023 21.6985 17.5874 21.4893 17.1849 21.1533L15.9714 21.8534C16.5702 23.3614 16.6461 24.9762 16.258 26.4734C16.1486 26.8975 16.0074 27.3121 15.8261 27.7119C15.6754 28.044 15.4979 28.3654 15.2982 28.6759C14.6782 29.6347 13.8314 30.4667 12.7742 31.0772C9.96224 32.701 6.53146 32.2772 4.19275 30.2811L2.99017 30.9759C6.46339 34.7278 12.1809 35.7278 16.7966 33.0637C17.4794 32.6703 18.1018 32.2143 18.666 31.7091C19.2313 32.2144 19.8541 32.6703 20.5355 33.0637C25.153 35.7278 30.869 34.7278 34.3419 30.9759L33.1393 30.2811C30.8006 32.2772 27.374 32.6999 24.5579 31.0772C23.5007 30.4664 22.6539 29.6344 22.0339 28.6759C21.8366 28.3665 21.6567 28.044 21.506 27.7119C21.3232 27.3118 21.186 26.8986 21.0766 26.4734C20.6885 24.9762 20.7619 23.3615 21.3631 21.8534L20.1474 21.1533Z',
]

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

  return (
    <section className="story-fullscreen rainbow" aria-label={RAINBOW.title}>
      <div className="fs-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{RAINBOW.eyebrow}</p>
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
          <aside className="rainbow-card" style={{ ['--agent' as string]: cardColor, ['--agent-text' as string]: cardText }}>
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
