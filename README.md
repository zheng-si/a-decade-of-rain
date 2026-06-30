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

## Roadmap

1. ✅ Map prototype — Vietnam basemap + dioxin hotspot airbases (Da Nang, Bien Hoa, Phu Cat)
2. ⬜ Real Operation Ranch Hand spray data (HERBS / Stellman 2003) on a time axis
3. ⬜ Switchable layers: admin boundaries, forest / mangrove cover
4. ⬜ Scrollytelling narrative (Facts → Actions) following the original Figma structure
5. ⬜ D3 charts + interactive layered remediation cross-sections
