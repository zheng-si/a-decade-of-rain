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

// Family icons from the IBM Carbon icon library (Apache 2.0, path data
// inlined): box = contained, fire = treated, thumbs-up-double = both.
const FAMILY_ICONS: Record<AltFamily, ReactNode> = {
  containment: (
    // Carbon "box"
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M20,21H12a2,2,0,0,1-2-2V17a2,2,0,0,1,2-2h8a2,2,0,0,1,2,2v2A2,2,0,0,1,20,21Zm-8-4v2h8V17Z" />
      <path d="M28,4H4A2,2,0,0,0,2,6v4a2,2,0,0,0,2,2V28a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V12a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4ZM26,28H6V12H26Zm2-18H4V6H28v4Z" />
    </svg>
  ),
  treatment: (
    // Carbon "fire"
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M24.832,16.9688c-.2724-.6465-.5815-1.38-.8833-2.2852-.79-2.3682,1.7344-4.9522,1.7583-4.9766L24.293,8.293c-.1407.1406-3.4234,3.4775-2.2417,7.0234.3261.978.6513,1.749.938,2.43A9.3812,9.3812,0,0,1,24,22a6.24,6.24,0,0,1-4.1892,5.293,8.52,8.52,0,0,0-2.1038-8l-1.0444-1.0445-.5815,1.3575C14.2449,23.89,12.06,25.76,10.7747,26.54A5.8437,5.8437,0,0,1,8,22a9.6239,9.6239,0,0,1,.9287-3.6289A11.3329,11.3329,0,0,0,10,14V12.2217c.8735.36,2,1.3037,2,3.7783v2.6035l1.7432-1.9341c3.1118-3.4546,2.4624-7.5678,1.206-10.3081A4.4859,4.4859,0,0,1,18,11h2c0-5.5371-4.5786-7-7-7H11l1.1992,1.5986c.1377.1856,2.8628,3.9278,1.3535,7.688A4.9426,4.9426,0,0,0,9,10H8v4a9.6239,9.6239,0,0,1-.9287,3.6289A11.3329,11.3329,0,0,0,6,22c0,3.8477,3.8232,8,10,8s10-4.1523,10-8A11.3771,11.3771,0,0,0,24.832,16.9688ZM12.8352,27.5264a16.4987,16.4987,0,0,0,4.3665-5.5987,6.1053,6.1053,0,0,1,.2573,5.9717A11.3213,11.3213,0,0,1,16,28,10.3278,10.3278,0,0,1,12.8352,27.5264Z" />
    </svg>
  ),
  hybrid: (
    // Carbon "thumbs-up-double" — both approaches together
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M20.7637,13.9999h-5.7637l-.0024-4.4316c0-2.1011-1.2324-3.5684-2.9976-3.5684h-1c-1.5273,0-1.7539,1.5273-1.8755,2.3477-.0225.1509-.6826,4.8052-.6826,4.8052l-2.0431,3.8472H2v13h16.3325c3.6763,0,6.6675-2.9912,6.6675-6.6675v-5.103c0-2.3369-1.8989-4.2295-4.2363-4.2295h0ZM4,27.9999v-9h1.9998l-.0017,9h-1.9981ZM23,23.3324c0,2.5737-2.0938,4.6675-4.6675,4.6675h-10.3325v-9.751l2.3735-4.4692s.7983-5.6035.8433-5.7798h.7832c.9697,0,.9976,1.4077.9976,1.5684l.0024,6.4316h7.7637c1.2344,0,2.2363.9951,2.2363,2.2295v5.103ZM31,13.2295v5.103c0,2.321-1.194,4.3667-2.9983,5.5613l-1.0042-1.7393c1.2073-.8446,2.0024-2.2402,2.0024-3.8221v-5.103c0-1.2344-1.0019-2.2295-2.2363-2.2295h-7.7637l-.0024-6.4315c0-.1608-.0279-1.5685-.9976-1.5685h-.7832c-.0174.0681-.1475.948-.3002,2.0001h-2.0273c.1234-.8691.2266-1.5944.2352-1.6523.1216-.8206.3482-2.3478,1.8755-2.3478h1c1.7652,0,2.9976,1.4673,2.9976,3.5685l.0024,4.4315h5.7637c2.3374.0001,4.2363,1.8927,4.2363,4.2296Z" />
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
            )
          })}
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
