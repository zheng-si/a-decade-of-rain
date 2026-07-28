# Explorer M2 — the volume-symbol map

## Cartographic rationale

The HERBS data is homogeneous: timestamped point events with one categorical
attribute (agent) and one absolute quantity (gallons). Per the classic rule
set (geometry × measurement level → visual variable), that calls for
**proportional symbols** (area ∝ gallons, square-root radius) with **hue for
agent** — not a choropleth, and not the story's KDE heat surface, whose job
is the emotional "rain on the land" field metaphor.

Reference models: Google Flood Hub (multi-geometry, representation switches
per zoom band) and CLEVER°FRANKE's Africa Climate Mobility platform (one
encoding, multi-resolution grid). Because our data is single-geometry we
follow the CF model: **one representational language — the dot — at every
zoom; only the aggregation cell size changes.**

- Story = the field metaphor (KDE heat, feeling).
- Explorer = the event record (countable symbols, inspection).
The contrast between the two IS the product narrative.

## The three zoom tiers

| Tier | Zoom band | Aggregation | Symbol |
|---|---|---|---|
| Far | ≤ 7.0 | ~0.3° grid (≈33 km) | dot at cell centre, area ∝ Σ gallons, hue = dominant agent |
| Mid | 7.0 – 9.2 | ~0.09° grid (≈10 km) | same encoding, finer grid |
| Near | ≥ 9.2 | none (raw events) | dot at true position, area ∝ run gallons, hue = agent |

Shared rules: radius = k·√gallons (area-true), capped below cell width;
white hairline stroke so overlapping dots read on the paper basemap; agent
filter chips drive all tiers identically; the playhead accumulates each
cell — dots grow as the record fills.

## Implementation (this branch)

- `src/components/volumeGrid.ts` — runtime binning (two grid levels from
  spray.json, ~20k events, re-binned per throttled playhead step) + layer
  definitions + update entry point.
- `MapView.tsx` — heatmap layers replaced by the three-tier symbol stack;
  the day/agent throttle now re-bins and `setData`s the two grid sources
  and re-filters the raw layer.

## Still to do (M2+)

- Legend: per-tier entries (dot-size ramp + agent hues) in the map key.
- Playback modes: cumulative (default) vs rolling window.
- Agent multi-select (chips → set of indices).
- Rebase this branch onto post-#155 master and restyle the chrome to the
  rem type system / Initial Caps / no-tabular rules.
- M3 inspect panel (province/CTZ aggregates), M4 story↔archive deep links.
