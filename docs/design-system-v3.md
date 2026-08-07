# A Decade of Rain — design system v3

The system as the Archive actually embodies it after the v2 spike and the
tuning passes that followed. v2 was a proposal read off a Figma frame; this is
a description of a running interface, with every value traceable to source.

**v2 is not superseded — it is the other branch.** `design-system-v2.md`
records the serif-carrying variant and stays where it is. This document is the
all-Geist reading. Where the two differ, §11 says so explicitly.

Provenance for every value below: read from `src/App.css`,
`src/ArchiveSkinV2.css`, `src/config/mapConfig.ts`, `src/components/volumeGrid.ts`
or `src/components/mapTheme.ts` at the commit this document ships with. Nothing
here is aspirational.

---

## 1 · The four moves

1. **One typeface.** Geist everywhere. No serif/sans pairing.
2. **No corner radii.** Panels, buttons, chips, switches, tooltips are
   rectangles. Round survives only where roundness is *meaning*: the agent
   dots, the compass dial, the map's own circles.
3. **Almost no strokes.** Outlines go. Two hairline RULES stay, because a rule
   divides where a border encloses.
4. **Shadows near zero.** 0.02 alpha on surfaces, 0.07 on controls. Present as
   depth, absent as decoration.

A fifth emerged from use and belongs with them:

5. **Hierarchy by weight before size.** Where two things say the same kind of
   thing, they get the same size and differ in weight and colour. Size is
   spent on *rank*, not on emphasis.

---

## 2 · Type

### Family

```
--font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

Four web weights ship (300/400/500/600), each in three subsets — latin,
latin-ext, **vietnamese**. The vietnamese subset is not optional: Geist's latin
subset stops at U+00FF, so without it `Đà Nẵng` and `Phù Cát` render half in
Geist and half in a system fallback.

Map labels are a separate problem — MapLibre renders from SDF glyph PBFs, not
webfonts. See §9.

### Scale

Every size in the shipped Archive, with its job:

| px | weight | Where | Notes |
|---|---|---|---|
| 20 | 500 | Panel title | "The Archive" |
| 16 | 500 | Eyebrow | "1961–1971", accent-deep |
| 14 | 500 | Subtitle | one line under the title |
| 12 | 400 | Body / deck | ~55 characters a line at 372px |
| 12 | 500 | Controls | Flat/3D, agent chips, links |
| 11 | 600 / 500 | **Stat grammar** | see below |
| 11 | 400 | Tooltip second line, inspect body | |
| 10 | 600 | Section labels | uppercase, 0.04em |
| 10 | 400 | Locating text | coordinates, spans, axis years |

Nine rungs, and they are the whole ladder. A new size needs a reason that is
not "this felt big".

### The stat grammar

Three surfaces carry counts — the panel readout, the inspect card, the hover
tooltip. They render **identically**:

| | size | weight | colour |
|---|---|---|---|
| Figure | 11px | 600 | `--accent-deep` `#cf3720` |
| The word attached to it | 11px | 500 | `--ink` `#101a14` |

`8,360 Missions` on the left and `5K Gallons` on the right are the same kind of
statement about the same record; they had drifted into three renderings of one
idea, and pulling them together is the single most legible thing in the v3 pass.

### Case

Uppercase is reserved for the 10px label tier and for map labels. Body copy,
titles and stat words are sentence or initial case. Uppercase at 11px reads
visually larger than lowercase at 11px, which is why the label tier sits one
step down at 10 rather than matching.

---

## 3 · Colour

### Ink

| Token | Value | On paper |
|---|---|---|
| `--ink` | `#101a14` | 16.9:1 — reads as black, carries a trace of green |
| `--ink-soft` | `#33443a` | 9.8:1 |
| `--ink-faint` | `#4b5a50` | 6.9:1 |
| `--rule` | `#dfe3d9` | hairline dividers |
| `--rule-strong` | `#647468` | decorative 3px card accents |

The green cast is deliberate and slight. A neutral grey ramp on this paper read
as unconsidered; the hue ties the text to the subject without tinting it.

### Accent

One red, four jobs, because the job decides the contrast requirement:

| Token | Value | Job |
|---|---|---|
| `--accent` | `#ff5449` | geometry — dots, pulse rings, heat, rain |
| `--accent-deep` | `#cf3720` | accent TEXT on paper · 4.7:1 |
| `--accent-chip` | `#d63328` | chip FILL behind white text · 4.8:1 |
| `--accent-bright` | `#ff7a70` | accent TEXT on forest surfaces · 5.2:1 |
| `--accent-line` | `#e8443a` | map linework on paper · 3.5:1 (non-text ≥3) |

