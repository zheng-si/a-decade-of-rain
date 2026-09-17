import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'

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

const REDUCED = '(prefers-reduced-motion: reduce)'
const reducedMotion = () => window.matchMedia(REDUCED).matches

/* Which cards have drawn, by id, kept outside React on purpose: a card that
   remounts after it has played shows the finished drawing, not a blank. */
const drawn = new Set<string>()

/** Hide every stroke ahead of its draw: dash each path to its own length and
 *  offset it fully. Inline styles, so with no JS nothing is hidden and the
 *  drawing simply shows. */
function prime(svg: SVGSVGElement) {
  for (const p of svg.querySelectorAll('path')) {
    const len = p.getTotalLength() + 1
    p.style.strokeDasharray = `${len} ${len}`
    p.style.strokeDashoffset = `${len}`
  }
}

/** Show the drawing complete: cancel any animation and drop the priming. */
function settle(svg: SVGSVGElement) {
  for (const a of svg.getAnimations({ subtree: true })) a.cancel()
  for (const p of svg.querySelectorAll('path')) {
    p.style.strokeDasharray = ''
    p.style.strokeDashoffset = ''
  }
}

/** The illustrator's timing, taken verbatim from the handoff. T = 1500ms.
 *  Phase g of G starts at g/(G+1) * T * 2/3, so phases overlap. Inside a phase
 *  a path with length L, out of the phase's total S and with P of that total
 *  drawn before it, starts at phaseStart + (P/S) * span * 0.72 and runs
 *  span * 0.28 + (L/S) * span * 0.72, capped so the last stroke ends at T:
 *  a long contour takes longer than a hatch mark and the whole reads as a hand
 *  drawing rather than a wipe. Linear easing, no fade, scale or movement. */
function draw(svg: SVGSVGElement, duration = 1500) {
  for (const a of svg.getAnimations({ subtree: true })) a.cancel()
  const phases = [...svg.querySelectorAll<SVGGElement>('g[data-phase]')]
  const groups: Element[] = phases.length ? phases : [svg]
  const animations: Animation[] = []
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
      animations.push(
        p.animate(
          [
            { strokeDasharray: `${len} ${len}`, strokeDashoffset: len },
            { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
          ],
          {
            duration: Math.min(span * 0.28 + (lengths[i] / sum) * span * 0.72, duration - delay),
            delay,
            easing: 'linear',
            fill: 'both',
          },
        ),
      )
      used += lengths[i]
    })
  })
  /* Once the last stroke lands, drop the priming and the animations both: the
     finished drawing is then the plain SVG, held by nothing. A browser is free
     to discard a finished fill-forward animation, and the drawing must not
     depend on whether it does. A cancel (settle, above) rejects `finished`;
     that case has already cleared the styles itself. */
  Promise.all(animations.map((a) => a.finished)).then(
    () => {
      for (const a of animations) a.cancel()
      for (const p of svg.querySelectorAll('path')) {
        p.style.strokeDasharray = ''
        p.style.strokeDashoffset = ''
      }
    },
    () => {},
  )
}

/** The card's sketch. Primed hidden on mount, drawn once the first time the
 *  card's step goes active (scrollama owns that), and left drawn: scrolling
 *  back does not replay it, nor does a remount. Under prefers-reduced-motion
 *  it simply shows, complete, and switching that on mid-play completes it.
 *
 *  memo, and a memoised innerHTML object, and both matter. Story re-renders on
 *  every scroll and map event, and React re-applies dangerouslySetInnerHTML
 *  whenever it is handed a NEW {__html} object -- which replaces the <svg>
 *  node, and with it the primed styles and every running animation. Measured:
 *  the node this component primed was never the node in the DOM a second
 *  later. Same object, same node. */
function CardSketch({ id, active }: { id: string; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const svg = ART[id]
  const html = useMemo(() => ({ __html: svg }), [svg])

  /* One layout effect for both the priming and the draw, in that order, so
     the order cannot depend on effect scheduling: prime on the first pass,
     draw the first time the card is active. A layout effect, not a passive
     one, because the draw belongs to the same commit as the card's is-active
     class; a passive effect waits for the paint, and with the map mid-flight
     that wait measured over a second. */
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('svg')
    if (!el) return
    if (drawn.has(id)) {
      /* A card that has already played. In dev, StrictMode mounts twice and
         this is the same node, mid-draw: leave it. A real remount is a fresh
         node with no animations on it: show it complete. */
      if (el.getAnimations({ subtree: true }).length === 0) settle(el)
      return
    }
    if (reducedMotion()) {
      settle(el)
      return
    }
    if (!el.dataset.primed) {
      prime(el)
      el.dataset.primed = '1'
    }
    if (!active) return
    drawn.add(id)
    draw(el)
  }, [active, id])

  useEffect(() => {
    const node = ref.current
    const mq = window.matchMedia(REDUCED)
    const onChange = () => {
      const el = node?.querySelector('svg')
      if (el && mq.matches) settle(el)
    }
    mq.addEventListener('change', onChange)
    /* No cancel on unmount: a discarded node takes its animations with it, and
       cancelling here would kill the first card's draw under StrictMode's
       simulated unmount in dev. */
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!svg) return null
  return <div ref={ref} className="story-art" aria-hidden="true" dangerouslySetInnerHTML={html} />
}

export default memo(CardSketch)
