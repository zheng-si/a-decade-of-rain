import { lazy, Suspense, useState } from 'react'
import { AGENTS, RAINBOW, type AgentInfo, type FieldNums } from '../content/facts/agents'
import { SOURCES } from '../content/sources'
import { fmtGallons } from '../data/spray'
import { BIOHAZARD } from './biohazard'
import { buildField, FIELD_DEFAULTS, type FieldGeom } from './rainfield'

/** Lazy, so the tuner's code never reaches a reader. Gated exactly as the
 *  Story's type tuner is: on in dev, and on anywhere with `?tune` in the query
 *  string — which is what lets the geometry be dialled on a deploy preview
 *  rather than only on a machine with the repo checked out. Latched at import
 *  for the same reason that one is: whether a dev tool appears should not
 *  depend on when a render happened to run. */
const RainFieldTuner = lazy(() => import('./RainFieldTuner'))
const FIELD_TUNE_GATE: boolean = (() => {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).has('tune')
  } catch {
    return false
  }
})()

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

// ── the year typology: a field of drops ───────────────────────────────────
//
// "Each year" used to be the same stacked area on a per-year axis, and on an
// absolute axis a small year has no area: 1962-64 are 0.8-4.4% of the peak, so
// the three years that were almost entirely one agent were a line at the foot
// of the plot saying nothing. A field per year fixes that, because SHARE mode
// gives every year the same field whatever its volume.
//
// The geometry itself lives in rainfield.ts, as parameters rather than as a
// literal path, so the tuner and the shipped page cannot drift apart.
//
// 16 x 16 = 256 is not a round number chosen for looks. Two constraints meet
// in it. Below about 144 a largest-remainder split starts losing groups that
// actually sprayed -- at 100 the 0.4477% Other of 1967 rounds away, at 64 so
// does the 0.60% Blue of 1966 -- so 256 is comfortably clear of that floor and
// the tuner confirms it loses nothing. Above it the mark runs out of room: the
// field is drawn at a cell of 180px, which puts the drop at 8.0px across, and
// below about 7.6 the silhouette stops being a drop. 24 x 24 was measured at
// 5.2px and was a field of dots.

/** Unfilled. Deliberately close to the paper: the field is a budget, not a mark. */
const DROP_EMPTY = 'rgba(28, 43, 33, 0.07)'

/** Largest remainder, with one guarantee on top of it: a group that sprayed
 *  never rounds to nothing.
 *
 *  In Share mode, where the budget is the whole field, that guarantee never
 *  has to fire — it is there so a later change to the grid cannot silently
 *  delete a number. In Volume mode it does fire, and it wins against the
 *  budget: 1971's 29,068 gallons is worth 1.45 drops but it sprayed three
 *  agents, so it draws three.
 *  Measured across the decade at the current unit that is two extra drops out
 *  of 2,560, both of them at 1971, the one year already reading as "almost
 *  nothing" -- and the number under each cell carries the true figure. Read
 *  off the rendered page rather than reasoned about; the tuner recomputes it
 *  on every change, and it has already caught this number being wrong once. The trade is deliberate: a reader
 *  miscounting a 3-drop cell as a 1-drop cell costs nothing, and an agent that
 *  sprayed being invisible costs the claim the figure is making. */
