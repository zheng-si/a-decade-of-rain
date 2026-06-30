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
    /** Furthest zoom-OUT allowed (the locked overview of Vietnam). */
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

export const mapConfig: MapConfig = {
  baseStyleUrl: 'https://tiles.openfreemap.org/styles/positron',

  // Self-hosted Switzer glyphs (see scripts/build-glyphs.mjs) label the map in
  // the project font instead of OpenFreeMap's Noto.
  glyphsUrl: '/fonts/{fontstack}/{range}.pbf',

  view: {
    // Tuned so a 16" laptop shows all of Vietnam, ~2/3 of the viewport height.
    // Vietnam runs ~8.2°N (Cà Mau) to ~23.4°N; centre + zoom frame that span.
    center: [106.5, 16.2],
    zoom: 5.8,
    minZoom: 5.6, // furthest zoom-out: full country still visible
    maxZoom: 16, // can keep zooming in to street level
    // Loose leash: at the zoom needed to see all of (narrow) Vietnam the
    // viewport is far wider than the country, so a tight box would fight the
    // zoom. This just stops the map drifting out of the region; it can't hide
    // neighbours at full zoom-out. Tighten once zoomed in.
    maxBounds: [
      [80.0, 1.0],
      [128.0, 30.0],
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

  theme: {
    land: '#f3efe9',
    water: '#cde0e6',
    greenspace: '#e3ebdc',
    building: '#e7e1d8',
    road: '#ffffff',
    boundary: '#c4b9a8',
    label: {
      color: '#4a4540',
      halo: '#ffffff',
      haloWidth: 1.4,
      sizeScale: 1,
      // Must match a self-hosted glyph stack (public/fonts/<name>/). See
      // scripts/build-glyphs.mjs to add more fonts/weights.
      font: ['Switzer Medium'],
    },
  },

  // One colour per agent group. Orange/White/Blue are the three big ones; the
  // rest (Purple, Pink, etc.) fold into "Other".
  // Colours match the agent names: Orange = orange, White = light grey,
  // Blue = light blue. Other (Purple, Pink, …) keeps a distinct violet.
  agents: [
    { key: 'O', label: 'Orange', codes: ['O'], color: '#ef7d1a' },
    { key: 'W', label: 'White', codes: ['W'], color: '#a9adb3' },
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
