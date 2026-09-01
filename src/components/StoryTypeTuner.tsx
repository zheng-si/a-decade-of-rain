import { useEffect, useMemo, useRef, useState } from 'react'
import './StoryTypeTuner.css'

/**
 * A size dial for the nineteen places Courier handed back to Geist.
 *
 * Swapping a monospace for a proportional face at the same nominal size does
 * not keep the same optical size: Courier Prime is declared here with
 * `size-adjust: 88%` to bring its 0.60em advance back in line, and Geist has a
 * larger x-height on top of that. So every one of the nineteen is now rendering
 * at a size that was chosen for a different face, and the only way to settle
 * that is to look at each one in place.
 *
 * Hence this: the same shape as the Archive's MapTuner, gated the same way.
 * It writes a single <style> element with a rule per row, so nothing here
 * touches the shipped CSS — close the panel or drop `?tune` and the page is
 * exactly what it was. The copy block emits the same nineteen rows as a diff
 * against the measured baseline, which is the artefact that comes back to be
 * folded into StorySkinV3.css by hand.
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

const STYLE_ID = 'story-type-tuner'

/** Read what the page is actually rendering, not what the CSS says.
 *
 *  Several of these mount only once their act scrolls in, so a size read
 *  before that returns nothing and the row would seed itself with a zero. A
 *  row with no element yet stays null and is re-read on the next open, which
 *  is why the panel re-measures every time it is unfolded rather than once. */
function measure(): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const r of ROWS) {
    const el = document.querySelector(`.story ${r.sel}`)
    out[r.sel] = el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100 : null
  }
  return out
}

export default function StoryTypeTuner() {
  const [open, setOpen] = useState(true)
  /** The size each row is set to, or null for "leave it alone". Only rows the
   *  reader has actually touched go into the stylesheet, so an untouched row
   *  cannot pin a size it merely happened to measure at. */
  const [size, setSize] = useState<Record<string, number | null>>({})
  const [base, setBase] = useState<Record<string, number | null>>({})
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
   * "from" in the hand-off is always the size the page shipped with and not
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
    const rules = ROWS.filter((r) => size[r.sel] != null)
      .map((r) => `.story ${r.sel}{font-size:${size[r.sel]}px}`)
      .join('\n')
    styleRef.current.textContent = rules
  }, [size])

  const touched = useMemo(() => ROWS.filter((r) => size[r.sel] != null), [size])

  /* px AND rem, and the rem is the part that matters.
   *
   * Every size in this project is rem-based because the root font-size is the
   * density dial — 13.6px between 641 and 1600 wide, 16px above. So a px value
   * dialled here silently carries the width of the screen it was dialled on: a
   * row set to 16px on a 1440 laptop is 1.176rem, and writing `16px` into the
   * CSS would freeze at 1600+ what was chosen at 1440. Both numbers go into
   * the hand-off so the conversion is not left to be remembered. */
  const copyText = useMemo(() => {
    if (!touched.length) return '// nothing changed yet'
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const lines = touched.map((r) => {
      const from = base[r.sel]
      const to = size[r.sel] as number
      const rem = Math.round((to / root) * 10000) / 10000
      return `${r.sel}  ${from == null ? '?' : from}px -> ${to}px  (${rem}rem)`
    })
    return [
      '// src/StorySkinV3.css — the reclaims block',
      `// dialled at ${Math.round(window.innerWidth)}px wide, 1rem = ${root}px`,
      ...lines,
    ].join('\n')
  }, [touched, size, base])

  const bump = (sel: string, by: number) => {
    setSize((s) => {
      const from = s[sel] ?? base[sel]
      if (from == null) return s
      return { ...s, [sel]: Math.max(6, Math.round((from + by) * 100) / 100) }
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
        mounted yet reads as “—”. Only rows you touch are written.
      </p>

      <ol className="stt-list">
        {ROWS.map((r) => {
          const cur = size[r.sel] ?? base[r.sel]
          const from = base[r.sel]
          const moved = size[r.sel] != null && from != null && size[r.sel] !== from
          return (
            <li key={r.sel} className={moved ? 'is-moved' : undefined}>
              <div className="stt-row-name">
                <span className="stt-label">{r.label}</span>
                <span className="stt-where">{r.where}</span>
              </div>
              <div className="stt-row-dial">
                <button onClick={() => bump(r.sel, -0.5)} disabled={cur == null} aria-label="Smaller">
                  −
                </button>
                <span className="stt-val">{cur == null ? '—' : `${cur}px`}</span>
                <button onClick={() => bump(r.sel, 0.5)} disabled={cur == null} aria-label="Larger">
                  +
                </button>
                {moved && (
                  <button
                    className="stt-undo"
                    onClick={() => {
                      setSize((s) => {
                        const n = { ...s }
                        delete n[r.sel]
                        return n
                      })
                      setCopied(false)
                    }}
                    aria-label="Reset this row"
                  >
                    ↺
                  </button>
                )}
              </div>
              <code className="stt-sel">{r.sel}</code>
            </li>
          )
        })}
      </ol>

      <footer className="stt-foot">
        <button
          onClick={() => {
            setSize({})
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
