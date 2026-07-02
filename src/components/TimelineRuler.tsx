import { memo, useEffect, useRef, useState } from 'react'

interface Props {
  /** Cumulative gallons at the end of each month, from January of yearStart. */
  monthlyCum: number[]
  yearStart: number
  fmt: (v: number) => string
  /** The scrolling story container, used to derive continuous progress. */
  storyRef: { current: HTMLElement | null }
  started: boolean
}

const H = 1000
const CHART_W = 100

// The static part of the ruler (year labels + stepped cumulative area). Memoised
// so the per-scroll-frame scan updates don't re-reconcile ~140 SVG nodes.
const RulerChart = memo(function RulerChart({ monthlyCum, yearStart }: { monthlyCum: number[]; yearStart: number }) {
  const N = monthlyCum.length
  const maxCum = monthlyCum[N - 1] || 1

  let d = 'M 0 0'
  for (let i = 0; i < N; i++) {
    const y0 = (i / N) * H
    const y1 = ((i + 1) / N) * H
    const x = (monthlyCum[i] / maxCum) * CHART_W
    d += ` L ${x.toFixed(2)} ${y0.toFixed(2)} L ${x.toFixed(2)} ${y1.toFixed(2)}`
  }
  d += ` L 0 ${H} Z`

  const years: number[] = []
  for (let y = 0; y * 12 < N; y++) years.push(y)

  return (
    <>
      <div className="timeline-years">
        {years.map((y) => (
          <span key={y} className="timeline-year" style={{ top: `${((y * 12) / N) * 100}%` }}>
            {yearStart + y}
          </span>
        ))}
      </div>

      <svg className="timeline-chart" viewBox={`0 0 ${CHART_W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,84,73,0.45)" />
            <stop offset="100%" stopColor="rgba(255,84,73,0.92)" />
          </linearGradient>
        </defs>
        {monthlyCum.map((_, i) => (
          <line
            key={`m${i}`}
            x1="0"
            x2="3.5"
            y1={((i + 0.5) / N) * H}
            y2={((i + 0.5) / N) * H}
            stroke="rgba(33,53,40,0.18)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {years.map((y) => (
          <line
            key={`y${y}`}
            x1="0"
            x2={CHART_W}
            y1={((y * 12) / N) * H}
            y2={((y * 12) / N) * H}
            stroke="rgba(33,53,40,0.14)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={d} fill="url(#tl-area)" />
      </svg>
    </>
  )
})

// A full-height ruler: the whole 1961–1971 span is drawn at a uniform monthly
// scale, with each month's cumulative spray volume as a horizontal bar (so the
// area widens downward). A scan line tracks the reader's scroll position and
// reads out the running total.
export default function TimelineRuler({ monthlyCum, yearStart, fmt, storyRef, started }: Props) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const el = storyRef.current
      if (!el) return
      const vh = window.innerHeight
      const rect = el.getBoundingClientRect()
      const total = rect.height - vh
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0
      setProgress(p)
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
  }, [storyRef])

  if (!monthlyCum.length) return null

  const N = monthlyCum.length
  const fpos = progress * (N - 1)
  const i0 = Math.floor(fpos)
  const frac = fpos - i0
  const vol = monthlyCum[i0] + ((monthlyCum[Math.min(i0 + 1, N - 1)] ?? monthlyCum[i0]) - monthlyCum[i0]) * frac

  return (
    <aside className={`timeline-ruler${started ? ' is-visible' : ''}`} aria-hidden="true">
      <RulerChart monthlyCum={monthlyCum} yearStart={yearStart} />
      <div className="timeline-scan" style={{ top: `${progress * 100}%` }}>
        <span className="timeline-scan-line" />
        <div className="timeline-scan-vol">
          <span className="timeline-scan-num">{fmt(vol)}</span>
          <span className="timeline-scan-unit">gallons</span>
        </div>
      </div>
    </aside>
  )
}
