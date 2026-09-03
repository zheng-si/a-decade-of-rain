// ── the spray record as lines ─────────────────────────────────────────────
// A spray run is a track, not a point: HERBS records it as leg 1A → 1B → …
// and books the whole run's volume against 1A. See scripts/build-spray-tracks
// for the evidence and src/data/README.md for what it costs to ignore.
//
// This loader is deliberately separate from spray.ts rather than replacing it.
// The point dataset drives the story's heatmap and the Archive's grid tiers,
// both of which are tuned against it; the tracks are the truer geometry and
// have to earn their way in on the screen, not by breaking two other pages.

export interface TrackDataset {
  /** One LineString per sprayed segment. */
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString, TrackProps>
  /** Runs recorded at a single grid reference — no line to draw. */
  marks: GeoJSON.FeatureCollection<GeoJSON.Point, TrackProps>
  /** First and last point of each track, for the endpoint caps. Built here
   *  rather than in the layer module because it is a fact about the data, not
   *  about how it is painted, and because doing it once at load beats doing it
   *  on every style change. */
  ends: GeoJSON.FeatureCollection<GeoJSON.Point, TrackProps>
  agents: string[]
  dayMin: number
  dayMax: number
  /** Gallons per km across all tracks, sorted — for picking width ramps
   *  against the real distribution instead of by eye. */
  gpkSorted: number[]
}

export interface TrackProps {
  day: number
  agent: number
  gallons: number
  /** Segment length in km. 0 for a mark. */
  km: number
  /** Gallons per km — the linear density this segment was dosed at, and the
   *  only quantity that is comparable between a 2 km run and a 40 km one. */
  gpk: number
  /** Resolved colour, stamped at load so the layers need no match expression. */
  c: string
  /** Agent group index, for the dominant-agent readouts. */
  gi: number
  /** Endpoint features only: 0 = head, 1 = tail.
   *
   *  "Head" means leg 1A — the first row of the run and the one HERBS books
   *  the gallons against. For a connected aerial path the letters are the
   *  spray sequence: Stellman et al. (2003, EHP) read A as the point where
   *  spraying began, the middle letters as turns made while spraying and the
   *  last as spray-off. That is an order, not a compass bearing, and it is not
   *  claimed for records logged as point applications (perimeter spraying
   *  went guard post to guard post and is not connected). */
  end?: 0 | 1
  /** HERBS run identity — Mission and Run numbers from the source rows, so a
   *  record on screen can cite the row it came from. 0 = not carried. */
  mission: number
  run: number
  /** Aircraft count for the run, read the way hea-v's own engine reads FWAC
   *  (the last two digits). 0 = not recorded. */
  fwac: number
  /** 1 on the one run that carries the positional halo for its geometry.
   *
   *  Runs repeat: a route north of Đồng Xoài was flown daily for three weeks
   *  on the same five grid references, and 488 sprayed geometries in the file
   *  occur more than once (the largest 32 times). The halo is a statement
   *  about where a LINE could be, so it is owed once per line, not once per
   *  flight; drawn per run, the alpha of a 21-deep stack saturates into a
   *  black corridor with an edge, which is the one picture the band exists to
   *  avoid. The earliest sprayed run of each geometry carries it, so under the
   *  playhead the band appears with the first flight and stays. */
  halo: 0 | 1
}

interface RawTracks {
  agents: string[]
  tracks: [number, number, number, number, number[], number?, number?, number?][]
  marks: [number, number, number, number, number, number?, number?, number?][]
}

/** In-flight and settled loads, so a second caller gets the first one's work.
 *
 *  The key is the url AND the palette, and that is not belt-and-braces. The
 *  colour is baked into every feature's `c` at load time (that is the whole
 *  point — it saves a match expression per layer), so the parsed result is
 *  specific to the palette it was parsed with. The Story calls this with an
 *  empty `colors`, which resolves every track to the fallback violet; the
 *  Archive calls it with the real agent palette. Keyed on the url alone,
 *  whichever surface asked first would decide what colour the herbicides are
 *  on the other — reach the Archive by clicking through from the Story and
 *  every track paints #9a6cc4. Keyed on both, they are simply two entries. */
