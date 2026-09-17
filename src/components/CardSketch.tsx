import { useEffect, useRef } from 'react'

/* One line drawing per story card, inlined so its strokes can be drawn on.
   Vite hands back each file's text. The SVGs are viewBox 600x400, fill="none"
   stroke="currentColor", their paths grouped in <g data-phase> in the order
   they should appear (ground, then subject, then detail). Width and colour
   are the card's business, set in CSS (.story-art). */
const RAW = import.meta.glob('../figures/cards/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const ART: Record<string, string> = {}
for (const [path, svg] of Object.entries(RAW)) ART[path.replace(/^.*\//, '').replace(/\.svg$/, '')] = svg

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hide every stroke: dash each path to its own length and offset it fully. */
function prime(svg: SVGSVGElement) {
  for (const p of svg.querySelectorAll('path')) {
    const len = p.getTotalLength() + 1
    p.style.strokeDasharray = `${len} ${len}`
    p.style.strokeDashoffset = `${len}`
  }
}

/** Draw the strokes on, phase by phase, a long stroke taking longer than a
 *  short one so it reads as a hand moving rather than a wipe. About 1.4s. */
function draw(svg: SVGSVGElement, duration = 1400) {
  const phases = [...svg.querySelectorAll<SVGGElement>('g[data-phase]')]
  const groups: Element[] = phases.length ? phases : [svg]
  groups.forEach((group, index) => {
    const paths = [...group.querySelectorAll('path')]
    const lengths = paths.map((p) => p.getTotalLength())
    const sum = lengths.reduce((a, b) => a + b, 0)
    if (!sum) return
    const start = (index / (groups.length + 1)) * duration * (2 / 3)
    const span = duration - start
    let used = 0
    paths.forEach((p, i) => {
      const len = lengths[i] + 1
      const delay = start + (used / sum) * span * 0.72
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
        duration: Math.min(span * 0.28 + (lengths[i] / sum) * span * 0.72, duration - delay),
        delay,
        easing: 'linear',
        fill: 'forwards',
      })
      used += lengths[i]
    })
  })
}

/** The card's sketch. Primed hidden on mount, drawn once the first time the
 *  card goes active, and left drawn: scrolling back does not replay it.
 *  Under prefers-reduced-motion it simply shows, complete. */
export default function CardSketch({ id, active }: { id: string; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const drawn = useRef(false)
  const svg = ART[id]

  useEffect(() => {
    const el = ref.current?.querySelector('svg')
    if (!el || reducedMotion()) return
    prime(el)
  }, [])

  useEffect(() => {
    if (!active || drawn.current) return
    const el = ref.current?.querySelector('svg')
    if (!el) return
    drawn.current = true
    if (reducedMotion()) return
    draw(el)
  }, [active])

  if (!svg) return null
  return <div ref={ref} className="story-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}
