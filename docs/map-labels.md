# Map label tiers — how the basemap labels work, and what we override

The Story map uses OpenFreeMap's **positron** style (OpenMapTiles schema).
This documents the label system as shipped, the problems we found, and the
normalisation the app applies on top. Audited against the style source
(`hyperknot/openfreemap-styles`, `styles/positron/style.json`).

## 1 · The basemap's own tiers (as shipped)

Every text layer in positron, with its zoom window and casing:

| Layer | Data class | Visible at | Casing | Notes |
|---|---|---|---|---|
| `label_country_1/2/3` | `place:country` | z0–9 | as-is | Vietnam, Laos… by rank |
| `label_state` | `place:state` | z5–8 | **UPPERCASE** | first-level subdivisions |
| `label_city_capital` | `place:city` (capital) | z3+ | as-is | Hanoi, Phnom Penh |
| `label_city` | `place:city` | z3+ | as-is | Da Lat, Nha Trang Ward… |
| `label_town` | `place:town` | z6+ | as-is | Cù Chi, A Lưới town… |
| `label_village` | `place:village` | z9+ | as-is | hamlets, communes |
| `label_other` | `place:*` (rest) | z8+ | **UPPERCASE** | suburbs, quarters… |
| `water_name_*` | seas, lakes | all | as-is | |
| `waterway_line_label` | rivers | z10+ | as-is | |
| `airport` | aerodromes w/ IATA | z11+ | as-is | |
| `highway-name-*` / shields | roads | z11–15.5+ | as-is | |

So the intended reading order as you zoom in is:
**countries → provinces (z5–8 only) → cities → towns → villages → streets.**

## 2 · What the Story map curates on top

Applied at map init (`Story.tsx` + `labelLayers.ts`):

- **Hidden tiers**: villages/hamlets/suburbs, POIs, road names, uncategorised
  (`DEFAULT_HIDDEN`) — they're noise at storytelling zooms.
- **Provinces / states**: zoom window widened from z5–8 to z4+ so they anchor
  the reader at the country overview *and* stay while zoomed into a node.
- **Own overlays** (brand orange, Switzer): military-region tags and dividers,
  per-node landmark outlines/markers, test-spray pins, disputed-island notes.

## 3 · The two inconsistencies, explained

### "Nha Trang Ward" vs "Da Lat" — inconsistent names inside Vietnam

Not a style bug — it's upstream **OSM data after Vietnam's mid-2025
administrative reform**. Provincial cities were dissolved into wards
(phường); some OSM place nodes were renamed with a literal " Ward" suffix
("Nha Trang Ward", "Kon Tum Ward"), others kept their plain name ("Da Lat").
Both still sit in the same `place:city` tier, so the map shows a mix.

**Fix (applied)**: the app rewrites every `place` label's text to its Latin
name with any trailing " Ward" / " Commune" stripped —
`normalizePlaceLabels()` in `labelLayers.ts`. "Nha Trang Ward" → "Nha Trang".

### "ATTAPEU" vs "Biên Hòa" — mixed casing

positron uppercases exactly two tiers: `label_state` and `label_other`.
Vietnam currently has **no `place:state` nodes** in the tiles (post-reform),
so inside Vietnam everything renders title-case — while Laos/Cambodia
provinces (ATTAPEU, CHAMPASAK) hit the uppercase state tier right across the
border. Hence the mismatch.

**Fix (applied)**: `text-transform: none` on every basemap label —
title-case across the board ("Attapeu", "Champasak"). Our own overlay tags
(MILITARY REGION I–IV) stay uppercase deliberately, as a design accent that
separates *our* annotation layer from the basemap's geography.

## 4 · Resulting spec (what a reader now sees)

| Zoom | Basemap labels | Our overlays |
|---|---|---|
| ~z5.8 (hook overview) | countries; provinces (title-case); major cities | MR tags + dividers, island notes |
| z6–8.5 (most nodes) | + towns | MR tags fade at z8.5; node landmark/pins |
| z9+ (Biên Hòa node) | + waterways (z10), airports (z11) | node landmark/pins |
| always hidden | villages, POIs, road names, `label_other` | — |

One-line label: **basemap = muted grey title-case geography; orange
uppercase = our annotation layer.**
