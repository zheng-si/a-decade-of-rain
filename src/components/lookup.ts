// ── location lookup: the spatial query ────────────────────────────────────
// Given a point, a radius and a date range, return the RUNS whose recorded
// geometry passes within the radius during the range — an archive query, not
// a verdict. The unit of answer is the run (HERBS Mission + Run), because
// that is the unit of the source record; a run drawn as three segments is
// still one flight and appears once.
//
// Distance is point-to-geometry: for a track, the minimum distance from the
// query point to any of its segments (the aircraft passed the whole line, not
// just its vertices); for a mark, plain point distance. Computed on a local
// equirectangular projection about the query point — exact enough at ≤10 km
// radii that the error is below the 100 m precision of the source's own grid
// references, and cheap enough to scan all 24,604 waypoints per keystroke.

import type { TrackDataset } from '../data/tracks'

export interface LookupParams {
  lng: number
  lat: number
  radiusKm: number
  dayFrom: number
  dayTo: number
}

export interface LookupHit {
  key: string
  mission: number
  run: number
  day: number
  agent: number
  gi: number
  fwac: number
  /** The run's whole recorded volume (all its segments and marks), NOT the
   *  amount that fell inside the radius — the source cannot answer that. */
  gallons: number
  /** Minimum distance from the query point to the run's recorded geometry.
   *  0 for a mission search, which has no query point. */
  distanceKm: number
  /** The run's sprayed length in km, summed over its segments. Carried by the
   *  mission search, whose list shows length where the circle's shows
   *  distance; the circle's hits leave it unset. */
  km?: number
  /** Indexes into data.lines.features / data.marks.features, for highlight
   *  and fly-to. */
  lineIdx: number[]
  markIdx: number[]
  /** [w, s, e, n] over the run's geometry. */
  bounds: [number, number, number, number]
}

const KM_PER_DEG = 111.195 // mean earth radius; matches the ETL's own km()

/** Min distance (km) from origin to segment [ax,ay]→[bx,by] in local km. */
function segDist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
  const px = ax + t * dx
  const py = ay + t * dy
  return Math.hypot(px, py)
}

export function queryLookup(data: TrackDataset, params: LookupParams): LookupHit[] {
  const { lng, lat, radiusKm, dayFrom, dayTo } = params
  const kx = KM_PER_DEG * Math.cos((lat * Math.PI) / 180)
  const ky = KM_PER_DEG
  // A cheap reject box in degrees, padded a hair for the projection.
  const degX = (radiusKm / kx) * 1.01
  const degY = (radiusKm / ky) * 1.01

  /** min distance of one coordinate list (as segments) to the query point,
   *  or Infinity if its bbox cannot reach the radius. */
  const lineDist = (coords: [number, number][]): number => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of coords) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    if (minX > lng + degX || maxX < lng - degX || minY > lat + degY || maxY < lat - degY)
      return Infinity
    let best = Infinity
    for (let i = 0; i < coords.length; i++) {
      const ax = (coords[i][0] - lng) * kx
      const ay = (coords[i][1] - lat) * ky
      if (i === 0 && coords.length === 1) return Math.hypot(ax, ay)
      if (i > 0) {
        const px = (coords[i - 1][0] - lng) * kx
        const py = (coords[i - 1][1] - lat) * ky
        const d = segDist(px, py, ax, ay)
        if (d < best) best = d
      }
    }
    return best
  }

  const hits = new Map<string, LookupHit>()
  const consider = (
    key: string,
    p: { mission: number; run: number; day: number; agent: number; gi: number; fwac: number },
    d: number,
    lineIdx: number | null,
    markIdx: number | null,
  ) => {
    let h = hits.get(key)
    if (!h) {
      h = {
        key,
        mission: p.mission,
        run: p.run,
        day: p.day,
        agent: p.agent,
        gi: p.gi,
        fwac: p.fwac,
        gallons: 0,
        distanceKm: d,
        lineIdx: [],
        markIdx: [],
        bounds: [Infinity, Infinity, -Infinity, -Infinity],
      }
      hits.set(key, h)
    }
    if (d < h.distanceKm) h.distanceKm = d
    if (lineIdx != null) h.lineIdx.push(lineIdx)
    if (markIdx != null) h.markIdx.push(markIdx)
  }

  const lines = data.lines.features
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i].properties
    if (p.day < dayFrom || p.day > dayTo) continue
    const d = lineDist(lines[i].geometry.coordinates as [number, number][])
    if (d <= radiusKm) consider(`${p.mission}|${p.run}`, p, d, i, null)
  }
  const marks = data.marks.features
  for (let i = 0; i < marks.length; i++) {
    const p = marks[i].properties
    if (p.day < dayFrom || p.day > dayTo) continue
    const [x, y] = marks[i].geometry.coordinates as [number, number]
    if (Math.abs(x - lng) > degX || Math.abs(y - lat) > degY) continue
    const d = Math.hypot((x - lng) * kx, (y - lat) * ky)
    if (d <= radiusKm) consider(`${p.mission}|${p.run}`, p, d, null, i)
  }

  // Second pass, hit runs only: the run's WHOLE volume and extent, including
  // segments outside the radius — the answer is the record, not the slice of
  // it that happens to fall inside the circle.
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i].properties
    const h = hits.get(`${p.mission}|${p.run}`)
    if (!h) continue
    h.gallons += p.gallons
    for (const [x, y] of lines[i].geometry.coordinates as [number, number][]) {
      if (x < h.bounds[0]) h.bounds[0] = x
      if (y < h.bounds[1]) h.bounds[1] = y
      if (x > h.bounds[2]) h.bounds[2] = x
      if (y > h.bounds[3]) h.bounds[3] = y
    }
  }
  for (let i = 0; i < marks.length; i++) {
    const p = marks[i].properties
    const h = hits.get(`${p.mission}|${p.run}`)
    if (!h) continue
    h.gallons += p.gallons
    const [x, y] = marks[i].geometry.coordinates as [number, number]
    if (x < h.bounds[0]) h.bounds[0] = x
    if (y < h.bounds[1]) h.bounds[1] = y
    if (x > h.bounds[2]) h.bounds[2] = x
    if (y > h.bounds[3]) h.bounds[3] = y
  }

  const out = [...hits.values()]
  for (const h of out) h.distanceKm = Math.round(h.distanceKm * 10) / 10
  out.sort((a, b) => a.distanceKm - b.distanceKm || a.day - b.day)
  return out
}

