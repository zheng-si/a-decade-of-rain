import { useState } from 'react'
import { METHODS, METHODS_HEAD, type Method } from '../content/actions/methods'

// Leader-line geometry, % of the diagram box. Labels live in the left column;
// each line runs from the label's edge to a point inside the diagram.
const LABEL_COL = 34 // % width reserved for labels
const LINE_END = 58 // % where the leader line ends, inside the image

type Key = Method['key']

function Diagram({ m, open }: { m: Method; open: boolean }) {
  const [hot, setHot] = useState<number | null>(null)

  return (
    <div className="method-diagram">
      <img src={m.img} alt={m.imgAlt} loading="lazy" />

      <svg className="method-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {open &&
          m.layers.map((l, i) => (
            <line
              key={i}
              className={hot === i ? 'is-hot' : undefined}
              x1={LABEL_COL}
              y1={l.y}
              x2={l.endX ?? LINE_END}
              y2={l.y}
            />
          ))}
      </svg>
      {open &&
        m.layers.map((l, i) => (
          <i
            key={i}
            className={`method-dot${hot === i ? ' is-hot' : ''}`}
            style={{ left: `${l.endX ?? LINE_END}%`, top: `${l.y}%` }}
            aria-hidden="true"
          />
        ))}

      {open && (
        <ul className="method-labels">
          {m.layers.map((l, i) => (
            <li
              key={i}
              className={hot === i ? 'is-hot' : undefined}
              style={{ top: `${l.y}%` }}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
            >
              {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Act II — the two retained methods as an expanding pair of panels. At rest
// both exploded views sit side by side, unannotated; activating one (tab or
// panel) stretches it wide, floods it with the method's theme gradient and
// brings in the intro text and the layer-by-layer leader labels.
export default function MethodsSection() {
  const [active, setActive] = useState<Key | null>(null)

  return (
    <section className="story-fullscreen methods" id="sec-methods" aria-label={METHODS_HEAD.title}>
      <div className="fs-inner methods-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{METHODS_HEAD.eyebrow}</p>
          <h2 className="fs-title">{METHODS_HEAD.title}</h2>
          <p className="fs-dek">{METHODS_HEAD.dek}</p>
        </header>

        <div className="method-tabs" role="tablist" aria-label="Remediation methods">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active === m.key}
              className={`method-tab is-${m.key}${active === m.key ? ' is-on' : ''}`}
              onClick={() => setActive((a) => (a === m.key ? null : m.key))}
            >
              <i className="method-tab-dot" aria-hidden="true" />
              {m.title}
            </button>
          ))}
        </div>

        <div className={`methods-stage${active ? ' has-open' : ''}`}>
          {METHODS.map((m) => {
            const open = active === m.key
            const shut = active !== null && !open
            return (
              <div
                key={m.key}
                className={`method-panel is-${m.key}${open ? ' is-open' : ''}${shut ? ' is-shut' : ''}`}
                role="button"
                tabIndex={shut || !active ? 0 : -1}
                aria-expanded={open}
                onClick={() => {
                  if (!open) setActive(m.key)
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !open) {
                    e.preventDefault()
                    setActive(m.key)
                  }
                }}
              >
                <span className="method-side" aria-hidden="true">
                  {m.title}
                </span>

                <div className="method-inner">
                  {open ? (
                    <div className="method-open-grid">
                      <div className="method-copy">
                        <h3>{m.title}</h3>
                        <p>{m.body}</p>
                        <p className="method-cap">{m.caption}</p>
                      </div>
                      <Diagram m={m} open />
                    </div>
                  ) : (
                    <div className="method-rest">
                      <h3>{m.title}</h3>
                      <Diagram m={m} open={false} />
                      <p className="method-hint">Click to explore the layers</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
