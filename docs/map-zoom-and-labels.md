# Map zoom, layers and labels — the Archive explorer, against CF

A per-item audit of everything that changes with zoom on the Archive map, with
the Climate Mobility (CF) explorer alongside as a reference point.

中文版：[`map-zoom-and-labels.zh.md`](./map-zoom-and-labels.zh.md)

**How to read the provenance marks.** Every CF row is one of:

- ● **read from their code** — a literal value decompiled out of the shipped
  bundle or the saved page. Not inferred.
- ◐ **inferred** — reasoned from what the code implies, but not stated by it.
- ○ **unknown** — genuinely not recoverable from the archive, and marked as
  such rather than guessed.

Our own numbers are all read from the source or measured in a browser; where a
number was measured rather than declared, the row says so.

**The one big gap.** CF's basemap is a remote Mapbox Studio style
(`mapbox://styles/gccm/cl5rujhy3000415pny20an82b` on the Explore page,
`cl6qfxkxs00hk14pdm9md5380` referenced in the bundle). Style JSON is fetched at
runtime and is **not** in the saved page. I verified this: every `text-size`,
`text-field` and `symbol` string in their JS is inside the bundled mapbox-gl
library itself, not in CF's own code. **CF authors zero label rules in code** —
all of it lives in Studio, where we cannot see it. So every label row for CF is
○, and honestly so.

---

## 1 · Zoom range and how many levels there are

| | A Decade of Rain (Archive) | CF (Explore) |
|---|---|---|
| Zoom floor | **derived per viewport**: `fit(recordBounds) − 0.35` | ● fixed: `minZoom: y ? 3 : 1.5` (3 desktop, 1.5 mobile) |
| Zoom ceiling | **12** (`view.maxZoom`) | ● **9** (`maxZoom: 9`) |
| Usable range | ~5.6–6.4 levels, viewport-dependent | ● 6 levels desktop, 7.5 mobile |
| Initial camera | fit to `recordBounds` once the container has a real size | ● `initialViewState` from the CMS; saved snapshot was at z5.87 |
| Pan clamp | `maxBounds` `[[94,2],[122,26]]` | ○ none found in the bundle |
| Re-fit on resize | yes, debounced 120 ms, only if the reader hasn't panned | ● `flyTo(initialCenter, initialZoom)` on resize, debounced 50 ms — **unconditional**, it yanks the reader back |

Measured home zoom and floor, real browser, `recordBounds` = `[[103.8, 8.3], [109.8, 17.7]]`:

| Viewport | Home z | minZoom | Visible N–S |
|---|---|---|---|
| 390×844 (iPhone 14) | 5.29 | 4.94 | 5.57–20.30 °N |
| 834×1112 (iPad) | 5.48 | 5.13 | 4.42–21.38 °N |
| 1280×800 (13″) | 5.76 | 5.41 | 7.94–18.05 °N |
| 1512×900 (16″) | 5.94 | 5.59 | 7.98–18.01 °N |
| 1920×1080 | 6.22 | 5.87 | 8.04–17.95 °N |
| 2560×1440 (27″) | 6.65 | 6.30 | 8.11–17.89 °N |

A 1.36-level spread between the smallest and largest viewport. This is the
argument for deriving the floor rather than fixing it: any single number is
wrong at both ends. CF chose the opposite and accepts that a phone opens on a
different framing than a desktop.

---

## 2 · Data tiers (level of detail)

Ours — three tiers, two hand-offs, declared in `mapConfig.ts` as `Z_MID` / `Z_NEAR`:

| Tier | Layer | Zoom range | Cell size | Radius `k·√gallons` | Cap |
|---|---|---|---|---|---|
| Far | `vol-coarse-l` | floor → **7.0** | 0.12° (~13 km) | z5.6 → 0.030, z7.0 → 0.069 | 13 px |
| Mid | `vol-fine-l` | **7.0** → **9.2** | 0.03° (~3 km) | z7.0 → 0.037, z9.2 → 0.100 | 12 px |
| Near | `vol-raw` | **9.2** → 12 | none (raw runs) | z9.2 → 0.14, z12 → 0.34 | 18 px |

