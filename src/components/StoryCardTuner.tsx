import { useEffect, useMemo, useRef, useState } from 'react'
import './StoryTypeTuner.css'
import './StoryCardTuner.css'

/**
 * A spacing dial for the story card: the picture, the year, the title, the
 * dek, the body, the stat pill and the account, and the six gaps between them,
 * with the four texts' size, face, weight, opacity, colour, tracking and
 * case beside.
 *
 * The gaps are shown as type is measured, BASELINE TO CAP HEIGHT -- the
 * baseline of the last line above to the top of a capital on the first line
 * below -- not as the margins that produce them. A margin of 4px under the
 * title reads as 14 once the lines' own leading is counted, and it is the 14
 * that gets judged; the margin is shown small beneath it, because the margin
 * is what goes into the CSS. Where one side of a gap is a box rather than
 * text (the picture's frame, the stat pill, the rule above the account) that
 * edge is used instead.
 *
 * Baseline to cap height, and not the ink of the actual letters, so that the
 * same CSS reads the same on every card. The ink was tried first: a title
 * ending in a g, a dek with no descender at all, a name with a diacritic on
 * its first line, each moved the number by a pixel or three from one card to
 * the next, and the canvas reports glyph bounds in whole pixels besides. A
 * descender still hangs into the gap by about 0.2em, on every card alike.
 *
 * Nothing is rasterised: a zero-size inline-block dropped into the text gives
 * the line's baseline, and the canvas measures a capital H in the same font
 * for the cap height, at 16x the size for sub-pixel precision.
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

const TEXTS = [
  { key: 'eyebrow', label: 'year', sel: '.story-eyebrow' },
  { key: 'name', label: 'title', sel: '.story-name' },
  { key: 'dek', label: 'dek', sel: '.story-dek' },
  { key: 'body', label: 'body', sel: '.story-body' },
]

/* The two faces the page has, by the token that names them, so what the
   panel writes is what ships. Courier Prime comes in 400 and 700, Geist in
   300 to 600; every weight listed is a real file, no faux bold. */
type Face = 'courier' | 'geist'
const FACES: { v: Face; label: string; token: string; weights: number[] }[] = [
  { v: 'courier', label: 'Courier', token: 'var(--font-serif)', weights: [400, 700] },
  { v: 'geist', label: 'Geist', token: 'var(--font-sans)', weights: [300, 400, 500, 600] },
]
const faceOf = (family: string): Face => (/geist/i.test(family) ? 'geist' : 'courier')

/* The three colours the card's texts ship in, by token: the ivory of the
   title and the dek, the soft sage of the body, the coral of the year. A
   text's colour is recognised by what it computes to, so one set by any
   route still lands on its button, and one that is none of these shows as
   the rgb it is. */
const COLOURS: { label: string; token: string }[] = [
  { label: 'text', token: 'var(--forest-text)' },
  { label: 'soft', token: 'var(--forest-text-soft)' },
  { label: 'accent', token: 'var(--accent-bright)' },
]

const CASES = [
  { v: 'uppercase', label: 'ALL CAPS' },
  { v: 'capitalize', label: 'Initial Cap' },
  { v: 'none', label: 'natural' },
] as const
type Case = (typeof CASES)[number]['v']

type Text = {
  size: number
  face: Face
  weight: number
  opacity: number
  /** A token from COLOURS, or the computed rgb when the text is in none of them. */
  color: string
  /** In em: a proportion of the size, so the size dial beside it cannot undo it. */
  track: number
  tcase: Case
}

const STYLE_ID = 'story-card-tuner'

/* The panel only ever dials the desktop card; the deck (<= 1024px) keeps its
   own sizes and never shows the picture. */
const DESKTOP = '(min-width: 1025px)'

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const ctx = canvas?.getContext('2d') ?? null

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

/** The cap height of the element's font: how far a capital reaches above the
 *  baseline. Measured at 16x and scaled back, since the canvas reports glyph
 *  bounds in whole pixels. */
