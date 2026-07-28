import { useEffect, useRef } from 'react'
import { TL_AXIS, TL_MOMENTS, TL_SPANS, TIMELINE_HEAD } from '../content/actions/timeline'
import { SOURCES } from '../content/sources'

// Position on the overview bar's axis, in %.
const pct = (year: number) => ((year - TL_AXIS.min) / (TL_AXIS.max - TL_AXIS.min)) * 100

// Act II — "The Timeline": the programme as one readable arc, no interaction.
// An overview bar shows the three projects' spans on a shared 2009–2030 axis
// (colours matching their base cards), then a colour-coded card grid walks
// the key moments in reading order. Cards fade in as they enter the viewport.
export default function TimelineSection() {
  const gridRef = useRef<HTMLOListElement>(null)
  const src = SOURCES[TIMELINE_HEAD.sourceId]

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const items = Array.from(grid.children) as HTMLElement[]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('is-seen'))
      return
    }
    // Stagger within a row: delay follows the card's index.
    items.forEach((el, i) => el.style.setProperty('--tl-delay', `${(i % 4) * 70}ms`))
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-seen')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section className="story-fullscreen timeline-sec" id="sec-timeline" aria-label={TIMELINE_HEAD.title}>
      <div className="fs-inner tl-inner">
        <header className="fs-head">
          <h2 className="fs-title">{TIMELINE_HEAD.title}</h2>
          <p className="fs-dek">{TIMELINE_HEAD.dek}</p>
        </header>

        {/* Overview: the three projects' spans on one axis. The ongoing bar
            fades out to the right instead of ending. */}
        <figure className="tl-bands" aria-label="The three projects on one axis">
          <div className="tl-bands-grid">
            {TL_AXIS.ticks.map((t) => (
              <i key={t} className="tl-tick" style={{ left: `${pct(t)}%` }} aria-hidden="true">
                <em>{t}</em>
              </i>
            ))}
            {TL_SPANS.map((s) => (
              <div key={s.key} className="tl-band-row">
                <span className="tl-band-name">{s.name}</span>
                <div
                  className={`tl-band is-${s.key}${s.ongoing ? ' is-open' : ''}${s.end - s.start <= 2 ? ' is-slim' : ''}`}
                  style={{ left: `${pct(s.start)}%`, width: `${pct(s.ongoing ? s.end + 1 : s.end) - pct(s.start)}%` }}
                >
                  <span className="tl-band-status">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </figure>

        {/* The moments: a colour-coded card grid, read like text. */}
        <ol className="tl-cards" ref={gridRef}>
          {TL_MOMENTS.map((m, i) => (
            <li key={i} className={`tl-card is-${m.project}${m.milestone ? ' is-invert' : ''}`}>
              <div className="tl-card-head">
                <span className="tl-card-year">{m.year}</span>
                <p className="tl-card-tag">{m.tag}</p>
              </div>
              {m.stat && (
                <p className="tl-card-stat">
                  <strong>{m.stat.value}</strong>
                  <span>{m.stat.label}</span>
                </p>
              )}
              <p className="tl-card-text">{m.body}</p>
            </li>
          ))}
        </ol>

        <p className="fs-note">
          {TIMELINE_HEAD.note}{' '}
          {src && (
            <a href={src.url} target="_blank" rel="noreferrer">
              {src.publisher}
            </a>
          )}
        </p>
      </div>
    </section>
  )
}
