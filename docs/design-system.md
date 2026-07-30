# Design system — A Decade of Rain

Design idea in one line: **warm paper cartography, forest-green ink, and one
orange accent family — orange draws, forest speaks.**

**Sources of truth**, in the order you should reach for them:

| File | Holds |
|---|---|
| `src/index.css` | the root scale (one density dial) + the numerals rule |
| `src/App.css` `:root` | colour and type tokens; all shell/panel styles |
| `src/fonts.css` | the three faces and the two serif switches |
| `src/pages/Story.css` | the story's own components (cards, charts, map key) |
| `docs/design-tokens.tokens.json` | the same tokens for Tokens Studio → Figma |

`docs/design-system.html` is the interactive companion to this document — open it
in a browser (it embeds its own faces, so it works offline and from a file URL).
It is built in the system's own tokens, so every sheet doubles as a specimen of
itself, and each rule ships with a toggle that reproduces the bug we actually
had: the off-ladder sizes, serif applied below 17px, the four stat-line variants,
MapLibre's border-triangle tip. Prose rules live here; the html is where you go
to see one.

Edit `docs/design-system.src.html` (the page without its fonts inlined), then run
`node scripts/build-design-system-doc.mjs` to regenerate the standalone file.

This document is the **specification** — read it before drawing a new surface,
not after. Anything here that reads like a rule (§2–§4) is meant to be applied
to *new* work without re-deriving it from review.

