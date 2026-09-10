// ── Tile zoom under tilt ──────────────────────────────────────────────────
//
// The tiers hand off by LAYER zoom range: the coarse dots stop at Z_MID, the
// fine dots run to Z_NEAR, the tracks start there. MapLibre applies those
// ranges in its worker, per TILE, against the tile's own zoom — and once the
// map is tilted with the terrain on, the tiles are no longer all at the map's
// zoom. The far ground comes in as coarser tiles and the near ground as finer
// ones, so that a view reaching towards the horizon is covered by a sane
// number of them.
//
// The two rules meet badly. Measured at z8.6 under 55° of tilt: the ground
// nearest the camera arrived as z9 tiles, and the fine grid's maxzoom of 9
// left those eight tiles with no dots at all — the record stopped dead along a
// tile edge a third of the way up the screen. At z9.4 the far ground arrived
// as z8 tiles, under the tracks' minzoom, and the record stopped along a tile
// edge near the top instead. The hit grid is one image, not tiles, which is
// why it never showed the cut.
//
// So the record's sources choose their own tile zoom: coarser with distance,
// as MapLibre's own rule is, but never outside the tier the map's zoom is in.
// A tile can then only be at a zoom whose layers exist for it. On the flat map
// MapLibre gives every tile the one zoom and never consults this.
//
// Tying the windows to the committed hand-offs rather than reading them off
// the layers means the console's per-layer zoom overrides do not move them —
// a difference that shows only under tilt, on a console nobody ships.
import type maplibregl from 'maplibre-gl'
import { Z_MID, Z_NEAR } from '../config/mapConfig'

/** The tile zooms the tier at `zoom` accepts, as [lo, hi). MapLibre floors a
 *  layer's minzoom at the tile and treats its maxzoom as exclusive; these
 *  windows say the same thing. */
function tierWindow(zoom: number): [number, number] {
  if (zoom < Z_MID) return [0, Z_MID]
  if (zoom < Z_NEAR) return [Z_MID, Z_NEAR]
  return [Z_NEAR, Infinity]
}

/** Per-tile zoom for the record's sources, in MapLibre's own shape: the
 *  centre's zoom, then the tile's distances from the camera. */
export const tierTileZoom: maplibregl.CalculateTileZoomFunction = (
  zoom,
  distanceToTile2D,
  distanceToTileZ,
  distanceToCenter3D,
) => {
  // One zoom coarser for every doubling of a tile's distance past the
  // centre's — the same ground kept at about the same pixels. Nearer tiles
  // stay at the centre's zoom, which is what the flat map gives them too.
  const distanceToTile3D = Math.hypot(distanceToTile2D, distanceToTileZ)
  const lod = zoom - Math.max(0, Math.log2(distanceToTile3D / distanceToCenter3D))
  const [lo, hi] = tierWindow(zoom)
  // MapLibre floors what it is handed, so the top of the window sits just
  // under the hand-off: floor(8.999…) is 8, a zoom the fine grid still draws.
  return Math.min(Math.max(lod, lo), hi - 1e-6)
}

/** Put sources on tierTileZoom. After addSource, for every source whose
 *  layers carry a tier's minzoom or maxzoom. */
export function keepTierTiles(map: maplibregl.Map, ...ids: string[]) {
  for (const id of ids) {
    const src = map.getSource(id)
    if (src) src.calculateTileZoom = tierTileZoom
  }
}
