> **HISTORICAL.** This is the Figma-derived *proposal* for the Archive spike,
> not the shipped system. The live reference is [`design-system.md`](./design-system.md).
> Kept as a decision record.

# A Decade of Rain — Design System v2

Spec for redrawing the pages in Figma. Every value here is either **shipped**
(read out of the running build on `claude/archive-ui-geist`) or **proposed**
(a normalisation of something the build does inconsistently). The two are
marked, because only one of them is a fact.

- ● **shipped** — measured from the running build; safe to draw against.
- ○ **proposed** — a decision this document is making. Confirm before drawing.
- ◐ **open** — a question with no answer yet. Listed in §10.

Preview of the shipped state: `/archive` on the `claude/archive-ui-geist`
branch.

---

## 1 · Principles

The system is defined by four subtractions. When a new component is drawn and
the spec is silent, these decide it.

1. **One typeface.** Geist carries the entire interface. The only serif in the
   product is the story's pull-quote voice (§2.2) — nowhere else.
2. **No corner radii.** Panels, buttons, chips, switches, tooltips, bars are
   rectangles. Round survives only where roundness *is* the meaning: the agent
   dots, the compass dial, the map's own proportional circles.
3. **Almost no strokes.** Surfaces have no borders. Hairlines survive only
   where they **divide** two blocks, never where they would **outline** one.
4. **Shadow is depth, not decoration.** Two shadows exist, with different jobs
   (§8). Nothing else casts one.

A fifth rule, implied by the other four: **separation comes from space and
value, not from containers.** If two things need to feel apart, move them or
change their tone — do not put a box around one.

---

## 2 · Typography

### 2.1 Families

| Role | Family | Weights in use | Note |
|---|---|---|---|
| Interface, body, data ● | **Geist** | 300 / 400 / 500 / 600 | The whole product except the two below |
| Story pull-quote ◐ | *see §10.1* | 400 | The one serif; decision still open |
| Map labels ● | **Roboto Condensed** Medium | 500 | Not a UI font — see §2.4 |

**Vietnamese coverage is a hard requirement, not a preference.** Geist's latin
subset stops at U+00FF, so the `latin-ext` and `vietnamese` subsets must ship
alongside it or `Đà Nẵng` renders half in Geist and half in a fallback. Any
face proposed for this product gets checked for `ầ ư Đ ễ ợ ắ ộ ệ ẵ ị ũ` before
it gets considered for anything else.

### 2.2 Type scale ●

All sizes in px. Geist unless noted. Line-height as a unitless multiple except
where the build uses a fixed px value.

| Token | Size | Weight | Line-height | Tracking | Case | Used for |
|---|---|---|---|---|---|---|
| `display` | 24 | 500 | 1.1 | 0 | as-is | Panel title (*The Archive*) |
| `eyebrow` | 16 | 500 | 1.1 | 0 | as-is | Year range, in accent |
| `subtitle` | 16 | 400 | 1.2 | 0 | as-is | Panel standfirst |
| `readout` | 16 | 500 | 1.2 | 0 | as-is | Playhead date (*Dec 1971*) |
| `body` | 12 | 300 | 20px | 0 | as-is | Panel dek — the skippable paragraph |
| `ui` | 12 | 600 | 1.2 | 0 | as-is | Chips, view switch, story link |
| `label` | 10 | 600 | 1.2 | 0.04em | UPPER | Section headings (SPRAYING VOLUME) |
| `data` | 10 | 500–600 | 1.3 | 0.02em | UPPER | Stat line, chart axis |
| `caption` | 11 | 400 | 1.4 | 0 | as-is | Legend rows, inspect body |
| `figure` | 11 | 600 | 1.1 | 0 | as-is | Headline number, in accent |

Two things worth noting because they are easy to get wrong:

- `figure` is **the same size as the unit beside it**. The number is marked by
  colour and weight, not by scale. At 19px it shouted a value before the reader
  had asked for it.
- `body` is the only weight-300 text in the system. It is deliberately the
  quietest thing in the panel — the paragraph a returning reader skips.

