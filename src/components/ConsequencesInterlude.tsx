import { Fragment, useState } from 'react'
import { WALLS, type ConsequenceWall } from '../content/interlude/consequences'
import { SOURCES } from '../content/sources'

// One full-page photo wall. Sensitive walls (the health toll) blur every photo
// by default behind a single consent toggle — reveal only on the reader's say-so.
function Wall({ w }: { w: ConsequenceWall }) {
  const [revealed, setRevealed] = useState(false)
  const srcs = (w.sourceIds ?? []).map((id) => SOURCES[id]).filter(Boolean)
  const blurred = Boolean(w.sensitive && !revealed)

  return (
    <section id={`sec-${w.key}`} className={`story-fullscreen interlude-wall is-${w.theme}`} aria-label={w.label}>
      <div className="wall-inner">
        <div className="wall-lead">
          <p className="wall-value">{w.value}</p>
          <p className="wall-label">{w.label}</p>
          {w.stats && (
            <ul className="wall-stats">
              {w.stats.map((s, i) => (
                <li key={i}>
                  <span className="wall-stat-v">{s.value}</span>
                  <span className="wall-stat-l">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="wall-lede">{w.lede}</p>
          {w.lede2 && <p className="wall-lede">{w.lede2}</p>}
          {srcs.length > 0 && (
            <p className="wall-srcs">
              {srcs.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  <a className="wall-src" href={s.url} target="_blank" rel="noreferrer">
                    {s.publisher}
                  </a>
                </Fragment>
              ))}
            </p>
          )}

          {w.sensitive && (
            <div className="wall-consent">
              <p>{w.warning}</p>
              <button
                type="button"
                className="wall-consent-btn"
                aria-pressed={revealed}
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? 'Blur photographs' : 'Show photographs'}
              </button>
            </div>
          )}
        </div>

        <div className={`wall-grid${blurred ? ' is-blurred' : ''}`}>
          {w.photos.map((p, i) => (
            <figure key={i} className="wall-tile">
              <img src={p.src} alt={p.alt} loading="lazy" />
              <figcaption className="wall-cap">
                <span>{p.caption}</span>
                {p.credit && <em>{p.credit}</em>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// Interlude — "The Consequences": two full-page photo walls (the land, in green;
// the body, in orange). Built for impact.
export default function ConsequencesInterlude() {
  return (
    <>
      {WALLS.map((w) => (
        <Wall key={w.key} w={w} />
      ))}
    </>
  )
}
