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

// Small explanatory icons for the three families. Containment and treatment
// use Lucide's archive and flame (MIT licence, path data inlined); no stock
// icon says "half contained, half treated", so hybrid stays custom, drawn in
// the same stroke style.
const FAMILY_ICONS: Record<AltFamily, ReactNode> = {
  containment: (
    // Lucide "archive" — a sealed storage box
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  ),
  treatment: (
    // Lucide "flame" — heat destroys the dioxin
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  hybrid: (
    // custom: half contained (soil dots), half treated (flame)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6.5" width="18" height="14" rx="1.5" />
      <path d="M12 6.5v14" />
      <circle cx="7.4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="16" r="1" fill="currentColor" stroke="none" />
      <path d="M16.3 17.5c-1.5-.8-1.9-2.3-.9-3.5.2.6.7.9 1.1 1-.3-1.2.2-2.3 1.3-2.8-.1 1 .4 1.6.9 2.3.8 1.3.1 2.5-1.2 3" />
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
              <div className="alt-family-methods">
                <span className="alt-family-methods-label">On the chart</span>
                {ALT_FAMILIES[f].methodChips.map((c) => (
                  <span key={c} className="alt-method-chip">
                    {c}
                  </span>
                ))}
              </div>
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

            {/* Always in the layout so toggling doesn't re-centre the section;
                hidden (not removed) until revealed. */}
            <div className={`alt-verdicts${revealed ? '' : ' is-hidden'}`} aria-hidden={!revealed}>
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