CF — ● two tiers, one hand-off at **z7**:

```js
minzoom: id.includes("low")  ? 0 : id.includes("high") ? 7 : 0
maxzoom: id.includes("low")  ? 7 : 24
```

| Tier | Source | Zoom range |
|---|---|---|
| low | `gccm.acmi_2022_mobility_{unit}_low` | 0 → 7 |
| high | `gccm.acmi_2022_mobility_{unit}_high` | 7 → 24 |

Both tiers are mounted at once — ● their `activeLayers` filter keys on
rcp/ssp/unit/timePeriod but **not** on resolution, so the LOD switch is done by
`minzoom`/`maxzoom` alone, never by toggling visibility. Same mechanism as ours.

Worth noting: **CF's crossover is z7 and our first hand-off is z7.0.** Arrived
at independently.

One more ● CF detail: `"fill-antialias": zoom > 5 && layerId !== "sea_level_rise_ssp1"` —
antialiasing is off below z5 as a performance trade, and permanently off for one
layer.

---

## 3 · Basemap layer visibility — every layer positron ships

Derived by running the real `quietBasemap` + `applyMapTheme` rules against the
live positron style JSON (55 layers). "native z" is positron's own range.

| Layer | Type | Native z | What we do |
|---|---|---|---|
| `background` | background | 0–24 | → `land` #f3f1ed |
| `park` | fill | 0–24 | → `greenspace` #e1e5d7 |
| `water` | fill | 0–24 | → #d1dee6 |
| `landcover_ice_shelf` | fill | 0–8 | → greenspace (moot in VN) |
| `landcover_glacier` | fill | 0–8 | → greenspace (moot in VN) |
| `landuse_residential` | fill | 0–16 | → greenspace ⚠️ see §7.5 |
| `landcover_wood` | fill | 10–24 | → greenspace |
| `waterway` | line | 0–24 | → #c0d0db |
| `building` | fill | 12–24 | **hidden** |
| `tunnel_motorway_*` | line | 6–24 | kept, hairline 0.4→2 px |
| `aeroway-taxiway` | line | 12–24 | **untouched** ⚠️ |
| `aeroway-runway-casing` | line | 11–24 | **untouched** ⚠️ |
| `aeroway-area` | fill | 4–24 | **untouched** ⚠️ |
| `aeroway-runway` | line | 11–24 | **untouched** ⚠️ |
| `road_area_pier` | fill | 0–24 | **untouched** |
| `road_pier` | line | 0–24 | **hidden** (minor) |
| `highway_path` | line | 0–24 | **hidden** (minor) |
| `highway_minor` | line | 8–24 | **hidden** (minor) |
| `highway_major_casing` / `_inner` | line | 11–24 | kept, hairline |
| `highway_major_subtle` | line | 0–11 | kept, hairline |
| `highway_motorway_casing` / `_inner` | line | 6–24 | kept, hairline |
| `highway_motorway_subtle` | line | 0–6 | kept, hairline |
| `highway_motorway_bridge_*` | line | 6–24 | kept, hairline |
| `railway*` (6 layers) | line | 13–24 | untouched — above maxZoom 12, never draws |
| `boundary_3` | line | 8–24 | kept, `admin_level ≤ 4` only |
| `boundary_2` | line | 0–24 | kept, `admin_level ≤ 4` only |
| `boundary_disputed` | line | 0–24 | kept, `admin_level ≤ 4` only |

CF: ○ their basemap layer set is entirely inside the Studio style. The one thing
we do know is ● their data fills are inserted with
`beforeId: "country labels disputed"` — so **every label in their basemap draws
above the data**, and there is a layer literally named that in their style.

---

## 4 · Label layers — visibility and zoom staging

This is the table to go through line by line.

