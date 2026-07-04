import { useState } from 'react'
import { ACTIONS, HOTSPOTS, type HotspotKey } from '../content/actions/hotspots'
import { SOURCES } from '../content/sources'
import ActionsMap from './ActionsMap'

// Shared scale for the volume bar: Biên Hòa, the largest hotspot.
const VOLUME_MAX = 500_000

// Act II, "The Actions": the present-day cleanup at the three dioxin hotspot
// air bases. One compact card at a time — switched by the tabs above it or by
// clicking a pin on the locator map to its right.
export default function ActionsSection() {
  const [active, setActive] = useState<HotspotKey>('danang')
  const h = HOTSPOTS.find((x) => x.key === active)!
  const src = SOURCES[h.sourceId]
  const s = h.status.toLowerCase()

  return (
    <section className="story-fullscreen actions" id="sec-actions" aria-label={ACTIONS.title}>
      <div className="fs-inner act2-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{ACTIONS.eyebrow}</p>
          <h2 className="fs-title">{ACTIONS.title}</h2>
          <p className="fs-dek">{ACTIONS.dek}</p>
        </header>

        <div className="act2-main">
          <div className="act2-panel">
            <div className="act2-tabs" role="tablist" aria-label="Hotspot air bases">
              {HOTSPOTS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active === t.key}
                  className={`act2-tab is-${t.status.toLowerCase()}${active === t.key ? ' is-on' : ''}`}
                  onClick={() => setActive(t.key)}
                >
                  <i className="act2-tab-dot" aria-hidden="true" />
                  {t.name}
                </button>
              ))}
            </div>

            <div key={h.key} className={`act2-card is-${s}`} role="tabpanel">
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
            </div>

            <p className="act2-closing">{ACTIONS.closing}</p>
            <p className="fs-note">{ACTIONS.note}</p>
          </div>

          <div className="act2-map">
            <ActionsMap active={active} onSelect={setActive} />
          </div>
        </div>
      </div>
    </section>
  )
}
