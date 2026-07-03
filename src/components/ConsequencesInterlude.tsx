import { CONSEQUENCES, CONSEQUENCE_STATS } from '../content/interlude/consequences'

// Interlude between Act I and Act II: the human/health legacy of the dioxin.
// Full-screen, stat-forward, deliberately sober.
export default function ConsequencesInterlude() {
  return (
    <section className="story-fullscreen consequences" id="sec-consequences" aria-label={CONSEQUENCES.title}>
      <div className="fs-inner cons-inner">
        <header className="fs-head">
          <p className="fs-eyebrow">{CONSEQUENCES.eyebrow}</p>
          <h2 className="fs-title">{CONSEQUENCES.title}</h2>
          <p className="fs-dek">{CONSEQUENCES.dek}</p>
        </header>

        <ul className="cons-stats">
          {CONSEQUENCE_STATS.map((s) => (
            <li key={s.label} className="cons-stat">
              <span className="cons-stat-value">{s.value}</span>
              <span className="cons-stat-label">{s.label}</span>
            </li>
          ))}
        </ul>

        <div className="cons-body">
          {CONSEQUENCES.body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        <p className="fs-note">{CONSEQUENCES.note}</p>
      </div>
    </section>
  )
}
