# A Decade of Rain

Two pages drawn from one record: the HERBS file of U.S. military herbicide
missions over South Vietnam, 1961 to 1971.

- **A Decade of Rain** ([adecadeofrain.sizheng.me](https://adecadeofrain.sizheng.me)):
  a scroll-driven narrative in eight nodes, from the 1961 test sprays to the
  1971 reckoning, over a single heat field that fills in as the reader scrolls.
- **The Herbicide Atlas of Vietnam** ([/archive](https://adecadeofrain.sizheng.me/archive)):
  an explorer of the same record. A playable decade, three zoom-dependent
  encodings of the volume, an agent filter, and a lookup that returns the
  individual runs within a radius of a place or the runs of a HERBS mission
  number (`?m=4493`).

Both are static pages: no backend, no accounts, no analytics.

## The record

The source is the HERBS file as republished in Andrew Stellman's open
[`hea-v`](https://github.com/andrewstellman/hea-v) repository
(`data/herbs.json`, MIT), pinned to commit `cb5948b` so that every number here
can be recomputed from the same bytes. It is the record behind Stellman,
Stellman, Christian, Weber and Tomasallo, *The extent and patterns of usage of
Agent Orange and other herbicides in Vietnam*, Nature 422 (2003).

Measured at that commit:

| | |
|---|---|
| Rows (waypoint records) | 24,604, fourteen fields each |
| Missions | 9,141 |
| Mission + Run pairs | 11,273 |
| Gallons | 19,490,690, all of them on each mission's `1A` row |
| Dates | 10 August 1961 to 27 December 1971 |
| Method | fixed-wing 95.4% of the gallons, helicopter 3.8%, ground 0.25% |

The one fact that shapes everything below: the file books a mission's whole
load against the first waypoint of its first track, and records the track
itself as a chain of further waypoints with no volume on them. A map drawn
straight from the fields puts the load in one cell at one end of an 11 km line.

## What the pipeline does

1. **Georeference.** The grid references are MGRS-style with the UTM zone
   omitted. Each is converted under every candidate zone and band (48 and 49 ×
   N, P, Q, R) and the candidate nearest `hea-v`'s own 0.01° lattice
   (`gridpoints.json`) is kept, within 0.05°. All 24,604 rows convert; none is
   dropped. Coordinates are rounded to 0.001°.
2. **Reconstruct runs as lines.** Rows are grouped by `Mission` + `Run` in file
   order and split where the leg number changes: 8,753 line segments and 2,831
   single-point records.
3. **Spread the volume.** Each mission's gallons are spread along every line
   track it flew, in proportion to length. Totals are conserved to the gallon
   (19,490,688 out against 19,490,690 in, whole-gallon rounding) and the build
   throws if they are not.
4. **Bin.** The Atlas's two dot tiers (0.12° and 0.03° cells) are binned from
   the lines in the browser (`src/components/trackGrid.ts`); the Story's field
   is binned by `scripts/build-story-heat.mjs` into 0.03° cells by month.
5. **Draw.** Dots take area proportional to gallons; strokes take width
   proportional to gallons per kilometre and fade from the first waypoint on
   file; the heat weight is √(gallons / ref) with ref the 90th percentile of
   the cell-month totals.

Steps 1 to 3 are `scripts/build-spray-tracks.mjs` (`npm run build:tracks`);
the point file for the timeline is `scripts/build-spray-data.mjs`
(`npm run build:data`). The source is cached under `scripts/.cache/` and
fetched from the pinned commit when absent.

### What the pipeline does not do

No drift, no swath width, no degradation, no canopy or soil interception, no
population. The maps show where the record says the herbicide was released,
not where it landed or whom it reached. The full list of limits is in
[`docs/methods.md`](docs/methods.md).

## Outputs

All in `public/data/`, fetched by the pages at runtime.

| File | One entry is | Fields |
|---|---|---|
| `spray.json` | one source row | `[lon, lat, day, agent, gallons, ctz]` |
| `spray-tracks.json` | one line segment (`tracks`) or one single-point run (`marks`) | `[agent, day, gallons, km, coords, mission, run, fwac]` / `[agent, day, gallons, lon, lat, mission, run, fwac]` |
| `spray-heat.json` | one (cell, month) aggregate | `[lon, lat, day, gallons]`, 23,729 of them |

`day` counts from 1 January 1961 as day 1, matching `hea-v`'s own engine.
`src/data/README.md` documents the point file in more detail.

## Methods

- [`docs/methods.md`](docs/methods.md): the working methods note, kept
  current with the build.
- [`docs/methods-paper.md`](docs/methods-paper.md): a longer note written for
  the authors of the record, with the field dictionary as observed, every
  encoding constant, the checks, the limits, and open questions. Its central
  measurement: at a 3 km cell, 59% of all gallons sit in a different place
  under the file's own booking than under the along-track reading, and 63% of
  cells that received herbicide read as zero.
- `scripts/analyse-binning.mjs` (`npm run analyse:binning`) reproduces the
  tables in both notes; `scripts/analyse-mission-spread.mjs` measures the
  per-mission correction; `scripts/build-figure-binning.mjs`
  (`npm run build:figures`) draws `docs/figures/binning-comparison.svg`.

`docs/` also holds the design-system notes and the map label and zoom studies.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite → dist/
npm run preview
```

Rebuilding the data, in order: `npm run build:data`, `npm run build:tracks`,
`npm run build:heat`. `npm run build:regions` rebuilds the province and
military-region layers from geoBoundaries.

## Stack

Vite, React and TypeScript. MapLibre GL JS with the OpenFreeMap Positron
style (no key), AWS Terrain Tiles for the optional 3D relief, geoBoundaries
for provinces. Scrollama drives the Story. Geist and Courier Prime are
self-hosted under `public/fonts/`. Deployed on Vercel.

## Licence and citation

The code, the build scripts and the notes in this repository are released
under the MIT licence (see `LICENSE`). The source data is MIT-licensed by
Andrew Stellman via `hea-v`; the pages cite it as "the complete record behind
Stellman et al. (2003)". The basemap, terrain and boundary sources carry their
own licences, listed in the pages' sources.
