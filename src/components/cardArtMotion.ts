/* The moving parts of the C illustrations, ported from the illustrator's
   C/app.js (final handoff of 2026-09-19) with the geometry unchanged: the
   spray fans on 01 and 03, the ramp chevrons on 02, the boat and its wake on
   04, the aircraft and its three long trails on 05, the drum's liquid on 06,
   the row highlights on 07, the chart scan on 08; and, still, the orange
   residue on the dead trees, ground and water of 03 and 04. Coordinates are
   source-image pixels on a 1536x1024 viewBox laid over the PNG in the same
   frame (both fitted `contain`, so both letterbox alike).

   t runs 0..1 over the preview's 8000ms master cycle. The preview loops;
   the page plays each card once, the first time it is active, up to the
   scene's `end` and then shows its `rest`: the sprays out and staying, the
   aircraft arrived with its trails behind it, the drum's pool grown, the
   boat at rest, the chevrons and row highlights gone, the scan finished.
   The rest is also what a reader who asked for reduced motion sees, in
   place of the play; the residue is there in every frame. */

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

/** Bitmaps a scene lays into its SVG, by name: today only the aircraft on
 *  05, the illustrator's own pixels cut from the original picture. */
export type Parts = Record<string, string>

type Attrs = Record<string, string | number>

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  parent.append(e)
  return e
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (t: number) => Math.max(0, Math.min(1, t))

const ORANGE = '#E9954B'
/* The liquid on 06: the colour of the band on the drums it comes out of,
   sampled from the picture (#e84c30 across a third of the bands' pixels),
   not the lighter spray orange, which read as a different substance. */
const LIQUID = '#e84c30'

/* Spray fans: start x,y (the boom) to end x,y, three per aircraft. 01's run
   up and to the right, behind an aircraft flying to the lower left. */
