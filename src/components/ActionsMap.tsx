import vegRaw from '../figures/vegetation-map.svg?raw'
import { HOTSPOTS } from '../content/actions/hotspots'

// Pixel positions of the three air bases on the 494x750 traced vegetation map.
// Derived from the overlay control points (scripts/overlay/cp.json): a global
// affine fit corrected against the nearest coastline anchors, then verified by
// eye against the rendered coastline. The tracing is non-uniform, so these are
// good to roughly 15 px (~20 km), which is plenty for a country-scale locator.
const PIN_PX: Record<string, [number, number]> = {
  danang: [366, 87],
  phucat: [443, 282],
  bienhoa: [395, 527],
}

// Label placement per pin: which side of the dot the text sits on.
const LABEL_SIDE: Record<string, 'left' | 'right'> = {
  danang: 'left',
  phucat: 'left',
  bienhoa: 'left',
}

// Act II locator: the three dioxin hotspot air bases pinned on the same
// redrawn wartime vegetation map used in Act I. Static by design; it orients
// the reader, the interactive map already lives in Act I.
export default function ActionsMap() {
  return (
    <figure
      className="act2-map-fig"
      role="img"
      aria-label="Locator map of the three dioxin hotspot air bases, Đà Nẵng, Phú Cát and Biên Hòa, down the central and southern coast of Vietnam"
    >
      <div className="act2-map-veg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: vegRaw }} />

      <svg className="act2-map-pins" viewBox="0 0 494 750" aria-hidden="true">
        {HOTSPOTS.map((h) => {
          const px = PIN_PX[h.key]
          if (!px) return null
          const [x, y] = px
          const side = LABEL_SIDE[h.key]
          const s = h.status.toLowerCase()
          return (
            <g key={h.key} className={`act2-svgpin is-${s}`}>
              <circle className="act2-svgpin-ring" cx={x} cy={y} r={11} />
              <circle className="act2-svgpin-dot" cx={x} cy={y} r={5.5} />
              <text
                className="act2-svgpin-name"
                x={side === 'left' ? x - 17 : x + 17}
                y={y - 1}
                textAnchor={side === 'left' ? 'end' : 'start'}
              >
                {h.name}
              </text>
              <text
                className="act2-svgpin-status"
                x={side === 'left' ? x - 17 : x + 17}
                y={y + 13}
                textAnchor={side === 'left' ? 'end' : 'start'}
              >
                {h.status} · {h.statusYear}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
