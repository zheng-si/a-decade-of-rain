import { useState } from 'react'
import { TIMELINE, TIMELINE_HEAD } from '../content/actions/timeline'
import { SOURCES } from '../content/sources'

// Serpentine track geometry, matching the Figma component: six stops per row,
// top row runs 2009→2014 left to right, a semicircular bend on the right
// carries the line down, and the bottom row runs 2015→2020 right to left.
const COLS = 6
const X0 = 3.5 // % centre of the first column
const X_STEP = 18.46 // % between column centres
const TOP_Y = 40 // px, top row's line/dots
const BOT_Y = 114 // px, bottom row's line/dots
const xPct = (col: number) => X0 + col * X_STEP

// Act II — "The Timeline": the remediation programme year by year. One year
// active at a time; clicking a stop swaps the milestone list below the track.
export default function TimelineSection() {
  const [year, setYear] = useState(TIMELINE[0].year)
  const current = TIMELINE.find((t) => t.year === year) ?? TIMELINE[0]
  const src = SOURCES[TIMELINE_HEAD.sourceId]

  return (
    <section className="story-fullscreen timeline-sec" id="sec-timeline" aria-label={TIMELINE_HEAD.title}>
      <div className="fs-inner tl-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{TIMELINE_HEAD.eyebrow}</p>
          <h2 className="fs-title">{TIMELINE_HEAD.title}</h2>
          <p className="fs-dek">{TIMELINE_HEAD.dek}</p>
        </header>

        <div className="tl-track" role="tablist" aria-label="Project years">
          {/* The serpentine line: two horizontal rules joined by a right bend. */}
          <i className="tl-line" style={{ top: TOP_Y }} aria-hidden="true" />
          <i className="tl-line" style={{ top: BOT_Y }} aria-hidden="true" />
          <svg
            className="tl-bend"
            style={{ left: `${xPct(COLS - 1)}%`, top: TOP_Y, height: BOT_Y - TOP_Y }}
            viewBox={`0 0 ${(BOT_Y - TOP_Y) / 2 + 2} ${BOT_Y - TOP_Y}`}
            aria-hidden="true"
          >
            <path
              d={`M 0 1 A ${(BOT_Y - TOP_Y) / 2 - 1} ${(BOT_Y - TOP_Y) / 2 - 1} 0 0 1 0 ${BOT_Y - TOP_Y - 1}`}
              fill="none"
            />
          </svg>

          {TIMELINE.map((t, i) => {
            const topRow = i < COLS
            // Bottom row runs right→left: 2015 sits under 2014.
            const col = topRow ? i : COLS - 1 - (i - COLS)
            const on = t.year === year
            return (
              <button
                key={t.year}
                type="button"
                role="tab"
                aria-selected={on}
                className={`tl-stop${on ? ' is-on' : ''}`}
                style={{ left: `${xPct(col)}%`, top: topRow ? TOP_Y : BOT_Y }}
                onClick={() => setYear(t.year)}
              >
                <span className="tl-year">{t.year}</span>
                <i className="tl-dot" aria-hidden="true" />
              </button>
            )
          })}
        </div>

        {/* Milestones for the active year. Height is reserved so switching
            years never re-centres the full-screen section. */}
        <ul className="tl-events" key={current.year}>
          {current.events.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>

        <p className="fs-note">
          {TIMELINE_HEAD.note}{' '}
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
