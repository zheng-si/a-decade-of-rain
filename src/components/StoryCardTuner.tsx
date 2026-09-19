import { useEffect, useMemo, useRef, useState } from 'react'
import './StoryTypeTuner.css'
import './StoryCardTuner.css'

/**
 * A spacing dial for the story card: the picture, the year, the title, the
 * dek, the body, the stat pill and the account, and the six gaps between them,
 * with the four text sizes beside.
 *
 * The gaps are shown as the eye reads them, INK TO INK -- the lowest pixel of
 * the last line above to the highest pixel of the first line below -- not as
 * the margins that produce them. A margin of 4px under the title reads as 15
 * once the lines' own leading and the glyphs' ascenders are counted, and it is
 * the 15 that gets judged; the margin is shown small beneath it, because the
 * margin is what goes into the CSS. Where one side of a gap is a box rather
 * than text (the picture's frame, the stat pill, the rule above the account)
 * that edge is used instead.
 *
 * The ink is found without rasterising anything: a zero-size inline-block
 * dropped into the text gives the line's baseline, and the canvas measures the
 * same string in the same font for how far the glyphs reach above and below
 * it. Checked against a pixel scan of a screenshot: the same numbers.
 *
 * The panel measures the ACTIVE card, so scroll to the card whose numbers you
 * want; it re-reads on scroll and after every dial. Gated and built like
 * StoryTypeTuner: one <style> element, nothing in the shipped CSS, a copy
 * block in rem for folding into Story.css by hand.
 */

type Edge = 'ink' | 'box'
type Gap = {
  key: string
  label: string
  sel: string
  prop: 'margin-bottom' | 'margin-top'
  from: string
  fromEdge: Edge
  to: string
  toEdge: Edge
}

const GAPS: Gap[] = [
  {
    key: 'art',
    label: 'picture → year',
    sel: '.story-art',
    prop: 'margin-bottom',
    from: '.story-art',
    fromEdge: 'box',
    to: '.story-eyebrow',
    toEdge: 'ink',
  },
  {
    key: 'eyebrow',
    label: 'year → title',
    sel: '.story-eyebrow',
    prop: 'margin-bottom',
    from: '.story-eyebrow',
    fromEdge: 'ink',
    to: '.story-name',
    toEdge: 'ink',
  },
  {
    key: 'name',
    label: 'title → dek',
    sel: '.story-name',
    prop: 'margin-bottom',
    from: '.story-name',
    fromEdge: 'ink',
    to: '.story-dek',
    toEdge: 'ink',
  },
  {
    key: 'dek',
    label: 'dek → body',
    sel: '.story-dek',
    prop: 'margin-bottom',
    from: '.story-dek',
    fromEdge: 'ink',
    to: '.story-body',
    toEdge: 'ink',
  },
  {
    key: 'stat',
    label: 'body → stat pill',
    sel: '.story-stat',
    prop: 'margin-top',
    from: '.story-body',
    fromEdge: 'ink',
    to: '.story-stat',
    toEdge: 'box',
  },
  {
    key: 'quote',
    label: 'stat pill → rule',
    sel: '.story-quote',
    prop: 'margin-top',
    from: '.story-stat',
    fromEdge: 'box',
    to: '.story-quote',
    toEdge: 'box',
  },
]

const SIZES = [
  { key: 'eyebrow', label: 'year', sel: '.story-eyebrow' },
  { key: 'name', label: 'title', sel: '.story-name' },
  { key: 'dek', label: 'dek', sel: '.story-dek' },
  { key: 'body', label: 'body', sel: '.story-body' },
]

const STYLE_ID = 'story-card-tuner'

/* The panel only ever dials the desktop card; the deck (<= 1024px) keeps its
   own sizes and never shows the picture. */
const DESKTOP = '(min-width: 1025px)'

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const ctx = canvas?.getContext('2d') ?? null

