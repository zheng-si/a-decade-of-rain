import { useState, useEffect, useRef } from 'react'
import { VEG_TYPES, VEG_AXIS_MAX, VEG_AXIS_STEP, ECOSYSTEMS, type VegKey } from '../content/facts/ecosystems'
import { SOURCES } from '../content/sources'
import vegRaw from '../figures/vegetation-map.svg?raw'

const pct = (s: number, t: number) => (t > 0 ? Math.round((s / t) * 100) : 0)
const axisTicks = Array.from({ length: VEG_AXIS_MAX / VEG_AXIS_STEP + 1 }, (_, i) => i * VEG_AXIS_STEP)

// Tween the headline figure toward `target` (easeOutCubic) so it rolls up/down
// on selection instead of hard-cutting. Honours prefers-reduced-motion.
function useCountUp(target: number, duration = 450) {
  const [val, setVal] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    fromRef.current = val
  }, [val])
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    if (reduce || from === target) {
      setVal(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(from + (target - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return val
}

// Full-screen interlude: the redrawn wartime vegetation map + an interactive
// legend. Selecting a type highlights it on the map (the rest fade), the bars
// read sprayed-over-total, and the headline % follows the selection.
export default function EcosystemsFigure() {
  const [sel, setSel] = useState<VegKey | null>(null)
  const [sortMode, setSortMode] = useState<'pct' | 'vol'>('pct')

  // Rank the rows by share sprayed (sprayed/total) or by absolute sprayed area.
  const ordered = [...VEG_TYPES].sort((a, b) =>
    sortMode === 'pct' ? b.sprayed / b.total - a.sprayed / a.total : b.sprayed - a.sprayed,
  )

  const active = sel ? VEG_TYPES.find((v) => v.key === sel)! : null
  const sumSpr = VEG_TYPES.reduce((a, v) => a + v.sprayed, 0)
  const sumTot = VEG_TYPES.reduce((a, v) => a + v.total, 0)
  const headPct = active ? pct(active.sprayed, active.total) : pct(sumSpr, sumTot)
  const headColor = active ? active.ink : '#51625a'
  const displayPct = useCountUp(headPct)

  return (
    <section className="story-fullscreen ecosystems" aria-label={ECOSYSTEMS.title}>
      <div className="fs-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{ECOSYSTEMS.eyebrow}</p>
          <h2 className="fs-title">{ECOSYSTEMS.title}</h2>
        </header>

        <div className="eco-grid">
          <div className="eco-legend">
            <p className="fs-dek eco-dek">{ECOSYSTEMS.dek}</p>

            {/* Shared scale key: 0–6000, orange = sprayed, outline = area of type. */}
            <div className="eco-scale">
              <div className="eco-scale-ticks">
                {axisTicks.map((t, i) => (
                  <span key={t} className={i === axisTicks.length - 1 ? 'is-last' : undefined} style={{ left: `${(t / VEG_AXIS_MAX) * 100}%` }}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="eco-scale-bar" style={{ ['--seg' as string]: `${(VEG_AXIS_STEP / 2 / VEG_AXIS_MAX) * 100}%` }}>
                <div className="eco-scale-sprayed" style={{ width: '33%' }} />
              </div>
              <div className="eco-scale-caps">
                <span className="eco-cap-sprayed">{ECOSYSTEMS.scaleSprayed}</span>
                <span>
                  {ECOSYSTEMS.scaleTotal} <em className="eco-scale-unit">{ECOSYSTEMS.scaleUnit}</em>
                </span>
              </div>
            </div>

            {/* Sort toggle + the affordance hint that these rows are clickable. */}
            <div className="eco-controls">
              <span className="eco-sort-label">Ranked by</span>
              <div className="eco-sort" role="group" aria-label="Rank vegetation types by">
                <button
                  className={`eco-sort-btn${sortMode === 'pct' ? ' is-active' : ''}`}
                  aria-pressed={sortMode === 'pct'}
                  onClick={() => setSortMode('pct')}
                >
                  Share sprayed
                </button>
                <button
                  className={`eco-sort-btn${sortMode === 'vol' ? ' is-active' : ''}`}
                  aria-pressed={sortMode === 'vol'}
                  onClick={() => setSortMode('vol')}
                >
                  Area sprayed
                </button>
              </div>
            </div>

            <ul className="eco-types" role="tablist" aria-label="Vegetation types">
              {ordered.map((v) => {
                const on = sel === v.key
                const segPct = (VEG_AXIS_STEP / 2 / v.total) * 100 // 1000-ha segment, relative to this track
                return (
                  <li key={v.key}>
                    <button
                      role="tab"
                      aria-selected={on}
                      className={`eco-type${on ? ' is-on' : ''}`}
                      onClick={() => setSel(on ? null : v.key)}
                    >
                      <span className="eco-swatch" style={{ background: v.color }} />
                      <span className="eco-type-name">
                        {v.name}
                        {!v.sourced && <span className="eco-est" title="estimate pending confirmation">est.</span>}
                      </span>
                      <span className="eco-type-pct">
                        {sortMode === 'pct' ? `${pct(v.sprayed, v.total)}%` : v.sprayed.toLocaleString()}
                      </span>
                      <span className="eco-type-go" aria-hidden="true">→</span>
                    </button>
                    <div className="eco-bar">
                      <div
                        className="eco-bar-track"
                        style={{ width: `${(v.total / VEG_AXIS_MAX) * 100}%`, ['--seg' as string]: `${segPct}%` }}
                      >
                        <div className="eco-bar-fill" style={{ width: `${(v.sprayed / v.total) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="eco-note">{ECOSYSTEMS.note}</p>
          </div>

          <figure className="eco-map" data-sel={sel ?? undefined}>
            <div className="eco-map-svg" aria-label={ECOSYSTEMS.mapAlt} role="img" dangerouslySetInnerHTML={{ __html: vegRaw }} />
            <figcaption className="eco-headline" style={{ color: headColor }}>
              <strong>{displayPct}%</strong>
              <span>{active ? `of ${active.name.toLowerCase()} sprayed` : 'of vegetation sprayed'}</span>
              {active?.sourceId && SOURCES[active.sourceId] && (
                <a href={SOURCES[active.sourceId].url} target="_blank" rel="noreferrer" className="eco-headline-src">
                  {SOURCES[active.sourceId].publisher}
                </a>
              )}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
