import { useState } from 'react'
import { ALTERNATIVES, ALT_FAMILIES, ALTS, type AltFamily } from '../content/actions/alternatives'
import { SOURCES } from '../content/sources'

// Axis ceilings. 700 M ↔ 70 kt keeps the two scales' gridlines aligned
// (200 M sits exactly on 20 kt), as in the Figma chart; the tallest bar
// (incineration's CO2) deliberately overshoots the top edge, also as designed.
const COST_MAX = 700
const CO2_MAX = 70
const COST_TICKS = [0, 200, 400, 600]
const CO2_TICKS = [0, 20, 40, 60]
/* Phone rows scale CO2 to the largest value instead of the desktop axis
   ceiling — there is no second axis to keep aligned, and a bar may not
   overflow a row the way the incineration column overflows the plot. */
const CO2_ROW_MAX = 80

const FAMILY_ORDER: AltFamily[] = ['containment', 'hybrid', 'treatment']

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
          <h2 className="fs-title">{ALTS.title}</h2>
          <p className="fs-dek">{ALTS.dek}</p>
        </header>

        <ul className="alt-families">
          {FAMILY_ORDER.map((f) => {
            const kept = ALTERNATIVES.filter((a) => a.family === f && a.retained).length
            return (
            <li key={f} className={`alt-family is-${f}${revealed && f !== 'treatment' ? ' is-kept' : ''}`}>
              {revealed && kept > 0 && (
                <span className="alt-family-checks" role="img" aria-label={`${kept} alternative${kept > 1 ? 's' : ''} retained`}>
                  {Array.from({ length: kept }).map((_, i) => (
                    // Carbon "checkmark--filled"
                    <svg key={i} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
                      <path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM14,21.5908l-5-5L10.5906,15,14,18.4092,21.41,11l1.5957,1.5859Z" />
                    </svg>
                  ))}
                </span>
              )}
              <h3>{ALT_FAMILIES[f].title}</h3>
              <p>{ALT_FAMILIES[f].blurb}</p>
            </li>
            )
          })}
        </ul>

        <figure className={`alt-chart${revealed ? ' is-revealed' : ''}`} aria-label={ALTS.chartTitle}>
          <div className="alt-arrow">
            <span>{ALTS.arrow}</span>
            <div className="alt-arrow-line" aria-hidden="true" />
          </div>

          {/* Axis titles row (family group labels moved below the chart). */}
          <div className="alt-gheads">
            <div className="alt-axis-title is-cost">
              Cost
              <em>(US$ million)</em>
            </div>
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
                  title={`${a.name}: $${a.costM}M · ${a.co2Kt} kt CO₂`}
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
                  {/* Bare, like the cost axis beside it: the title already
                      says kilotonnes, so "60 K" read as 60,000 of them —
                      1000x the value the bar draws. */}
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="alt-xlabels">
            {ALTERNATIVES.map((a) => (
              <div key={a.key} className="alt-xlabel">
                {a.chartLines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            ))}
          </div>

          {/* Family span brackets under the column labels — an upward-opening
              range line per group, so grouping reads without crowding the plot. */}
          <div className="alt-bands" aria-hidden="true">
            {spans.map((s) => (
              <div key={s.family} className={`alt-band-group is-${s.family}`} style={{ flex: s.count }}>
                <i />
                <span>{ALT_FAMILIES[s.family].title}</span>
              </div>
            ))}
          </div>

          {/* Phone variant: the same data as horizontal rows — names get a
              full line, the values are printed instead of hovered, nothing
              scrolls. Desktop keeps the Figma plot; CSS swaps the two. */}
          <div className="alt-rows">
            <p className="alt-rows-legend" aria-hidden="true">
              <i className="is-cost" /> Cost <em>(US$ million)</em>
              <i className="is-co2" /> CO₂ <em>(kilotonnes)</em>
            </p>
            {FAMILY_ORDER.map((f) => (
              <div key={f} className={`alt-rowgroup is-${f}`}>
                <h4>{ALT_FAMILIES[f].title}</h4>
                {ALTERNATIVES.filter((a) => a.family === f).map((a) => (
                  <div key={a.key} className={`alt-row${revealed ? (a.retained ? ' is-kept' : ' is-cut') : ''}`}>
                    <p className="alt-row-name">
                      {a.chartLines[0]}
                      {a.chartLines[1] && <em> · {a.chartLines[1]}</em>}
                    </p>
                    <div className="alt-row-bars">
                      <i className="is-cost" style={{ width: `${(a.costM / COST_MAX) * 100}%` }} />
                      <span>${a.costM}M</span>
                      <i className="is-co2" style={{ width: `${(a.co2Kt / CO2_ROW_MAX) * 100}%` }} />
                      <span>{a.co2Kt} kt</span>
                    </div>
                    {revealed && (
                      <p className="alt-row-note">
                        <span aria-hidden="true">{a.retained ? '✓' : '✕'}</span>{' '}
                        {a.retained ? ALTS.retainedLabel : a.screenNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <figcaption className="alt-reveal">
            <p className="fs-note alt-note">
              {ALTS.note}{' '}
              {src && (
                <a href={src.url} target="_blank" rel="noreferrer">
                  {src.publisher}
                </a>
              )}
            </p>
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
      </div>
    </section>
  )
}
