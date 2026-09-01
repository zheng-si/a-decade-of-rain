import { useEffect, useMemo, useRef, useState } from 'react'
import './StoryTypeTuner.css'

/**
 * A type dial for the nineteen places Courier handed back to Geist.
 *
 * Swapping a monospace for a proportional face at the same nominal size does
 * not keep the same optical size: Courier Prime is declared here with
 * `size-adjust: 88%` to bring its 0.60em advance back in line, and Geist has a
 * larger x-height on top of that. So every one of the nineteen is now rendering
 * at settings that were chosen for a different face — not just a size, but the
 * weight and the tracking that were picked to sit against it — and the only way
 * to settle that is to look at each one in place.
 *
 * Four dials per row, which is the set that actually moves under a face swap:
 * size, weight, case and tracking. Colour is deliberately absent — the palette
 * is settled and a face change does not disturb it.
 *
 * The same shape as the Archive's MapTuner, gated the same way. It writes a
 * single <style> element, so nothing here touches the shipped CSS — close the
 * panel or drop `?tune` and the page is exactly what it was. The copy block
 * emits the touched rows as a diff against the measured baseline, which is the
 * artefact that comes back to be folded into StorySkinV3.css by hand.
 */

/** Every row is one selector from the reclaims block in StorySkinV3.css, in
 *  the order the reader meets it. `label` is what the thing says on screen,
 *  because that is how it will be talked about, not by class name. */
const ROWS: { sel: string; label: string; where: string }[] = [
  { sel: '.story-rail-act', label: 'Act 1', where: 'rail' },
  { sel: '.story-rail-mark span', label: 'A Decade of Rain', where: 'rail' },
  { sel: '.story-dek', label: 'Operation Ranch Hand…', where: 'act card' },
  { sel: '.story-quote p', label: '“Only we can prevent forests.”', where: 'act card' },
  { sel: '.rainbow-card-name', label: 'All four agents', where: 'agents' },
  { sel: '.rainbow-stat strong', label: '19.5M', where: 'agents' },
  { sel: '.eco-headline strong', label: '24%', where: 'vegetation' },
  { sel: '.wall-value', label: '3.1M ha', where: 'photo wall' },
  { sel: '.wall-label', label: 'of forest and mangrove…', where: 'photo wall' },
  { sel: '.wall-stat-v', label: '36%', where: 'photo wall' },
  { sel: '.wall-stat-l', label: 'of the south’s mangrove…', where: 'photo wall' },
  { sel: '.alt-family h3', label: 'Containment only', where: 'strategies' },
  { sel: '.act2-card-name', label: 'Phú Cát', where: 'cleaning it up' },
  { sel: '.act2-closing', label: 'Phú Cát is sealed…', where: 'cleaning it up' },
  { sel: '.method-side', label: 'Passive Landfill', where: 'methods' },
  { sel: '.method-copy h3', label: 'method heading', where: 'methods' },
  { sel: '.method-rest-copy h3', label: 'Passive Landfill (heading)', where: 'methods' },
  { sel: '.tl-card-year', label: '2009', where: 'timeline' },
  { sel: '.close-action-name', label: 'USAID Vietnam', where: 'closing' },
]

/** 300 to 600, and every one of them is a real file in fontsGeist.css. No
 *  synthetic bold is reachable from this panel, which matters: a browser's
 *  faux-bold of a 500 looks like a weight that does not exist and would send
 *  a value back that cannot be shipped. */
const WEIGHTS = [300, 400, 500, 600] as const
const CASES = [
  { v: 'none', label: 'Ab' },
  { v: 'capitalize', label: 'Ab Cd' },
  { v: 'uppercase', label: 'ABCD' },
] as const

type Case = (typeof CASES)[number]['v']

type Cell = {
  size: number | null
  weight: number | null
  tcase: Case | null
  /** In em, always. Tracking is a proportion of the size it sits at, so a px
   *  value would come undone the moment the size dial next to it moves. */
  track: number | null
}

const EMPTY: Cell = { size: null, weight: null, tcase: null, track: null }
const STYLE_ID = 'story-type-tuner'

/** Read what the page is actually rendering, not what the CSS says.
 *
 *  Several of these mount only once their act scrolls in, so a read before
 *  that returns nothing and the row would seed itself with a zero. A row with
 *  no element yet stays null and is filled in on the next scroll. */
function measure(): Record<string, Cell | null> {
  const out: Record<string, Cell | null> = {}
  for (const r of ROWS) {
    const el = document.querySelector(`.story ${r.sel}`)
    if (!el) {
      out[r.sel] = null
      continue
    }
    const c = getComputedStyle(el)
    const fs = parseFloat(c.fontSize) || 16
    // `letterSpacing` comes back as px or the keyword; both become em here so
    // the number in the panel is the number that goes in the CSS.
    const lsPx = c.letterSpacing === 'normal' ? 0 : parseFloat(c.letterSpacing) || 0
    out[r.sel] = {
      size: Math.round(fs * 100) / 100,
      weight: parseInt(c.fontWeight, 10) || 400,
      tcase: (['none', 'capitalize', 'uppercase'].includes(c.textTransform)
        ? c.textTransform
        : 'none') as Case,
      track: Math.round((lsPx / fs) * 1000) / 1000,
    }
  }
  return out
}

