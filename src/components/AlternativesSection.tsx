import { useState, type ReactNode } from 'react'
import { ALTERNATIVES, ALT_FAMILIES, ALTS, type AltFamily } from '../content/actions/alternatives'
import { SOURCES } from '../content/sources'

// Axis ceilings. 700 M ↔ 70 kt keeps the two scales' gridlines aligned
// (200 M sits exactly on 20 kt), as in the Figma chart; the tallest bar
// (incineration's CO2) deliberately overshoots the top edge, also as designed.
const COST_MAX = 700
const CO2_MAX = 70
const COST_TICKS = [0, 200, 400, 600]
const CO2_TICKS = [0, 20, 40, 60]

const FAMILY_ORDER: AltFamily[] = ['containment', 'hybrid', 'treatment']

// Bold the numeric thresholds inside a column label line, as in the design.
function boldNumbers(line: string): ReactNode[] {
  return line
    .split(/(\d[\d,]*)/)
    .map((part, i) => (/^\d/.test(part) ? <strong key={i}>{part}</strong> : part))
}

// Act II — "The Alternatives": the six remediation options USAID weighed for
// Biên Hòa. The comparison chart reproduces the project's Figma design: one
// plot, a grey cost bar and a red CO2 bar per option, twin axes, sage family
// bands, and the reveal button underneath.
export default function AlternativesSection() {
  const [revealed, setRevealed] = useState(false)
  const src = SOURCES[ALTS.sourceId]

  const spans = FAMILY_ORDER.map((f) => ({
    family: f,
    count: ALTERNATIVES.filter((a) => a.family === f).length,
  }))

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

        <figure className={`alt-chart${revealed ? ' is-revealed' : ''}`} aria-label={ALTS.chartTitle}>
          <div className="alt-arrow">
            <span>{ALTS.arrow}</span>
            <div className="alt-arrow-line" aria-hidden="true" />
          </div>

          {/* Axis titles + family group labels, sharing the plot's gutters. */}
          <div className="alt-gheads">
            <div className="alt-axis-title is-cost">
              Cost
              <em>(US$ million)</em>
            </div>
            {spans.map((s) => (
              <div key={s.family} className={`alt-ghead is-${s.family}`} style={{ flex: s.count }}>
                {ALT_FAMILIES[s.family].title}
              </div>
            ))}
            <div className="alt-axis-title is-co2">
              CO₂ emission
              <em>(kilotonnes)</em>
            </div>
          </div>

          <div className="alt-chartgrid">
            <div className="alt-axis is-cost" aria-hidden="true">
              {COST_TICKS.map((t) => (
                <span key={t} style={{ bottom: `${(t / COST_MAX) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>

            <div className="alt-plot">
              <div className="alt-glines" aria-hidden="true">
                {[100, 200, 300, 400, 500, 600].map((t) => (
                  <i key={t} className={t % 200 === 0 ? 'is-major' : undefined} style={{ bottom: `${(t / COST_MAX) * 100}%` }} />
                ))}
              </div>
              {ALTERNATIVES.map((a) => (
                <div
                  key={a.key}
                  className={`alt-cell is-${a.family}${a.adopted ? ' is-adopted' : ''}`}
                  title={`${a.name} — $${a.costM}M · ${a.co2Kt} kt CO₂`}
                >
                  <div className="alt-pair">
                    <i className="is-cost" style={{ height: `${(a.costM / COST_MAX) * 100}%` }} />
                    <i className="is-co2" style={{ height: `${(a.co2Kt / CO2_MAX) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="alt-axis is-co2" aria-hidden="true">
              {CO2_TICKS.map((t) => (
                <span key={t} style={{ bottom: `${(t / CO2_MAX) * 100}%` }}>
                  {t === 0 ? '0' : `${t} K`}
                </span>
              ))}
            </div>
          </div>

          <div className="alt-xlabels">
            {ALTERNATIVES.map((a) => (
              <div key={a.key} className={`alt-xlabel${revealed && a.adopted ? ' is-adopted' : ''}`}>
                {a.chartLines.map((line, i) => (
                  <span key={i}>{boldNumbers(line)}</span>
                ))}
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
              {revealed ? 'Show every alternative equally' : ALTS.revealLabel}
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
