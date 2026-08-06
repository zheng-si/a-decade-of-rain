// ── What is still on the ground ───────────────────────────────────────────
//
// The Archive's other two readings are monotone: run the playhead forward and
// gallons accumulate, sprayings accumulate, nothing ever goes down. That is
// true of the RECORD and false of the ground. Herbicide degrades.
//
// This is Stellman's E4 model, which is the standard reading of this exact
// dataset: first-order decay with a 30-day half-life, accumulated over every
// prior spraying at a location.
//   Stellman & Stellman (2004), "Exposure opportunity models for Agent Orange,
//   dioxin, and other military herbicides used in Vietnam, 1961–1971",
//   J. Expo. Sci. Environ. Epidemiol. — and the Agent Orange Data Warehouse,
//   whose published exposure scores use the same 30-day first-order curve.
//
// It matters here because of one number in this record: the median gap between
// two sprayings of the same ground is 19 days, and the half-life is 30. Most
// re-spraying landed before half the previous dose had gone. Measured over the
// record, 5,813 sprayings fell on ground still carrying at least a tenth of an
// earlier dose, and at the median the residue equalled the new dose exactly.
//
// WHY THERE IS NO PRECOMPUTED TABLE. Decay is multiplicative, so the field
// steps forward incrementally: multiply every cell by 0.5^(dt/half), then add
// the sprayings that fell in the step, each decayed from its own day. The whole
// state is a list of (cell, day, gallons) deposits — 35,182 of them at the fine
// cell, 12,524 at the coarse — built in under 50 ms. A lookup table over 304
// playback steps would be two million numbers to ship for something a loop
// reproduces exactly.
//
// The one thing it cannot do is run backwards: a decayed field has forgotten
// what it decayed from. Scrubbing back replays from zero, which is the same
//50 ms.
import type { TrackDataset } from './tracks'

/** Half-life in days. Stellman's value, not a taste parameter — changing it
 *  changes which published model this is. Exposed so the console can show what
 *  a different assumption would look like, and labelled there as a departure. */
export const HALF_LIFE_DAYS = 30

/** Sampling step as a fraction of the cell, matching trackGrid so the two
 *  readings bin the same lines the same way. */
const STEP_FRACTION = 1 / 3

interface Deposit {
  cell: number
  day: number
  gallons: number
  agent: number
  gi: number
}

export interface LoadField {
  cellDeg: number
  /** Cell centres, parallel arrays indexed by cell id. */
  cx: Float64Array
  cy: Float64Array
  /** Deposits, sorted by day — the whole history the field replays. */
  deposits: Deposit[]
  /** Live state, all indexed by cell id. */
  loadIn: Float64Array
  loadOut: Float64Array
  cumIn: Float64Array
  cumOut: Float64Array
  passes: Int32Array
  days: Int32Array
  lastDay: Float64Array
  byGroup: Float64Array
  /** Where the replay has got to, and what selection it was replayed for. */
  at: number
  selKey: string
}

/** Build the deposit list once. Walks each run exactly as trackGrid does. */
export function buildLoadField(data: TrackDataset, cellDeg: number): LoadField {
  const index = new Map<string, number>()
  const cxs: number[] = []
  const cys: number[] = []
  const idFor = (lng: number, lat: number) => {
    const x = Math.floor(lng / cellDeg)
    const y = Math.floor(lat / cellDeg)
    const key = `${x}|${y}`
    let id = index.get(key)
    if (id === undefined) {
      id = cxs.length
      index.set(key, id)
      cxs.push((x + 0.5) * cellDeg)
      cys.push((y + 0.5) * cellDeg)
    }
    return id
  }

  const deposits: Deposit[] = []
  for (const f of data.lines.features) {
    const p = f.properties
    // A run with no recorded volume put nothing on the ground, so it deposits
    // nothing — the same rule the passes reading uses, for the same reason.
    if (p.gallons <= 0) continue
    const coords = f.geometry.coordinates
    let totalDeg = 0
    for (let i = 1; i < coords.length; i++) {
      totalDeg += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    }
    const touched = new Map<number, number>()
    if (totalDeg <= 0) {
      touched.set(idFor(coords[0][0], coords[0][1]), p.gallons)
    } else {
      for (let i = 1; i < coords.length; i++) {
        const [x0, y0] = coords[i - 1]
        const [x1, y1] = coords[i]
        const legDeg = Math.hypot(x1 - x0, y1 - y0)
        if (legDeg <= 0) continue
        const n = Math.max(1, Math.ceil(legDeg / (cellDeg * STEP_FRACTION)))
        const share = (legDeg / totalDeg / n) * p.gallons
        for (let s = 0; s < n; s++) {
          const u = (s + 0.5) / n
          const id = idFor(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u)
          touched.set(id, (touched.get(id) ?? 0) + share)
        }
      }
    }
    for (const [cell, gallons] of touched) {
      deposits.push({ cell, day: p.day, gallons, agent: p.agent, gi: p.gi })
    }
  }
  // Sorted so the replay is a single forward scan, and so each cell's days
  // arrive in order — which is what lets `days` count distinct ones with a
  // comparison instead of a Set per cell.
  deposits.sort((a, b) => a.day - b.day)

  const n = cxs.length
  return {
    cellDeg,
    cx: Float64Array.from(cxs),
    cy: Float64Array.from(cys),
    deposits,
    loadIn: new Float64Array(n),
    loadOut: new Float64Array(n),
    cumIn: new Float64Array(n),
    cumOut: new Float64Array(n),
    passes: new Int32Array(n),
    days: new Int32Array(n),
    lastDay: new Float64Array(n).fill(-1),
    byGroup: new Float64Array(n * 4),
    at: -1,
    selKey: '',
  }
}