/** The words on the element's first or last line, by where each word's box
 *  sits: a word whose top is the lowest top is on the first line, and so on. */
function lineText(el: Element, which: 'first' | 'last'): string {
  const lines = new Map<number, string[]>()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const r = document.createRange()
      r.setStart(node, m.index)
      r.setEnd(node, m.index + m[0].length)
      const top = Math.round(r.getBoundingClientRect().top)
      const words = lines.get(top) ?? []
      words.push(m[0])
      lines.set(top, words)
    }
  }
  const tops = [...lines.keys()].sort((a, b) => a - b)
  if (!tops.length) return ''
  return (lines.get(which === 'first' ? tops[0] : tops[tops.length - 1]) ?? []).join(' ')
}

/** The baseline of the element's first or last line, in viewport px: a
 *  zero-size inline-block sits on the baseline, so its top is the baseline. */
function baselineY(el: Element, which: 'first' | 'last'): number {
  const probe = document.createElement('span')
  probe.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline'
  if (which === 'first') el.insertBefore(probe, el.firstChild)
  else el.appendChild(probe)
  const y = probe.getBoundingClientRect().top
  probe.remove()
  return y
}

/** How far the glyphs of `text`, set as `el` sets them, reach above and below
 *  the baseline. */
function reach(el: Element, text: string): { up: number; down: number } {
  if (!ctx) return { up: 0, down: 0 }
  const cs = getComputedStyle(el)
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const t =
    cs.textTransform === 'uppercase' ? text.toUpperCase() : cs.textTransform === 'lowercase' ? text.toLowerCase() : text
  const m = ctx.measureText(t)
  return { up: m.actualBoundingBoxAscent, down: m.actualBoundingBoxDescent }
}

function bottomEdge(el: Element, edge: Edge): number {
  if (edge === 'box') return el.getBoundingClientRect().bottom
  return baselineY(el, 'last') + reach(el, lineText(el, 'last')).down
}

function topEdge(el: Element, edge: Edge): number {
  if (edge === 'box') return el.getBoundingClientRect().top
  return baselineY(el, 'first') - reach(el, lineText(el, 'first')).up
}

type Reading = { card: string; gaps: Record<string, number | null> }

function measureCard(): Reading | null {
  const card = document.querySelector('.story-card.is-active') ?? document.querySelector('.story-card')
  if (!card) return null
  const gaps: Record<string, number | null> = {}
  for (const g of GAPS) {
    const a = card.querySelector(g.from)
    const b = card.querySelector(g.to)
    if (!a || !b) {
      gaps[g.key] = null
      continue
    }
    gaps[g.key] = Math.round((topEdge(b, g.toEdge) - bottomEdge(a, g.fromEdge)) * 10) / 10
  }
  return { card: card.querySelector('.story-name')?.textContent ?? '', gaps }
}