/* ── the mission search ────────────────────────────────────────────────────
   The other way to ask the record a question: by its own key. A HERBS mission
   number typed into the search box lists that mission's tracks, in the same
   list the circle answers with — a lookup is a lookup, whether the reader
   started from a place or from a citation. */

export interface MissionSummary {
  mission: number
  runs: number
  day: number
  agent: number
  gi: number
  fwac: number
  gallons: number
  km: number
}

/** `167`, `M167`, `mission 167`, `#167` → 167. Anything else → null. Five
 *  digits at most: the record's mission numbers run to four. */
export function parseMissionQuery(query: string): number | null {
  const m = /^\s*(?:m(?:ission)?\s*#?\s*|#\s*)?(\d{1,5})\s*$/i.exec(query)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 ? n : null
}

/** One pass over the record: what each mission is, for the search's
 *  suggestion row. Built once per dataset and kept by the caller. */
export function indexMissions(data: TrackDataset): Map<number, MissionSummary> {
  const out = new Map<number, MissionSummary>()
  const runsOf = new Map<number, Set<number>>()
  const touch = (p: { mission: number; run: number; day: number; agent: number; gi: number; fwac: number; gallons: number; km: number }) => {
    if (!p.mission) return
    let s = out.get(p.mission)
    if (!s) {
      s = { mission: p.mission, runs: 0, day: p.day, agent: p.agent, gi: p.gi, fwac: p.fwac, gallons: 0, km: 0 }
      out.set(p.mission, s)
      runsOf.set(p.mission, new Set())
    }
    runsOf.get(p.mission)!.add(p.run)
    s.gallons += p.gallons
    s.km += p.km
    if (p.fwac && !s.fwac) s.fwac = p.fwac
  }
  for (const f of data.lines.features) touch(f.properties)
  for (const f of data.marks.features) touch(f.properties)
  for (const [m, s] of out) {
    s.runs = runsOf.get(m)!.size
    s.km = Math.round(s.km * 10) / 10
  }
  return out
}

/** Every track of one mission, as lookup hits — the circle's own answer
 *  shape, so the list, the highlight and the record card all work unchanged.
 *  Ordered by run number, which is the order the tape lists the tracks in;
 *  `distanceKm` is 0 because there is no query point to be distant from. */
export function missionRuns(data: TrackDataset, mission: number): LookupHit[] {
  const hits = new Map<string, LookupHit>()
  const get = (p: { mission: number; run: number; day: number; agent: number; gi: number; fwac: number }) => {
    const key = `${p.mission}|${p.run}`
    let h = hits.get(key)
    if (!h) {
      h = {
        key,
        mission: p.mission,
        run: p.run,
        day: p.day,
        agent: p.agent,
        gi: p.gi,
        fwac: p.fwac,
        gallons: 0,
        distanceKm: 0,
        km: 0,
        lineIdx: [],
        markIdx: [],
        bounds: [Infinity, Infinity, -Infinity, -Infinity],
      }
      hits.set(key, h)
    }
    return h
  }
  const grow = (h: LookupHit, x: number, y: number) => {
    if (x < h.bounds[0]) h.bounds[0] = x
    if (y < h.bounds[1]) h.bounds[1] = y
    if (x > h.bounds[2]) h.bounds[2] = x
    if (y > h.bounds[3]) h.bounds[3] = y
  }
  const lines = data.lines.features
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i].properties
    if (p.mission !== mission) continue
    const h = get(p)
    h.lineIdx.push(i)
    h.gallons += p.gallons
    h.km = (h.km ?? 0) + p.km
    for (const [x, y] of lines[i].geometry.coordinates as [number, number][]) grow(h, x, y)
  }
  const marks = data.marks.features
  for (let i = 0; i < marks.length; i++) {
    const p = marks[i].properties
    if (p.mission !== mission) continue
    const h = get(p)
    h.markIdx.push(i)
    h.gallons += p.gallons
    const [x, y] = marks[i].geometry.coordinates as [number, number]
    grow(h, x, y)
  }
  const out = [...hits.values()]
  for (const h of out) h.km = Math.round((h.km ?? 0) * 10) / 10
  out.sort((a, b) => a.run - b.run)
  return out
}

