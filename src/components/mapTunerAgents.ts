// ── the console's agent colours, applied before the record is read ────────
//
// Everything else the map tuner changes is a paint property: it can be pushed
// at a live map and the map redraws. The four agent colours are not. They are
// BAKED — into every track feature's `c` at parse time (data/tracks.ts) and
// into the binned cells' dominant-agent tint (volumeGrid.ts) — because a
// per-feature colour is what lets one layer draw four agents. By the time the
// tuner mounts, lazily and after the map is up, that baking has happened.
//
// So the tuner's live edits repaint what reads from the live palette (the
// dots, the tapered strokes) and this reads the stored value back at LOAD, so
// a reload paints everything, endpoint beads and all. Which is also why this
// file is separate and tiny: MapView imports it statically, and the 48 kB
// tuner it belongs to must stay out of the entry chunk.
//
// Gated by the caller, which only runs it under the same `?tune` / dev gate
// that mounts the panel. A reader on the live site never calls it.
import { mapConfig } from '../config/mapConfig'

export const TUNER_STORE_KEY = 'adr-map-tuner'

/** Writes any stored per-agent colours over `mapConfig.agents`, in place.
 *  Returns the keys it changed, so the caller can say so in the console. */
export function applyTunedAgents(): string[] {
  let stored: Record<string, unknown>
  try {
    const raw = localStorage.getItem(TUNER_STORE_KEY)
    if (!raw) return []
    stored = (JSON.parse(raw) as Record<string, unknown>) ?? {}
  } catch {
    return []
  }
  const agents = stored.agents
  if (!agents || typeof agents !== 'object') return []
  const changed: string[] = []
  for (const g of mapConfig.agents) {
    const c = (agents as Record<string, unknown>)[g.key]
    // Validated, not trusted: this value came out of localStorage, and a
    // malformed one would reach MapLibre as a paint property and take the
    // layer down rather than fail visibly here.
    if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && c.toLowerCase() !== g.color.toLowerCase()) {
      g.color = c
      changed.push(g.key)
    }
  }
  return changed
}
