import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

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
const BARS_W = 120 // widest bar, in px, inside the panel
const PANEL_LEFT = 16
const PANEL_MY = 16 // top / bottom margin
const CARD_LEFT = 240 // matches .story-step padding-left

// Tick marks at every month boundary; year boundaries are twice as long. Memoised.
const RulerTicks = memo(function RulerTicks({ n }: { n: number }) {
  const ticks = []
  for (let i = 0; i <= n; i++) {
    const isYear = i % 12 === 0
    const y = (i / n) * H
    ticks.push(
      <line
        key={i}
        x1="0"
        x2={isYear ? 12 : 6}
        y1={y}
        y2={y}
        stroke={isYear ? 'rgba(33,53,40,0.5)' : 'rgba(33,53,40,0.24)'}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />,
    )
  }
  return (
    <svg className="timeline-ticks" viewBox="0 0 16 1000" preserveAspectRatio="none">
      {ticks}
    </svg>
  )
})

// Year labels — sit just above each year tick. Memoised.
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

// A floating full-height panel: the whole 1961–1971 span at a uniform monthly
// scale, cumulative spray volume as a stacked area, orange node triangles on the
// axis, and a scan line whose length tracks the bar under it. When a node is
// active, a connector animates out toward the card.
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

  const maxCum = monthlyCum[n - 1] || 1
  const fpos = pos * (n - 1)
  const i0 = Math.floor(fpos)
  const frac = fpos - i0
  const vol = monthlyCum[i0] + ((monthlyCum[Math.min(i0 + 1, n - 1)] ?? monthlyCum[i0]) - monthlyCum[i0]) * frac
  const barTip = Math.max(2, (vol / maxCum) * BARS_W)

  const panelH = Math.max(1, vh - 2 * PANEL_MY)
  const clampPx = 26
  const clampY = (f: number) => Math.min(panelH - clampPx, Math.max(clampPx, f * panelH))
  const scanY = vh ? clampY(pos) : 0
  const hasActive = vh > 0 && started && activeIndex >= 0 && activeIndex < nodeFracs.length
  const reveal = `inset(0 0 ${((1 - pos) * 100).toFixed(2)}% 0)`
  const vis = started ? ' is-visible' : ''

  // Diagonal connector from the active node's triangle to the card's centre.
  const cx1 = PANEL_LEFT + 12
  const cy1 = hasActive ? PANEL_MY + clampY(nodeFracs[activeIndex]) : 0
  const cx2 = CARD_LEFT
  const cy2 = vh * 0.5
  const cLen = Math.hypot(cx2 - cx1, cy2 - cy1)
  const cAng = (Math.atan2(cy2 - cy1, cx2 - cx1) * 180) / Math.PI

  return (
    <aside className={`timeline-ruler${vis}`} aria-hidden="true">
      <div className="timeline-panel">
        {/* Clipped face holds the bars, ticks, labels and node markers. */}
        <div className="timeline-panel-face">
          <svg
            className="timeline-area"
            viewBox={`0 0 ${CHART_W} ${H}`}
            preserveAspectRatio="none"
            style={{ clipPath: reveal, WebkitClipPath: reveal }}
          >
            <defs>
              <linearGradient id="tl-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,84,73,0.5)" />
                <stop offset="100%" stopColor="rgba(255,84,73,0.92)" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#tl-area)" />
          </svg>
          <RulerTicks n={n} />
          <div className="timeline-nodes">
            {nodeFracs.map((f, i) => (
              <span
                key={i}
                className={`timeline-node${i === activeIndex ? ' is-active' : ''}`}
                style={{ top: `${f * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Year labels sit outside the clipped face so the top one isn't cut. */}
        <RulerYears n={n} yearStart={yearStart} />

        {/* Overhanging elements (not clipped): scan line, chip, connector. */}
        <span className="timeline-scan-line" style={{ top: `${scanY}px`, width: `${barTip}px` }} />
        <div className="timeline-cursor" style={{ top: `${scanY}px`, left: `${barTip}px` }}>
          <div className="timeline-scan-vol">
            <span className="timeline-scan-num">{fmt(vol)}</span>
            <span className="timeline-scan-unit">gallons sprayed</span>
          </div>
        </div>
      </div>
      {hasActive && (
        <span
          key={activeIndex}
          className="timeline-connector"
          style={
            {
              left: `${cx1}px`,
              top: `${cy1 - 1}px`,
              width: `${cLen}px`,
              '--ang': `${cAng}deg`,
            } as CSSProperties
          }
        />
      )}
    </aside>
  )
}
