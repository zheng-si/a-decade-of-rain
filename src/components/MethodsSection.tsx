import { useState } from 'react'
import { METHODS, METHODS_HEAD, type Method } from '../content/actions/methods'

type Key = Method['key']

// The labelled exploded figure is the designer's own artwork (diagram +
// leaders + labels baked in), shown on a paper card so its dark labels read.
function Diagram({ m }: { m: Method }) {
  return (
    <figure className="method-diagram">
      <img className="method-figure" src={m.figure} alt={m.figureAlt} loading="lazy" />
    </figure>
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
                      <Diagram m={m} />
                    </div>
                  ) : active === null ? (
                    <div className="method-rest">
                      <img className="method-photo" src={m.photo} alt="" loading="lazy" />
                      <div className="method-rest-veil" aria-hidden="true" />
                      <div className="method-rest-copy">
                        <div>
                          <h3>{m.title}</h3>
                          <p className="method-tagline">{m.tagline}</p>
                        </div>
                        <p className="method-hint">Click to explore the layers →</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
