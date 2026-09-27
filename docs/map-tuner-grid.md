# Atlas tuner grid guides

Open `/archive?tune=1`, open Map Tuner, choose **Dots**, and check
**Show grid lines / 显示网格线**. The guide outlines occupied aggregation cells
underneath the dots, so radius/cap adjustments can be compared with cell size.
Coarse guides are blue-grey, fine guides warm grey; shared edges are drawn once.

Guides inherit the corresponding dot layer's live zoom range and visibility.
Ordinary hand-offs show one tier at a time and no guide in the raw/track band.
If Layers overrides deliberately overlap the tiers, the two guide colours
identify them. Hiding dots in a lookup/proximity view hides their guides too.
Change **Zoom → Grid cell size** to resize cells; the guides update from the
same re-binned data as the dots. Timeline and agent changes also update them.

This is a session-only aid, initially off. Switching tabs or collapsing the
panel retains it; refresh, global Reset, or Dots' Reset this tab turns it off.
It is excluded from persisted Tune settings, the Layers list and Copy for
commit. The existing development / `?tune` gate is unchanged. No guide source,
layer, or boundary geometry is created unless the checkbox is enabled.

`volumeGridData.ts` publishes references to the exact point FeatureCollections
passed to the coarse/fine sources, alongside the cell size used for that bin.
Both the point fallback in `volumeGrid.ts` and the visible/idle track-bin writes
in `MapView.tsx` use it. The original binning calculations are unchanged.
`mapTunerGrid.ts` derives unique cell edges from those centres and sizes only
while enabled; it does not query clipped rendered tiles or re-bin events.

## Checks

- `npm run lint`
- `node --test scripts/test-tuner-grid.mjs`
- `npm run build`

The focused tests cover exact bounds, duplicate selection dots/shared edges,
empty cells, snapshot replay, changing cell sizes, live zoom/visibility,
boundary zooms, a hand-off below Z_MID, repeated toggles and teardown after map
removal. Visual QA: compare dot caps with guides at both tiers, resize cells,
scrub time/select agents, adjust hand-offs and hide a tier, then reset/reload.
