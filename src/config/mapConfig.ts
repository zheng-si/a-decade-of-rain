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
  view: {
    center: [number, number]
    zoom: number
    /** Furthest zoom-OUT allowed (the locked overview of Vietnam). */
    minZoom: number
    /** Furthest zoom-IN allowed. */
    maxZoom: number
    /** Pan is clamped to this box: [[west, south], [east, north]]. */
    maxBounds: [[number, number], [number, number]]
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

  view: {
    center: [106.3, 16.0],
    zoom: 4.9,
    minZoom: 4.4, // can't zoom out past the Vietnam overview
    maxZoom: 16, // can keep zooming in to street level
    // Hugs Vietnam (+ a little coastline) so you can't pan off to neighbours.
    maxBounds: [
      [101.0, 7.5],
      [111.5, 24.2],
    ],
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
      // font: ['Noto Sans Medium'],
    },
  },

  // One colour per agent group. Orange/White/Blue are the three big ones; the
  // rest (Purple, Pink, etc.) fold into "Other".
  agents: [
    { key: 'O', label: 'Orange', codes: ['O'], color: '#e8761e' },
    { key: 'W', label: 'White', codes: ['W'], color: '#3b7fc4' },
    { key: 'B', label: 'Blue', codes: ['B'], color: '#2f9e7a' },
    { key: 'other', label: 'Other', codes: ['P', 'U', 'K', 'D', 'T'], color: '#9a6cc4' },
  ],

  heatmap: {
    radius: [
      [4, 5],
      [7, 16],
      [10, 36],
    ],
    intensity: [
      [4, 0.9],
      [9, 2.2],
    ],
    opacity: 0.78,
  },
}