/** What the CSS ships: the margins and sizes as rendered on the first card. */
function measureBase(): { gaps: Record<string, number>; sizes: Record<string, number> } | null {
  const card = document.querySelector('.story-card')
  if (!card) return null
  const gaps: Record<string, number> = {}
  for (const g of GAPS) {
    const el = card.querySelector(g.sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    gaps[g.key] = Math.round(parseFloat(g.prop === 'margin-top' ? cs.marginTop : cs.marginBottom) * 100) / 100
  }
  const sizes: Record<string, number> = {}
  for (const s of SIZES) {
    const el = card.querySelector(s.sel)
    if (el) sizes[s.key] = Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100
  }
  return { gaps, sizes }
}

const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
const rem = (px: number) => Math.round((px / rootPx()) * 10000) / 10000

export default function StoryCardTuner() {
  const [open, setOpen] = useState(true)
  const [base, setBase] = useState<ReturnType<typeof measureBase>>(null)
  /** Only what the reader has touched, in px. */
  const [gapEdit, setGapEdit] = useState<Record<string, number>>({})
  const [sizeEdit, setSizeEdit] = useState<Record<string, number>>({})
  const [reading, setReading] = useState<Reading | null>(null)
  const [copied, setCopied] = useState(false)
  const styleRef = useRef<HTMLStyleElement | null>(null)

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

  /* Baseline once, after the fonts are in: a size read off the fallback face
     is not the size the page ships. */
  useEffect(() => {
    let alive = true
    document.fonts.ready.then(() => {
      if (alive) setBase(measureBase())
    })
    return () => {
      alive = false
    }
  }, [])

  /* The overrides, as one style element, desktop only. */
  useEffect(() => {
    if (!styleRef.current) return
    const rules: string[] = []
    for (const g of GAPS) if (gapEdit[g.key] != null) rules.push(`.story ${g.sel}{${g.prop}:${gapEdit[g.key]}px}`)
    for (const s of SIZES) if (sizeEdit[s.key] != null) rules.push(`.story ${s.sel}{font-size:${sizeEdit[s.key]}px}`)
    styleRef.current.textContent = rules.length ? `@media ${DESKTOP}{${rules.join('')}}` : ''
  }, [gapEdit, sizeEdit])

  /* Read the active card after every dial, on scroll (the active card
     changes) and on resize (the root size changes), once the fonts are in. */
  useEffect(() => {
    if (!open) return
    let raf = 0
    const sync = () => {
      raf = 0
      setReading(measureCard())
    }
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(sync)
    }
    document.fonts.ready.then(ask)
    window.addEventListener('scroll', ask, { passive: true })
    window.addEventListener('resize', ask)
    /* The active card changes a beat after the scroll that brings it in
       (scrollama's offset), so watch the class flip itself. */
    const mo = new MutationObserver(ask)
    mo.observe(document.querySelector('.story') ?? document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })
    return () => {
      window.removeEventListener('scroll', ask)
      window.removeEventListener('resize', ask)
      mo.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open, gapEdit, sizeEdit])

  const touchedGaps = useMemo(() => GAPS.filter((g) => gapEdit[g.key] != null), [gapEdit])
  const touchedSizes = useMemo(() => SIZES.filter((s) => sizeEdit[s.key] != null), [sizeEdit])

  /** Dialling a value back to what the page shipped with unsets it, so the
   *  hand-off lists only real changes. */
  const setGap = (key: string, px: number) => {
    setGapEdit((s) => {
      const v = Math.round(Math.max(0, px) * 100) / 100
      const next = { ...s }
      if (base && v === base.gaps[key]) delete next[key]
      else next[key] = v
      return next
    })
    setCopied(false)
  }
  const setSize = (key: string, px: number) => {
    setSizeEdit((s) => {
      const v = Math.round(Math.max(6, px) * 100) / 100
      const next = { ...s }
      if (base && v === base.sizes[key]) delete next[key]
      else next[key] = v
      return next
    })
    setCopied(false)
  }
  const curGap = (key: string) => gapEdit[key] ?? base?.gaps[key] ?? null
  const curSize = (key: string) => sizeEdit[key] ?? base?.sizes[key] ?? null

  const copyText = useMemo(() => {
    if (!touchedGaps.length && !touchedSizes.length) return '// nothing changed yet'
    const root = rootPx()
    const lines: string[] = []
    for (const g of touchedGaps) {
      const from = base?.gaps[g.key]
      const to = gapEdit[g.key]
      const read = reading?.gaps[g.key]
      lines.push(
        `.story ${g.sel} { ${g.prop}: ${from != null ? `${rem(from)}rem -> ` : ''}${rem(to)}rem; }   /* ${g.label}${read != null ? `, reads ${read}px` : ''} */`,
      )
    }
    for (const s of touchedSizes) {
      const from = base?.sizes[s.key]
      const to = sizeEdit[s.key]
      lines.push(
        `.story ${s.sel} { font-size: ${from != null ? `${rem(from)}rem -> ` : ''}${rem(to)}rem; }   /* ${s.label}, ${to}px */`,
      )
    }
    return [
      '// src/pages/Story.css — the story card, desktop (>= 1025px)',
      `// dialled at ${Math.round(window.innerWidth)}px wide, 1rem = ${root}px, read on "${reading?.card ?? ''}"`,
      ...lines,
    ].join('\n')
  }, [touchedGaps, touchedSizes, gapEdit, sizeEdit, base, reading])

  if (!open) {
    return (
      <button className="stt-reopen sct-reopen" onClick={() => setOpen(true)}>
        Card
      </button>
    )
  }

  return (
    <aside className="stt sct" aria-label="Story card spacing tuner">
      <header className="stt-head">
        <strong>Card · spacing</strong>
        <button onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      </header>

      <p className="stt-note">
        The big number is the gap as read, ink to ink (or to a box edge: the picture&apos;s frame, the stat pill, the
        rule). The small one is the margin that makes it, which is what ships. Each step moves the margin 1px. Sizes
        step 0.5px. Only what you touch is written.
      </p>

      <p className="sct-card">
        reading <strong>{reading?.card || '—'}</strong>
      </p>

      <ol className="sct-list">
        <li className="sct-h">gaps</li>
        {GAPS.map((g) => {
          const m = curGap(g.key)
          const read = reading?.gaps[g.key]
          const set = gapEdit[g.key] != null
          return (
            <li key={g.key} className={set ? 'is-moved' : undefined}>
              <div className="stt-row-name">
                <span className="stt-label">{g.label}</span>
                {set && (
                  <button
                    className="stt-undo"
                    onClick={() => {
                      setGapEdit((s) => {
                        const n = { ...s }
                        delete n[g.key]
                        return n
                      })
                      setCopied(false)
                    }}
                    aria-label="Reset row"
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">gap</span>
                <button onClick={() => m != null && setGap(g.key, m - 1)} disabled={m == null} aria-label="Tighter">
                  −
                </button>
                <span className={`sct-big${set ? ' is-set' : ''}`}>{read != null ? `${read}px` : '—'}</span>
                <button onClick={() => m != null && setGap(g.key, m + 1)} disabled={m == null} aria-label="Looser">
                  +
                </button>
                <span className="sct-sub">{m != null ? `${g.prop} ${m}px · ${rem(m)}rem` : ''}</span>
              </div>
            </li>
          )
        })}

        <li className="sct-h">sizes</li>
        {SIZES.map((s) => {
          const v = curSize(s.key)
          const set = sizeEdit[s.key] != null
          return (
            <li key={s.key} className={set ? 'is-moved' : undefined}>
              <div className="stt-row-name">
                <span className="stt-label">{s.label}</span>
                {set && (
                  <button
                    className="stt-undo"
                    onClick={() => {
                      setSizeEdit((e) => {
                        const n = { ...e }
                        delete n[s.key]
                        return n
                      })
                      setCopied(false)
                    }}
                    aria-label="Reset row"
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">size</span>
                <button onClick={() => v != null && setSize(s.key, v - 0.5)} disabled={v == null} aria-label="Smaller">
                  −
                </button>
                <span className={`sct-big${set ? ' is-set' : ''}`}>{v != null ? `${v}px` : '—'}</span>
                <button onClick={() => v != null && setSize(s.key, v + 0.5)} disabled={v == null} aria-label="Larger">
                  +
                </button>
                <span className="sct-sub">{v != null ? `${rem(v)}rem` : ''}</span>
              </div>
            </li>
          )
        })}
      </ol>

      <footer className="stt-foot">
        <button
          onClick={() => {
            setGapEdit({})
            setSizeEdit({})
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
          {copied ? 'Copied' : `Copy ${touchedGaps.length + touchedSizes.length || ''}`}
        </button>
      </footer>

      <pre className="stt-out">{copyText}</pre>
    </aside>
  )
}
