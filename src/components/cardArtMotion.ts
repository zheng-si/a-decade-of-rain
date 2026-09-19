/* The moving parts of the C illustrations, ported from the illustrator's
   C/app.js (handoff of 2026-09-19) with the geometry unchanged: the spray
   fans on 01/03/05, the ramp chevrons on 02, the boat and its wake on 04,
   the drum's liquid on 06, the row highlights on 07, the chart scan on 08.
   Coordinates are source-image pixels on a 1536x1024 viewBox laid over the
   PNG in the same frame (both fitted `contain`, so both letterbox alike).

   t runs 0..1 over the preview's 8000ms master cycle. The preview loops;
   the page plays each card once, the first time it is active, up to the
   scene's `end` and then shows its `rest`: the sprays out and staying, the
   drum's pool grown, the boat at rest, the chevrons and row highlights
   gone, the scan finished. The rest is also what a reader who asked for
   reduced motion sees, in place of the play. */

const NS = 'http://www.w3.org/2000/svg'

export const MASTER_MS = 8000

export type Motion = {
  /** Paint the frame at t, a fraction of the master cycle. */
  paint: (t: number) => void
  /** Where the single play stops, as a fraction of the master cycle. */
  end: number
  /** The resting picture, painted once the play is over. */
  rest: () => void
}

type Attrs = Record<string, string | number>

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent.append(e)
  return e
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (t: number) => Math.max(0, Math.min(1, t))

/* Spray fans: start x,y (the boom) to end x,y, three per aircraft. */
const SPRAY: Record<string, [number, number, number, number][]> = {
  begins: [
    [503, 239, 1170, 420],
    [504, 241, 1138, 446],
    [503, 243, 1080, 456],
  ],
  peak: [
    [625, 116, 1118, 325],
    [873, 165, 1328, 362],
    [1140, 231, 1439, 363],
  ],
  'a-sau': [
    [240, 82, 1260, 412],
    [251, 103, 1228, 484],
    [241, 112, 1178, 556],
  ],
}

/* Drum tops on 07, by row from the back. */
const ROWS: [number, number][][] = [
  [[767, 94]],
  [
    [655, 155],
    [879, 156],
  ],
  [
    [544, 213],
    [768, 215],
    [991, 215],
  ],
  [
    [432, 273],
    [655, 276],
    [878, 276],
    [1103, 278],
  ],
  [
    [315, 333],
    [544, 337],
    [769, 337],
    [990, 337],
    [1217, 337],
  ],
  [
    [202, 395],
    [430, 397],
    [657, 397],
    [881, 397],
    [1106, 397],
    [1334, 397],
  ],
  [
    [315, 458],
    [546, 458],
    [770, 458],
    [994, 458],
    [1220, 458],
  ],
  [
    [431, 521],
    [659, 520],
    [881, 520],
    [1109, 520],
  ],
  [
    [545, 584],
    [771, 585],
    [996, 585],
  ],
  [
    [655, 645],
    [880, 646],
  ],
  [[768, 711]],
]

let clipSeq = 0

/** Build the overlay for one card into `svg` (emptied first), or null for a
 *  card with no moving parts. */