### Dark surfaces

| Token | Value |
|---|---|
| `--forest` | `#213528` — the one dark. Selected controls, story cards |
| `--forest-2` | `#2c3730` — raised dark |
| `--forest-text` | `#e8ece6` · 11.0:1 |
| `--forest-text-soft` | `#b4ccba` · 7.7:1 |

`--forest` is also `--v2-fill`: the play button, the active Flat/3D tab and the
All-agents chip are the same kind of thing — a control's selected state — so
they take one value rather than three darks that drifted apart.

### Agents

| | | |
|---|---|---|
| Orange | `#ef7d1a` | |
| White | `#93a1b3` | blue-leaning silver, so an isolated White stays apart from the neutral context grey |
| Blue | `#5aa6e0` | |
| Other | `#9a6cc4` | |
| De-emphasised | `#c9cdc4` | context volume when one agent is isolated |

⚠️ White-on-`#5aa6e0` is ~2.2:1. The Blue chip keeps dark text; do not fill it
and put white on top.

---

## 4 · Surfaces

| | Value |
|---|---|
| Paper | `--paper` `250,249,244` · `--paper-solid` `#fdfdfd` |
| Panel glass | `rgba(255,255,255,0.90)` |
| Backdrop blur | `blur(20px)` |
| Border | none |
| Radius | 0 |

The glass alpha and the blur move **together and in the same direction**. At
0.65/8px the spray field showing through arrived as recognisable dots and
competed with the panel's own chart — the two reddest things on screen read as
one. At 0.90/20px what comes through arrives as tone. Raising opacity without
raising blur makes the remaining transmission *more* legible, not less.

---

## 5 · Shape

Radius is **0** everywhere except:

- agent dots, the compass dial, the map's own circles — roundness is the
  meaning
- nothing else

Buttons are rectangles. Chips are rectangles butted together into one block,
divided by a 14px hairline inset top and bottom (`rgba(33,53,40,0.14)`) which
is suppressed on both sides of the active chip, whose fill draws its own edges.

---

## 6 · Elevation

Two shadows, two jobs:

| Token | Value | For |
|---|---|---|
| `--v2-shadow` | `0 8px 28px rgba(40,38,30,0.02)` | a surface against the map |
| `--v2-shadow-control` | `0 1px 3px rgba(40,38,30,0.07)` | a control sitting ON that surface |

The second is not a smaller version of the first. A control on glass has the
harder problem — white on white with no border left to help — so it needs a
tight close shadow to stop dissolving, where the panel needs a wide faint one
to separate from the map. **A group casts one shadow, not one per member**;
per-chip shadows bled into the seams and drew vertical lines through what is
meant to read as a single control.

---

## 7 · Space

The panel's block rhythm, measured:

| Gap | px |
|---|---|
| Between blocks (identity → controls) | 16 |
| Within a block (title → subtitle) | 8 |
| Subtitle → deck | 12 |
| Section label → its content | 8 |
| Label above a section | 16 |
| Chart → the row above it | 14 |
| Inside a statement (figure → its counts) | 4 |
| Between lines of one address (coords → span) | 4 |

16 rather than the Figma's 24: at 24 the panel read as five loose islands
rather than one instrument. The rule is that **a divider sits equidistant** —
the deck's bottom margin and the transport's top padding are both 16, so the
hairline between them is centred by construction rather than by eye.

Panel width is **372px**. It was sized to the agent row's natural width (308.7)
plus padding, with headroom: an exact fit left 3.3px and the row wrapped on the
first machine whose subpixel rounding went the other way.

---

## 8 · Components

**Button (transport).** 32×32, rectangle, no radius. Primary = `--forest` fill,
white glyph. Ghost = transparent, ink glyph, white on hover. The pair butts
together into one 60×32 block carrying one `--v2-shadow-control`.

**Chip (agent filter).** 6px/12px padding, weight 500, no radius, no border.
Active = `--forest` fill for the neutral "All"; the per-agent chips carry their
entity colour as an inline style, which is the point of them. Row is
`inline-flex`, `width: fit-content`, `flex-wrap: nowrap`.

**Switch (Flat/3D).** Two rectangles, no padding inset, weight 500. Active =
`--forest` fill. The 2px inset that existed to let a rounded thumb sit inside a
rounded track is gone with the radii.

**Rule.** `1px solid var(--rule)`. Divides blocks. Never encloses.