### 2.3 Weight meaning

| Weight | Meaning |
|---|---|
| 300 | Explanatory prose that can be skipped |
| 400 | Neutral running text |
| 500 | Titles, readouts, numeric furniture — presence without emphasis |
| 600 | Controls and structural labels — anything the reader acts on or navigates by |

### 2.4 Map labels ●

The map is not the interface and does not share its type. Labels are **Roboto
Condensed Medium**, chosen because Vietnamese place names run long
(`Buôn Ma Thuột`, `Bà Rịa – Vũng Tàu`) and a narrower face fits more of them
before collision starts dropping names.

Label size **interpolates with zoom** — it is not a fixed value:

| Tier | at z5 | at z12 | Visible |
|---|---|---|---|
| Place names | 9.5 | 14 | cities always; towns from z7 |
| Country | 12.5 | 15 | to z7 |
| Military region tags | 12 | 16 | to z9.2 |
| Island notes | 8.5 | 11 | always |

Do not draw these as fixed sizes in Figma. Draw the z6 state (the opening view)
and note that they scale.

---

## 3 · Colour

### 3.1 Ink ●

One ramp, one hue (~145°, low chroma). The green cast is what ties the text to
the map's land and vegetation. Contrast measured on `#faf9f4`.

| Token | Hex | Contrast | Used for |
|---|---|---|---|
| `ink` | `#101a14` | 16.9:1 | Headings, primary text — reads as black |
| `ink-soft` | `#33443a` | 9.8:1 | Secondary text, UI labels |
| `ink-faint` | `#4b5a50` | 6.9:1 | Captions, the smallest text |
| `rule` | `#dfe3d9` | — | Hairline dividers (non-text) |

### 3.2 Surfaces ●

| Token | Value | Used for |
|---|---|---|
| `paper` | `#faf9f4` | Page ground |
| `panel` | `rgba(255,255,255,0.65)` + `blur(8px)` | Explorer panel, map key |
| `control-quiet` | `rgba(255,255,255,0.75)` | Ghost buttons on the panel |
| `chip-rest` | `rgba(255,255,255,0.60)` | Inactive chips |
| `fill` | `#213528` | **Every selected control** — see below |
| `forest` | `#213528` | Dark surfaces (story cards) |

`fill` is the single most important token to hold the line on. The play button,
the active Flat/3D tab and the All-agents chip are all *the selected state of a
control*, so they are all one dark. They had drifted to two.

### 3.3 Accent ●

One hue, four jobs. Do not substitute one for another.

| Token | Hex | Job |
|---|---|---|
| `accent` | `#ff5449` | **Geometry only** — data dots, the volume chart |
| `accent-deep` | `#cf3720` | **Accent text on paper** — figures, the story link |
| `accent-chip` | `#d63328` | Chip fill behind white text (4.8:1) |
| `accent-line` | `#e8443a` | Map linework on paper |

### 3.4 Agent colours ●

Categorical. Each is an entity identity, not a status.

| Agent | Hex |
|---|---|
| Orange | `#ef7d1a` |
| White | `#93a1b3` |
| Blue | `#5aa6e0` |
| Other | `#9a6cc4` |

When a per-agent chip is selected it fills with its own colour — that is the
point of them. **See §10.2: the Figma's white-on-Blue treatment fails
contrast.**

### 3.5 Map palette ●

The basemap must recede behind the data. Contrasts measured against land.

| Element | Hex | vs land | Note |
|---|---|---|---|
| Land | `#f3f1ed` | — | Warm paper |
| Water fill | `#d1dee6` | 1.22:1 | +27 cooler than land in blue-minus-red |
| Waterway line | `#c0d0db` | — | Same hue, two steps down |
| Vegetation | `#e1e5d7` | 1.14:1 | Shown — the canopy is what the record is about |
| Buildings | — | — | Hidden at every zoom |
| Place labels | `#4b5a50` | 6.5:1 | Same tertiary ink as UI captions |
| Sea labels | `#44585e` | 6.6:1 | Cool sibling, matched in luminance |
| Island notes | `#6b7268` | 4.4:1 | Deliberately the quietest thing on the map |

