# Vegetation × spray overlay (exploratory)

Standalone analysis scripts (not part of the app build) that attempt to compute,
per vegetation type, the **area sprayed one or more times** by overlaying the
HERBS spray records on the traced vegetation map.

Inputs (already in the repo):
- `public/data/spray.json` — 24,604 Ranch Hand spray runs as `[lon,lat,day,agent,gallons,ctz]`
  (from `andrewstellman/hea-v`, the digitised HERBS file behind Stellman et al. 2003).
- `src/figures/vegetation-map.svg` — the vegetation polygons, classed `vt vt-<key>`.
- `public/data/vietnam.geojson` — real coastline (full Vietnam; clipped to lat < 17.12°).

Pipeline:
- `lib.mjs` — parse the SVG paths into per-class polygons; point-in-polygon; areas.
- `render-grid.mjs` — render the classified map with a pixel grid (to pick control points).
- `georef.mjs` / `georef_icp.mjs` — georeference the traced SVG (pixel → lon/lat) by
  matching its silhouette / coastline to `vietnam.geojson` (moment matching; ICP).
- `overlay.mjs` / `overlay2.mjs` — rasterise total area per class, drop the spray points,
  tally sprayed-vs-total area and % per class.

## Finding (why the per-class numbers are NOT used in the figure)

The overlay reproduces the **total** sprayed area well (~1.6M ha, matching the literature
~1.5–1.7M ha), which validates the spray data, the scale, and the intersection logic.

But it does **not** reproduce the known per-class anchors: forest comes out ~15–18%
(Westing 1971: 35%) and mangrove ~6–19% (Westing/Stellman: 36%). The binding constraint
is **georeferencing accuracy**: every method tried (manual-GCP affine, silhouette moment
matching, ICP boundary registration) plateaus at ~20–30 km residual. At that error the
spray points scatter across the interfingered vegetation classes and flatten the real
concentration (forest 35% vs ~10% overall becomes a nearly uniform ~15%).

Root cause: the vegetation SVG is a hand-traced, recoloured redraw of the 1974 thematic
map and carries no coordinate datum. A trustworthy overlay needs the **original map image**
(its printed city labels give 15–20 accurate ground-control points for a polynomial/TPS
warp) plus swath modelling of the spray flight lines — i.e. a real GIS georeferencing pass.

Until then the figure uses literature anchors (forest 35%, mangrove 36% = 105/291,
rice ~7–10%) and marks the remaining types as estimates.
