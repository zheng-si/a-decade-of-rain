// Typed access to the Operation Ranch Hand spray dataset (see README.md).
// spray.json is served as a static asset and fetched once at runtime, then
// expanded into a GeoJSON FeatureCollection. The timeline / agent filters are
// applied purely via MapLibre filter expressions on the feature properties,
// so the data is never re-serialised per frame.
import type { FeatureCollection, Point } from 'geojson'

type RawRun = [lon: number, lat: number, day: number, agent: number, gallons: number]

interface RawSpray {
  epoch: string
  fields: string[]
  agents: string[]
  agentNames: Record<string, string>
  runs: RawRun[]
}

export const EPOCH_MS = Date.UTC(1961, 0, 1)
const DAY_MS = 86_400_000

/** Day number (1 = epoch) → Date. */
export function dayToDate(day: number): Date {
  return new Date(EPOCH_MS + (day - 1) * DAY_MS)
}

/** ISO date string → day number (1 = epoch). */
export function dateToDay(iso: string): number {
  return Math.floor((Date.parse(iso) - EPOCH_MS) / DAY_MS) + 1
}

export interface SprayProps {
  day: number
  agent: number
  gallons: number
  w: number
  [key: string]: unknown
}

export interface AgentInfo {
  index: number
  code: string
  name: string
}

export interface SprayDataset {
  features: FeatureCollection<Point, SprayProps>
  agents: AgentInfo[]
  dayMin: number
  dayMax: number
  yearMin: number
  yearMax: number
  totalRuns: number
}

// Reference volume for the heat-map weight (≈ p90 of non-zero runs). A run's
// weight is sqrt(gallons / ref) clamped to [floor, 1]; the floor lets the many
// mission-legs recorded with 0 gallons still faintly mark a spray location.
const GAL_REF = 6000
const WEIGHT_FLOOR = 0.06

function weight(gallons: number): number {
  if (gallons <= 0) return WEIGHT_FLOOR
  return Math.min(1, Math.max(WEIGHT_FLOOR, Math.sqrt(gallons / GAL_REF)))
}

let cache: Promise<SprayDataset> | null = null

/** Fetch and parse the spray dataset (memoised). */
export function loadSpray(): Promise<SprayDataset> {
  if (cache) return cache
  const url = `${import.meta.env.BASE_URL}data/spray.json`
  cache = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load spray data: ${r.status}`)
      return r.json() as Promise<RawSpray>
    })
    .then((raw) => {
      const features: FeatureCollection<Point, SprayProps> = {
        type: 'FeatureCollection',
        features: raw.runs.map(([lon, lat, day, agent, gallons]) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: { day, agent, gallons, w: Number(weight(gallons).toFixed(3)) },
        })),
      }
      const days = raw.runs.map((r) => r[2])
      const dayMin = Math.min(...days)
      const dayMax = Math.max(...days)
      return {
        features,
        agents: raw.agents.map((code, index) => ({
          index,
          code,
          name: raw.agentNames[code] ?? code,
        })),
        dayMin,
        dayMax,
        yearMin: dayToDate(dayMin).getUTCFullYear(),
        yearMax: dayToDate(dayMax).getUTCFullYear(),
        totalRuns: raw.runs.length,
      }
    })
  return cache
}