| Layer | Native z | Our clamp | Size ramp | Notes |
|---|---|---|---|---|
| `label_country_1/2/3` | 0–9 / 0–9 / 2–9 | **0 → 7.0** | 12.5 → 15 | Vietnam filtered out (we draw our own) |
| `label_city_capital` | 3–24 | **none** | 9.5 → 14 | on from the opening view |
| `label_city` | 3–24 | **none** | 9.5 → 14 | on from the opening view |
| `label_town` | 6–24 | **7.0 → 22** | 9.5 → 14 | arrives at the first hand-off |
| `label_other` | 8–24 | **none** ⚠️ | 9.5 → 14 | unmanaged third settlement tier — see §7.2 |
| `label_state` | 5–8 | **hidden** | — | provinces would compete with the military regions |
| `label_village` | 9–24 | **hidden** | — | "P.9"-style post-reform names |
| `water_name_point_label` | 0–24 | none | 9.5 → 14 | English via `name:en`, colour #44585e |
| `water_name_line_label` | 0–24 | none | 9.5 → 14 | ditto |
| `waterway_line_label` | 10–24 | none | 9.5 → 14 | ditto |
| `airport` | 11–24 | **none** ⚠️ | 9.5 → 14 | draws z11–12 — see §7.3 |
| `highway-shield-non-us` | 11–24 | **none** ⚠️ | 9.5 → 14 | draws z11–12, shield icon stripped, bare ref left |
| `road_shield_us` | 12–24 | **none** ⚠️ | 9.5 → 14 | draws at z12 |
| `highway-shield-us-interstate` | 11–24 | **hidden** ⚠️ | — | hidden *by accident* — see §7.1 |
| `highway-name-major` | 12.2–24 | none | 9.5 → 14 | above maxZoom 12, never draws |
| `highway-name-minor` | 15–24 | none | 9.5 → 14 | never draws |
| `highway-name-path` | 15.5–24 | none | 9.5 → 14 | never draws |

> **The "Size ramp" column above predates the tuning pass and is stale** — it
> reads 9.5 → 14 everywhere, which is no longer any tier's value. Live numbers
> are in `BASEMAP_TIERS` (below) and in §6. The column is left as written rather
> than quietly corrected, because the rest of the table is a survey of what
> positron ships and that part is still accurate.

### 4.1 · Settlement tiers — no longer uniform

The paragraph that used to sit here said one font, one colour and one ramp were
applied to every surviving label layer. That was true, and it was the bug: the
basemap already separates settlements into four layers by attribute, and
writing one appearance across all of them erased the distinction before it
reached the screen. `label_city_capital` ships as **Noto Sans Bold** at a larger
ramp; we overwrote it with the map's medium.

The tiers now come from one table, `BASEMAP_TIERS` in `volumeGrid.ts`, with one
classifier (`basemapTier`) that the tuner calls rather than copies:

| Tier | Layer(s) | Face | Size | Colour | Shown |
|---|---|---|---|---|---|
| `capital` | `label_city_capital` (`capital=2`) | **Bold** | 9 → 13.5 | `#646464` | yes |
| `city` | `label_city` (`class=city`) | medium | 8 → 12 | `#646464` | yes |
| `town` | `label_town` | Regular | 7.5 → 11 | `#767676` | hidden |
| `village` | `label_village`, suburb / quarter | Light | 7 → 10 | `#8a8a8a` | hidden |
| `admin` | `label_state`, provinces | Light | 8 → 11 | `#8a8a8a` | hidden |
| `waterName` | sea / river names | medium | 8 → 12 | `#338199` | yes |
| `country` | `label_country_*`, our own VN label | medium | 10 → 15 | `#646464` | to z7.5 |

The hidden three are styled anyway, so switching one on from the tuner produces
a tiered map rather than four identical layers.

**Weight is a font stack in MapLibre** — there is no numeric `text-font-weight`,
so each of those faces is a separate set of SDF glyph PBFs under `public/fonts/`.
All four Roboto Condensed weights are built.

