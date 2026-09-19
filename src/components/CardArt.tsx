import { memo, useEffect, useRef } from 'react'
import { CARD_ART, CARD_ART_PARTS, CARD_ART_STYLE } from '../figures/cards'
import { MASTER_MS, mountMotion, type Motion } from './cardArtMotion'

/* The illustration at the top of a story card: a 3:2 frame (.story-art in
   Story.css) holding the card's picture, fitted `contain`. Two styles were
   drawn and src/figures/cards names the one this build ships:

   B is one transparent picture per card, and it simply sits there: no
   entrance, no drift, nothing to reduce.

   C is a transparent base picture with an SVG of moving parts laid over the
   same frame (cardArtMotion.ts). Each card plays once, the first time it
   is active, and then holds its resting picture; scrolling back does not
   replay it, nor does a remount. A play interrupted (the card left, the tab
   hidden) pauses and resumes where it stopped. Under prefers-reduced-motion
   the resting picture shows and nothing plays.

   The picture carries no alt: the card's own text is its description. */

const REDUCED = '(prefers-reduced-motion: reduce)'

/* Cards whose play has finished, kept outside React on purpose: a card that
   remounts after it has played shows its resting picture. */
const played = new Set<string>()

function CardArt({ id, active }: { id: string; active: boolean }) {
  const src = CARD_ART[id]
  const svgRef = useRef<SVGSVGElement>(null)
  const motion = useRef<Motion | null>(null)
  /* time: how far into the play this card is, in ms; origin: the timestamp
     the running play started from, less that time, so a resumed play
     continues where it paused. Wall-clock, not summed frame gaps: a slow
     frame (a busy map, a throttled tab) then skips ahead instead of
     stretching the play. */
  const clock = useRef({ time: 0, origin: 0, raf: 0 })

  /* C: build the overlay once per card, at its first frame or, for a card
     that has played, at rest. */
  useEffect(() => {
    if (CARD_ART_STYLE !== 'c') return
    const svg = svgRef.current
    if (!svg) return
    const m = mountMotion(svg, id, CARD_ART_PARTS)
    motion.current = m
    if (m) {
      if (played.has(id) || window.matchMedia(REDUCED).matches) m.rest()
      else m.paint(0)
    }
    return () => {
      motion.current = null
      svg.replaceChildren()
    }
  }, [id])

  /* C: the clock. Runs while the card is active and the page visible, up
     to the scene's end, then paints the rest and stops for good. One
     requestAnimationFrame loop at a time: the page has one active card. */
  useEffect(() => {
    if (CARD_ART_STYLE !== 'c') return
    const m = motion.current
    if (!m) return
    const c = clock.current
    const mq = window.matchMedia(REDUCED)
    const stop = () => {
      if (c.raf) cancelAnimationFrame(c.raf)
      c.raf = 0
    }
    const finish = () => {
      stop()
      played.add(id)
      m.rest()
    }
    const frame = (now: number) => {
      c.time = now - c.origin
      if (c.time >= m.end * MASTER_MS) {
        finish()
        return
      }
      m.paint(c.time / MASTER_MS)
      c.raf = requestAnimationFrame(frame)
    }
    const sync = () => {
      stop()
      if (played.has(id)) return
      if (mq.matches) {
        finish()
        return
      }
      if (!active || document.hidden) return
      c.origin = performance.now() - c.time
      c.raf = requestAnimationFrame(frame)
    }
    sync()
    mq.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      stop()
      mq.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [active, id])

  if (!src) return null
  return (
    <div className="story-art" data-style={CARD_ART_STYLE}>
      <img src={src} alt="" width={1536} height={1024} decoding="async" loading={id === 'begins' ? 'eager' : 'lazy'} />
      {CARD_ART_STYLE === 'c' && <svg ref={svgRef} viewBox="0 0 1536 1024" aria-hidden="true" />}
    </div>
  )
}

export default memo(CardArt)
