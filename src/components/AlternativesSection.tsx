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

// Small explanatory icons for the three families — the site is otherwise
// restrained with icons, but these carry real meaning: a lined container
// around the soil; a heated chamber with its offgas collected; both at once.
const FAMILY_ICONS: Record<AltFamily, ReactNode> = {
  containment: (
    // a sealed vault: lid seam + latched soil inside
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="1.8" />
      <path d="M4 10.5h16" />
      <circle cx="9.5" cy="15.2" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="16.4" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  ),
  treatment: (
    // a heated chamber with its offgas piped away
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="9.5" width="13" height="10.5" rx="1.8" />
      <path d="M10.5 9.5V4.5h8" />
      <path d="M16.7 2.7l1.8 1.8-1.8 1.8" />
      <path d="M10.5 17.6c-1.7-.9-2.2-2.7-1-4.1.3.7.8 1 1.3 1.1-.4-1.4.3-2.7 1.6-3.3-.2 1.2.5 2 1 2.8 1 1.5.1 2.9-1.3 3.5" />
    </svg>
  ),
  hybrid: (
    // half contained, half treated
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="7" width="17" height="13" rx="1.8" />
      <path d="M12 7v13" />
      <circle cx="7.7" cy="12.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="8.4" cy="16.2" r="1.05" fill="currentColor" stroke="none" />
      <path d="M16.2 17.4c-1.4-.8-1.8-2.2-.8-3.4.2.6.7.8 1 .9-.3-1.1.2-2.2 1.3-2.7-.1 1 .4 1.6.8 2.3.8 1.2.1 2.4-1.1 2.9" />
    </svg>
  ),
}

// Bold the numeric thresholds inside a column label line, as in the design.
function boldNumbers(line: string): ReactNode[] {
  return line
    .split(/(\d[\d,]*)/)
    .map((part, i) => (/^\d/.test(part) ? <strong key={i}>{part}</strong> : part))
}

// Act II — "The Alternatives": the six remediation options USAID weighed for
// Biên Hòa. The comparison chart reproduces the project's Figma design: one
// plot, a grey cost bar and a red CO2 bar per option, twin axes, sage family
// bands — and a screening reveal that marks which options survived and why
// the others were dropped.
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
              <div className="alt-family-head">
                <span className="alt-family-icon">{FAMILY_ICONS[f]}</span>
                <h3>{ALT_FAMILIES[f].title}</h3>
              </div>
              <p>{ALT_FAMILIES[f].blurb}</p>
              <p className="alt-family-methods">{ALT_FAMILIES[f].methods}</p>
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
                  className={`alt-cell is-${a.family}`}
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
              <div key={a.key} className="alt-xlabel">
                {a.chartLines.map((line, i) => (
                  <span key={i}>{boldNumbers(line)}</span>
                ))}
              </div>
            ))}
          </div>

          <figcaption className="alt-reveal">
            <button
              type="button"
              className={`alt-reveal-btn${revealed ? ' is-banner' : ''}`}
              aria-pressed={revealed}
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? ALTS.revealBanner : ALTS.revealLabel}
            </button>

            {revealed && (
              <div className="alt-verdicts">
                {ALTERNATIVES.map((a) => (
                  <div key={a.key} className={`alt-verdict${a.retained ? ' is-kept' : ' is-cut'}`}>
                    <span className="alt-verdict-mark" aria-hidden="true">
                      {a.retained ? '✓' : '✕'}
                    </span>
                    <span className="alt-verdict-chip">
                      {a.retained ? ALTS.retainedLabel : a.screenNote}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
