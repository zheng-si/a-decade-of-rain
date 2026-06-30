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
  `minZoom` (furthest zoom-out), `maxZoom` (furthest zoom-in), and the initial
  `center` / `zoom`.
- **`agents`** — one color per herbicide group (Orange / White / Blue / Other).
  Each becomes its own colored heatmap layer and drives the filter chips, so the
  agents are distinguishable by color; selecting a chip isolates that agent.
- **`baseStyleUrl`** — swap the OpenFreeMap base style (positron / bright /
  liberty / dark).

### Custom label font

Map labels are drawn by MapLibre from **SDF glyph PBFs**, not CSS fonts, so a
custom font can't be set with CSS — it has to be self-hosted as glyphs.
OpenFreeMap only serves Noto Sans / Metropolis, so anything else (e.g. *Neue
Haas Unica W1G*) needs these steps:

1. Add the licensed font file under `scripts/fonts/` (you must hold a license to
   embed/serve it).
2. Generate glyph ranges with an SDF tool (e.g. [font-maker](https://maplibre.org/font-maker/)
   or `fontnik`) into `public/fonts/<Font Name>/0-255.pbf`, `256-511.pbf`, …
   The basemap's own fonts (Noto Sans Regular/Italic/Bold) must live there too,
   because a style has a single glyph endpoint — generate or copy those as well.
3. Point the map at the local glyphs and pick the font:
   ```ts
   // src/config/mapConfig.ts
   glyphsUrl: '/fonts/{fontstack}/{range}.pbf',
   theme: { label: { font: ['Neue Haas Unica W1G'], … } }
   ```

Until then `label.font` is best left on an OpenFreeMap-served font
(`Metropolis Regular` is the most distinctive alternative to the default).

## Roadmap

1. ✅ Map prototype — Vietnam basemap + dioxin hotspot airbases (Da Nang, Bien Hoa, Phu Cat)
2. ✅ Real Operation Ranch Hand spray data (HERBS / Stellman 2003) — gallons-weighted
   heat map with a 1961→1971 play/scrub timeline and per-agent (Orange/White/Blue) filter
3. ⬜ Switchable layers: admin boundaries, forest / mangrove cover
4. ⬜ Scrollytelling narrative (Facts → Actions) following the original Figma structure
5. ⬜ D3 charts + interactive layered remediation cross-sections
