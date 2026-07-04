import { useState } from 'react'
import { ACTIONS, HOTSPOTS, type HotspotKey } from '../content/actions/hotspots'
import { SOURCES } from '../content/sources'
import ActionsMap from './ActionsMap'

// Shared scale for the volume bar: Biên Hòa, the largest hotspot.
const VOLUME_MAX = 500_000

// Act II, "The Actions": the three hotspot air bases, each a colour-washed
// site photograph at rest. Clicking a card (or its map pin) flips it to the
// numbers; the three flip independently, so all can be open for comparison.
export default function ActionsSection() {
  const [open, setOpen] = useState<Record<HotspotKey, boolean>>({
    phucat: false,
    danang: false,
    bienhoa: false,
  })
  const toggle = (key: HotspotKey) => setOpen((o) => ({ ...o, [key]: !o[key] }))
  const openKeys = HOTSPOTS.filter((h) => open[h.key]).map((h) => h.key)

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
              const isOpen = open[h.key]
              return (
                <li
                  key={h.key}
                  className={`act2-card is-${s}${isOpen ? ' is-active' : ' is-photo'}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggle(h.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(h.key)
                    }
                  }}
                >
                  {isOpen ? (
                    <div className="act2-data-face">
                      <div className="act2-card-head">
                        <h3 className="act2-card-name">{h.name}</h3>
                        <span className={`act2-badge is-${s}`}>
                          {h.status}
                          <em>{h.statusYear}</em>
                        </span>
                      </div>
                      <p className="act2-place">{h.place}</p>

                      <dl className="act2-facts">
                        <div>
                          <dt>Contamination</dt>
                          <dd>{h.volume}</dd>
                          <div
                            className="act2-volbar"
                            role="img"
                            aria-label={`Roughly ${Math.round((h.volumeM3 / VOLUME_MAX) * 100)}% of the largest hotspot's volume`}
                          >
                            <i style={{ width: `${Math.max((h.volumeM3 / VOLUME_MAX) * 100, 1.2)}%` }} />
                          </div>
                        </div>
                        <div>
                          <dt>Cost</dt>
                          <dd>{h.cost}</dd>
                        </div>
                        <div>
                          <dt>Timeline</dt>
                          <dd>{h.timeline}</dd>
                        </div>
                        <div>
                          <dt>Method</dt>
                          <dd>{h.method}</dd>
                        </div>
                      </dl>

                      <p className="act2-card-note">
                        {h.note}
                        {src && (
                          <>
                            {' '}
                            <a
                              className="act2-src"
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {src.publisher}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="act2-photo-face">
                      <img className="act2-photo" src={h.photo} alt="" loading="lazy" />
                      <div className="act2-photo-veil" aria-hidden="true" />
                      <div className="act2-photo-copy">
                        <div>
                          <div className="act2-card-head">
                            <h3 className="act2-card-name">{h.name}</h3>
                            <span className={`act2-badge is-${s}`}>
                              {h.status}
                              <em>{h.statusYear}</em>
                            </span>
                          </div>
                          <p className="act2-photo-place">{h.place}</p>
                        </div>
                        <p className="act2-photo-hint">Click for the numbers →</p>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="act2-map">
            <ActionsMap active={openKeys} onSelect={toggle} />
          </div>
        </div>

        <p className="act2-closing">{ACTIONS.closing}</p>
        <p className="fs-note">{ACTIONS.note}</p>
      </div>
    </section>
  )
}
