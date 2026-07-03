import { VEG_TYPES, ECOSYSTEMS } from '../content/facts/ecosystems'
import { SOURCES } from '../content/sources'

// Full-screen interlude: the redrawn wartime vegetation map + a curated legend.
// The map SVG is served statically (public/figures) so it stays out of the JS
// bundle; the legend and callout are rebuilt with our tokens.
export default function EcosystemsFigure() {
  const headSrc = SOURCES[ECOSYSTEMS.headline.sourceId]
  return (
    <section className="story-fullscreen ecosystems" aria-label={ECOSYSTEMS.title}>
      <div className="fs-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{ECOSYSTEMS.eyebrow}</p>
          <h2 className="fs-title">{ECOSYSTEMS.title}</h2>
          <p className="fs-dek">{ECOSYSTEMS.dek}</p>
        </header>

        <div className="eco-grid">
          <div className="eco-legend">
            <p className="eco-legend-title">{ECOSYSTEMS.legendTitle}</p>
            <ul className="eco-types">
              {VEG_TYPES.map((v) => (
                <li key={v.name} className="eco-type">
                  <span className="eco-swatch" style={{ background: v.color }} />
                  <span className="eco-type-name">{v.name}</span>
                  {v.impact && (
                    <span className="eco-type-impact" title={v.impact.label}>
                      {Math.round(v.impact.fraction * 100)}% sprayed
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <dl className="eco-impacts">
              {VEG_TYPES.filter((v) => v.impact).map((v) => {
                const s = SOURCES[v.impact!.sourceId]
                return (
                  <div key={v.name} className="eco-impact-row">
                    <dt>{v.name}</dt>
                    <dd>
                      {v.impact!.label}
                      {s && (
                        <>
                          {' '}
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.publisher}
                          </a>
                        </>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
            <p className="eco-note">{ECOSYSTEMS.note}</p>
          </div>

          <figure className="eco-map">
            <img src={`${import.meta.env.BASE_URL}figures/vegetation-map.svg`} alt={ECOSYSTEMS.mapAlt} />
            <figcaption className="eco-headline">
              <strong>{ECOSYSTEMS.headline.value}</strong>
              <span>{ECOSYSTEMS.headline.label}</span>
              {headSrc && (
                <a href={headSrc.url} target="_blank" rel="noreferrer" className="eco-headline-src">
                  {headSrc.publisher}
                </a>
              )}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