export function mountMotion(svg: SVGSVGElement, id: string): Motion | null {
  svg.replaceChildren()
  const motions: ((t: number) => void)[] = []
  const paint = (t: number) => {
    for (const m of motions) m(t)
  }

  if (SPRAY[id]) {
    /* 01 sprays in ivory: the first test runs were not Agent Orange. */
    const color = id === 'begins' ? '#e8ece6' : '#E9954B'
    const halfWidth = id === 'peak' ? 3.4 : 6.2
    SPRAY[id].forEach((a, i) => {
      const p = el('polygon', { fill: color }, svg)
      motions.push((t) => {
        const u = (t - i * 0.045 + 1) % 1
        const reach = clamp(u / 0.48)
        const fade = 1 - clamp((u - 0.72) / 0.2)
        const [x, y, ex, ey] = a
        const dx = ex - x
        const dy = ey - y
        const l = Math.hypot(dx, dy)
        const w = halfWidth * reach
        const px = (-dy / l) * w
        const py = (dx / l) * w
        const tx = lerp(x, ex, reach)
        const ty = lerp(y, ey, reach)
        p.setAttribute(
          'points',
          `${x},${y} ${lerp(x, tx, 0.58) + px},${lerp(y, ty, 0.58) + py} ${tx},${ty} ${lerp(x, tx, 0.58) - px},${lerp(y, ty, 0.58) - py}`,
        )
        p.setAttribute('opacity', String(fade))
      })
    })
    /* Every fan is out by t = 0.6 and none has begun to fade; that is the
       picture that stays. */
    return { paint, end: 0.6, rest: () => paint(0.6) }
  }

  if (id === 'mangroves') {
    const wake = el('g', {}, svg)
    const rings = [0, 1, 2].map(() => el('ellipse', { fill: 'none', stroke: '#d1dfcf', 'stroke-width': 3 }, wake))
    const g = el('g', {}, svg)
    const boat = el('g', { transform: 'rotate(-34)' }, g)
    el('path', { d: 'M-70 0 Q-40 -29 70 0 Q30 37 -70 0Z', fill: '#213528' }, boat)
    el('path', { d: 'M-70 -8 Q-20 -47 70 -8 Q35 26 -70 -8Z', fill: '#e8ece6' }, boat)
    el('path', { d: 'M-54 -9 Q-12 -34 54 -9 Q20 13 -54 -9Z', fill: '#294735' }, boat)
    for (const x of [-30, -5, 20, 40]) {
      el(
        'path',
        {
          d: `M${x - 7} ${-22 + Math.abs(x) * 0.19} L${x + 3} ${4 - Math.abs(x) * 0.1}`,
          stroke: '#b4ccba',
          'stroke-width': 7,
        },
        boat,
      )
    }
    motions.push((t) => {
      const a = t * Math.PI * 4
      const dx = -18 * Math.sin(a)
      const dy = 12 * Math.sin(a) + 2 * Math.sin(a * 2)
      g.setAttribute('transform', `translate(${875 + dx} ${413 + dy}) rotate(${Math.sin(a) * 1.2})`)
      rings.forEach((r, i) => {
        const q = (t * 2 + i / 3) % 1
        r.setAttribute('cx', String(865 - 20 * q))
        r.setAttribute('cy', String(437 + 13 * q))
        r.setAttribute('rx', String(48 + 55 * q))
        r.setAttribute('ry', String(14 + 18 * q))
        r.setAttribute('transform', 'rotate(-30 865 437)')
        r.setAttribute('opacity', String(0.45 * (1 - q)))
      })
    })
    /* One 4s drift brings the boat back to where it started; it rests
       there, and the wake goes. */
    return {
      paint,
      end: 0.5,
      rest: () => {
        paint(0.5)
        wake.setAttribute('opacity', '0')
      },
    }
  }

  if (id === 'warzone-d') {
    const paths = [0, 1, 2].map(() =>
      el(
        'path',
        {
          fill: 'none',
          stroke: '#e8ece6',
          'stroke-width': 8,
          'stroke-linecap': 'round',
        },
        svg,
      ),
    )
    motions.push((t) => {
      paths.forEach((p, i) => {
        const q = (t * 2 + i / 3) % 1
        const x = lerp(922, 824, q)
        const y = lerp(746, 616, q)
        p.setAttribute('d', `M${x - 29} ${y + 5} L${x} ${y - 12} L${x + 29} ${y + 5}`)
        p.setAttribute('opacity', String(Math.sin(q * Math.PI) * 0.95))
      })
    })
    /* The chevrons are a hint up the ramp: one 4s pass, then the picture
       as drawn. */
    return {
      paint,
      end: 0.5,
      rest: () => {
        for (const p of paths) p.setAttribute('opacity', '0')
      },
    }
  }

  if (id === 'hotspots') {
    const g = el('g', {}, svg)
    const pool = el(
      'path',
      {
        d: 'M647 706 C665 701 684 708 702 714 C723 711 739 717 750 721 C773 718 798 725 814 735 C834 736 845 748 825 754 C805 758 792 753 777 757 C758 765 738 759 725 751 C702 753 686 740 675 728 C660 724 648 719 647 706Z',
        fill: '#E9954B',
      },
      g,
    )
    const stream = el('path', { fill: 'none', stroke: '#E9954B', 'stroke-width': 7, 'stroke-linecap': 'round' }, g)
    motions.push((t) => {
      const flow = clamp((t - 0.12) / 0.12)
      const growth = clamp((t - 0.24) / 0.48)
      const fade = 1 - clamp((t - 0.9) / 0.1)
      const endY = 684 + 22 * flow
      stream.setAttribute('d', `M647 684 Q645 ${684 + 11 * flow} 647 ${endY}`)
      stream.setAttribute('opacity', String(t > 0.12 ? fade : 0))
      const scale = Math.pow(growth, 0.72)
      pool.setAttribute('transform', `translate(647 706) scale(${scale}) translate(-647 -706)`)
      pool.setAttribute('opacity', String(growth > 0 ? fade : 0))
    })
    /* The pool is full from t = 0.72 and begins to fade at 0.9; it stays
       full. */
    return { paint, end: 0.88, rest: () => paint(0.88) }
  }

  if (id === 'reckoning') {
    const groups: SVGGElement[] = []
    ROWS.forEach((row, i) => {
      const g = el('g', {}, svg)
      groups.push(g)
      for (const [x, y] of row) {
        el('ellipse', { cx: x, cy: y, rx: 42, ry: 18, fill: '#ff7a70', stroke: '#e8ece6', 'stroke-width': 5 }, g)
      }
      motions.push((t) => {
        const phase = (t * 2) % 1
        const d = Math.abs(phase - i / (ROWS.length - 1))
        g.setAttribute('opacity', String(Math.max(0, 1 - d / 0.16) * 0.85))
      })
    })
    /* One 4s sweep down the rows, then the drums as drawn. */
    return {
      paint,
      end: 0.5,
      rest: () => {
        for (const g of groups) g.setAttribute('opacity', '0')
      },
    }
  }

  if (id === 'record') {
    /* One clip id per instance: the preview had one chart, the page may
       mount this card more than once. */
    const clipId = `card-art-paper-${++clipSeq}`
    const defs = el('defs', {}, svg)
    const clip = el('clipPath', { id: clipId }, defs)
    el('polygon', { points: '407,98 1373,444 1080,995 31,577' }, clip)
    const scan = el('g', { 'clip-path': `url(#${clipId})` }, svg)
    const line = el('line', { y1: 0, y2: 1024, stroke: '#ff7a70', 'stroke-width': 3 }, scan)
    const ring = el('g', { transform: 'translate(1223 180) scale(1 .62)' }, svg)
    const arc = el(
      'path',
      { d: 'M0 -55 A55 55 0 0 1 55 0', stroke: '#ff7a70', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' },
      ring,
    )
    motions.push((t) => {
      line.setAttribute('x1', String(t * 1650 - 50))
      line.setAttribute('x2', String(t * 1650 - 50))
      line.setAttribute('opacity', String(Math.sin(t * Math.PI) * 0.5))
      arc.setAttribute('transform', `rotate(${t * 720})`)
    })
    /* One scan across the chart; the reel comes round to where it began. */
    return {
      paint,
      end: 1,
      rest: () => {
        paint(1)
        line.setAttribute('opacity', '0')
      },
    }
  }

  return null
}
