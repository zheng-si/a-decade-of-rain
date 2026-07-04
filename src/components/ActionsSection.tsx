import { useState } from 'react'
import { ACTIONS, HOTSPOTS, type HotspotKey } from '../content/actions/hotspots'
import { SOURCES } from '../content/sources'
import ActionsMap from './ActionsMap'

// Act II, "The Actions": the present-day cleanup, told through the three dioxin
// hotspot air bases. Cards on the left, locator map on the right; clicking a
// map pin highlights and scrolls to the matching card.
export default function ActionsSection() {
  const [active, setActive] = useState<HotspotKey | null>(null)

  const select = (key: HotspotKey) => {
    const next = active === key ? null : key
    setActive(next)
    if (next) {
      document
        .getElementById(`act2-card-${key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  return (
    <section className="story-fullscreen actions" id="sec-actions" aria-label={ACTIONS.title}>
      <div className="fs-inner act2-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{ACTIONS.eyebrow}</p>
          <h2 className="fs-title">{ACTIONS.title}</h2>
          <p className="fs-dek">{ACTIONS.dek}</p>
        </header>

        <div className="act2-main">
          <ul className="act2-hotspots">
            {HOTSPOTS.map((h) => {
              const src = SOURCES[h.sourceId]
              const s = h.status.toLowerCase()
              return (
                <li
                  key={h.key}
                  id={`act2-card-${h.key}`}
                  className={`act2-card is-${s}${active === h.key ? ' is-active' : ''}`}
                >
                  <div className="act2-card-head">
                    <h3 className="act2-card-name">{h.name}</h3>
                    <span className={`act2-badge is-${s}`}>
                      {h.status}
                      <em>{h.statusYear}</em>
                    </span>
                  </div>
                  <p className="act2-place">{h.place}</p>

                  <dl className="act2-facts">
                    <div className="is-wide">
                      <dt>Contamination</dt>
                      <dd>{h.volume}</dd>
                    </div>
                    <div>
                      <dt>Cost</dt>
                      <dd>{h.cost}</dd>
                    </div>
                    <div>
                      <dt>Timeline</dt>
                      <dd>{h.timeline}</dd>
                    </div>
                    <div className="is-wide">
                      <dt>Method</dt>
                      <dd>{h.method}</dd>
                    </div>
                  </dl>

                  <p className="act2-card-note">
                    {h.note}
                    {src && (
                      <>
                        {' '}
                        <a className="act2-src" href={src.url} target="_blank" rel="noreferrer">
                          {src.publisher}
                        </a>
                      </>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>

          <div className="act2-map">
            <ActionsMap active={active} onSelect={select} />
          </div>
        </div>

        <p className="act2-closing">{ACTIONS.closing}</p>
        <p className="fs-note">{ACTIONS.note}</p>
      </div>
    </section>
  )
}
