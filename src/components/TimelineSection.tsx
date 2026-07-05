import { useEffect, useRef } from 'react'
import { TL_AXIS, TL_MOMENTS, TL_SPANS, TIMELINE_HEAD } from '../content/actions/timeline'
import { SOURCES } from '../content/sources'

// Position on the overview bar's axis, in %.
const pct = (year: number) => ((year - TL_AXIS.min) / (TL_AXIS.max - TL_AXIS.min)) * 100

// Act II — "The Timeline": the programme as one readable arc, no interaction.
// An overview bar shows the three projects' spans on a shared 2009–2030 axis
// (colours matching their base cards), then a colour-coded spine walks the
// key moments top to bottom. Entries fade in as they enter the viewport.
export default function TimelineSection() {
  const listRef = useRef<HTMLOListElement>(null)
  const src = SOURCES[TIMELINE_HEAD.sourceId]

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const items = Array.from(list.children)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('is-seen'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-seen')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section className="story-fullscreen timeline-sec" id="sec-timeline" aria-label={TIMELINE_HEAD.title}>
      <div className="fs-inner tl-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{TIMELINE_HEAD.eyebrow}</p>
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

        {/* The spine: every moment visible, colour-coded by project. */}
        <ol className="tl-spine" ref={listRef}>
          {TL_MOMENTS.map((m, i) => (
            <li key={i} className={`tl-moment is-${m.project}`}>
              <span className="tl-moment-year">{m.year}</span>
              <i className="tl-moment-dot" aria-hidden="true" />
              <div className="tl-moment-body">
                <p className="tl-moment-tag">{m.tag}</p>
                {m.stat && (
                  <p className="tl-moment-stat">
                    <strong>{m.stat.value}</strong> {m.stat.label}
                  </p>
                )}
                <p className="tl-moment-text">{m.body}</p>
              </div>
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
