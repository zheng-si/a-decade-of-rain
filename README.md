# Remedial Vietnam — GIS Data Visualization

Interactive, map-driven retelling of the Agent Orange / dioxin story in Vietnam
and its environmental remediation. Rebuild of an earlier static infographic
(Figma) into a real-GIS scrollytelling site.

## Stack

- **Vite + React + TypeScript**
- **MapLibre GL JS** — vector basemap, zoom/pan/3D, flight animation, layer toggles
  (basemap via [OpenFreeMap](https://openfreemap.org), no API key needed)
- **Scrollama** — scroll-driven narrative (planned)
- **D3** — bar charts, timeline, layered cross-sections (planned)

## Develop in the cloud (any device)

This project is built to be edited from any device.

### Option A — GitHub Codespaces (in the browser)
1. On the repo page click **Code ▸ Codespaces ▸ Create codespace**.
2. Wait for it to build (`.devcontainer` runs `npm install` automatically).
3. In the terminal: `npm run dev`. Codespaces auto-forwards port 5173 and opens a preview.

### Option B — claude.ai/code (keeps the AI conversation in sync across devices)
Open this GitHub repo in [claude.ai/code](https://claude.ai/code). Code *and* the
assistant conversation live in the cloud, so any device sees the same progress.

## Develop locally
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## Data

- **Spray data** — real Operation Ranch Hand records (24,604 runs, 1961–1971,
  19.49M gallons) from Stellman et al. 2003, via the MIT-licensed
  [`andrewstellman/hea-v`](https://github.com/andrewstellman/hea-v) dataset.
  Wartime military grid coordinates are converted to lon/lat by
  `scripts/build-spray-data.mjs` (`npm run build:data`). See
  [`src/data/README.md`](src/data/README.md) for provenance, the UTM→lon/lat
  conversion, and the compact `spray.json` format.

## Customizing the map

All map styling lives in one file: **[`src/config/mapConfig.ts`](src/config/mapConfig.ts)**.
Edit it and save — nothing else needs touching.

- **`theme`** — colors for land / water / greenspace / buildings / roads /
  boundaries, plus label color, halo, size, and font. (Fonts are limited to what
  OpenFreeMap serves; safe options are listed inline.) These tokens are applied
  to the basemap at load time by `applyMapTheme()` in `src/components/mapTheme.ts`.
- **`view`** — the locked viewport: `maxBounds` (pan is clamped to Vietnam),
  `minZoom` (furthest zoom-out), `maxZoom` (furthest zoom-in), the initial
  `center` / `zoom`, and `pitch3d` / `maxPitch` for the 3D tilt.
- **`terrain`** — the optional 3D relief shown by the **3D view** toggle (free,
  no-key AWS elevation tiles by default). Remove the block to disable terrain.
- **`agents`** — one color per herbicide group (Orange / White / Blue / Other).
  Each becomes its own colored heatmap layer and drives the filter chips, so the
  agents are distinguishable by color; selecting a chip isolates that agent.
- **`baseStyleUrl`** — swap the OpenFreeMap base style (positron / bright /
  liberty / dark).

### Fonts

Self-hosted **Switzer** (UI, body, map labels) + **Gambarino** (editorial
headlines) — both Fontshare / Indian Type Foundry, free for commercial use.

- UI/webfonts live in `public/fonts/ui/`, declared in `src/fonts.css` as
  `--font-sans` (Switzer) and `--font-serif` (Gambarino).
- Map labels are drawn by MapLibre from **SDF glyph PBFs**, not CSS, so Switzer
  is also self-hosted as glyphs under `public/fonts/Switzer Medium/`, generated
  by `scripts/build-glyphs.mjs` (`npm run build:glyphs`, needs `fontnik`) from
  `scripts/fonts/Switzer-Medium.ttf`. `mapConfig.glyphsUrl` points the map at
  them and `theme.label.font` selects the stack.

To swap the label font: drop a `.ttf` in `scripts/fonts/`, add it to the `FONTS`
list in `build-glyphs.mjs`, run `npm run build:glyphs`, and set
`theme.label.font` to its name. Glyphs cover Latin + Vietnamese; scripts Switzer
lacks (e.g. CJK) render blank, leaving the romanised label.

## Roadmap

1. ✅ Map prototype — Vietnam basemap + dioxin hotspot airbases (Da Nang, Bien Hoa, Phu Cat)
2. ✅ Real Operation Ranch Hand spray data (HERBS / Stellman 2003) — gallons-weighted
   heat map with a 1961→1971 play/scrub timeline and per-agent (Orange/White/Blue) filter
3. ⬜ Switchable layers: admin boundaries, forest / mangrove cover
4. ⬜ Scrollytelling narrative (Facts → Actions) following the original Figma structure
5. ⬜ D3 charts + interactive layered remediation cross-sections
