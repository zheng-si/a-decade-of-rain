import { useEffect, useRef } from 'react'
import { CLOSE_ACTIONS, CLOSE_HEAD, COLOPHON, REF_GROUPS } from '../content/close'
import { SOURCES } from '../content/sources'
import Logo from './Logo'

// The hook's rain, winding down: sparse pale drops that thin out over ~14s
// once the section is on screen, settling to a last occasional drizzle.
// Same single-canvas approach as RainCanvas (no DOM-node animation storm).
function ClosingRain() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    interface Drop {
      x: number
      y: number
      len: number
      sp: number
      a: number
    }
    let drops: Drop[] = []
    const spawn = (anywhere: boolean): Drop => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -30,
      len: 10 + Math.random() * 40,
      sp: 380 + Math.random() * 420,
      a: 0.05 + Math.random() * 0.22,
    })
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drops = Array.from({ length: Math.max(16, Math.round((w * h) / 42000)) }, () => spawn(true))
    }

    let raf = 0
    let last = 0
    let elapsed = 0
    let running = false
    const frame = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
      last = t
      elapsed += dt
      // Wind down over ~14s, then hold a last sparse drizzle.
      const intensity = Math.max(0.07, 1 - elapsed / 14)
      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'
      for (const d of drops) {
        d.y += d.sp * dt
        if (d.y - d.len > h) {
          // Fewer drops respawn as the rain dies off.
          if (Math.random() < intensity) Object.assign(d, spawn(false))
          else d.y = h + d.len + 1e6 // parked off-screen
        }
        ctx.strokeStyle = `rgba(214, 232, 220, ${(d.a * intensity).toFixed(3)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x, d.y - d.len)
        ctx.stroke()
      }
      raf = requestAnimationFrame(frame)
    }

    // Start only once the section is actually on screen.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !running) {
          running = true
          resize()
          raf = requestAnimationFrame(frame)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(canvas)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="close-rain" aria-hidden="true" />
}

// Epilogue: the bookend. A dark, quiet close (the rain stopping), verified
// ways to act, then the full sources ledger and colophon on paper.
export default function CloseSection() {
  return (
    <>
      <section className="story-fullscreen close-hero" id="sec-close" aria-label="Epilogue">
        <ClosingRain />
        <div className="fs-inner close-hero-inner">
          <h2 className="close-statement">{CLOSE_HEAD.statement}</h2>
          <p className="close-body">{CLOSE_HEAD.body}</p>

          <ul className="close-actions">
            {CLOSE_ACTIONS.map((a) => (
              <li key={a.name}>
                <a className="close-action" href={a.url} target="_blank" rel="noreferrer">
                  <p className="close-action-role">{a.role}</p>
                  <h3 className="close-action-name">{a.name}</h3>
                  <p className="close-action-desc">{a.desc}</p>
                  <p className="close-action-cta">
                    {a.action} <span aria-hidden="true">↗</span>
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="story-fullscreen close-sources" id="sec-sources" aria-label="Notes and sources">
        <div className="fs-inner close-sources-inner">
          <header className="fs-head">
            <h2 className="fs-title">Where This Story Comes From</h2>
          </header>

          <div className="close-refs">
            {REF_GROUPS.map((g) => (
              <div key={g.title} className="close-ref-group">
                <h3>{g.title}</h3>
                <ul>
                  {g.sourceIds?.map((id) => {
                    const s = SOURCES[id]
                    if (!s) return null
                    return (
                      <li key={id}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                        <span className="close-ref-pub"> · {s.publisher}</span>
                      </li>
                    )
                  })}
                  {g.lines?.map((l, i) => (
                    <li key={`l${i}`}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <footer className="close-colophon">
            {COLOPHON.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            <p className="close-credit">{COLOPHON.credit}</p>
            <p className="close-email">
              <a href={`mailto:${COLOPHON.email}`}>{COLOPHON.email}</a>
            </p>
            <div className="close-mark" aria-hidden="true">
              <Logo />
              <span>A Decade of Rain</span>
            </div>

            <button
              type="button"
              className="close-top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <span aria-hidden="true">↑</span> Back to top
            </button>
          </footer>
        </div>
      </section>
    </>
  )
}
