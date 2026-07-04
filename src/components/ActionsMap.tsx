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

// Which side of the dot the label chip sits on (right chips would run off the
// traced map's eastern edge for the two coastal bases).
const CHIP_SIDE: Record<string, 'left' | 'right'> = {
  danang: 'left',
  phucat: 'left',
  bienhoa: 'left',
}

// Act II locator, styled after the Figma design: the traced wartime vegetation
// map washed to a light sage, with red dot-and-chip pins for the three bases.
// Static by design; the interactive map is Act I's job.
export default function ActionsMap() {
  return (
    <figure
      className="act2-map-fig"
      role="img"
      aria-label="Locator map of the three dioxin hotspot air bases, Đà Nẵng, Phú Cát and Biên Hòa, down the central and southern coast of Vietnam"
    >
      <div className="act2-map-veg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: vegRaw }} />

      <div className="act2-pins" aria-hidden="true">
        {HOTSPOTS.map((h) => {
          const px = PIN_PX[h.key]
          if (!px) return null
          const [x, y] = px
          return (
            <div
              key={h.key}
              className="act2-pin"
              style={{ left: `${(x / 494) * 100}%`, top: `${(y / 750) * 100}%` }}
            >
              <span className={`act2-chip is-${CHIP_SIDE[h.key]}`}>{h.name} Airbase</span>
              <i className="act2-dot" />
            </div>
          )
        })}
      </div>
    </figure>
  )
}
