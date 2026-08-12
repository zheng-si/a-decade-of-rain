/**
 * The Story's heat field — gallons where they FELL, not where they were booked.
 *
 * Built by scripts/build-story-heat.mjs from the runs as lines, into the same
 * 0.03° cell the Archive's fine tier uses. One binning, two presentations.
 *
 * Why this file exists rather than reusing `spray`: `spray` is one point per
 * HERBS waypoint carrying the gallons the archive books against waypoint 1A. It
 * is still the right source for everything the Story computes over TIME — the
 * year and month charts aggregate by date and no spatial convention touches
 * them — but it is the wrong source for anything drawn on the map. See
 * docs/methods.md §3.
 */

export interface HeatCell {
  /** Cell centre. */
  lon: number
  lat: number
  /** First day of the month this cell's gallons fell in (epoch-day). */
  day: number
  gallons: number
}

interface RawHeat {
  epoch: string
  cell: number
  /** p90 of the cell-month totals, computed at build time. */
  ref: number
  fields: string[]
  cells: [number, number, number, number][]
}

export interface HeatDataset {
  features: GeoJSON.FeatureCollection<GeoJSON.Point>
  /** Cell size in degrees, for anything that needs to know the resolution. */
  cell: number
  dayMin: number
  dayMax: number
}

/**
 * Heat weight: √(gallons / ref), clamped to [0, 1].
 *
 * Square root for the same reason the dots take one — a heat blob's visual
 * weight goes with its area, so a linear weight would let one heavy cell
 * dominate everything around it. No floor: the old per-run weight carried one
 * so that zero-gallon continuation legs still marked a spray location, and this
 * field has no zero cells to mark — a cell is here because volume fell in it.
 */
const weight = (gallons: number, ref: number) =>
  Math.min(1, Math.max(0, Math.sqrt(gallons / ref)))

let cache: Promise<HeatDataset> | null = null

export function loadHeat(): Promise<HeatDataset> {
  if (cache) return cache
  const url = `${import.meta.env.BASE_URL}data/spray-heat.json`
  cache = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load heat data: ${r.status}`)
      return r.json() as Promise<RawHeat>
    })
    .then((raw) => {
      let dayMin = Infinity
      let dayMax = -Infinity
      const features: GeoJSON.Feature<GeoJSON.Point>[] = raw.cells.map(
        ([lon, lat, day, gallons]) => {
          if (day < dayMin) dayMin = day
          if (day > dayMax) dayMax = day
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: {
              day,
              gallons,
              w: Number(weight(gallons, raw.ref).toFixed(3)),
            },
          }
        },
      )
      return {
        features: { type: 'FeatureCollection', features },
        cell: raw.cell,
        dayMin,
        dayMax,
      }
    })
  return cache
}
