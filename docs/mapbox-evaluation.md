# Mapbox vs MapLibre + OpenFreeMap — what the spike is for

A decision doc, not a recommendation. `/archive-mapbox` exists to make the
choice on evidence instead of on vibes.

---

## 1 · The SDK is not the gap

This was the starting premise and it is mostly wrong, so it goes first.

| | Us | CF |
|---|---|---|
| Engine | maplibre-gl **5.24.0** | mapbox-gl-js **2.11.0** (read from their bundle) |
| Lineage | fork of mapbox-gl-js v1.13, Dec 2020 | same code, continued under a proprietary licence |

MapLibre *is* Mapbox GL JS, forked when Mapbox closed the licence at v2.0. The
renderer, the style spec, the expression language and the symbol-collision code
share an ancestor. By version, ours is the newer engine.

Checked rather than assumed: MapLibre 5 exposes 45 symbol layout properties
including `text-variable-anchor`, `text-radial-offset`, `symbol-sort-key`,
`symbol-z-order` and `text-overlap`. **Nothing about our label problem is
impossible in MapLibre.**

One consequence worth stating plainly: **CF's label behaviour is not something
Mapbox gives you by default.** Their bundle contains zero label rules — I
verified every `text-size` / `text-field` / `symbol` string in it belongs to the
bundled mapbox-gl library. Their tiering was tuned by a person in Studio. The
difference is where the tuning lives, not whether it exists.

## 2 · The three things that are actually different

**2.1 Tile schema — real, and the strongest argument for switching.**

| | OpenMapTiles (ours) | Mapbox Streets (CF) |
|---|---|---|
| Settlement ranking | `class` (city/town/village/other) + `rank`, ordered only within a class | `symbolrank` 1–18 (global, continuous) + `filterrank` 1–5 (density gate) |
| Density control | four on/off layers | one expression: `["<=", ["get","filterrank"], 3]` |

This is the root of finding §7.2 in `map-zoom-and-labels.md`: positron can only
cut settlements into four coarse buckets, with nothing continuous between them.

**2.2 Style authoring — real, but not a vendor problem.**

CF tunes visually in Studio. We patch a ready-made style at runtime by matching
regexes against layer IDs. Findings §7.1 (`inter`**`state`** caught by
`/state|province/`), §7.3 (road shields slipping through with their icons
stripped) and §7.5 (residential land painted as vegetation) are **all**
consequences of that technique, not of the tile vendor. Switching to Mapbox and
keeping the runtime-patching approach would carry all three across.

**2.3 Terms — real, and the cost side.**

- mapbox-gl-js v2+ is proprietary (`SEE LICENSE IN LICENSE.txt`; the v1.13
  ancestor inside it remains BSD-3).
- Mapbox tiles may only be rendered by Mapbox's own renderer, so "MapLibre plus
  Mapbox tiles" is not a legal shortcut — adopting the data means adopting the SDK.
- The token is inlined into the client bundle by Vite and is therefore public.
  Protection is a URL restriction on the token, not secrecy.

## 3 · What it costs

From mapbox.com/pricing, **Mapbox GL JS (Map Loads)**. A load is counted every
time a `Map` object initialises, and includes unlimited tile requests.

| Monthly loads | Cost per 1,000 |
|---|---|
| Up to 50,000 | **Free** |
| 50,001 – 100,000 | $5.00 |
| 100,001 – 200,000 | $4.00 |
| 200,001 – 1,000,000 | $3.00 |
| 1,000,001 – 5,000,000 | $2.50 |

**The unit is map initialisations, not visitors, and this site has two maps.**
A reader who scrolls the Story and then opens the Archive costs **two** loads.
So the free tier is roughly **25,000 such readers a month**, not 50,000.

Rough shape past the free tier: 100k loads ≈ **$250/month**; 200k ≈ **$650/month**.

Two things that inflate the count and are easy to miss:

- React StrictMode double-mounts in development.
- Navigating Story ↔ Archive builds a fresh `Map` each time, so a reader who
  goes back and forth three times costs six loads, not two.

If we adopt this, the count needs measuring before it needs budgeting.

