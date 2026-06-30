# Data sources

## `spray.json` — Operation Ranch Hand herbicide spray runs (1961–1971)

> Built to `public/data/spray.json` (served as a static asset, fetched at
> runtime by `src/data/spray.ts`).

Time-stamped, georeferenced record of US aerial herbicide spraying in Vietnam.
Drives the spray heat map and timeline.

- **Records:** 24,604 spray "runs"
- **Span:** 1961–1971 (peak 1966–1969)
- **Total:** 19,490,690 gallons
- **Size:** ~640 KB (compact array form)

### Provenance

Built from **[`andrewstellman/hea-v`](https://github.com/andrewstellman/hea-v)**
(`data/herbs.json`), the open digitisation of the **HERBS file** maintained by
Andrew Stellman, who developed the GIS behind:

> Stellman, J.M., Stellman, S.D., Christian, R., Weber, T. & Tomasallo, C.
> *The extent and patterns of usage of Agent Orange and other herbicides in
> Vietnam.* **Nature 422, 681–687 (2003).**

Licensed **MIT, © 2026 Andrew Stellman**. Pinned to commit
`cb5948b` (see `scripts/build-spray-data.mjs`).

### How it's produced

`npm run build:data` runs `scripts/build-spray-data.mjs`, which:

1. Loads `herbs.json` (cached under `scripts/.cache/`, else fetched from the
   pinned commit).
2. Converts each run's wartime **military grid string** (e.g. `AR769898` —
   100 km square + easting/northing, 100 m precision) to lon/lat. The strings
   omit the UTM zone, so the script tries Vietnam's candidate zones/bands
   (`48P 49P 48Q 49Q 48N 49N`) and keeps the result inside the Vietnam bbox.
   This reproduces Stellman's own georeferencing — validated against his
   `gridpoints.json`: **100% of runs land in the correct 100 km square**
   (max offset 0.49° vs. each square's centroid, well within its ~1° width).
3. Writes the compact `spray.json`.

### Format

```jsonc
{
  "epoch": "1961-01-01",              // day 1 (matches the HEA-V engine)
  "fields": ["lon", "lat", "day", "agent", "gallons"],
  "agents": ["O","W","B","P","U","K","D","T"],   // agent index legend
  "agentNames": { "O": "Agent Orange", "W": "Agent White", ... },
  "runs": [ [108.199, 16.044, 1623, 0, 1500], ... ]  // sorted by day
}
```

- `day` — integer day number since the epoch; convert with
  `new Date(Date.UTC(1961,0,1) + (day-1)*86400000)`.
- `agent` — index into `agents`. `O` (Orange), `W` (White), `B` (Blue) dominate.
- `gallons` — recorded at mission level in HERBS, so many individual legs read
  `0`; the heat map weights by gallons, which is correct for spray *intensity*.

## `hotspots.ts` — dioxin hotspot airbases

Hand-curated former US airbases that are the focus of post-war remediation
(Da Nang, Bien Hoa, Phu Cat). See file for per-site notes.