function capHeight(el: Element): number {
  if (!ctx) return 0
  const cs = getComputedStyle(el)
  const px = parseFloat(cs.fontSize) || 16
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${px * 16}px ${cs.fontFamily}`
  return ctx.measureText('H').actualBoundingBoxAscent / 16
}

function bottomEdge(el: Element, edge: Edge): number {
  if (edge === 'box') return el.getBoundingClientRect().bottom
  return baselineY(el, 'last')
}

function topEdge(el: Element, edge: Edge): number {
  if (edge === 'box') return el.getBoundingClientRect().top
  return baselineY(el, 'first') - capHeight(el)
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

/** What a colour token computes to inside the card, as the browser writes
 *  it, for matching against a text's computed colour. */
function resolveColour(card: Element, token: string): string {
  const probe = document.createElement('span')
  probe.style.color = token
  card.appendChild(probe)
  const c = getComputedStyle(probe).color
  probe.remove()
  return c
}

/** What the CSS ships: the margins and the texts as rendered on the first card. */
function measureBase(): { gaps: Record<string, number>; texts: Record<string, Text> } | null {
  const card = document.querySelector('.story-card')
  if (!card) return null
  const gaps: Record<string, number> = {}
  for (const g of GAPS) {
    const el = card.querySelector(g.sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    gaps[g.key] = Math.round(parseFloat(g.prop === 'margin-top' ? cs.marginTop : cs.marginBottom) * 100) / 100
  }
  const texts: Record<string, Text> = {}
  const colours = COLOURS.map((c) => ({ token: c.token, rgb: resolveColour(card, c.token) }))
  for (const t of TEXTS) {
    const el = card.querySelector(t.sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    const size = Math.round(parseFloat(cs.fontSize) * 100) / 100
    // `letterSpacing` comes back as px or the keyword; it is kept in em.
    const lsPx = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0
    texts[t.key] = {
      size,
      face: faceOf(cs.fontFamily),
      weight: parseInt(cs.fontWeight, 10) || 400,
      opacity: Math.round(parseFloat(cs.opacity) * 100) / 100,
      color: colours.find((c) => c.rgb === cs.color)?.token ?? cs.color,
      track: size ? Math.round((lsPx / size) * 1000) / 1000 : 0,
      tcase: CASES.find((k) => k.v === cs.textTransform)?.v ?? 'none',
    }
  }
  return { gaps, texts }
}

const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
const rem = (px: number) => Math.round((px / rootPx()) * 10000) / 10000

export default function StoryCardTuner() {
  const [open, setOpen] = useState(true)
  const [base, setBase] = useState<ReturnType<typeof measureBase>>(null)
  /** Only what the reader has touched, in px. */
  const [gapEdit, setGapEdit] = useState<Record<string, number>>({})
  const [textEdit, setTextEdit] = useState<Record<string, Partial<Text>>>({})
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
    for (const t of TEXTS) {
      const e = textEdit[t.key]
      if (!e) continue
      const decls: string[] = []
      if (e.size != null) decls.push(`font-size:${e.size}px`)
      if (e.face != null) decls.push(`font-family:${FACES.find((f) => f.v === e.face)!.token}`)
      if (e.weight != null) decls.push(`font-weight:${e.weight}`)
      if (e.opacity != null) decls.push(`opacity:${e.opacity}`)
      if (e.color != null) decls.push(`color:${e.color}`)
      // 0 is a real answer here: it is how tracking comes off a text.
      if (e.track != null) decls.push(`letter-spacing:${e.track}em`)
      if (e.tcase != null) decls.push(`text-transform:${e.tcase}`)
      if (decls.length) rules.push(`.story ${t.sel}{${decls.join(';')}}`)
    }
    styleRef.current.textContent = rules.length ? `@media ${DESKTOP}{${rules.join('')}}` : ''
  }, [gapEdit, textEdit])

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
  }, [open, gapEdit, textEdit])

  const touchedGaps = useMemo(() => GAPS.filter((g) => gapEdit[g.key] != null), [gapEdit])
  const touchedTexts = useMemo(
    () => TEXTS.filter((t) => Object.values(textEdit[t.key] ?? {}).some((v) => v != null)),
    [textEdit],
  )

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
  /** One property of one text row. A value dialled back to the base is
   *  unset; a row with nothing set left drops out of the hand-off. */
  const setText = (key: string, patch: Partial<Text>) => {
    setTextEdit((s) => {
      const b = base?.texts[key]
      const merged: Partial<Text> = { ...s[key], ...patch }
      if (b) for (const k of Object.keys(merged) as (keyof Text)[]) if (merged[k] === b[k]) delete merged[k]
      const next = { ...s }
      if (Object.keys(merged).length) next[key] = merged
      else delete next[key]
      return next
    })
    setCopied(false)
  }
  const curGap = (key: string) => gapEdit[key] ?? base?.gaps[key] ?? null
  const curText = (key: string): Text | null => {
    const b = base?.texts[key]
    if (!b) return null
    return { ...b, ...textEdit[key] }
  }

  const copyText = useMemo(() => {
    if (!touchedGaps.length && !touchedTexts.length) return '// nothing changed yet'
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
    for (const t of touchedTexts) {
      const b = base?.texts[t.key]
      const e = textEdit[t.key]
      const decls: string[] = []
      if (e.size != null) decls.push(`font-size: ${b ? `${rem(b.size)}rem -> ` : ''}${rem(e.size)}rem`)
      if (e.face != null) {
        const tok = (f: Face) => FACES.find((x) => x.v === f)!.token
        decls.push(`font-family: ${b ? `${tok(b.face)} -> ` : ''}${tok(e.face)}`)
      }
      if (e.weight != null) decls.push(`font-weight: ${b ? `${b.weight} -> ` : ''}${e.weight}`)
      if (e.opacity != null) decls.push(`opacity: ${b ? `${b.opacity} -> ` : ''}${e.opacity}`)
      if (e.color != null) decls.push(`color: ${b ? `${b.color} -> ` : ''}${e.color}`)
      if (e.track != null) decls.push(`letter-spacing: ${b ? `${b.track}em -> ` : ''}${e.track}em`)
      if (e.tcase != null) decls.push(`text-transform: ${b ? `${b.tcase} -> ` : ''}${e.tcase}`)
      lines.push(`.story ${t.sel} { ${decls.join('; ')}; }   /* ${t.label}${e.size != null ? `, ${e.size}px` : ''} */`)
    }
    return [
      '// src/pages/Story.css — the story card, desktop (>= 1025px)',
      `// dialled at ${Math.round(window.innerWidth)}px wide, 1rem = ${root}px, read on "${reading?.card ?? ''}"`,
      ...lines,
    ].join('\n')
  }, [touchedGaps, touchedTexts, gapEdit, textEdit, base, reading])

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
        The big number is the gap as measured, baseline to cap height (or to a box edge: the picture&apos;s frame, the
        stat pill, the rule), the same on every card for the same CSS. The small one is the margin that makes it, which
        is what ships. Each step moves the margin 1px. Sizes step 0.5px, opacity 0.05, tracking 0.005em; the faces,
        weights and colours are the ones the page has (soft is the body&apos;s). Only what you touch is written.
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

        <li className="sct-h">text</li>
        {TEXTS.map((t) => {
          const v = curText(t.key)
          const e = textEdit[t.key] ?? {}
          const set = Object.values(e).some((x) => x != null)
          const weights = FACES.find((f) => f.v === v?.face)?.weights ?? []
          return (
            <li key={t.key} className={set ? 'is-moved' : undefined}>
              <div className="stt-row-name">
                <span className="stt-label">{t.label}</span>
                {set && (
                  <button
                    className="stt-undo"
                    onClick={() => {
                      setTextEdit((s) => {
                        const n = { ...s }
                        delete n[t.key]
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
                <button
                  onClick={() => v && setText(t.key, { size: Math.max(6, v.size - 0.5) })}
                  disabled={!v}
                  aria-label="Smaller"
                >
                  −
                </button>
                <span className={`sct-big${e.size != null ? ' is-set' : ''}`}>{v ? `${v.size}px` : '—'}</span>
                <button onClick={() => v && setText(t.key, { size: v.size + 0.5 })} disabled={!v} aria-label="Larger">
                  +
                </button>
                <span className="sct-sub">{v ? `${rem(v.size)}rem` : ''}</span>
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">face</span>
                <div className="stt-seg">
                  {FACES.map((f) => (
                    <button
                      key={f.v}
                      className={v && v.face === f.v ? 'is-on' : undefined}
                      disabled={!v}
                      onClick={() => setText(t.key, { face: f.v })}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {e.face != null && <span className="sct-sub is-set">set</span>}
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">weight</span>
                <div className="stt-seg">
                  {weights.map((w) => (
                    <button
                      key={w}
                      className={v && v.weight === w ? 'is-on' : undefined}
                      disabled={!v}
                      onClick={() => setText(t.key, { weight: w })}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                {v && !weights.includes(v.weight) && <span className="sct-sub">{v.weight}, not in this face</span>}
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">opacity</span>
                <button
                  onClick={() =>
                    v && setText(t.key, { opacity: Math.max(0.3, Math.round((v.opacity - 0.05) * 100) / 100) })
                  }
                  disabled={!v}
                  aria-label="Fainter"
                >
                  −
                </button>
                <span className={`sct-big${e.opacity != null ? ' is-set' : ''}`}>{v ? v.opacity : '—'}</span>
                <button
                  onClick={() =>
                    v && setText(t.key, { opacity: Math.min(1, Math.round((v.opacity + 0.05) * 100) / 100) })
                  }
                  disabled={!v}
                  aria-label="Stronger"
                >
                  +
                </button>
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">colour</span>
                <div className="stt-seg">
                  {COLOURS.map((c) => (
                    <button
                      key={c.token}
                      className={v && v.color === c.token ? 'is-on' : undefined}
                      disabled={!v}
                      onClick={() => setText(t.key, { color: c.token })}
                    >
                      <i className="sct-swatch" style={{ background: c.token }} />
                      {c.label}
                    </button>
                  ))}
                </div>
                {v && !COLOURS.some((c) => c.token === v.color) && <span className="sct-sub">{v.color}</span>}
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">track</span>
                <button
                  onClick={() =>
                    v && setText(t.key, { track: Math.max(-0.1, Math.round((v.track - 0.005) * 1000) / 1000) })
                  }
                  disabled={!v}
                  aria-label="Tighter tracking"
                >
                  −
                </button>
                <span className={`sct-big${e.track != null ? ' is-set' : ''}`}>{v ? `${v.track}em` : '—'}</span>
                <button
                  onClick={() =>
                    v && setText(t.key, { track: Math.min(1, Math.round((v.track + 0.005) * 1000) / 1000) })
                  }
                  disabled={!v}
                  aria-label="Looser tracking"
                >
                  +
                </button>
                <span className="sct-sub">{v ? `${Math.round(v.track * v.size * 100) / 100}px` : ''}</span>
              </div>
              <div className="stt-dial">
                <span className="stt-dial-k">case</span>
                <div className="stt-seg">
                  {CASES.map((k) => (
                    <button
                      key={k.v}
                      className={v && v.tcase === k.v ? 'is-on' : undefined}
                      disabled={!v}
                      onClick={() => setText(t.key, { tcase: k.v })}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <footer className="stt-foot">
        <button
          onClick={() => {
            setGapEdit({})
            setTextEdit({})
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
          {copied ? 'Copied' : `Copy ${touchedGaps.length + touchedTexts.length || ''}`}
        </button>
      </footer>

      <pre className="stt-out">{copyText}</pre>
    </aside>
  )
}