> **State note.** §2–§4 and §7 describe the system as of the Explorer branch
> (`claude/archive-v1`) plus the merged master passes (#153 editorial, #154
> palette, #155 density). The Explorer branch is still based on pre-#155 master,
> so it has not yet inherited the rem root scale or the current type tokens;
> rebasing it is the one outstanding task before these two halves are literally
> the same code. Values below are the canonical ones.

---

## 1 · Colour

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--paper` | `250,249,244` (rgb tuple) | page background, glass panels (with alpha) |
| `--paper-solid` | `#fdfdfd` | solid paper: popups, map-key panel |
| `--forest` | `#213528` | dark surfaces: story cards, filled controls |
| `--forest-2` | `#2c3730` | raised dark surface (stat pill bg) |

### Ink — three semantic tiers

The ink scale is **semantic, not just a lightness ramp**. Pick by role, never by
"how grey does this feel":

| Token | Value | Role | Contrast on paper |
|---|---|---|---|
| `--ink` | `#213528` | titles **and structural labels** (the small tracked caps that name a section) | 12.4:1 |
| `--ink-soft` | `#4e6355` | content: body copy, legend rows, stat labels, dates | 6.2:1 |
| `--ink-faint` | `#647468` | notes about the content: coordinates, axis years, table values | 4.7:1 — AA floor for small text; don't lighten |
| `--rule` | `#dfe3d9` | hairline dividers (non-text) | — |

Why structural labels take the *darkest* ink: their size and tracking already
separate them from the content they introduce, so colour is free to mark them as
structure. Painting them faint (the old behaviour) made a label lighter than its
own content and inverted the hierarchy.

### Text on forest (dark cards)

| Token | Value | Role | Contrast on forest |
|---|---|---|---|
| `--forest-text` | `#e8ece6` | primary | 11.0:1 |
| `--forest-text-soft` | `#b4ccba` | secondary | 7.7:1 |
| `--mint` | `#92f7bc` | decorative borders only — never text | — |

### The accent family — one hue, four jobs

The brand orange stays vivid where it's *drawing* and gets tuned one step where
it's *carrying text*, so every pairing passes AA:

| Token | Value | Job | Ratio |
|---|---|---|---|
| `--accent` | `#ff5449` | **geometry**: dots, pulse rings, heat, rain, chart bars | n/a (decorative) |
| `--accent-chip` | `#d63328` | **chip fill** behind white text | 4.8:1 vs #fff |
| `--accent-bright` | `#ff7a70` | accent **text on forest** | 5.2:1 |
| `--accent-deep` | `#cf3720` | accent **text on paper**: every figure in a stat line | 4.7:1 |
| `--accent-line` | `#e8443a` | **map linework** on paper | 3.5:1 (non-text ≥3) |

Rule of thumb: shape → `--accent`; line → `--accent-line`; chip →
`--accent-chip`; orange *words and figures* → `--accent-bright` on dark,
`--accent-deep` on light.

### Data palette (the Explorer)

Categorical hues for the four herbicide families, plus the grey that carries
de-emphasised context. These are **data colours** — they may not be borrowed for
UI chrome:

| Series | Value | Note |
|---|---|---|
| Agent Orange | `#ef7d1a` | |
| Agent White | `#93a1b3` | slate **blue**-grey on purpose: a neutral silver was indistinguishable from the context grey below |
| Agent Blue | `#5aa6e0` | |
| Other (Purple, Pink, unattributed) | `#9a6cc4` | |
| context grey (`DIM`) | `#c9cdc4` | the *unselected* record — green-leaning, so every series reads apart from it |

Selection model: one hue at a time. With no filter the whole field is
`--accent`; isolating a series tints it with that series' hue and **greys the
rest rather than hiding it** (map, chart and legend all follow).

### Status colours (the three hotspots)

| Colour | Value | Meaning |
|---|---|---|
| completed green | `#3f8f5f` | Đà Nẵng, done |
| ongoing red | `--accent-deep` `#cf3720` | Biên Hòa, running |
| contained forest | `#2c5a40` | Phú Cát, sealed |

*Contained* used to be a blue (`#5a7ca8`). It was retired in the palette
purification: the palette is **two families — forest green and brand orange** —
and a lone blue read as out-of-system. (The Explorer branch still carries the
old blue until it rebases.)

---

## 2 · Type

### 2.1 Root scale — one density dial

All CSS lengths are `rem` (÷16 from px; anything under 4px and all media
conditions stay px). `src/index.css` sets the only dial:

```css
html { font-size: 16px; }                                   /* phones, ≥1601px */
@media (min-width: 641px) and (max-width: 1600px) {
  html { font-size: 13.6px; }                               /* 85% — laptops */
}
```

Everything — type, padding, panel widths, chart heights — scales together, which
is why laptop density is a single-line change and not a per-component pass.

### 2.2 The ladder

One modular scale, site-wide. **Every `font-size` sits on a tick — no one-offs:**

```
10 · 11 · 12 · 13 · 14 · 15 · 17 · 19 · 24 · 28
```

plus three fluid display steps: `clamp(27→38)` section titles ·
`clamp(30→44)` statements and big percentages · `clamp(40→72)` masthead and
photo-wall figures.

Values that drifted off the ladder are bugs, and they hide well: `11.5px`
buttons, a `20px` figure, a `9px` label and an `8px` coordinate line all had to
be found by measuring rather than by eye.

### 2.3 Role ladder — what each tick is for

| Tick | Role |
|---|---|
| 10–11 | chart furniture, footnotes, structural labels (10 = tracked caps) |
| 12 | UI controls, badges, chips |
| 13 | body copy |
| 14 | deks, primary buttons |
| 15 | wall captions |
| 17 | quotes, card deks (serif) |
| 19 | card titles, **display anchor figures** (serif) |
| 24 | section subtitles, card years (serif) |
| 28 | stat figures (serif) |

### 2.4 The serif rule

> **Serif is a display role, not a content type.** It belongs to anchor text —
> 17px and up — and each surface gets **exactly one** anchor. Below 17px,
> everything is sans, no matter what the words refer to.

Two consequences worth stating, because both came up as "inconsistencies" and
are in fact the rule working:

- A date can be serif in one place and sans in another (`Dec 1971` at 19px is
  the panel's anchor; `Sep 1966 – May 1969` at 11px is a note).
- So can a figure (`81K` at 19px anchors the inspect card; `24,604` at 11px sits
  in a stat line).

The physical reason is Playfair/Gambarino are high-contrast Didones: their thin
strokes disintegrate below ~15px. A "serif = data" rule would force serif onto
10–11px table values and break them.

Faces:

| Token | Face | Where |
|---|---|---|
| `--font-sans` | Public Sans (300/400/500 only) | body, UI, map glyph fallback |
| `--font-serif` | Gambarino | the Story's display |
| `--font-serif-display` | Playfair Display | the Archive's display |

**Public Sans ships 300/400/500 — there is no 600 or 700 face.** Anything bolder
is a synthesised faux-bold; use 500 and let colour or size carry the rest. (The
`600`s that remain in small tracked caps are deliberate and legible; don't add
new ones at display sizes.)

### 2.5 Tracking — three ticks

| Token | Value | Use |
|---|---|---|
| `--track-tight` | `0.02em` | small-caps-adjacent emphasis |
| `--track-caps` | `0.06em` | uppercase tags, badges, structural labels |
| `--track-caps-wide` | `0.1em` | wide uppercase, eyebrow scale |

Serif display sets solid — no tracking.

### 2.6 Numerals

`body { font-variant-numeric: lining-nums }` in `src/index.css`, inherited
site-wide. **Proportional lining figures everywhere; `tabular-nums` nowhere** —
Public Sans's tabular digits carry a uniform full-width advance that reads gappy,
and nothing in the site aligns digits column-on-column. Note that
`font-variant-numeric` does *not* merge with inherited values: if a component
sets its own, it must restate `lining-nums` or oldstyle figures creep back into
the serif.

---

## 3 · Editorial grammar

### 3.1 Caps

**Initial Caps for every label, badge, chip and button.** Decorative all-caps was
retired site-wide. Uppercase survives in exactly two places, both of which are
signposts rather than content:

- **10px structural labels** — `MAP VIEW`, `13 KM GRID CELL`, `JUMP TO`
  (10/600/`--track-caps`/`--ink`).
- **Map linework tags and basemap labels** — `MILITARY REGION III`, place names
  (see §9).

### 3.2 Stat grammar

Any "figure + label" pair, on any surface, is written the same way:

| Part | Spec |
|---|---|
| figure | weight **500**, `--accent-deep` |
| label | weight **400**, `--ink-soft`, same size as the figure |
| between pairs | **12px of space** — no separator glyph |

Applied by the panel stat line, the inspect counts and the hover tooltip. When
these three disagreed on colour, weight, gap *and* tracking, the discrepancy was
invisible in review and obvious in a measurement.

### 3.3 Interpuncts

> **`·` joins parallel phrases of equal rank and equal formatting. The moment
> the two sides carry their own hierarchy, use white space.**

Keep: source lines (`W. A. Buckingham · U.S. Air Force Office of History`),
eyebrows (`Act II · The timeline`), map annotations
(`Đắk Tô · test spray, Aug 1961`), and running prose inside a tooltip
(`Mostly Orange · Sep 1966 – May 1969`).

Drop: between styled stat pairs — the red figure already marks where each pair
begins, so the dot is a second, redundant separator and reads as grit at 11px.
This matches news-graphics practice (NYT/FT/Bloomberg stat blocks separate by
space or column; interpuncts live in bylines and source lines).

### 3.4 Units and approximations

Write the unit as a word beside the figure (`81K Gallons`), sharing a baseline.
Prefer a round number over an `≈` glyph: `13 km Grid Cell` says "about" by being
round, and reads as a noun phrase parallel to `Single Spray Run`.

---

## 4 · Panels and surfaces

### 4.1 Two surface recipes

**Frosted glass** — for panels that float over the map and want it to show
through (`.explorer-panel`, `.intro-card`):

```css
background: rgba(255, 255, 255, 0.5);
border: 1px solid rgba(255, 255, 255, 0.55);
border-radius: 4px;                 /* 6px on the Explorer panel */
box-shadow: 0 6px 24px rgba(40, 38, 30, 0.08);
backdrop-filter: blur(18px) saturate(1.35);
```

**Near-opaque paper** — for panels that must stay legible over anything, and for
anything *fixed* over scrolling content (`.site-nav`, `.map-key`,
`.archive-key`):

```css
background: rgba(252, 251, 247, 0.94);
border: 1px solid rgba(255, 255, 255, 0.6);
box-shadow: 0 8px 24px rgba(33, 53, 40, 0.14);
```

Why the split: `backdrop-filter` on a *fixed* panel re-samples the scrolling
content beneath it every frame and flickers. Glass is for panels over a map;
paper is for panels over a page.

### 4.2 Spacing rhythms

| Surface | Rhythm |
|---|---|
| Explorer left panel | **24px** between blocks (header → rule → transport → chart → chips → note → jump → link), 24px padding |
| Map key, control half | **12px** between rows (label→capsule stays a tight 5px pair) |
| Map key, inspect half | **14px** between sections, each opened by a hairline rule |
| Tooltip | 10/13/11px padding; 2px between the two lines |

Content-vs-control is a legitimate reason for two rhythms in one panel; drifting
between 9, 10 and 16 in the same stack is not.

### 4.3 Explorer left panel (`.explorer-panel`)

| Element | Spec |
|---|---|
| surface | glass, radius 6, `min(400px, 100vw − 48px)`, 24px padding, docked 24/24 |
| year eyebrow | serif-display **24** / `--accent-deep` |
| title | serif-display **24** / lh 1.1 / `--ink` |
| subtitle | serif-display **17** / lh 1.3 / `--ink` |
| dek | sans **13**/300 / lh 1.65 / `--ink-soft`; inline link underlined, warms to accent on hover |
| transport | play/pause toggle = 32px `--forest` circle; reset = 32px white circle, Material `refresh` glyph mirrored |
| playhead date | serif-display **19** / `--ink` — the panel's anchor |
| stat line | §3.2, 12px gaps |
| chart | 104px; bars `--accent` @0.85, future months @0.22; playhead 1px `--ink`; 1px baseline `rgba(33,53,40,0.28)` |
| axis | ruler: **major tick per year** (7px @0.45) + **minor per quarter** (4px @0.3); labels every second year, 11/400/`--ink-faint` |
| agent filter | one white capsule (radius 999, 0.85 alpha) holding borderless 12/600 chips; active chip fills with the series hue |
| agent note | **fixed 34px** slot, 11/400/`--ink-faint` — switching series must not resize the card |
| Jump To | 10px structural label on its own line + ghost pills (11/500, `--rule` border, white 0.7) |
| back link | 13/600 / `--accent-deep` |

### 4.4 Map key + inspect (`.archive-key`)

One panel, two halves separated by a hairline: the **control half** (view
switch, share, scale bar, compass, legend) and the **inspect half**, which
appears when a symbol is clicked and disappears with it — never a second
floating card.

| Element | Spec |
|---|---|
| surface | paper, 172px wide, 11/13/16px padding, docked 24/24 |
| `MAP VIEW` | 10/600/`--track-caps`/`--ink` |
| Flat / 3D | capsule on `rgba(33,53,40,0.06)`; buttons **11**/600; active = `--forest` fill, white text |
| Share This View | full-width pill, `--rule` border, 11/600/`--ink-soft` |
| scale + compass | bar 5px with 1.5px `--ink-soft` rule, label 10.5/600; compass = 17px ring + 1.6px needle, **no "N"** |
| legend rows | 11/400/`--ink-soft`, 20px swatch column, 8px row gap |
| inspect kicker | 10/600/`--track-caps`/`--ink` |
| coordinates | 10/400/`--ink-faint` |
| figure | serif-display **19**/500/`--accent-deep` + unit 11/`--ink-soft` on the same baseline |
| counts | §3.2 at 11px |
| agent mix | label 40px · 5px track (`rgba(33,53,40,0.07)`) · bar in the series hue @0.85 · value 34px right-aligned |
| year sparkline | 46px, bars `--accent` @0.9, 1px baseline axis, 10px end labels |
| close | 16px glyph with 6px padding for a real hit area |

### 4.5 Hover tooltip (`.adr-popup.adr-hover`)

A transient utility surface: **no serif, no border, and only what a glance
needs** (volume and count — missions belong to the click, which is the "look
closer" gesture).

| Element | Spec |
|---|---|
| box | `--paper-solid`, radius 4, no border, `0 8px 24px rgba(33,53,40,0.16)`, offset 12 |
| headline | 13px; figures 500/`--accent-deep`, words 400/`--ink-soft`, 12px gap |
| second line | 11/400/`--ink-soft` |

**The rounded tip.** MapLibre's tip is a border triangle (`border: 10px solid
transparent`), which cannot take a radius. Replace it with a rotated square:

```css
.adr-hover .maplibregl-popup-tip {
  width: 11px; height: 11px; border: none;
  background: var(--paper-solid);
  transform: rotate(45deg);
  z-index: 2;                       /* above the content… */
}
.adr-hover.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
  margin-top: -7px;                 /* …tucked back in */
  border-bottom-right-radius: 2px;  /* the outer corner, per anchor */
}
```

Two traps: the tip must paint **above** the content, or the box's drop shadow
greys it out; and at MapLibre's four *corner* anchors a rotated square points the
wrong way, so hide it and keep all four corners rounded.

Also beware the generic `.adr-popup span { display: block; font-size: 11.5px }`
rule: any nested span in a tooltip must restate `display: inline` and inherit its
size, or figures silently drop half a step and break the line.

---

## 5 · Map markers — one system

Spec implemented by `.map-dot` / `.map-area-label` in `src/pages/Story.css`.

**Point** (`.map-dot`) — anything that points at a *place*: solid `--accent` dot
(12px, white halo) + pulsing ring, plus a chip (`--accent-chip` fill, white text,
4px radius). Chip placement:

| Variant | Placement | Pointer |
|---|---|---|
| default | above the dot | triangle pointing down |
| `--below` | below the dot | triangle pointing up |
| `--leader` | led `--leader`px right on an `--accent-line` hairline (90px on mobile) | none — the line is the pointer |

**Area** (`.map-area-label`) — anything that names a *region* (Cà Mau, A Lưới):
the pulsing `--accent-line` boundary outline is the pointer, so the chip floats
alone at the label anchor, centred, **no pointer triangle, no dot**.

---

## 6 · Map linework

| Element | Style |
|---|---|
| Military-region dividers | `--accent-line`, 2.2px, dash 2.4/1.8 — internal lines only |
| MILITARY REGION tags | `--accent-deep` text, uppercase, paper halo, ≤z8.5 |
| Landmark boundary outline | `--accent-line`, 3px, opacity pulsing 0.5–0.95 |
| National border / provinces | basemap's own, knocked back (`mapTheme.ts`) |

---

## 7 · The Explorer's symbol map

The Story and the Explorer deliberately encode the same data two ways, and the
contrast between them *is* the product narrative:

- **Story** = a KDE heat field. The metaphor is rain on land; the job is feeling.
- **Explorer** = countable proportional symbols. The job is inspection.

Because the HERBS data is homogeneous (timestamped points, one category, one
absolute quantity), the Explorer follows the CLEVER°FRANKE model: **one
representational language — the dot — at every zoom, with only the aggregation
cell size changing.**

| Tier | Zoom | Aggregation | Symbol |
|---|---|---|---|
| Far | ≤ 7.0 | 0.12° grid (≈13 km) | dot at cell centre |
| Mid | 7.0 – 9.2 | 0.03° grid (≈3 km) | same encoding, finer grid |
| Near | ≥ 9.2 | none — raw runs | dot at true position |

Shared rules: radius = k·√gallons (**area-true**), capped below the cell width;
no stroke — overlap darkens by alpha stacking, the closest WebGL gets to a
multiply blend; `circle-pitch-alignment: map` so discs lie on the terrain plane
and foreshorten in 3D. Two MapLibre traps: a zoom `interpolate` must be the
**outermost** expression (wrapping it in `min` kills the layer silently — put the
cap inside each stop), and `circle-sort-key` is what keeps grey context beneath
tinted selection.

See `docs/explorer-m2-plan.md` for the cartographic rationale and roadmap.

---

## 8 · Motion

- Map first paint: `.story-map` holds at opacity 0 behind the hook banner and
  fades in (~0.35s) once tiles + data are ready, so the basemap never hard-pops
  (instant under reduced motion). If the reader scrolls into the story before the
  map is ready, it catches up to the current node rather than resetting.
- Hook rain: plays at the top, fades out (~1.4s) after half a viewport of
  scroll, parks (rAF stopped), fades back in (~0.8s) at the very top.
- Pulses: dot ring (CSS, 2.2s), landmark outline (rAF sine).
- Spray bloom: on each Act I step the heat filter's day threshold is *animated*
  (rAF, easeOutCubic, ~1.5–2.8s) from the previous event's date to the new one,
  so newly sprayed area grows outward in chronological order. Armed on the
  camera's `moveend` (with a fallback timer) so long flights don't finish it
  before the reader arrives; scrolling up recedes symmetrically. Throttled to
  ~60 filter re-applies per reveal.
- Explorer playback: 28s for the full decade, re-binning throttled to one step
  per 12 simulated days — re-tessellating 24k points every frame is what made
  the old heatmap stutter.
- Also fading/animated: act2 card cross-fade · alternatives check pop · methods
  open-grid fade · timeline card fade-in · closing rain.
- **`prefers-reduced-motion: reduce` disables all of the above** (one shared
  media block in `Story.css` + per-component JS guards) — keep this invariant
  when adding any animation.

---

## 9 · Basemap labels

See `docs/map-labels.md` for the tier system and `normalizePlaceLabels()`
(casing + " Ward"-suffix normalisation).

The Explorer quiets the basemap further (`quietBasemap()` in `volumeGrid.ts`):
vegetation and buildings off, water at half strength, only motorway/trunk/primary
kept as hairlines, admin level ≤ 4, town-and-below labels hidden until z6.4.
Remaining labels are **Cuprum** tracked caps at 15 (country) / 12 (rest) — water
names in `#7d9ba1`, settlements in `#6f7568`. Map glyph stacks are built by
`npm run build:glyphs` (see `scripts/build-glyphs.mjs`); a new map face needs a
built stack before `text-font` can name it.

---

## 10 · Recorded contrast exceptions

- Rail resting links are 11px white on the gradient top (`#e0644f`) ≈ 3.2:1.
  A deliberate exception for the look; links use `rgba(255,255,255,0.92)` and the
  active item (white on the highlight fill, bold) passes.
- Micro text (<12px) on paper keeps to `--ink-soft`; `--ink-faint` only at 11px+
  (its 4.7:1 floor).
- **Banner text is `--ink` (forest), not white.** On the orange→pink wash white
  fails everywhere (1.5–2.8:1) and forest passes everywhere (4.7:1 at the salmon
  top → 8.8:1 near the bottom), so it carries the banner with no text-shadow.
- Inverted timeline cards use `rgba(255,255,255,0.92)` for their smallest labels.

---

## 11 · Act II palette extensions

| Colour | Value | Where |
|---|---|---|
| family containment | `#6a9c81` (`--fam`) | alternatives family card accents |
| family hybrid | `#4d7d63` | " |
| family treatment | `#2f5c44` | " |
| USAID green | `#5abe88` | reveal button (Figma-mandated) |
| epilogue sage | `#9fd4b4` | source-group heads / CTA text on forest |
