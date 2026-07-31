// ─────────────────────────────────────────────────────────────────────────
//  Map configuration — EDIT THIS FILE to restyle the map.
//
//  Everything visual about the basemap, the locked viewport, and the per-agent
//  spray colours lives here. Change a value, save, and the map updates. No other
//  file needs touching for normal restyling.
// ─────────────────────────────────────────────────────────────────────────

export interface MapTheme {
  /** Land / background fill. */
  land: string
  /** Seas, lakes, rivers. */
  water: string
  /** Parks, forest, vegetation. */
  greenspace: string
  /** Building footprints. */
  building: string
  /** Roads. */
  road: string
  /** Administrative boundaries. */
  boundary: string
  label: {
    color: string
    halo: string
    haloWidth: number
    /** Multiplies every label's size (1 = unchanged). */
    sizeScale: number
    /**
     * Font stack. Leave undefined to keep the basemap's fonts. OpenFreeMap
     * only serves a fixed set of glyphs — safe choices are:
     *   ['Noto Sans Regular'] · ['Noto Sans Medium'] · ['Noto Sans Bold']
     *   ['Noto Sans Italic']  · ['Metropolis Regular'] · ['Metropolis Bold']
     * A font the server doesn't have makes labels disappear, so stick to these
     * unless you self-host glyphs.
     */
    font?: string[]
  }
}

export interface AgentStyle {
  /** Chip key + heatmap layer suffix. */
  key: string
  /** Chip label. */
  label: string
  /** HERBS agent codes grouped under this colour (see src/data/README.md). */
  codes: string[]
  /** Base colour; the heatmap ramps from transparent → this → darker. */
  color: string
}

export interface MapConfig {
  /** OpenFreeMap base style. Try: positron · bright · liberty · dark. */
  baseStyleUrl: string
  /**
   * Override the glyph (font) endpoint. Leave undefined to use the base style's
   * fonts (OpenFreeMap → Noto/Metropolis only). To use a custom font you must
   * self-host SDF glyph PBFs and point this at them, e.g. '/fonts/{fontstack}/{range}.pbf'.
   * See the README "Custom label font" section.
   */
  glyphsUrl?: string
  view: {
    center: [number, number]
    zoom: number
    /**
     * The subject's own extent. The explorer derives its home camera and its
     * zoom floor from THIS, per viewport, rather than trusting the fixed
     * center/zoom above — a single number cannot frame the same ground on a
     * phone and on a 27" display.
     */
    recordBounds: [[number, number], [number, number]]
    /** Screen padding (px) left around `recordBounds` when fitting. */
    fitPadding: number
    /** How far below the fitted zoom the reader may still pull out. */
    minZoomMargin: number
    /** Fallback zoom floor, used only if the fit cannot be computed. */
    minZoom: number
    /** Furthest zoom-IN allowed. */
    maxZoom: number
    /** Pan is clamped to this box: [[west, south], [east, north]]. */
    maxBounds: [[number, number], [number, number]]
    /** Tilt (degrees) used by the 3D view toggle. */
    pitch3d: number
    /** Hard cap on tilt. */
    maxPitch: number
  }
  /** Optional 3D terrain (used by the 3D view). Omit to disable relief. */
  terrain?: {
    /** Raster-DEM tile URL. The default is free, no-key AWS Terrarium tiles. */
    demUrl: string
    /** Terrarium-encoded DEM. */
    encoding: 'terrarium' | 'mapbox'
    exaggeration: number
  }
  theme: MapTheme
  agents: AgentStyle[]
  heatmap: {
    /** [zoom, value] stops for blur radius (px) and intensity. */
    radius: [number, number][]
    intensity: [number, number][]
    opacity: number
  }
}

/**
 * The map-label face — one name, used by every text layer on both maps.
 *
 * Condensed is a deliberate choice, not a style preference: Vietnamese place
 * names run long ("Buôn Ma Thuột", "Bà Rịa – Vũng Tàu"), and a narrower face
 * fits more of them on screen before MapLibre's collision detection starts
 * dropping names outright. It covers Vietnamese natively, so a name renders in
 * one face instead of being half-composited from the Noto fallback.
 *
 * Must match a self-hosted glyph stack under public/fonts/ — see
 * scripts/build-glyphs.mjs. A name with no stack on disk does not fall back;
 * every label on the map disappears.
 */
export const LABEL_FONT = 'Roboto Condensed'

/**
 * The map's only two hand-off zooms.
 *
 * Everything that changes with zoom — which data tier is drawn, which label
 * tiers are visible, which of our own annotations survive — is pinned to one
 * of these two numbers. The explorer used to have five thresholds (6.4 / 7.0 /
 * 8.5 / 9.0 / 9.2) packed into 2.8 zoom levels, so one scroll of the wheel
 * could trip three separate reflows. One coordinated change reads as the map
 * shifting gear; three unaligned ones read as twitching.
 *
 *   Z_MID   coarse grid → fine grid · town names in · country name out
 *   Z_NEAR  fine grid → raw events  · military-region tags out
 *
 * They live here rather than in volumeGrid because mapTheme needs them too,
 * and volumeGrid already imports from mapTheme — the other direction would
 * close an import cycle.
 */