**Tooltip.** 6px/9px/7px padding, radius 0, `--v2-shadow-control`. Both lines
at 11px; the tip is a rotated square with its radius removed.

**Inspect card.** Title states the subject and its span, not the container.
Data at 11px, labels at 10px, one grammar for the figures (§2). Section
headings (`BY AGENT`, `BY YEAR`) each take over the rule that would otherwise
sit above the block they head.

---

## 9 · The map

Map labels do not use the webfont. They use self-hosted SDF glyph stacks under
`public/fonts/`, built by `scripts/build-glyphs.mjs`.

**Weight is a stack, not a number.** MapLibre has no `text-font-weight`. Four
weights of the label face ship as four stacks: `Roboto Condensed Light` (300),
`Roboto Condensed Regular` (400), `Roboto Condensed` (500, the default and the
bare name), `Roboto Condensed Bold` (700).

Roboto Condensed rather than Geist for map labels, and the reason is not taste:
Vietnamese place names run long (`Buôn Ma Thuột`, `Bà Rịa – Vũng Tàu`) and a
narrower face fits more of them before the collision detector starts dropping
names outright.

### Basemap palette

| | |
|---|---|
| Land | `#f4f2f1` |
| Water fill | `#d1dee6` |
| Water line | `#c0d0db` (derived: land-relative, so rivers read against ground not sea) |
| Vegetation | hidden |

Vegetation is **off**, and the reason belongs in the system rather than the
code: positron's green is *today's* cover, half a century after the record.
Inviting a reader to read it as the forest that was sprayed is the wrong
inference to offer.

### Label tiers

| Tier | size @z5 → @z11 | colour |
|---|---|---|
| Places | 8 → 12 | `#646464` |
| Sea · river names | 8 → 12 | `#338199` |
| Country · VIET NAM | 10 → 15 | `#646464` |
| Military region | 8 → 14 | `#cf3720` |
| Island notes | 8.5 → 11 | `#6b7268` |

All uppercase, 0.2em tracking (military regions 0.1), halo
`rgba(250,249,244,0.92)` at 1.1px.

Towns, villages, wards and provinces are hidden. Cities and sea names carry the
whole basemap.

### Zoom

| | |
|---|---|
| Floor | derived per viewport by fitting the record's bounds, minus 0.35 |
| First hand-off `Z_MID` | 7.5 — coarse grid → fine grid, country name out |
| Second hand-off `Z_NEAR` | 10.5 — fine grid → raw runs, region tags out |
| Ceiling | 11 |
| Type ramp | anchored z5 → z11 |

The ramp top equals the ceiling, so labels reach full size exactly where the
map stops rather than being cut off partway up.

**The floor is derived, not set.** It measures 5.29 on a phone and 6.65 on a
27-inch display — a 1.36-level spread. Any single number is wrong at both ends.

---

## 10 · Applying this to the Story

The Story is scrollytelling, not an instrument, so two things bend:

**Reading measure wins over panel geometry.** The Archive's 12px body exists in
a 312px column. Story body copy sits in a much wider one and should hold near
65 characters — that means a larger body size, not the same number.

**Motion is content there.** The Archive has one 1000ms camera ease and nothing
else. The Story's reveals, the rain, the pulse rings are subject matter. §1's
subtraction applies to *chrome* — cards, captions, buttons, rules — not to the
narrative art.

Everything else transfers unchanged: one typeface, no radii, no strokes, the
ink ramp, the accent's four jobs, the two shadows, the stat grammar.

---

## 11 · Where v2 and v3 differ

| | v2 | v3 |
|---|---|---|
| Serif | Playfair Display for Story pull-quotes ≥28px, undecided | **none** — Geist throughout, both pages |
| Panel glass | 0.65 | 0.90, with blur raised 8 → 20 |
| Control shadow | 0.10 alpha | 0.07 |
| Block gap | 24 (Figma) | 16 |
| Stat grammar | three renderings | one |
| Map palette | land `#f3f1ed`, vegetation shown | land `#f4f2f1`, vegetation hidden |
| Label sizes | 9.5 → 14 | 8 → 12 |
| Hand-offs | 7.0 / 9.2, ceiling 12 | 7.5 / 10.5, ceiling 11 |

The serif variant of this document is [`design-system-v3-serif.md`](./design-system-v3-serif.md),
implemented on the `claude/ds-v3-playfair` branch. It is written as a **delta**
that replaces §2 *Family* and §11 rather than as a full copy: the two readings
agree on all but a dozen of these four hundred lines, and a duplicate would
start drifting the first time either one was edited. Everything from §3 to §10
applies to both branches unchanged.
