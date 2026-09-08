/**
 * The proximity grid: Stellman & Stellman's own model, summed per cell.
 *
 * public/data/proximity.json is built by scripts/build-proximity.mjs from the
 * Exposure_Master table hea-v ships (data/exposure at the pinned commit): one
 * row per mission and 0.01° grid point wherever a spray path came within
 * 5 km. A "hit" is the authors' term — a recorded spray-path leg passing
 * within the distance of the cell's grid point — and the file carries, for
 * each cell and each of the Atlas's four agent groups, the number of hits
 * within 0.5, 1, 2 and 5 km over the whole record. Nothing here is modelled
 * on this side: the Atlas draws their table.
 *
 * The cell is the SW-cornered 0.01° square of the study grid (hea-v
 * engine.js, gridKey: coordinates are TRUNCATED to two decimals). The grid is
 * regular in longitude and latitude, so it is drawn as a canvas image that
 * MapLibre projects — the image is rendered in Mercator rows so the cells
 * land where they are, not stretched between four corners.
 */

export interface ProximityGrid {
  lon0: number
  lat0: number
  step: number
  ncols: number
  nrows: number
  groups: string[]
  bands: number[]
  cells: number
  /** Cell index (row × ncols + col) of each sparse entry, ascending. */
  idx: Int32Array
  /** counts[g][b] — hits for agent group g within band b, per sparse entry. */
  counts: Uint16Array[][]
  /** Sparse entry of a cell index, or -1. */
  entryOf: (cell: number) => number
}

let cache: Promise<ProximityGrid> | null = null

interface Raw {
  lon0: number
  lat0: number
  step: number
  ncols: number
  nrows: number
  groups: string[]
  bands: number[]
  cells: number
  idx: number[]
  n: number[][][]
}

export function loadProximity(url = '/data/proximity.json'): Promise<ProximityGrid> {
  if (cache) return cache
  cache = (async () => {
    const raw = (await (await fetch(url)).json()) as Raw
    const idx = new Int32Array(raw.cells)
    let acc = 0
    for (let i = 0; i < raw.cells; i++) {
      acc += raw.idx[i]
      idx[i] = acc
    }
    const counts = raw.n.map((byBand) => byBand.map((arr) => Uint16Array.from(arr)))
    // Dense index from cell → entry, so a hover is a lookup and not a search.
    const dense = new Int32Array(raw.ncols * raw.nrows).fill(-1)
    for (let i = 0; i < raw.cells; i++) dense[idx[i]] = i
    return {
      lon0: raw.lon0,
      lat0: raw.lat0,
      step: raw.step,
      ncols: raw.ncols,
      nrows: raw.nrows,
      groups: raw.groups,
      bands: raw.bands,
      cells: raw.cells,
      idx,
      counts,
      entryOf: (cell) => (cell >= 0 && cell < dense.length ? dense[cell] : -1),
    }
  })()
  cache.catch(() => (cache = null))
  return cache
}

/** The cell index under a coordinate, or -1 outside the grid. Truncation,
 *  as in hea-v: the SW corner names the cell. */
export function cellAt(g: ProximityGrid, lng: number, lat: number): number {
  const col = Math.floor((lng - g.lon0) / g.step + 1e-9)
  const row = Math.floor((lat - g.lat0) / g.step + 1e-9)
  if (col < 0 || col >= g.ncols || row < 0 || row >= g.nrows) return -1
  return row * g.ncols + col
}

/** Hits at a cell for the selected groups, one figure per band. */
export function hitsAt(g: ProximityGrid, cell: number, groups: number[] | null): number[] {
  const e = g.entryOf(cell)
  const out = g.bands.map(() => 0)
  if (e < 0) return out
  const gs = groups ?? g.groups.map((_, i) => i)
  for (const gi of gs) for (let b = 0; b < g.bands.length; b++) out[b] += g.counts[gi][b][e]
  return out
}

/** Class breaks for the count ramp: the class of a count is the number of
 *  breaks it reaches. Fixed across bands so the same colour always means the
 *  same number of hits; at 5 km most of the sprayed country sits in the top
 *  class, which is a fact about 5 km and not a fault of the ramp. */
export const HIT_BREAKS = [1, 3, 6, 11, 21]
export function hitClass(n: number): number {
  let c = 0
  for (const b of HIT_BREAKS) if (n >= b) c++
  return c
}
export const HIT_CLASS_LABELS = ['1–2', '3–5', '6–10', '11–20', '21 or more']

/** A five-step ramp from a base colour: four mixes towards white and the base
 *  itself darkened, so a selected agent's ramp is that agent's colour and the
 *  brand red is the ramp with nothing isolated. */
export function hitRamp(base: string): string[] {
  const h = base.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255
  const mix = (t: number, to: number) => (c: number) => Math.round(c + (to - c) * t)
  const hex = (f: (c: number) => number) =>
    `#${[r, gg, b].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`
  return [hex(mix(0.78, 255)), hex(mix(0.56, 255)), hex(mix(0.3, 255)), hex(mix(0, 255)), hex(mix(0.35, 0))]
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI

/** Draw the grid for one band and one selection into a canvas, in Mercator
 *  rows. Returns the image and the four corners MapLibre needs, NW first. */
export function renderProximity(
  g: ProximityGrid,
  band: number,
  groups: number[] | null,
  ramp: string[],
  pxPerCell = 2,
): { url: string; coordinates: [[number, number], [number, number], [number, number], [number, number]] } {
  const W = g.ncols * pxPerCell
  const latTop = g.lat0 + g.nrows * g.step
  const yTop = mercY(latTop), yBot = mercY(g.lat0)
  // Height so that a row at the middle latitude is pxPerCell tall.
  const H = Math.round(((yTop - yBot) / ((mercY(g.lat0 + g.step) - yBot))) * pxPerCell)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const data = img.data
  const rgba = ramp.map((c) => {
    const n = parseInt(c.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  })
  // Class per sparse entry, computed once, then painted per pixel.
  const cls = new Int8Array(g.cells)
  const gs = groups ?? g.groups.map((_, i) => i)
  for (let e = 0; e < g.cells; e++) {
    let n = 0
    for (const gi of gs) n += g.counts[gi][band][e]
    cls[e] = n > 0 ? hitClass(n) - 1 : -1
  }
  // Row of cells for each pixel row, from the top of the image down.
  for (let py = 0; py < H; py++) {
    const y = yTop - ((py + 0.5) / H) * (yTop - yBot)
    const row = Math.floor((invMercY(y) - g.lat0) / g.step)
    if (row < 0 || row >= g.nrows) continue
    const base = row * g.ncols
    for (let col = 0; col < g.ncols; col++) {
      const e = g.entryOf(base + col)
      if (e < 0 || cls[e] < 0) continue
      const c = rgba[cls[e]]
      for (let k = 0; k < pxPerCell; k++) {
        const o = (py * W + col * pxPerCell + k) * 4
        data[o] = c[0]
        data[o + 1] = c[1]
        data[o + 2] = c[2]
        data[o + 3] = 255
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  const lonR = g.lon0 + g.ncols * g.step
  return {
    url: canvas.toDataURL('image/png'),
    coordinates: [
      [g.lon0, latTop],
      [lonR, latTop],
      [lonR, g.lat0],
      [g.lon0, g.lat0],
    ],
  }
}