function apportion(vals: number[], budget: number): number[] {
  const total = vals.reduce((a, b) => a + b, 0)
  const out = vals.map(() => 0)
  if (!total || !budget) return out
  const raw = vals.map((v) => (v / total) * budget)
  raw.forEach((r, i) => (out[i] = Math.floor(r)))
  vals.forEach((v, i) => {
    if (v > 0 && out[i] === 0) out[i] = 1
  })
  const order = raw.map((_, i) => i).sort((a, b) => ((raw[b] % 1) - (raw[a] % 1)))
  let d = budget - out.reduce((a, b) => a + b, 0)
  for (let i = 0; d > 0 && i < 999; i++, d--) out[order[i % order.length]]++
  for (let i = 0; d < 0 && i < 999; i++) {
    const j = order[order.length - 1 - (i % order.length)]
    if (out[j] > 1) {
      out[j]--
      d++
    }
  }
  return out
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
  /** The typology's scale. Volume counts drops of a fixed size; Share gives
   *  every year the whole field, which is the only way the three years that
   *  were almost entirely one agent can be read at all. */
  const [scale, setScale] = useState<'vol' | 'share'>('vol')
  /** The typology's own agent filter, which is a SET rather than the chart's
   *  one-of-five. The two figures ask different questions of the same four
   *  agents: the chart is a stack, where isolating one band against the others
   *  is the whole gesture, and the typology is a composition, where the reading
   *  that pays is a pair -- Orange against Other across 1965, White beside Blue
   *  across 1968. That is not expressible as a single selection, so the field
   *  stopped borrowing the chart's. */
  const [picks, setPicks] = useState<Set<AgentInfo['key']>>(() => new Set(AGENTS.map((a) => a.key)))
  /** Chronological, or the heaviest year first. "Heaviest" always ranks by
   *  gallons of the SELECTED agents, in both scales: in Share mode the fields
   *  are all the same size, so ranking them by size would be a control that
   *  visibly does nothing, while ranking by volume reads the mixture of the
   *  heaviest years left to right, which is the question that mode is for. */
  const [order, setOrder] = useState<'time' | 'heavy'>('time')
  /** The field's geometry. A plain state whose initial value is the shipped
   *  constant, so with the tuner gated off this is a value that is set once and
   *  never written again — the render is identical to reading the constants
   *  directly. */
  const [geom, setGeom] = useState<FieldGeom>(FIELD_DEFAULTS)
  const F = buildField(geom)

  const allPicked = picks.size === AGENTS.length
  /** A plain toggle, with one guard: the last agent cannot be turned off. An
   *  empty field is a dead state no reader wants, and silently snapping back to
   *  all four would move three chips on a click aimed at one. "All" is the way
   *  back, and it is one button. */
  const togglePick = (k: AgentInfo['key']) =>
    setPicks((prev) => {
      const next = new Set(prev)
      if (!next.has(k)) next.add(k)
      else if (next.size > 1) next.delete(k)
      return next
    })

  // The area chart is the running total, and only that now: its other mode
  // was the same chart on a per-year axis, which is what the typology below
  // does properly. A tab is a bad place for the better view — most readers
  // never press it.
  const plot = series.map((s) => {
    let run = 0
    return { ...s, values: s.values.map((v) => (run += v)) }
  })

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

  // Per-year totals from the record itself. Volume mode no longer measures
  // against the heaviest of them -- see `gallons` in rainfield.ts.
  const yearTotals = years.map((_, i) => series.reduce((a, ser) => a + ser.values[i], 0))

  const grandTotal = series.reduce((s, x2) => s + x2.total, 0)
  const active = sel === 'all' ? null : AGENTS.find((a) => a.key === sel) ?? null
  const activeSeries = sel === 'all' ? null : series.find((s) => s.key === sel)
  const cardColor = activeSeries?.color ?? 'var(--accent)'
  const cardText = active ? TEXT_SAFE[active.key] : 'var(--accent-bright)'
  const cardInk = active ? PAPER_SAFE[active.key] : 'var(--accent-deep)'

  // The typology's rows. Isolating an agent FILTERS rather than dims. The area
  // chart dims its other bands to contextGrey, and that cannot work inside a
  // field: measured on this ground, contextGrey sits 1.31:1 from the unfilled
  // drop, so a dimmed drop and an empty one are the same mark. Every grey dark
  // enough to separate from the empty tone lands within 1.3:1 of Agent White,
  // which is the one colour it would then be beside. So there is no third grey:
  // the field draws the chosen agents alone, and the cell reads as how much of
  // the year was theirs.
  const rows = years.map((yr, i) => {
    const total = yearTotals[i]
    const shown = series.map((ser) => (picks.has(ser.key) ? ser.values[i] : 0))
    const q = shown.reduce((a, b) => a + b, 0)
    const budget =
      q > 0
        ? scale === 'share'
          ? total > 0
            ? Math.max(1, Math.round((q / total) * F.cells))
            : 0
          : Math.min(F.cells, Math.max(1, Math.round(q / geom.gallons)))
        : 0
    const seq: string[] = []
    apportion(shown, budget).forEach((c, k) => {
      for (let z = 0; z < c; z++) seq.push(series[k].color)
    })
    return { yr, total, q, seq }
  })
  // A year with no volume can be dropped from the grid. Filtered on the year's
  // OWN total rather than on `q`, so an agent filter never deletes a year: with
  // Orange alone 1961-64 and 1971 all come to zero, and losing five of eleven
  // fields on a chip press would be a different figure, not a filtered one.
  const kept = geom.hideEmpty ? rows.filter((r) => r.total > 0) : rows
  // What the captions are allowed to say about this figure. Derived here and
  // passed down, so a line of copy cannot state a unit or a fill the grid above
  // it does not have -- which is exactly what happened while these were
  // literals. The peak is the UNFILTERED one: it describes the figure's scale,
  // not the current selection.
  const peakGal = Math.max(...yearTotals, 0)
  const nums: FieldNums = {
    gal: geom.gallons.toLocaleString('en-US'),
    cells: F.cells,
    peakYear: years[yearTotals.indexOf(peakGal)],
    peakFill: peakGal > 0 ? Math.min(F.cells, Math.max(1, Math.round(peakGal / geom.gallons))) : 0,
  }

  // Ties break chronologically, so equal years never shuffle between renders.
  const ordered = order === 'time' ? kept : kept.slice().sort((a, b) => b.q - a.q || a.yr - b.yr)

  return (
    <section id="sec-rainbow" className="story-fullscreen rainbow" aria-label={RAINBOW.title}>
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

        {/* The typology stands on its own below the chart rather than behind a
            tab on it. It was the chart's second mode, and a tab is a bad place
            for the better view: most readers never press it. Standing on its
            own it needs the things a figure needs -- a heading that makes a
            claim, a unit, and controls that are its own rather than the
            chart's. */}
        <figure className="rb-figure">
          <figcaption className="rb-head">
            {/* h2, not h3: it is a peer of the section title above it, and a
                reader hearing the outline should meet it at the same level a
                reader seeing the page does. */}
            <h2 className="rb-title">{RAINBOW.fieldHeading}</h2>
            <p className="rb-dek">{RAINBOW.fieldDek}</p>
          </figcaption>

          <div className="rb-controls">
            <div className="rb-ctl">
              <span className="rb-ctl-lab" id="rb-lab-agents">
                Agents
              </span>
              {/* wrap, where the chart's row above is pinned nowrap. That row is
                  a segmented control and a segmented control cannot reflow; these
                  are independent toggles, each complete on its own line, so
                  wrapping costs nothing and buys the phone widths. */}
              <div className="rb-chips" role="group" aria-labelledby="rb-lab-agents">
                <button
                  type="button"
                  aria-pressed={allPicked}
                  className={`rainbow-chip${allPicked ? ' is-active' : ''}`}
                  onClick={() => setPicks(new Set(AGENTS.map((a) => a.key)))}
                >
                  <span
                    className="rainbow-chip-dot"
                    style={{ background: `linear-gradient(135deg, ${series.map((x2) => x2.color).join(', ')})` }}
                  />
                  All
                </button>
                {series.map((s2) => {
                  const on = picks.has(s2.key)
                  return (
                    <button
                      key={s2.key}
                      type="button"
                      aria-pressed={on}
                      className={`rainbow-chip${on ? ' is-active' : ''}`}
                      style={on ? { background: s2.color, borderColor: s2.color } : undefined}
                      onClick={() => togglePick(s2.key)}
                    >
                      <span className="rainbow-chip-dot" style={{ background: s2.color }} />
                      {s2.name.replace(/^Agents? /, '')}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rb-ctl">
              <span className="rb-ctl-lab" id="rb-lab-scale">
                Scale
              </span>
              <div className="rainbow-mode" role="group" aria-labelledby="rb-lab-scale">
                <button
                  type="button"
                  aria-pressed={scale === 'vol'}
                  className={`rainbow-mode-btn${scale === 'vol' ? ' is-active' : ''}`}
                  onClick={() => setScale('vol')}
                >
                  Volume
                </button>
                <button
                  type="button"
                  aria-pressed={scale === 'share'}
                  className={`rainbow-mode-btn${scale === 'share' ? ' is-active' : ''}`}
                  onClick={() => setScale('share')}
                >
                  Share
                </button>
              </div>
            </div>

            <div className="rb-ctl">
              <span className="rb-ctl-lab" id="rb-lab-order">
                Order
              </span>
              <div className="rainbow-mode" role="group" aria-labelledby="rb-lab-order">
                <button
                  type="button"
                  aria-pressed={order === 'time'}
                  className={`rainbow-mode-btn${order === 'time' ? ' is-active' : ''}`}
                  onClick={() => setOrder('time')}
                >
                  Chronological
                </button>
                <button
                  type="button"
                  aria-pressed={order === 'heavy'}
                  className={`rainbow-mode-btn${order === 'heavy' ? ' is-active' : ''}`}
                  onClick={() => setOrder('heavy')}
                >
                  Heaviest first
                </button>
              </div>
            </div>
          </div>

          <p className="rb-unit">
            {RAINBOW.fieldTitle}{' '}
            <span>· {scale === 'vol' ? RAINBOW.fieldUnitVol(nums) : RAINBOW.fieldUnitShare(nums)}</span>
          </p>

          {/* The four grid numbers ride as custom properties so the tuner can
              move them live; Story.css carries the same values as fallbacks, so
              nothing here changes what the page does. */}
          <div
            className="rb-years"
            style={{
              ['--rb-cell-min' as string]: `${geom.cellMin}px`,
              ['--rb-gap-x' as string]: `${geom.gridGapX}rem`,
              ['--rb-gap-y' as string]: `${geom.gridGapY}rem`,
              ['--rb-max' as string]: `${geom.maxWidth}px`,
            }}
          >
            {/* One path, referenced once per mark in every field. */}
            <svg width="0" height="0" aria-hidden="true" focusable="false" className="rb-defs">
              <defs>
                <path id="rb-drop" d={F.d} />
              </defs>
            </svg>
            {ordered.map(({ yr, total, q, seq }) => (
              <div className="rb-year" key={yr}>
                <svg
                  viewBox={`0 0 ${F.fieldW.toFixed(1)} ${F.fieldH.toFixed(1)}`}
                  className="rb-field"
                  role="img"
                  aria-label={`${yr}: ${total > 0 ? fmtGallons(q) + ' gallons' : 'no volume recorded'}`}
                >
                  {Array.from({ length: F.cells }, (_, k) => (
                    <use
                      key={k}
                      href="#rb-drop"
                      // Filled from the bottom row up, the way a vessel fills.
                      x={((k % F.cols) * F.pitchX).toFixed(1)}
                      y={((F.rows - 1 - Math.floor(k / F.cols)) * F.pitchY).toFixed(1)}
                      fill={k < seq.length ? seq[k] : DROP_EMPTY}
                    />
                  ))}
                </svg>
                <p className="rb-year-lab">{yr}</p>
                <p className="rb-year-val">
                  {total > 0 ? fmtGallons(q) : <span className="rb-year-nil">no volume recorded</span>}
                </p>
              </div>
            ))}
          </div>
          <p className="rainbow-chart-note">
            {scale === 'vol' ? RAINBOW.fieldNoteVol(nums) : RAINBOW.fieldNoteShare}
            {/* In both scales, and whether or not 1961 has a field: the whole
                point is that the year is in the record carrying nothing, and
                hiding its field is exactly when that needs saying in words. */}
            {RAINBOW.fieldNoteNil(geom.hideEmpty)}
          </p>
          {FIELD_TUNE_GATE && (
            <Suspense fallback={null}>
              <RainFieldTuner geom={geom} onChange={setGeom} built={F} years={years} series={series} />
            </Suspense>
          )}
        </figure>
      </div>
    </section>
  )
}