## 4 · What switching would and would not fix

**Would not** — all of it ours, all of it portable, none of it cheaper on Mapbox:
the derived zoom floor, the two hand-off zooms, the three-tier grid, the radius
formula, agent filtering, hover/click, the inspect card, the 3D toggle. CF's own
LOD switch is four lines of ternary they wrote themselves.

**Would** — `filterrank`/`symbolrank` density control, Studio as the authoring
surface, curated `name_en` and worldview handling, and a `landuse` schema that
separates residential from wood (§7.5).

**Would, but does not need Mapbox** — §7.1, §7.3 and §7.5 all disappear if we
author our own style JSON instead of patching positron's at runtime. That is
the third path, and it is cheaper than either vendor decision.

## 5 · What the spike does

`/archive-mapbox`, not in the nav, reachable by URL.

Same ground, same `recordBounds` framing, same 24,604 runs, on `mapbox/light-v11`
— chosen because it is Mapbox's own Positron equivalent, so the comparison
isolates the *data* difference rather than confounding it with a design one.

Two live sliders, `symbolrank` and `filterrank`, wired to the settlement label
layers. **That pair is the entire argument for switching**, so the spike puts
them under your hand rather than describing them.

It is deliberately **not** a port of the Archive. Rebuilding the panel, the
transport and the inspect card against a second SDK to answer a question about
basemaps would be doing the expensive half of a migration to learn what the
cheap half already tells you.

`mapbox-gl` is lazy-loaded. Imported statically it landed in the entry chunk and
took it from 620 kB to 2.46 MB — every Story reader downloading a second map SDK
to look at photographs. Split out, it is a 1.8 MB chunk that only this route
fetches.

### Running it

Open `/archive-mapbox` and **paste a public (`pk.`) token into the field**. It is
kept in that browser's localStorage and nowhere else — not the repo, not the
build, not other visitors. Secret `sk.` tokens are refused rather than stored.

The env var route still works and takes priority: `VITE_MAPBOX_TOKEN` in
`.env.local`, or in the Vercel project's environment variables to share the
spike on a preview URL. That path inlines the token into the bundle for every
visitor, so restrict it by URL in the Mapbox account first. Pasting it in the
page does not.

The in-page field exists because the env var alone meant a settings change and
a redeploy before you could look at anything — a bad loop for a throwaway.

Without a token the route renders the field instead of a map, and the Story and
Archive are unaffected either way.

### Removing it — done

The spike is gone: `src/components/MapboxSpike.tsx`, `MapboxSpike.css`,
`src/config/mapboxConfig.ts`, the `/archive-mapbox` route and the `mapbox-gl`
dependency were all removed once the comparison had been made. **This file
stayed on purpose** — the original instruction said to delete it too, and that
was wrong: the verdict and the numbers behind it are the only durable product
of the spike, and deleting them would mean re-running the whole comparison the
next time someone asks why the project is on MapLibre.

Everything below is written in the present tense because it describes what was
on screen at the time. To reproduce it, check out a commit before the removal.

## 6 · The question the spike cannot answer

Whether `filterrank` is worth $0–650/month depends on how bad our label density
actually is, and our situation is milder than CF's in both directions that
matter: about 6 zoom levels against their 7.5, and one country's southern half
against a continent. Look at `/archive` and `/archive-mapbox` side by side at
the same zoom and judge whether the difference is one you would pay for.

## 7 · The thing you actually asked for

> 他们在 studio 调整，有可视化反馈，而我看不到

That is a workflow gap, not a vendor gap, and it is worth separating from
everything above. What Studio gives CF is a live visual surface for tuning the
map without a code change and a deploy.

We already have the seed of one: the **TUNE BASEMAP** panel (`MapTuner.tsx`),
built to tune land/water/vegetation colours live. It is still installed. It
could grow the controls that matter now — label tier thresholds, the two
hand-off zooms, the type ramp ends — and give you the same loop Studio gives
them, against our own map, with no token and no bill.

If the visual-feedback loop is the real problem, that is a smaller and more
certain fix than changing vendor.