Per-`rank` styling *within* one layer is possible but not done: the style spec
marks `text-font`, `text-letter-spacing`, `text-size`, `text-color` and
`text-halo-*` all `data-driven` with `feature` in their parameters. `text-font`
carries `interpolated: false`, so that split would have to be a `step`/`match`,
never an `interpolate`. Today `rank` drives only the within-tier size spread.

Still uniform across every surviving label layer: uppercase, letter-spacing 0.2,
halo `rgba(250,249,244,0.92)` at 1.1 px, icon stripped, `text-anchor: center`,
`text-offset: [0,0]`, and

```js
symbol-sort-key: ['case', ['has','rank'], ['to-number',['get','rank']], 100]
```

so collisions resolve by OpenMapTiles rank instead of tile order.

CF: ○ all of it. Not knowable from the archive.

---

## 5 · Our own annotation layers

| Layer | Zoom range | Size ramp | Colour | Note |
|---|---|---|---|---|
| `mr-label` (MILITARY REGION I–IV) | 0 → **9.2** | 12 → 16 | #cf3720, halo 2 px | out at the second hand-off |
| `mr-borders` | 0 → 24 | — | #ec7066, dashed 2.4/1.8, 1.2 px @ 0.55 | never clamped |
| `vn-label` (VIET NAM) | 0 → **7.0** | 12.5 → 15 | #4b5a50 | matches the country tier exactly |
| `island-label` (Paracel / Spratly) | 0 → 24 | 8.5 → 11 | #6b7268 | quietest tier at every zoom |

---

## 6 · Label size as a function of zoom

One linear ramp, anchored `Z_TYPE_FLOOR = 5` → `Z_TYPE_TOP = 12`:

```js
['interpolate', ['linear'], ['zoom'], 5, atFloor, 12, atTop]
```

Resulting px at the zooms that matter (16″ laptop home = 5.94):

| Tier | ramp | @home 5.94 | @Z_MID 7.0 | @Z_NEAR 9.2 | @max 12 |
|---|---|---|---|---|---|
| Country / VIET NAM | 12.5 → 15 | **12.84** | 13.21 *(gone)* | — | — |
| Military region | 12 → 16 | **12.54** | 13.14 | 14.40 *(gone)* | — |
| Cities / towns / water | 9.5 → 14 | **10.10** | 10.79 | 12.20 | 14.00 |
| Islands | 8.5 → 11 | **8.84** | 9.21 | 10.00 | 11.00 |

Deliberately a straight line with no intermediate stops: the two things that
genuinely change gear (`Z_MID`, `Z_NEAR`) change *what is on screen*, not how
big it is.

⚠️ The ramp is anchored at z5 but **no viewport ever opens there** — measured
home zooms run 5.29–6.65. So the reader always meets the map 0.3–1.65 levels
into the ramp, and `atFloor` is a value nobody sees. See §7.4.

CF: ○ unknown — Studio-side.

---

## 7 · Things I found while building this table

Ordered by how much I think they matter. None are fixed; they are yours to rule on.

**7.0 · The tuner's behaviour depended on deviceScaleFactor.**
Found while verifying the tier split, and worth recording because the shape of
it will recur. At DPR 2 the panel silently un-hid `label_town`, `label_village`
and `label_state`; at DPR 1 it did not. Two causes. The `hidden` seed was read
off the live style, which races `quietBasemap` — ask too early and the answer is
"nothing is hidden", which then gets written back as truth. And the real one:
both effects deferred with `map.once('idle', fn)`, but `idle` fires only when
the map finishes a frame, so if the map had already settled when the listener
was attached, the callback never ran at all. The corrected pass was waiting on
an event that had already happened. Replaced with a helper that polls the
animation frame until `isStyleLoaded()`, which has no event to miss. DPR 1 was
only ever correct by accident — its apply never ran.

**7.1 · `highway-shield-us-interstate` is hidden by accident.**
The province rule is `/state|province/.test(id)`, and `inter`**`state`** matches
it. The layer is correctly gone, but for the wrong reason — the regex is
matching a substring, not a word. Harmless in Vietnam; a trap for whoever
touches that regex next.