const cache = new Map<string, Promise<TrackDataset>>()

/** Load and shape the track dataset.
 *
 *  `colors` and `groupOf` are passed in rather than derived here so that the
 *  tracks take exactly the same agent palette as the dots — two files deciding
 *  what colour Agent Orange is, is how they start to disagree. */
export function loadTracks(
  colors: string[],
  groupOf: number[],
  url = '/data/spray-tracks.json',
): Promise<TrackDataset> {
  const key = `${url}|${colors.join(',')}|${groupOf.join(',')}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = parseTracks(colors, groupOf, url)
  // A failed fetch must not be remembered as the answer — drop it so a retry
  // (a route change, a reconnect) actually retries.
  p.catch(() => cache.delete(key))
  cache.set(key, p)
  return p
}

async function parseTracks(
  colors: string[],
  groupOf: number[],
  url: string,
): Promise<TrackDataset> {
  const raw = (await (await fetch(url)).json()) as RawTracks

  let dayMin = Infinity
  let dayMax = -Infinity
  const gpkSorted: number[] = []

  const lines: GeoJSON.Feature<GeoJSON.LineString, TrackProps>[] = raw.tracks.map(
    ([agent, day, gallons, km, flat, mission, run, fwac]) => {
      const coordinates: [number, number][] = []
      for (let i = 0; i < flat.length; i += 2) coordinates.push([flat[i], flat[i + 1]])
      const gpk = km > 0 ? gallons / km : 0
      if (day < dayMin) dayMin = day
      if (day > dayMax) dayMax = day
      gpkSorted.push(gpk)
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: {
          day,
          agent,
          gallons,
          km,
          gpk: Number(gpk.toFixed(1)),
          c: colors[agent] ?? '#9a6cc4',
          gi: groupOf[agent] ?? 3,
          mission: mission ?? 0,
          run: run ?? 0,
          fwac: fwac ?? 0,
          halo: 0,
        },
      }
    },
  )
  // One halo per distinct sprayed geometry, on its earliest run. See `halo`.
  const firstOf = new Map<string, GeoJSON.Feature<GeoJSON.LineString, TrackProps>>()
  for (const f of lines) {
    if (f.properties.gpk <= 0) continue
    const k = f.geometry.coordinates.join(';')
    const seen = firstOf.get(k)
    if (!seen || f.properties.day < seen.properties.day) firstOf.set(k, f)
  }
  for (const f of firstOf.values()) f.properties.halo = 1

  const marks: GeoJSON.Feature<GeoJSON.Point, TrackProps>[] = raw.marks.map(
    ([agent, day, gallons, lon, lat, mission, run, fwac]) => {
      if (day < dayMin) dayMin = day
      if (day > dayMax) dayMax = day
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          day,
          agent,
          gallons,
          km: 0,
          gpk: 0,
          c: colors[agent] ?? '#9a6cc4',
          gi: groupOf[agent] ?? 3,
          mission: mission ?? 0,
          run: run ?? 0,
          fwac: fwac ?? 0,
          halo: 0,
        },
      }
    },
  )

  const ends: GeoJSON.Feature<GeoJSON.Point, TrackProps>[] = []
  for (const f of lines) {
    const c = f.geometry.coordinates
    if (c.length < 2) continue
    ends.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c[0] },
      properties: { ...f.properties, end: 0 },
    })
    ends.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c[c.length - 1] },
      properties: { ...f.properties, end: 1 },
    })
  }

  gpkSorted.sort((a, b) => a - b)
  return {
    lines: { type: 'FeatureCollection', features: lines },
    marks: { type: 'FeatureCollection', features: marks },
    ends: { type: 'FeatureCollection', features: ends },
    agents: raw.agents,
    dayMin,
    dayMax,
    gpkSorted,
  }
}