---

## 4 · Spacing

### 4.1 Scale ○

A 4px base. **Proposed**, because the build currently uses 11, 13, 14 and 22 as
one-offs (§10.3).

| Step | Value | Typical use |
|---|---|---|
| `2xs` | 4 | Icon-to-label inside a chip |
| `xs` | 8 | Label to the thing it labels |
| `sm` | 12 | Related lines within a block |
| `md` | 16 | **Between blocks** — the panel's main rhythm |
| `lg` | 24 | Panel inset; distance from viewport edge |
| `xl` | 32 | Reserved |
| `2xl` | 48 | Reserved |

### 4.2 Applied rhythm ●

| Gap | Value |
|---|---|
| Panel inset from viewport edge | 24 |
| Panel padding | 24 / 24 / 22 |
| Title → subtitle | 8 |
| Eyebrow → title | 12 |
| Subtitle → dek | 16 |
| **Between blocks** (rule → heading, block → block) | **16** |
| Section heading → its content | 8 |
| Transport buttons → readout | 14 |
| Map key padding | 11 / 13 / 16 |

16 rather than 24 between blocks is a deliberate correction: at 24 the panel
read as five loose islands, and a heading floated between two blocks instead of
belonging to the one below it.

---

## 5 · Size

| Element | Size ● |
|---|---|
| Explorer panel width | `min(400, 100vw − 48)` |
| Map key width | 172 |
| Transport button | 30 × 30 |
| Transport icon | 11 × 11 |
| Chip padding | 6 / 12 |
| Agent dot | 8 × 8 |
| View switch button height | ~22 (text 12 + 4/4 padding) |
| Inspect bar track height | 5 |
| Legend swatch | 20 × 12 |
| Compass dial | 17 × 17 |

The two transport buttons **butt together** into a single 60 × 30 block with no
gap. Two squares with a gap between them read as two unrelated controls; joined,
they read as one transport.

---

## 6 · Corners

| Element | Radius |
|---|---|
| Everything | **0** |
| Agent dot | 50% |
| Compass dial | 50% |
| Map data circles | 50% |

There is no radius scale, and adding one is how this system dies. If something
needs to feel softer, it does not need a radius — it needs less contrast or
more space.

---

## 7 · Strokes

| Element | Treatment |
|---|---|
| Panel, key, tooltip, buttons, chips | **No border** |
| Transport ↔ identity block | 1px `rule` — divides |
| Scale row ↔ legend | 1px `rule` — divides |
| Volume chart baseline | 1px `rgba(33,53,40,0.28)` |
| Focus ring | 2px `accent-deep`, offset 2 |

The test is grammatical: a line that **separates two things** stays; a line that
**encloses one thing** goes.

---

## 8 · Shadows

Two, with different jobs. Nothing else casts one.

| Token | Value | Job |
|---|---|---|
| `shadow-surface` | `0 8px 28px rgba(40,38,30,0.02)` | Glass panel over the map |
| `shadow-control` | `0 1px 3px rgba(40,38,30,0.13)` | A control sitting **on** that glass |

The 6.5× difference in alpha is intentional. The panel only has to separate
from a busy map, and the map does most of that work. A white button on a white
panel with no border has nothing else to hold its edge — it needs a tight, close
shadow or it dissolves.

---

## 9 · Components

### 9.1 Explorer panel ●

Top-left, 24 from both edges. Blocks in order, 16 apart:

1. **Identity** — eyebrow (accent) / title / subtitle / dek
2. `rule`
3. **Transport** — joined button pair + date readout
4. **SPRAYING VOLUME** — heading, stat line, volume chart, year axis
5. **SPRAYING AGENTS** — heading, chip row, per-agent note
6. **← Read the Story** — accent, `ui` weight

Removed in v2: the *Jump To* bookmarks and *Share This View*.

### 9.2 Map key ●