**7.2 · `label_other` is an unmanaged settlement tier.**
The staged rollout was designed as *cities at the overview → towns at z7*, but
positron also ships `label_other` (native z8), which no rule clamps. The real
sequence is city (always) → town (z7) → other (z8). Either fold it into the town
clamp or hide it — right now it arrives one level after towns and nobody chose
that.

**7.3 · Road shields and airport labels survive into z11–12.**
`highway-shield-non-us` (z11), `road_shield_us` (z12) and `airport` (z11) all
carry a `text-field`, so the icon-only rule misses them and they get the full
place treatment — uppercased, letter-spaced, Roboto Condensed. For the shields
we also strip `icon-image`, which leaves a bare route number floating with no
shield around it. Only visible in the top zoom level, but that is exactly where
the raw-event tier is trying to be read.

**7.4 · The type ramp's floor is below every real starting zoom.**
`Z_TYPE_FLOOR = 5` vs a measured 5.29–6.65. Not a bug — the ramp is continuous —
but the comment claiming z5 is "the size a reader meets the map at" is wrong,
and if you want to tune the opening label size you are currently tuning it
through an extrapolation. Anchoring the ramp at ~5.3 would make `atFloor` mean
what it says.

**7.5 · `landuse_residential` is painted as vegetation.**
`classify()` sends anything matching `landuse` to `greenspace`, so residential
land gets #e1e5d7 — the same colour as `landcover_wood`. On a map whose subject
is *where the forest was*, built-up areas and forest currently render
identically. Positron draws it 0–16, so it is present at every zoom we allow.

**7.6 · `aeroway-*` is untouched by both passes.**
Runways and taxiways draw at z11–12 in positron's own colours. Given that the
subject is an aerial spraying campaign, airfields may well be *wanted* — but
right now they are there by omission, not by choice.

**7.7 · CF's resize handler yanks the reader home.**
● `flyTo({center: initialCenter, zoom: initialZoom})` on every resize,
unconditionally. Rotate a phone and you lose your place. Ours re-fits only if
`isAtHome()` says the reader hasn't gone anywhere. Noting it because it is one
of the few places where the comparison clearly favours us.

---

## 8 · Interaction and controls

| | Ours | CF |
|---|---|---|
| Zoom buttons | `NavigationControl`, bottom-right, no compass | ● **none** — verified absent from the saved DOM |
| Compass | off | ● none |
| Scale bar | custom, in the key panel | ● none |
| Scroll / pinch zoom | default on | ● default on |
| Tilt | Flat/3D toggle, `pitch3d: 55°`, `maxPitch: 68°` | ○ no pitch UI found |
| Attribution | compact | ● standard Mapbox |

---

## 9 · Summary of the numbers you may want to change

| Knob | Where | Now |
|---|---|---|
| Zoom ceiling | `mapConfig.view.maxZoom` | 12 |
| Zoom floor margin | `mapConfig.view.minZoomMargin` | 0.35 below the fit |
| Fallback floor | `mapConfig.view.minZoom` | 5.6 (only if the fit fails) |
| Frame | `mapConfig.view.recordBounds` | `[[103.8, 8.3], [109.8, 17.7]]` |
| Frame padding | `mapConfig.view.fitPadding` | 28 px |
| First hand-off | `mapConfig.Z_MID` | 7.0 |
| Second hand-off | `mapConfig.Z_NEAR` | 9.2 |
| Coarse cell | `volumeGrid.COARSE_DEG` | 0.12° |
| Fine cell | `volumeGrid.FINE_DEG` | 0.03° |
| Type ramp ends | `mapTheme.Z_TYPE_FLOOR` / `Z_TYPE_TOP` | 5 / 12 |
| Place label size | `quietBasemap` | 9.5 → 14 |
| Country label size | `COUNTRY_TEXT.size` | 12.5 → 15 |
| Region tag size | `addMilitaryRegions` | 12 → 16 |
| Island note size | `addIslandMarks` | 8.5 → 11 |
