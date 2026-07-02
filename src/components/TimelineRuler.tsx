import { memo, useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  /** Cumulative gallons at the end of each month, from January of yearStart. */
  monthlyCum: number[]
  yearStart: number
  /** Each node's position on the ruler (0–1), by its playhead date. */
  nodeFracs: number[]
  /** The currently active story node (highlighted on the axis). */
  activeIndex: number
  fmt: (v: number) => string
  /** The scrolling story container, used to derive continuous progress. */
  storyRef: { current: HTMLElement | null }
  started: boolean
}

const H = 1000
const CHART_W = 100

// Static year lines + month ticks. Memoised so per-scroll-frame updates don't
// re-reconcile ~140 SVG nodes.
const RulerGrid = memo(function RulerGrid({ n }: { n: number }) {
  const years: number[] = []
  for (let y = 0; y * 12 < n; y++) years.push(y)
  return (
    <svg className="timeline-grid" viewBox={`0 0 ${CHART_W} ${H}`} preserveAspectRatio="none">
      {Array.from({ length: n }, (_, i) => (
        <line
          key={`m${i}`}
          x1="0"
          x2="2.4"
          y1={((i + 0.5) / n) * H}
          y2={((i + 0.5) / n) * H}
          stroke="rgba(33,53,40,0.22)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {years.map((y) => (
        <line
          key={`y${y}`}
          x1="0"
          x2={CHART_W}
          y1={((y * 12) / n) * H}
          y2={((y * 12) / n) * H}
          stroke="rgba(33,53,40,0.13)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
})

// Year labels — sit just above each year line, right of the axis. Memoised.
const RulerYears = memo(function RulerYears({ n, yearStart }: { n: number; yearStart: number }) {
  const years: number[] = []
  for (let y = 0; y * 12 < n; y++) years.push(y)
  return (
    <div className="timeline-years">
      {years.map((y) => (
        <span key={y} className="timeline-year" style={{ top: `${((y * 12) / n) * 100}%` }}>
          {yearStart + y}
        </span>
      ))}
    </div>
  )
})

// A full-height ruler: the whole 1961–1971 span at a uniform monthly scale, with
// cumulative spray volume as a stacked area that widens downward. The scan line
// is anchored to the story nodes' dates (it lands on a node's dot when that
// card is active) and only the area above it is revealed.
export default function TimelineRuler({
  monthlyCum,
  yearStart,
  nodeFracs,
  activeIndex,
  fmt,
  storyRef,
  started,
}: Props) {
  const [pos, setPos] = useState(0)
  const [vh, setVh] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const el = storyRef.current
      if (!el) return
      const vhv = window.innerHeight
      setVh(vhv)
      const steps = Array.from(document.querySelectorAll<HTMLElement>('.story-step'))
      if (!steps.length) {
        setPos(0)
        return
      }
      // Piecewise map from scroll to ruler fraction, anchored at each node's
      // step-centre so the scan line meets the node's dot when it's active.
      const focus = window.scrollY + 0.6 * vhv
      const xs = [0]
      const ys = [0]
      for (let i = 0; i < steps.length; i++) {
        const r = steps[i].getBoundingClientRect()
        xs.push(r.top + window.scrollY + r.height / 2)
        ys.push(nodeFracs[i] ?? i / Math.max(1, steps.length - 1))
      }
      let frac: number
      if (focus <= xs[0]) frac = ys[0]
      else if (focus >= xs[xs.length - 1]) frac = ys[ys.length - 1]
      else {
        let k = 1
        while (k < xs.length && xs[k] < focus) k++
        const x0 = xs[k - 1]
        const x1 = xs[k]
        const t = x1 > x0 ? (focus - x0) / (x1 - x0) : 0
        frac = ys[k - 1] + (ys[k] - ys[k - 1]) * t
      }
      setPos(frac)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        rafRef.current = requestAnimationFrame(update)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [storyRef, nodeFracs])

  const n = monthlyCum.length

  // Stepped cumulative area (static geometry).
  const areaPath = useMemo(() => {
    if (!n) return ''
    const maxCum = monthlyCum[n - 1] || 1
    let d = 'M 0 0'
    for (let i = 0; i < n; i++) {
      const y0 = (i / n) * H
      const y1 = ((i + 1) / n) * H
      const x = (monthlyCum[i] / maxCum) * CHART_W
      d += ` L ${x.toFixed(2)} ${y0.toFixed(2)} L ${x.toFixed(2)} ${y1.toFixed(2)}`
    }
    d += ` L 0 ${H} Z`
    return d
  }, [monthlyCum, n])

  if (!n) return null

  const fpos = pos * (n - 1)
  const i0 = Math.floor(fpos)
  const frac = fpos - i0
  const vol = monthlyCum[i0] + ((monthlyCum[Math.min(i0 + 1, n - 1)] ?? monthlyCum[i0]) - monthlyCum[i0]) * frac

  const clampPx = 34
  const scanTop = vh ? `${Math.min(vh - clampPx, Math.max(clampPx, pos * vh))}px` : `${pos * 100}%`
  const reveal = `inset(0 0 ${((1 - pos) * 100).toFixed(2)}% 0)`

  return (
    <aside className={`timeline-ruler${started ? ' is-visible' : ''}`} aria-hidden="true">
      <RulerGrid n={n} />
      <svg
        className="timeline-area"
        viewBox={`0 0 ${CHART_W} ${H}`}
        preserveAspectRatio="none"
        style={{ clipPath: reveal, WebkitClipPath: reveal }}
      >
        <defs>
          <linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,84,73,0.5)" />
            <stop offset="100%" stopColor="rgba(255,84,73,0.9)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#tl-area)" />
      </svg>
      <RulerYears n={n} yearStart={yearStart} />
      <div className="timeline-nodes">
        {nodeFracs.map((f, i) => (
          <span
            key={i}
            className={`timeline-node${i === activeIndex ? ' is-active' : ''}`}
            style={{ top: `${f * 100}%` }}
          />
        ))}
      </div>
      <div className="timeline-scan" style={{ top: scanTop }}>
        <div className="timeline-scan-vol">
          <span className="timeline-scan-num">{fmt(vol)}</span>
          <span className="timeline-scan-unit">gallons sprayed</span>
        </div>
        <span className="timeline-scan-line" />
      </div>
    </aside>
  )
}