function clear(field: LoadField) {
  field.loadIn.fill(0)
  field.loadOut.fill(0)
  field.cumIn.fill(0)
  field.cumOut.fill(0)
  field.passes.fill(0)
  field.days.fill(0)
  field.lastDay.fill(-1)
  field.byGroup.fill(0)
  field.at = -1
}

/**
 * Bring the field to `day`.
 *
 * Forward is incremental; backward, or a change of selection, replays from
 * zero. The replay is not a fallback that quietly costs more than it looks —
 * it is 35,182 deposits and a multiply per live cell, and it is the only
 * correct answer, because a decayed field cannot be un-decayed: 0.5^(dt/half)
 * is invertible in arithmetic and not in information, since the deposits that
 * were folded in along the way are no longer separable.
 */
export function advanceLoad(
  field: LoadField,
  day: number,
  indices: number[] | null,
  halfLife = HALF_LIFE_DAYS,
): void {
  const selKey = indices ? indices.join(',') : ''
  if (day < field.at || selKey !== field.selKey) {
    clear(field)
    field.selKey = selKey
  }
  const from = field.at < 0 ? -1 : field.at
  if (day === field.at) return

  const sel = indices ? new Set(indices) : null
  // Decay everything already down, by the length of the step.
  if (from >= 0 && day > from) {
    const f = Math.pow(0.5, (day - from) / halfLife)
    const { loadIn, loadOut } = field
    for (let i = 0; i < loadIn.length; i++) {
      loadIn[i] *= f
      loadOut[i] *= f
    }
  }
  // Add what fell in the step, each decayed from its OWN day rather than from
  // the step boundary — otherwise a spraying on the first day of a 12-day step
  // would be credited as if it were 12 days fresher than it is.
  for (const d of field.deposits) {
    if (d.day <= from || d.day > day) continue
    const aged = d.gallons * Math.pow(0.5, (day - d.day) / halfLife)
    const inSel = !sel || sel.has(d.agent)
    if (inSel) {
      field.loadIn[d.cell] += aged
      field.cumIn[d.cell] += d.gallons
    } else {
      field.loadOut[d.cell] += aged
      field.cumOut[d.cell] += d.gallons
    }
    field.passes[d.cell]++
    if (d.gi >= 0 && d.gi < 4) field.byGroup[d.cell * 4 + d.gi] += d.gallons
    const whole = Math.floor(d.day)
    if (field.lastDay[d.cell] !== whole) {
      field.lastDay[d.cell] = whole
      field.days[d.cell]++
    }
  }
  field.at = day
}

/**
 * The live field as the same feature shape the circle layers already read.
 *
 * `g` is the DECAYED load, which is what the dot is sized by; `gt` stays the
 * cumulative total so the inspect card can print both and the difference
 * between them is the point. Cells below half a gallon are dropped rather than
 * drawn at the floor radius — a map of a substance that has gone should not
 * keep a mark where it was.
 */
export function loadFeatures(
  field: LoadField,
  tint: string,
  dim: string,
  filtered: boolean,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (let i = 0; i < field.cx.length; i++) {
    const li = field.loadIn[i]
    const lo = field.loadOut[i]
    if (li < 0.5 && lo < 0.5) continue
    const coords: [number, number] = [field.cx[i], field.cy[i]]
    const shared = {
      gt: Math.round(field.cumIn[i] + field.cumOut[i]),
      ld: Math.round(li + lo),
      nt: field.passes[i],
      dt: field.days[i],
      rt: field.passes[i],
      b0: Math.round(field.byGroup[i * 4]),
      b1: Math.round(field.byGroup[i * 4 + 1]),
      b2: Math.round(field.byGroup[i * 4 + 2]),
      b3: Math.round(field.byGroup[i * 4 + 3]),
    }
    if (filtered && lo >= 0.5)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { g: Math.round(lo), c: dim, s: 0, ...shared },
      })
    if (li >= 0.5)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { g: Math.round(li), c: tint, s: 1, ...shared },
      })
  }
  return { type: 'FeatureCollection', features }
}
