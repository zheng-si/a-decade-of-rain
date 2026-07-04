import { useState } from 'react'
import { METHODS, METHODS_HEAD, type Method } from '../content/actions/methods'

// Leader-line geometry, % of the figure box. Labels live in the left column;
// each line runs from the label's edge to a point inside the diagram.
const LABEL_COL = 34 // % width reserved for labels
const LINE_END = 58 // % where the leader line ends, inside the image

function MethodFigure({ m }: { m: Method }) {
  const [hot, setHot] = useState<number | null>(null)

  return (
    <div className="method-block">
      <div className="method-copy">
        <h3>{m.title}</h3>
        <p>{m.body}</p>
      </div>

      <figure className="method-fig" aria-label={m.caption}>
        <div className="method-diagram">
          <img src={m.img} alt={m.imgAlt} loading="lazy" />

          <svg className="method-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {m.layers.map((l, i) => (
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
          {m.layers.map((l, i) => (
            <i
              key={i}
              className={`method-dot${hot === i ? ' is-hot' : ''}`}
              style={{ left: `${l.endX ?? LINE_END}%`, top: `${l.y}%` }}
              aria-hidden="true"
            />
          ))}

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
        </div>
        <figcaption className="method-cap">{m.caption}</figcaption>
      </figure>
    </div>
  )
}

// Act II — the two retained methods as annotated exploded axonometrics
// (Rhino renders, labelled in the browser so the text stays crisp).
export default function MethodsSection() {
  return (
    <section className="story-fullscreen methods" id="sec-methods" aria-label={METHODS_HEAD.title}>
      <div className="fs-inner methods-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{METHODS_HEAD.eyebrow}</p>
          <h2 className="fs-title">{METHODS_HEAD.title}</h2>
          <p className="fs-dek">{METHODS_HEAD.dek}</p>
        </header>

        {METHODS.map((m) => (
          <MethodFigure key={m.key} m={m} />
        ))}
      </div>
    </section>
  )
}