Top-right, 24 from both edges, 172 wide.

1. **MAP VIEW** heading, caps
2. Flat / 3D switch — full-bleed halves, **no track inset**, active half filled
   with `fill`
3. Scale bar + compass, separated below by a `rule`
4. Legend rows — 20 × 12 swatch, 9 gap, `caption` text
5. Inspect card, when a cell is selected

### 9.3 Agent chip ●

| State | Background | Text |
|---|---|---|
| Rest | `chip-rest` | `ink-soft` |
| Hover | `rgba(255,255,255,0.90)` | `ink-soft` |
| Selected — *All* | `fill` | white |
| Selected — *an agent* | that agent's colour | see §10.2 |

Rectangular, 6/12 padding, 4 gap to its dot, `shadow-control`, no border.

### 9.4 Map tooltip ●

Padding 6 / 9 / 7, square, `shadow-control`, `rgba(255,255,255,0.92)` at
`blur(14px)`. The tip is a rotated square sharing the content's exact fill,
tucked 7px in and painted above it.

---

## 10 · Open decisions

### 10.1 Which serif for the story's pull-quote ◐

Vietnamese coverage checked by opening each font and testing the actual
codepoints in `Việt Nam · Đà Nẵng · A Sầu · Buôn Ma Thuột · Bà Rịa–Vũng Tàu`.
x-height and cap-height read from each font's OS/2 table.

| Face | Vietnamese | x-height | x/cap | Read |
|---|---|---|---|---|
| Playfair Display | ✅ | 0.514 | 0.726 | Largest on the page, highest contrast — a **display** face |
| Literata | ✅ | 0.507 | 0.723 | Big, warm, built for reading |
| Lora | ✅ | 0.500 | 0.714 | Brushy contrast, friendly |
| Fraunces | ✅ | 0.482 | 0.689 | Expressive, variable optical axis |
| Source Serif 4 | ✅ | 0.475 | 0.709 | Text-first, rationalist, quiet |
| Spectral | ✅ | 0.450 | 0.682 | Screen-first, slightly austere |
| Newsreader | ✅ | 0.426 | 0.636 | Small on the page |
| EB Garamond | ✅ | 0.400 | 0.615 | Much too small for screen at lede sizes |
| **Instrument Serif** | ❌ | — | — | **Cannot set Vietnamese** — disqualified |

**The decision depends on one thing: is the serif setting a paragraph, or a
line?**

- **A large pull-quote only (≥28px)** → **Playfair Display** works. It has the
  biggest x-height here and the drama suits a single quoted line.
- **A running lede paragraph (18–20px)** → **Source Serif 4**. Playfair is a
  display face; its hairlines are the thinnest of this set and they break up at
  text sizes on non-retina screens. Source Serif was drawn for text, has a real
  italic and a variable weight axis, and its low contrast sits comfortably next
  to a rationalist grotesque like Geist.

My recommendation, if the serif has to do both: **Source Serif 4**, with
Literata as the alternative if you want more warmth. There is also a tonal
argument — Playfair's Didone contrast reads as fashion-editorial, which sits
oddly against the subject.

### 10.2 White text on the Blue agent chip ◐

The Figma fills the selected *Blue* chip with `#5aa6e0` and sets the label in
white — about **2.2:1**, well under the 4.5:1 floor for text this size. The
build has not adopted it. Options: darken the fill for the selected state, or
keep the agent colour and set the label in `ink`. Needs a decision before the
chips are redrawn.

### 10.3 Spacing one-offs ○

The build still uses 11, 13, 14 and 22 in places that predate the 4px scale
(map key padding, transport gap, panel bottom padding). §4.1 proposes
normalising them. Low risk, but it changes measurements, so it should be a
deliberate pass rather than a silent one.

### 10.4 Scope ◐

Everything above is **shipped on the Archive only**. The story page still runs
the v1 system — the serif/sans pairing, the radii, the heavier shadows. Rolling
this out to the story is a larger judgement than restyling controls, because
the story's typography is editorial and leans on the serif much harder.