/** A ~64-gon around the center — the radius circle as source data. */
export function circlePolygon(lng: number, lat: number, radiusKm: number): GeoJSON.Feature {
  const kx = KM_PER_DEG * Math.cos((lat * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    ring.push([lng + (Math.cos(a) * radiusKm) / kx, lat + (Math.sin(a) * radiusKm) / KM_PER_DEG])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }
}

/** The world with the circle cut out — the "everything else fades" veil. */
export function veilPolygon(lng: number, lat: number, radiusKm: number): GeoJSON.Feature {
  const circle = circlePolygon(lng, lat, radiusKm)
  const hole = (circle.geometry as GeoJSON.Polygon).coordinates[0]
  const world: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ]
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [world, hole] },
    properties: {},
  }
}

/* ── the place search (Task D) ────────────────────────────────────────────
   Front-end fuzzy match over the gazetteer, diacritics-insensitive, over the
   canonical name and every variant. 75 places today; a linear scan per
   keystroke is nothing, and staying dependency-free beats shipping a fuzzy
   library for a list this size. */

export interface GazPlace {
  n: string
  v: string[]
  t: string
  lat: number
  lng: number
  p: string
  c: string
}

let gazPromise: Promise<GazPlace[]> | null = null

/** Lazily fetch the gazetteer; kicked off on the search box's first focus so
 *  readers who never search never download it. */
export function loadGazetteer(url = '/data/gazetteer.json'): Promise<GazPlace[]> {
  if (!gazPromise) {
    gazPromise = fetch(url)
      .then((r) => r.json())
      .then((d: { places: GazPlace[] }) => d.places)
    gazPromise.catch(() => {
      gazPromise = null
    })
  }
  return gazPromise
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đ]/g, 'd')

export function searchGazetteer(places: GazPlace[], query: string, limit = 8): GazPlace[] {
  const q = normalize(query.trim())
  if (!q) return []
  const scored: Array<[number, GazPlace]> = []
  for (const pl of places) {
    let best = 0
    for (const name of [pl.n, ...pl.v]) {
      const n = normalize(name)
      if (n.startsWith(q)) best = Math.max(best, 3)
      else if (n.includes(' ' + q)) best = Math.max(best, 2)
      else if (n.includes(q)) best = Math.max(best, 1)
      if (best === 3) break
    }
    if (best > 0) scored.push([best, pl])
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].n.length - b[1].n.length || a[1].n.localeCompare(b[1].n))
  return scored.slice(0, limit).map(([, pl]) => pl)
}