export default function StoryTypeTuner() {
  const [open, setOpen] = useState(true)
  /** Only what the reader has touched. A property left null is never written,
   *  so an untouched row cannot pin a value it merely happened to measure at. */
  const [edit, setEdit] = useState<Record<string, Cell>>({})
  const [base, setBase] = useState<Record<string, Cell | null>>({})
  const [copied, setCopied] = useState(false)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  /* Baseline, filled in as the page scrolls.
   *
   * Most of the nineteen do not exist yet on load — their acts mount as they
   * come into view — so a single measurement at open leaves half the panel
   * reading "—" and the reader has to close and reopen it at every section.
   * Measuring on scroll instead means a row lights up the moment its section
   * arrives, which is also the moment you want to dial it.
   *
   * Fill-only, never overwrite: once a row has a baseline it keeps it, so the
   * "from" in the hand-off is always what the page shipped with and not
   * whatever this panel last wrote. */
  useEffect(() => {
    if (!open) return
    let raf = 0
    const sync = () => {
      raf = 0
      setBase((prev) => {
        const now = measure()
        let changed = false
        const next = { ...prev }
        for (const r of ROWS) {
          if (next[r.sel] == null && now[r.sel] != null) {
            next[r.sel] = now[r.sel]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync)
    }
    sync()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open])

  useEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }
    styleRef.current = el
    return () => {
      el?.remove()
      styleRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!styleRef.current) return
    const rules: string[] = []
    for (const r of ROWS) {
      const e = edit[r.sel]
      if (!e) continue
      const decls: string[] = []
      if (e.size != null) decls.push(`font-size:${e.size}px`)
      if (e.weight != null) decls.push(`font-weight:${e.weight}`)
      if (e.tcase != null) decls.push(`text-transform:${e.tcase}`)
      // 0 is a real answer here — it is how you take tracking off something
      // that shipped with some — so it is written rather than treated as unset.
      if (e.track != null) decls.push(`letter-spacing:${e.track}em`)
      if (decls.length) rules.push(`.story ${r.sel}{${decls.join(';')}}`)
    }
    styleRef.current.textContent = rules.join('\n')
  }, [edit])

  const touched = useMemo(
    () =>
      ROWS.filter((r) => {
        const e = edit[r.sel]
        return e && (e.size != null || e.weight != null || e.tcase != null || e.track != null)
      }),
    [edit],
  )

  /* px AND rem on the size, and the rem is the part that matters.
   *
   * Every size in this project is rem-based because the root font-size is the
   * density dial — 13.6px between 641 and 1600 wide, 16px above. So a px value
   * dialled here silently carries the width of the screen it was dialled on: a
   * row set to 16px on a 1440 laptop is 1.176rem, and writing `16px` into the
   * CSS would freeze at 1600+ what was chosen at 1440. Both numbers go into the
   * hand-off so the conversion is not left to be remembered.
   *
   * Tracking needs no such pair — it is already in em, which is a proportion of
   * whatever size the row ends up at. */
  const copyText = useMemo(() => {
    if (!touched.length) return '// nothing changed yet'
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const lines: string[] = []
    for (const r of touched) {
      const e = edit[r.sel]
      const b = base[r.sel]
      const parts: string[] = []
      if (e.size != null) {
        const rem = Math.round((e.size / root) * 10000) / 10000
        parts.push(`size ${b?.size ?? '?'}px -> ${e.size}px (${rem}rem)`)
      }
      if (e.weight != null) parts.push(`weight ${b?.weight ?? '?'} -> ${e.weight}`)
      if (e.tcase != null) parts.push(`case ${b?.tcase ?? '?'} -> ${e.tcase}`)
      if (e.track != null) parts.push(`track ${b?.track ?? '?'}em -> ${e.track}em`)
      lines.push(`${r.sel}\n    ${parts.join('\n    ')}`)
    }
    return [
      '// src/StorySkinV3.css — the reclaims block',
      `// dialled at ${Math.round(window.innerWidth)}px wide, 1rem = ${root}px`,
      ...lines,
    ].join('\n')
  }, [touched, edit, base])

  /** Setting a property back to what the page shipped with UNSETS it rather
   *  than recording it. Without this, pressing the case that is already active
   *  writes `uppercase -> uppercase` into the hand-off, and a row can end up
   *  marked as changed while looking identical — which makes the one question
   *  this panel exists to answer, what did I actually change, unanswerable
   *  from its own output. A row whose last edit is undone this way drops out
   *  of the list entirely. */
  const set = (sel: string, patch: Partial<Cell>) => {
    setEdit((s) => {
      const b = base[sel]
      const merged: Cell = { ...EMPTY, ...s[sel], ...patch }
      if (b) {
        if (merged.size === b.size) merged.size = null
        if (merged.weight === b.weight) merged.weight = null
        if (merged.tcase === b.tcase) merged.tcase = null
        if (merged.track === b.track) merged.track = null
      }
      const empty =
        merged.size == null && merged.weight == null && merged.tcase == null && merged.track == null
      const next = { ...s }
      if (empty) delete next[sel]
      else next[sel] = merged
      return next
    })
    setCopied(false)
  }
  const cur = (sel: string): Cell | null => {
    const b = base[sel]
    if (!b) return null
    const e = edit[sel]
    return {
      size: e?.size ?? b.size,
      weight: e?.weight ?? b.weight,
      tcase: e?.tcase ?? b.tcase,
      track: e?.track ?? b.track,
    }
  }
  const clear = (sel: string) => {
    setEdit((s) => {
      const n = { ...s }
      delete n[sel]
      return n
    })
    setCopied(false)
  }

  if (!open) {
    return (
      <button className="stt-reopen" onClick={() => setOpen(true)}>
        Type
      </button>
    )
  }

  return (
    <aside className="stt" aria-label="Story type tuner">
      <header className="stt-head">
        <strong>Type · the nineteen</strong>
        <button onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      </header>

      <p className="stt-note">
        Scroll a section into view before dialling it — a row that has not
        mounted yet reads as “—”. Size steps 0.5px, tracking 0.005em. Only what
        you touch is written.
      </p>

      <ol className="stt-list">
        {ROWS.map((r) => {
          const c = cur(r.sel)
          const e = edit[r.sel]
          const moved = touched.includes(r)
          return (
            <li key={r.sel} className={moved ? 'is-moved' : undefined}>
              <div className="stt-row-name">
                <span className="stt-label">{r.label}</span>
                <span className="stt-where">{r.where}</span>
                {moved && (
                  <button className="stt-undo" onClick={() => clear(r.sel)} aria-label="Reset row">
                    ↺
                  </button>
                )}
              </div>

              <div className="stt-dial">
                <span className="stt-dial-k">size</span>
                <button
                  onClick={() => c && set(r.sel, { size: Math.max(6, Math.round((c.size! - 0.5) * 100) / 100) })}
                  disabled={!c}
                  aria-label="Smaller"
                >
                  −
                </button>
                <span className={`stt-val${e?.size != null ? ' is-set' : ''}`}>
                  {c ? `${c.size}px` : '—'}
                </span>
                <button
                  onClick={() => c && set(r.sel, { size: Math.round((c.size! + 0.5) * 100) / 100 })}
                  disabled={!c}
                  aria-label="Larger"
                >
                  +
                </button>
              </div>

              <div className="stt-dial">
                <span className="stt-dial-k">wt</span>
                <div className="stt-seg">
                  {WEIGHTS.map((w) => (
                    <button
                      key={w}
                      className={c && c.weight === w ? 'is-on' : undefined}
                      disabled={!c}
                      onClick={() => set(r.sel, { weight: w })}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stt-dial">
                <span className="stt-dial-k">case</span>
                <div className="stt-seg">
                  {CASES.map((k) => (
                    <button
                      key={k.v}
                      className={c && c.tcase === k.v ? 'is-on' : undefined}
                      disabled={!c}
                      onClick={() => set(r.sel, { tcase: k.v })}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stt-dial">
                <span className="stt-dial-k">track</span>
                <button
                  onClick={() => c && set(r.sel, { track: Math.round((c.track! - 0.005) * 1000) / 1000 })}
                  disabled={!c}
                  aria-label="Tighter"
                >
                  −
                </button>
                <span className={`stt-val${e?.track != null ? ' is-set' : ''}`}>
                  {c ? `${c.track}em` : '—'}
                </span>
                <button
                  onClick={() => c && set(r.sel, { track: Math.round((c.track! + 0.005) * 1000) / 1000 })}
                  disabled={!c}
                  aria-label="Looser"
                >
                  +
                </button>
              </div>

              <code className="stt-sel">{r.sel}</code>
            </li>
          )
        })}
      </ol>

      <footer className="stt-foot">
        <button
          onClick={() => {
            setEdit({})
            setCopied(false)
          }}
        >
          Reset all
        </button>
        <button
          className="is-primary"
          onClick={() => {
            navigator.clipboard?.writeText(copyText)
            setCopied(true)
          }}
        >
          {copied ? 'Copied' : `Copy ${touched.length || ''}`}
        </button>
      </footer>

      <pre className="stt-out">{copyText}</pre>
    </aside>
  )
}
