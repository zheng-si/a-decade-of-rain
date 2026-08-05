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
- `gallons` — see the note below. Two thirds of the rows read `0`, and not
  because the figure is missing.

### What a "run" actually is in HERBS

The source row has fourteen fields; this ETL keeps six. Three of the dropped
ones — `Mission`, `Run`, `Leg` — are the ones that say **these rows are one
flight**, and without them a spray run looks like a scatter of unrelated
points. Measured against `herbs.json` at the pinned commit:

| | |
|---|---|
| `Leg` format | `1A 1B 1C 2A …` — segment number + waypoint letter, 100% of 24,604 rows |
| runs (`Mission`+`Run`) | 11,273, of which 8,582 have more than one waypoint |
| most common shape | two waypoints — a straight line from A to B (6,385 runs) |
| gallons by leg | **all 19,490,690 on leg `1A`**; every other leg sums to exactly 0 |
| gap, leg `nB` → `(n+1)A` | median 2.63 km — the segments chain end to end |
| polyline length | median **11.4 km**, p90 19.9 km, max 354.6 km |

So a spray run is a **line**, and HERBS books the whole run's volume against
its first waypoint. The other waypoints are the track, not sorties with a
missing figure.

Two consequences this file's consumers must know:

1. **The volume is spatially displaced.** A run's gallons all land at one end
   of a track that is typically 11 km long — three or four fine-grid cells.
   93% of the gallons on multi-waypoint runs belong to tracks of 5 km or more.
   Any binning of `gallons` by location inherits that bias.
2. **Run counts are not recoverable here.** 2,913 of the 11,273 runs carry no
   volume anywhere, and with `Mission`/`Run` dropped there is nothing to group
   by, so counting gallons-bearing rows (8,360) undercounts runs.

Fixing either means re-running the ETL to keep the run identity and distribute
each run's volume along its track. The dataset carries no per-waypoint
quantity — `Gallons` and `FWAC` both appear only on leg `1A` — so the only
available weight is geometric (segment length).

## `hotspots.ts` — dioxin hotspot air bases

Hand-curated former U.S. air bases that are the focus of post-war remediation
(Da Nang, Bien Hoa, Phu Cat). See file for per-site notes.
