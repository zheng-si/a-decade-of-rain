import { readFileSync } from 'node:fs'
export const SVG_PATH = 'src/figures/vegetation-map.svg'
export const KEYS = ['forest','slashburn','grassland','rice','mangrove','marsh','rubber']
export const COLOR = {forest:'#8fb4a0',slashburn:'#859f97',grassland:'#c3d888',rice:'#544685',mangrove:'#aba1cd',marsh:'#61c1c2',rubber:'#ddc21a'}

// Parse absolute M/L/C/Z path data into a flat ring of [x,y] anchor points.
// (We keep command endpoints; the tracings are dense enough that dropping the
// two Bezier control points per C barely changes the polygon.)
export function pathToRing(d) {
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+/g) || []
  const pts = []
  let i = 0
  while (i < toks.length) {
    const c = toks[i]
    if (c === 'M' || c === 'L') { pts.push([+toks[i+1], +toks[i+2]]); i += 3 }
    else if (c === 'C') { pts.push([+toks[i+5], +toks[i+6]]); i += 7 }
    else if (c === 'Z') { i += 1 }
    else { i += 1 } // stray number (implicit lineto after M) — rare here
  }
  return pts
}

export function loadPolys() {
  const svg = readFileSync(SVG_PATH, 'utf8')
  const re = /<path d="([^"]+)"\s+class="vt vt-([a-z]+)"/g
  const polys = []
  let m
  while ((m = re.exec(svg))) {
    const ring = pathToRing(m[1])
    if (ring.length >= 3) polys.push({ key: m[2], ring })
  }
  return polys
}

// Shoelace area (pixel^2), unsigned.
export function ringArea(r) {
  let a = 0
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1,y1] = r[i], [x2,y2] = r[(i+1)%n]
    a += x1*y2 - x2*y1
  }
  return Math.abs(a) / 2
}

// Point in polygon (ray cast).
export function inRing(p, r) {
  let inside = false
  const [x,y] = p
  for (let i = 0, j = r.length-1, n = r.length; i < n; j = i++) {
    const [xi,yi] = r[i], [xj,yj] = r[j]
    if (((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside = !inside
  }
  return inside
}
