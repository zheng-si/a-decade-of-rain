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
   *  the gallons against. Whether the aircraft physically flew 1A→1B or the
   *  clerk listed them in some other order is NOT in the record; the letters
   *  are the only ordering it gives, so they are the only ordering to use, and
   *  a reader should be told the arrow means "first waypoint on file", not
   *  "direction of flight, verified". */
  end?: 0 | 1
}

interface RawTracks {
  agents: string[]
  tracks: [number, number, number, number, number[]][]
  marks: [number, number, number, number, number][]
}

/** Load and shape the track dataset.
 *
 *  `colors` and `groupOf` are passed in rather than derived here so that the
 *  tracks take exactly the same agent palette as the dots — two files deciding
 *  what colour Agent Orange is, is how they start to disagree. */
export async function loadTracks(
  colors: string[],
  groupOf: number[],
  url = '/data/spray-tracks.json',
): Promise<TrackDataset> {
  const raw = (await (await fetch(url)).json()) as RawTracks

  let dayMin = Infinity
  let dayMax = -Infinity
  const gpkSorted: number[] = []

  const lines: GeoJSON.Feature<GeoJSON.LineString, TrackProps>[] = raw.tracks.map(
    ([agent, day, gallons, km, flat]) => {
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
        },
      }
    },
  )

  const marks: GeoJSON.Feature<GeoJSON.Point, TrackProps>[] = raw.marks.map(
    ([agent, day, gallons, lon, lat]) => {
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
