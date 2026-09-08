// ── the (i) and its note ──────────────────────────────────────────────────
// One mark, one panel, used wherever a label or a row needs a sentence or
// three behind it: the model switch, the band row, the key's first row, the
// lookup's radius. The panel opens on hover or keyboard focus and hangs off
// the nearest `.map-key-pop-host`, so the mark can sit inside a label while
// the note escapes the label's own box.

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
  return (
    <span className="map-key-info">
      <button type="button" aria-label={label} aria-describedby={id}>
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
