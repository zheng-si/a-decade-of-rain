import { WALLS } from '../content/interlude/consequences'
import { SOURCES } from '../content/sources'

// Interlude — "The Consequences": two full-page photo walls (the land, in
// green; the body, in orange). Left third = a big number; right = a photo
// mosaic. Built for impact. (Tile images are placeholders for now.)
export default function ConsequencesInterlude() {
  return (
    <>
      {WALLS.map((w) => {
        const src = w.sourceId ? SOURCES[w.sourceId] : undefined
        return (
          <section key={w.key} id={`sec-${w.key}`} className={`story-fullscreen interlude-wall is-${w.theme}`} aria-label={w.label}>
            <div className="wall-inner">
              <div className="wall-lead">
                <p className="wall-eyebrow">{w.eyebrow}</p>
                <p className="wall-value">{w.value}</p>
                <p className="wall-label">{w.label}</p>
                <p className="wall-lede">{w.lede}</p>
                {src && (
                  <a className="wall-src" href={src.url} target="_blank" rel="noreferrer">
                    {src.publisher}
                  </a>
                )}
              </div>

              <div className="wall-grid">
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
      })}
    </>
  )
}
