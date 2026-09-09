// ── the (i) and its note ──────────────────────────────────────────────────
// One mark, one panel, used wherever a label or a row needs a sentence or
// three behind it: the model switch, the band row, the key's first row, the
// lookup's radius. The panel opens on hover or keyboard focus and hangs off
// the nearest `.map-key-pop-host`, so the mark can sit inside a label while
// the note escapes the label's own box. On a touch screen the mark is a
// toggle instead (see InfoMark below).
//
// The stylesheet travels with the component: both surfaces render these
// classes, and each skin lays its own surface over the shared structure.
import { useEffect, useMemo, useRef, useState } from 'react'
import './InfoMark.css'

interface Props {
  /** The panel's id, so the button can name it for assistive tech. */
  id: string
  label: string
  text: string
  /** Open below the host rather than above it — for a host near the top of
   *  its panel, where "above" is off the edge. */
  below?: boolean
}

/* Material Symbols "info", 300 weight, optical size 24 — the outlined ring
   rather than a filled disc. Material's own viewBox: the origin sits on the
   baseline, so the artwork runs from y −960 to 0. */
const INFO_PATH =
  'M450-290h60v-230h-60v230Zm52.92-307.75q9.39-9.29 9.39-23.02t-9.29-23.02q-9.29-9.28-23.02-9.28t-23.02 9.28q-9.29 9.29-9.29 23.02t9.39 23.02q9.38 9.29 22.92 9.29 13.54 0 22.92-9.29ZM480.07-100q-78.84 0-148.21-29.92t-120.68-81.21q-51.31-51.29-81.25-120.63Q100-401.1 100-479.93q0-78.84 29.92-148.21t81.21-120.68q51.29-51.31 120.63-81.25Q401.1-860 479.93-860q78.84 0 148.21 29.92t120.68 81.21q51.31 51.29 81.25 120.63Q860-558.9 860-480.07q0 78.84-29.92 148.21t-81.21 120.68q-51.29 51.31-120.63 81.25Q558.9-100 480.07-100Zm-.07-60q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z'

/** The mark. Place it inside the label or row it explains. */
export function InfoMark({ id, label }: Pick<Props, 'id' | 'label'>) {
  const ref = useRef<HTMLButtonElement>(null)
  // On a touch screen the mark is a toggle: a tap opens the note, a second
  // tap on the mark or a tap anywhere else closes it, Escape too, and the
  // mark says which state it is in. Hover has no tap, and plain focus was
  // tried in its place: it opened the note, but a second tap did nothing and
  // the mark never changed, so a reader could not tell the tap had landed
  // (the phone pass, PR #195). Read once: a pointer does not change kind
  // mid-session often enough to watch for.
  const touch = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches,
    [],
  )
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const host = ref.current?.closest('.map-key-pop-host')
    const onDown = (e: PointerEvent) => {
      if (host && e.target instanceof Node && host.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span className={`map-key-info${open ? ' is-open' : ''}`}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={touch ? open : undefined}
        onClick={touch ? () => setOpen((v) => !v) : undefined}
        // With a pointer that hovers, the note shows on keyboard focus and
        // nothing took it away; Escape gives the focus up, and the note with it.
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !touch) e.currentTarget.blur()
        }}
      >
        <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
          <path d={INFO_PATH} />
        </svg>
      </button>
    </span>
  )
}

/** The note. Place it as a direct child of the `.map-key-pop-host`. */
export function InfoPop({ id, text, below = false }: Pick<Props, 'id' | 'text' | 'below'>) {
  return (
    <span id={id} role="tooltip" className={`map-key-info-pop${below ? ' is-below' : ''}`}>
      {text}
    </span>
  )
}
