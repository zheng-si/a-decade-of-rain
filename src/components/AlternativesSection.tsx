import { useState } from 'react'
import { ALTERNATIVES, ALT_FAMILIES, ALTS, type AltFamily } from '../content/actions/alternatives'
import { SOURCES } from '../content/sources'

const COST_MAX = 700 // axis ceiling, US$ million
const CO2_MAX = 80 // axis ceiling, kt CO2

const FAMILY_ORDER: AltFamily[] = ['containment', 'hybrid', 'treatment']

// Act II — "The Alternatives": the six remediation options USAID weighed for
// Biên Hòa, compared on cost and CO2. The Figma design drew this as one
// dual-axis chart; here it is two small-multiple panels sharing the x axis,
// which reads the same story without two competing y scales.
export default function AlternativesSection() {
  const [revealed, setRevealed] = useState(false)
  const src = SOURCES[ALTS.sourceId]

  const spans = FAMILY_ORDER.map((f) => ({
    family: f,
    count: ALTERNATIVES.filter((a) => a.family === f).length,
  }))

  const panel = (kind: 'cost' | 'co2') => (
    <div className={`alt-panel is-${kind}`}>
      <p className="alt-panel-name">{kind === 'cost' ? 'Cost · US$ million' : 'CO₂ emitted · kilotonnes'}</p>
      <div className="alt-bars">
        {ALTERNATIVES.map((a) => {
          const v = kind === 'cost' ? a.costM : a.co2Kt
          const h = (v / (kind === 'cost' ? COST_MAX : CO2_MAX)) * 100
          const dim = revealed && !a.adopted
          return (
            <div key={a.key} className={`alt-bar-cell${dim ? ' is-dim' : ''}`} title={a.name}>
              <span className="alt-bar-value">{kind === 'cost' ? `$${v}M` : `${v} kt`}</span>
              <div className="alt-bar" style={{ height: `${h}%` }} />
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <section className="story-fullscreen alternatives" id="sec-alternatives" aria-label={ALTS.title}>
      <div className="fs-inner alt-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{ALTS.eyebrow}</p>
          <h2 className="fs-title">{ALTS.title}</h2>
          <p className="fs-dek">{ALTS.dek}</p>
        </header>

        <ul className="alt-families">
          {FAMILY_ORDER.map((f) => (
            <li key={f} className={`alt-family is-${f}`}>
              <h3>{ALT_FAMILIES[f].title}</h3>
              <p>{ALT_FAMILIES[f].blurb}</p>
            </li>
          ))}
        </ul>

        <figure className="alt-chart" aria-label={ALTS.chartTitle}>
          <div className="alt-arrow" aria-hidden="true">
            <span>{ALTS.arrow}</span>
          </div>

          {/* Family group headers, aligned to the shared column grid. */}
          <div className="alt-groups" aria-hidden="true">
            {spans.map((s) => (
              <div key={s.family} className={`alt-group is-${s.family}`} style={{ flex: s.count }}>
                {ALT_FAMILIES[s.family].title}
              </div>
            ))}
          </div>

          {panel('cost')}
          {panel('co2')}

          {/* Shared x labels under the bottom panel. */}
          <div className="alt-xlabels">
            {ALTERNATIVES.map((a) => (
              <div key={a.key} className={`alt-xlabel${revealed && a.adopted ? ' is-adopted' : ''}`}>
                {a.label}
                {revealed && a.adopted && <em>USAID’s choice</em>}
              </div>
            ))}
          </div>

          <figcaption className="alt-reveal">
            <button
              type="button"
              className="alt-reveal-btn"
              aria-pressed={revealed}
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? 'Show all equally' : ALTS.revealLabel}
            </button>
            {revealed && <p className="alt-reveal-note">{ALTS.revealNote}</p>}
          </figcaption>
        </figure>

        <p className="fs-note">
          {ALTS.note}{' '}
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