const SPRAY: Record<string, [number, number, number, number][]> = {
  begins: [
    [486, 292, 1136, 27],
    [495, 294, 1235, 44],
    [504, 296, 1334, 62],
  ],
  peak: [
    [625, 116, 1118, 325],
    [873, 165, 1328, 362],
    [1140, 231, 1439, 363],
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

/* The residue on 03 and 04: an illustrative accent on the dead vegetation
   and the ground beside it, in the liquid's colour rather than the spray's:
   what settled, not what fell. Static, under everything that moves. */
const RESIDUE: Record<string, { ground: [number, number, number, number][]; branches: string[]; water: string[] }> = {
  peak: {
    ground: [
      [980, 606, 36, 10],
      [1205, 700, 42, 12],
      [1335, 744, 32, 9],
      [1101, 754, 47, 12],
    ],
    branches: [
      'M991 468 L987 558',
      'M985 497 L966 481',
      'M1198 553 L1208 655',
      'M1201 580 L1223 558',
      'M1339 617 L1344 704',
      'M1341 642 L1324 628',
    ],
    water: [],
  },
  mangroves: {
    ground: [
      [1107, 665, 35, 10],
      [1252, 543, 38, 10],
      [1233, 620, 35, 9],
    ],
    branches: [
      'M1105 469 L1112 547',
      'M1109 501 L1086 479',
      'M1244 303 L1249 389',
      'M1247 354 L1270 335',
      'M1106 600 L1089 627',
    ],
    /* The handoff also laid three patches on the water; they read as
       something floating rather than something settled, and are left out. */
    water: [],
  },
}

function residue(svg: SVGSVGElement, id: string) {
  const r = RESIDUE[id]
  if (!r) return
  const marks = el('g', { fill: LIQUID, stroke: LIQUID, 'stroke-linecap': 'round' }, svg)
  for (const [x, y, rx, ry] of r.ground) {
    el(
      'ellipse',
      { cx: x, cy: y, rx, ry, 'fill-opacity': 0.26, stroke: 'none', transform: `rotate(18 ${x} ${y})` },
      marks,
    )
  }
  for (const d of r.branches) el('path', { d, fill: 'none', 'stroke-width': 6, 'stroke-opacity': 0.58 }, marks)
  for (const d of r.water) el('path', { d, fill: LIQUID, 'fill-opacity': 0.32, stroke: 'none' }, marks)
}

let clipSeq = 0

/** Build the overlay for one card into `svg` (emptied first), or null for a
 *  card with no moving parts. */
export function mountMotion(svg: SVGSVGElement, id: string, parts: Parts = {}): Motion | null {
  svg.replaceChildren()
  const motions: ((t: number) => void)[] = []
  const paint = (t: number) => {
    for (const m of motions) m(t)
  }
  residue(svg, id)

  if (SPRAY[id]) {
    /* 01 sprays in ivory: the first test runs were not Agent Orange. */
    const color = id === 'begins' ? '#e8ece6' : ORANGE
    const halfWidth = id === 'peak' ? 6.8 : 6.2
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

  if (id === 'a-sau') {
    /* The aircraft is the illustrator's own pixels, cut from the original
       picture (the rectangle at 125,20 of 155x125), carried with its anchor
       at 210,85 -- where it sat in that picture -- from the lower right to
       there. Three trails grow behind it. The base picture has no aircraft. */
    const trailGroup = el('g', { fill: ORANGE }, svg)
    const trails = [0, 1, 2].map(() => el('polygon', {}, trailGroup))
    const plane = el('g', {}, svg)
    if (parts['a-sau-plane']) {
      el('image', { href: parts['a-sau-plane'], x: 125 - 210, y: 20 - 85, width: 155, height: 125 }, plane)
    }
    const rays: [number, number, number, number][] = [
      [30, -3, 1020, 330],
      [41, 18, 977, 381],
      [31, 27, 937, 444],
    ]
    motions.push((t) => {
      const u = clamp((t - 0.05) / 0.83)
      const x = lerp(1250, 210, u)
      const y = lerp(660, 85, u)
      const visible = clamp(t / 0.045) * (1 - clamp((t - 0.9) / 0.1))
      plane.setAttribute('transform', `translate(${x} ${y})`)
      plane.setAttribute('opacity', String(visible))
      rays.forEach(([ox, oy, dx0, dy0], i) => {
        const sx = x + ox
        const sy = y + oy
        const growth = clamp(u / 0.72)
        const dx = dx0 * growth
        const dy = dy0 * growth
        const len = Math.hypot(dx0, dy0)
        const w = 10 * growth
        const px = (-dy0 / len) * w
        const py = (dx0 / len) * w
        trails[i].setAttribute(
          'points',
          `${sx},${sy} ${sx + dx * 0.58 + px},${sy + dy * 0.58 + py} ${sx + dx},${sy + dy} ${sx + dx * 0.58 - px},${sy + dy * 0.58 - py}`,
        )
        trails[i].setAttribute('opacity', String(visible))
      })
    })
    /* The aircraft arrives at t = 0.88, its trails full, before the fade
       that the loop needs; it stays there. */
    return { paint, end: 0.88, rest: () => paint(0.88) }
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
        fill: LIQUID,
      },
      g,
    )
    const stream = el('path', { fill: 'none', stroke: LIQUID, 'stroke-width': 7, 'stroke-linecap': 'round' }, g)
    motions.push((t) => {
      const flow = clamp((t - 0.12) / 0.12)
      const growth = clamp((t - 0.24) / 0.48)
      const fade = 1 - clamp((t - 0.9) / 0.1)
      const endY = 684 + 22 * flow
      stream.setAttribute('d', `M647 684 Q645 ${684 + 11 * flow} 647 ${endY}`)
      stream.setAttribute('opacity', String(t > 0.12 ? fade : 0))
      /* The pool grows to 1.8x the drawn path (3.24x its area), turned 18
         degrees about the point it lands on. */
      const scale = 1.8 * Math.pow(growth, 0.72)
      pool.setAttribute('transform', `translate(647 706) rotate(-18) scale(${scale}) translate(-647 -706)`)
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