export const Z_MID = 7.0
export const Z_NEAR = 9.2

export const mapConfig: MapConfig = {
  baseStyleUrl: 'https://tiles.openfreemap.org/styles/positron',

  // Self-hosted Public Sans glyphs (see scripts/build-glyphs.mjs) label the map in
  // the project font instead of OpenFreeMap's Noto.
  glyphsUrl: '/fonts/{fontstack}/{range}.pbf',

  view: {
    // Tuned so a 16" laptop shows all of Vietnam, ~2/3 of the viewport height.
    // Vietnam runs ~8.2°N (Cà Mau) to ~23.4°N; centre + zoom frame that span.
    // Fallbacks only — the explorer overrides both from `recordBounds` once it
    // knows the viewport. The story still uses them as written.
    center: [106.5, 16.2],
    zoom: 5.8,

    // Where Operation Ranch Hand actually flew, not where Vietnam is. 99.5% of
    // the 24,604 recorded runs fall below 17.05°N — only 130 crossed the DMZ —
    // so framing the whole country wastes the top third of the screen on ground
    // the record never touches, and pushes the Cà Mau peninsula (which was
    // sprayed heavily) off the bottom on any laptop. This box holds 99.9% of
    // the runs with a little air around it. Fitting it lands ~0.2–0.4 zoom
    // levels TIGHTER than the old fixed 5.8 on a desktop, and ~0.5 looser on a
    // phone — which is the whole point of deriving it.
    recordBounds: [
      [103.8, 8.3],
      [109.8, 17.7],
    ],
    fitPadding: 28,
    // The box is tall and narrow, so on any landscape viewport the fit is
    // height-limited and the extra width comes free — enough to keep the
    // disputed-island notes (112°E / 114°E) on screen without asking for them.
    minZoomMargin: 0.35,
    minZoom: 5.6,
    // Stops where the data does. HERBS records flight runs; past z12 a dot
    // carries no more information, and letting the reader keep going implies a
    // precision the record does not have. (CF caps its equivalent map at 9.)
    maxZoom: 12,
    // Still a loose leash, but half the old width: wide enough that an
    // ultrawide viewport at the zoom floor never fights the clamp, tight enough
    // that the map cannot drift to India or the Philippines. It has to contain
    // the full run extent (102.8–110.0°E, 8.6–20.5°N) and both island notes.
    maxBounds: [
      [94.0, 2.0],
      [122.0, 26.0],
    ],
    pitch3d: 55,
    maxPitch: 68,
  },

  // Free, no-key elevation tiles (AWS open data "Terrain Tiles") give the 3D
  // view real relief. The path-style URL is the canonical CORS-enabled one.
  terrain: {
    demUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: 'terrarium',
    exaggeration: 1.6,
  },

  // Muted cartographic palette matching the Figma redesign: warm near-white
  // paper, soft desaturated sage land, pale cool sea, hairline borders.
  // Land is the original warm paper. Lightening it toward white did raise
  // contrast against the data hues (WCAG is luminance-only, and land is the
  // lighter side of every pairing) but the gain was small, it read harsh, and
  // it flattened the warm/cool difference the water depends on. Water now
  // carries its own blue instead, so land does not have to compensate.
  theme: {
    land: '#f3f1ed',
    /* Water/vegetation at half strength (mixed 50% toward the land tone) so
       the basemap sits further behind the data. */
    water: '#e9ece7',
    greenspace: '#e1e5d7',
    building: '#e9e3d6',
    road: '#ffffff',
    boundary: '#6b6e66',
    label: {
      // Same tertiary ink the UI captions use (--ink-faint), so map and page
      // read as one text system. 6.5:1 on the land — a full step darker than
      // the old #5b5e57 (5.9:1), which sat too close to the paper.
      color: '#4b5a50',
      halo: '#ffffff',
      haloWidth: 1.3,
      sizeScale: 1,
      font: [LABEL_FONT],
    },
  },

  // One colour per agent group. Orange/White/Blue are the three big ones; the
  // rest (Purple, Pink, etc.) fold into "Other".
  // Agent names mapped to saturated, readable colours: Orange = orange,
  // White = light grey, Blue = light blue, Other = violet.
  agents: [
    { key: 'O', label: 'Orange', codes: ['O'], color: '#ef7d1a' },
    // Slate-blue silver: blue-leaning so an isolated White stays clearly
    // apart from the neutral context grey (DIM in volumeGrid.ts) on the map.
    { key: 'W', label: 'White', codes: ['W'], color: '#93a1b3' },
    { key: 'B', label: 'Blue', codes: ['B'], color: '#5aa6e0' },
    { key: 'other', label: 'Other', codes: ['P', 'U', 'K', 'D', 'T'], color: '#9a6cc4' },
  ],

  heatmap: {
    // Tighter radius keeps spray on the land it came from (less blur into the
    // sea) and is cheaper to render.
    radius: [
      [5, 3],
      [8, 11],
      [11, 24],
    ],
    intensity: [
      [5, 0.8],
      [10, 1.9],
    ],
    opacity: 0.8,
  },
}
