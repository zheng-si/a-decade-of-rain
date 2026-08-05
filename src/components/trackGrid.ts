// ── Binning a line, not a point ───────────────────────────────────────────
//
// The hybrid the Archive actually wants: dots where the data IS an aggregate,
// the track where it is a single run. Two marks, because they are two kinds of
// statement — a cell total is a summary, a run is a thing that happened.
//
// But swapping only the near tier would leave the far and mid views telling the
// old lie. binGrid drops each run's whole volume into the ONE cell holding leg
// 1A, and a run is typically an 11 km line across three or four fine cells. So
// the grids have to be binned FROM THE TRACKS: every segment deposits its
// gallons into each cell it crosses, in proportion to how much of the segment
// lies there.
//
// That is the whole difference between "this cell is where a run started" and
// "this cell is what fell on this cell".
import type { TrackDataset, TrackProps } from '../data/tracks'
import { DOTS } from './volumeGrid'

/** Sampling step as a fraction of the cell size.
 *
 *  Walking the segment and depositing into whichever cell each step's midpoint
 *  falls in is an approximation of exact cell clipping, and this is its error
 *  budget: at a third of a cell the misallocation at a boundary is at most a
 *  sixth of a cell's worth of one segment. Exact clipping (Liang–Barsky per
 *  cell edge) buys accuracy nobody can see on a 30 px square and costs a page
 *  of geometry that would need its own tests.
 *
 *  It is also self-correcting in the way that matters: the TOTAL gallons a
 *  segment deposits is exact regardless of step size, because each step
 *  deposits its own share and the shares sum to one. Only the split between
 *  neighbouring cells is approximate. */
const STEP_FRACTION = 1 / 3

interface Cell {
  x: number
  y: number
  inSel: number
  out: number
  /** Segments touching this cell — the track equivalent of a run count. */
  segs: number
  byGroup: number[]
  d0: number
  d1: number
  /** Sprayed track length in this cell, in km. The quantity a grid of lines
   *  can report that a grid of points cannot. */
  km: number
}

/**
 * Bin the tracks into a grid of proportional dots.
 *
 * Emits exactly the feature shape addVolumeLayers' circle layers already read
 * (`g`, `c`, `s` plus the hover fields), so the hybrid needs no second set of
 * layers — the dots do not care whether their totals came from points or from
 * lines, and that is the point of keeping the two apart.
 */
export function binTracks(
  data: TrackDataset,
  day: number,
  indices: number[] | null,
  cellDeg: number,
  tint: string,
): GeoJSON.FeatureCollection {
  const sel = indices ? new Set(indices) : null
  const cells = new Map<string, Cell>()
  const step = cellDeg * STEP_FRACTION

  const cellAt = (lng: number, lat: number) => {
    const x = Math.floor(lng / cellDeg)
    const y = Math.floor(lat / cellDeg)
    const key = `${x}|${y}`
    let c = cells.get(key)
    if (!c) {
      c = { x, y, inSel: 0, out: 0, segs: 0, byGroup: [0, 0, 0, 0], d0: Infinity, d1: -Infinity, km: 0 }
      cells.set(key, c)
    }
    return c
  }

  const deposit = (c: Cell, p: TrackProps, gallons: number, km: number) => {
    if (!sel || sel.has(p.agent)) c.inSel += gallons
    else c.out += gallons
    c.km += km
    if (p.gi >= 0 && p.gi < 4) c.byGroup[p.gi] += gallons
    if (p.day < c.d0) c.d0 = p.day
    if (p.day > c.d1) c.d1 = p.day
  }

  for (const f of data.lines.features) {
    const p = f.properties
    if (p.day > day) continue
    const coords = f.geometry.coordinates
    // Segment length in DEGREES, which is what the sampling walks in — the
    // gallons split uses the km the ETL already measured, so the two units
    // never have to be reconciled.
    let totalDeg = 0
    for (let i = 1; i < coords.length; i++) {
      totalDeg += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    }
    if (totalDeg <= 0) {
      const c = cellAt(coords[0][0], coords[0][1])
      c.segs++
      deposit(c, p, p.gallons, 0)
      continue
    }
    const touched = new Set<Cell>()
    for (let i = 1; i < coords.length; i++) {
      const [x0, y0] = coords[i - 1]
      const [x1, y1] = coords[i]
      const legDeg = Math.hypot(x1 - x0, y1 - y0)
      if (legDeg <= 0) continue
      const n = Math.max(1, Math.ceil(legDeg / step))
      // Each step carries 1/n of this leg, and this leg carries legDeg/totalDeg
      // of the whole track's gallons and km.
      const share = legDeg / totalDeg / n
      const gStep = p.gallons * share
      const kmStep = p.km * share
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n
        const c = cellAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        deposit(c, p, gStep, kmStep)
        touched.add(c)
      }
    }
    for (const c of touched) c.segs++
  }

  const features: GeoJSON.Feature[] = []
  for (const cell of cells.values()) {
    const coordsOut: [number, number] = [(cell.x + 0.5) * cellDeg, (cell.y + 0.5) * cellDeg]
    let dom = 0
    for (let i = 1; i < cell.byGroup.length; i++) if (cell.byGroup[i] > cell.byGroup[dom]) dom = i
    const shared = {
      gt: Math.round(cell.inSel + cell.out),
      rt: cell.segs,
      km: Number(cell.km.toFixed(1)),
      dom,
      d0: cell.d0,
      d1: cell.d1,
    }
    // Same two-feature shape as binGrid: grey context under a tinted selection.
    if (sel && cell.out > 0.5)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coordsOut },
        properties: { g: Math.round(cell.out), c: DOTS.dim, s: 0, ...shared },
      })
    if (cell.inSel > 0.5)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coordsOut },
        properties: { g: Math.round(cell.inSel), c: tint, s: 1, ...shared },
      })
  }
  return { type: 'FeatureCollection', features }
}
