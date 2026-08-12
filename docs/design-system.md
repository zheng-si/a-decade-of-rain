# Design system — A Decade of Rain

**This is the live reference.** Every value below was read out of the running
build, and every contrast ratio was recomputed rather than copied forward — the
old edition of this file carried three that had stopped being true.

Design idea in one line: **warm paper cartography, forest-green ink, and one
orange accent family — orange draws, forest speaks.**

Two surfaces share one system:

| | route | files |
|---|---|---|
| **Story** | `/` | `src/pages/Story.tsx` · `Story.css` · `StorySkinV3.css` |
| **Archive** | `/archive` | `src/components/MapView.tsx` · `App.css` · `ArchiveSkinV2.css` |

They differ in exactly two ways on purpose, and everywhere else a difference is
a bug: the Story pairs a display serif with the sans while the Archive is
sans-only, and the two maps carry their own water tone. Section 9 says why.

**Sources of truth**, in the order to reach for them:

| File | Holds |
|---|---|
| `src/index.css` | the root scale (the one density dial) and the px exception list |
| `src/App.css` `:root` | colour and type tokens; the Archive's shell |
| `src/fontsGeist.css` | Geist, four weights × three subsets |
| `src/fonts.css` | Playfair Display (the display tier), plus two retired faces |
| `src/config/mapConfig.ts` | map palette, zoom hand-offs, label font |
| `src/components/mapTaxonomy.ts` | the label tier spec |

The `*Skin*.css` files began as scoped spikes and are now load-bearing. Both are
still scoped (`.story`, `.map-wrap`), which is what lets one surface be changed
without touching the other.

---

## 1 · The root scale

`src/index.css` holds one dial:

```css
html { font-size: 16px }
@media (min-width: 641px) and (max-width: 1600px) { html { font-size: 13.6px } }
```

16px on phones and on 16-inch-and-larger screens; **13.6px (85%) on laptops**,
tuned by eye on a 14-inch MacBook. Every component scales together because
every size is `rem`. Divide the px value by 16.

**Four things stay in px, and only these four.** The list is in `index.css` too,
because a fifth exception invented in a hurry is how a scale stops being one:

1. **Hairlines** — any 1px or 1.5px border, rule, seam or divider, plus the
   playhead. A rem hairline lands on a fraction of a device pixel and greys out.
2. **Ticks** — axis ticks and the inspect card's year ticks. Same reason: a 2px
   mark at 85% is 1.7px and smudges.
3. **Shadow and blur geometry** — `box-shadow` offsets and spreads,
   `backdrop-filter` radii. Optical depth, not layout.
4. **Media-query breakpoints** — the root size is the thing changing across
   them, so rem there is circular.

Everything else is rem. The Archive was the last holdout and was converted in
one pass (188 values); before that its controls rendered at 12px against the
Story's 10.2px, which is one site at two type sizes.

---

## 2 · Type

### Families

| Tier | Face | Where |
|---|---|---|
| Display | **Playfair Display** (variable, 400–900) | Story headings, card titles and years, pull quotes, section subtitles |
| Text / UI | **Geist** (300 · 400 · 500 · 600) | everything else on both surfaces |
| Map labels | **Roboto Condensed** (SDF glyph stacks) | the map canvas only |

Geist ships three subsets each — latin, latin-ext and **vietnamese**. The
vietnamese subset is not optional: the latin subset stops at U+00FF, so without
it `Đà Nẵng` and `Phù Cát` render half in Geist and half in a fallback.

The Archive is **Geist only**: `ArchiveSkinV2.css` deliberately points
`--font-serif` at the sans, so any rule still reaching for the serif tier inside
`.map-wrap` gets Geist rather than silently keeping Playfair. That is the one
intended typographic difference between the surfaces.

Map labels are a separate problem — MapLibre renders from SDF glyph PBFs, not
webfonts — and use a narrower face because Vietnamese place names run long
(`Buôn Ma Thuột`, `Bà Rịa – Vũng Tàu`) and a condensed face fits more of them
before the collision detector starts dropping names outright.

**`button`, `input`, `select` and `textarea` do not inherit `font-family`.**
`index.css` sets it for them site-wide. Before that rule existed, five control
classes rendered in the browser's default face — including the three airbase
pins on the Hotspots map, in Arial, with the very diacritics the vietnamese
subset exists to serve.

### The scale

One modular scale, both surfaces. In rem, with the px each becomes at the two
root sizes:

| rem | @16 | @13.6 | Role |
|---|---|---|---|
| 0.625 | 10 | 8.5 | structural labels (uppercase), chart furniture |
| 0.6875 | 11 | 9.35 | footnotes, stat figures, map-pin chips |
| 0.75 | 12 | 10.2 | UI controls, chips, badges |
| 0.8125 | 13 | 11.05 | body |
| 0.875 | 14 | 11.9 | deks, primary buttons |
| 0.9375 | 15 | 12.75 | wall captions |
| 1.0625 | 17 | 14.45 | quotes and card deks (serif) |
| 1.1875 | 19 | 16.15 | card titles (serif) |
| 1.5 | 24 | 20.4 | section subtitles, card years (serif) |
| 1.75 | 28 | 23.8 | stat figures (serif) |

Plus three fluid display steps: `clamp(2.5rem, 6.5vw, 4.5rem)` masthead,
`clamp(30→44)` statements, `clamp(27→38)` section titles.

**Every font-size sits on a tick.** A new size needs a reason that is not "this
felt big".

### Weight

**Four weights ship: 300 / 400 / 500 / 600.** There is no 700. Thirteen
selectors used to ask for one; Chrome matches the 600 face and does not
synthesise, so they rendered at 600 while the stylesheet claimed otherwise —
measured, `Handgloves 8,360 Đà Nẵng` at 40px is 519.84px wide at 600, 700 and
800 alike.

The discipline, on both surfaces: **Medium (500) names things, Regular (400)
says them**, and 600 is for figures and structural labels. Playfair carries its
own emphasis in the letterforms and stays at 400 — giving it a semibold gives it
a weight it was never drawn to need.

### Tracking

Four ticks. Three are tokens; the fourth is not, and that is worth knowing:

| | value | Where |
|---|---|---|
| `--track-tight` | 0.02em | small-caps-adjacent emphasis |
| **0.04em** | *raw literal* | the 10px uppercase structural-label tier, both surfaces |
| `--track-caps` | 0.06em | uppercase tags and badges |
| `--track-caps-wide` | 0.1em | wide uppercase, eyebrow scale — **declared, currently unused** |

Serif display sets solid, no tracking.

### Case

Uppercase is reserved for the 10px label tier and for map labels. Body copy,
titles and stat words are sentence or initial case. Uppercase at 11px reads
visually larger than lowercase at 11px, which is why the label tier sits one
step down at 10 rather than matching.

### The stat grammar

Four surfaces carry counts — the panel readout, the inspect card, the hover
tooltip, and the story's own statline. They render **identically**:

| | size | weight | colour |
|---|---|---|---|
| Figure | 0.6875rem | 600 | `--accent-deep` |
| The word attached to it | 0.6875rem | 500 | `--ink` |

`8,360 Spray Runs` and `19.5M Gallons` are the same kind of statement about the
same record. One `fmtGallons` renders them, in `src/data/spray.ts` — there were
three, and one spelled the thousands suffix lowercase, so one section read
`494k` while everything else read `494K`.

Numerals: proportional lining figures everywhere (`body` sets `lining-nums`).
No `tabular-nums` anywhere — Geist's tabular digits carry a uniform full-width
advance that reads gappy, and nothing here aligns digits column-on-column.

---

## 3 · Colour

Every ratio below was recomputed for this edition against the real ground.

### Ink, on paper `#faf9f4`

| Token | Value | Ratio | Role |
|---|---|---|---|
| `--ink` | `#101a14` | **16.88** | headings, titles, **structural labels** |
| `--ink-soft` | `#33443a` | **9.82** | secondary text, **content** |
| `--ink-faint` | `#4b5a50` | **6.92** | captions, **notes**, smallest text |
| `--rule` | `#dfe3d9` | 1.24 | hairline dividers (not text) |
| `--rule-strong` | `#647468` | 4.70 | decorative 3px card accents (not text) |

**The three tiers are a rule, not a palette:** ink = titles and labels · soft =
content · faint = notes. Size and tracking set a structural label apart from
what it introduces, so colour is free to mark it as structure. This is the rule
the map key's own label was breaking — it shipped at faint/500/untracked on one
surface and ink/600/0.06em on the other.

### Accent — one hue, four jobs

The job decides the contrast requirement, which is the whole reason there are
four:

| Token | Value | Ratio | Job |
|---|---|---|---|
| `--accent` | `#ff5449` | 3.01 on paper | **GEOMETRY ONLY** — dots, pulse rings, heat, rain |
| `--accent-deep` | `#cf3720` | **4.72** on paper | accent TEXT on paper |
| `--accent-chip` | `#d63328` | **4.81** vs white | chip FILL behind white text |
| `--accent-bright` | `#ff7a70` | **5.15** on forest | accent TEXT on forest |
| `--accent-line` | `#e8443a` | 3.75 on paper | map linework (non-text, needs ≥3) |

`--accent` is 3.01:1 and **must never carry text**. Two rules did — the card
years on forest at 4.12 and the cut-mark on paper at 3.01 — and both were fixed
by swapping to the token that already existed for their ground.

`#ff5449` is also the theme-color in `index.html` and the favicon's baked fill.
One orange, site-wide.

### Dark surfaces

| Token | Value | On `--forest` |
|---|---|---|
| `--forest` | `#213528` | the one dark: selected controls, story cards |
| `--forest-2` | `#2c3730` | raised dark |
| `--forest-text` | `#e8ece6` | **10.95** |
| `--forest-text-soft` | `#b4ccba` | **7.66** |
| `--mint` | `#92f7bc` | 10.13 — decorative borders only |

`--forest` is the selected state of **every** control that carries no other
meaning: the play button, the active Flat/3D tab, the All-agents chip, the
accumulation toggle, the sort switch. One dark, not three that drifted apart.

Where a selected state *does* carry meaning it keeps its own colour — the agent
chips take the agent's colour, the method tabs take the method's. That fill is
information, not decoration.

### Text over photographs

Solid tokens don't work over an image — the type reads as a patch stuck on the
photo rather than as part of it. So the same three-tier idea, in white with
alpha. Ratios are against `--forest`; over a photograph the block's own veil
carries the rest.

| Token | Value | On `--forest` | |
|---|---|---|---|
| `--on-photo` | white 0.92 | **11.32** | body, titles, place names |
| `--on-photo-soft` | white 0.72 | **7.58** | credits, tags, captions, secondary links |
| `--on-photo-faint` | white 0.50 | **4.51** | not-yet-active — the rail's upcoming nodes |

There were fifteen of these, 0.40 to 0.92, and no two surfaces agreed. The
faint tier is 0.50 because that is where AA lands, not because it looked
right: the rail's resting and upcoming links were 0.40 and 0.42 — 3.44 and
3.64 — and both failed.

Plain `#fff` is **not** a fourth tier. The active and hovered rail links use
it, and full white against a graded scale is what makes *selected* read
instantly. The epilogue keeps its own seven alphas by decision.

### Agents

| | | |
|---|---|---|
| Orange | `#ef7d1a` | |
| White | `#93a1b3` | blue-leaning silver, so an isolated White stays apart from the neutral grey |
| Blue | `#5aa6e0` | |
| Other | `#9a6cc4` | |
| De-emphasised | `#c9cdc4` | context volume when one agent is isolated |

⚠️ White-on-`#5aa6e0` is ~2.2:1. The Blue chip keeps dark text; do not fill it
and put white on top.

### Remediation status

One colour per project, used as a card border, a badge, a map pin, a timeline
band **and as running text** (`.act2-facts dt`, `.act2-card.is-completed`).
That last use is why these are text ratios and not the 3:1 non-text floor.

| | | | |
|---|---|---|---|
| Completed | `#35784f` | **5.04** on paper | Đà Nẵng · done |
| Ongoing | `#cf3720` | **4.72** | Biên Hòa · running (= `--accent-deep`) |
| Contained | `#2c5a40` | **7.54** | Phù Cát · sealed |
| Programme | `#6a7160` | **4.81** | the whole-programme timeline band |

Completed and Programme were `#3f8f5f` (3.75) and `#79806f` (3.88) — both below
AA for the text they were set in. Darkened at constant hue; every other use of
each colour moved with it, so there is still exactly one Đà Nẵng green.

---

## 4 · Surfaces and elevation

| | Story | Archive |
|---|---|---|
| Paper | `--paper` `250,249,244` · `--paper-solid` `#fdfdfd` | same |
| Panel glass | `rgba(252,251,247,0.94)`, no filter | `rgba(255,255,255,0.90)` + `blur(20px)` |
| Radius | 0 | 0 |
| Border | none | none |

The Story's fixed panels take near-opaque paper and **no** `backdrop-filter`: a
filtered element fixed over a *scrolling* page re-samples its backdrop every
frame and flickers. The Archive's panels sit over a map that does not scroll
under them, so they can be glass.

Glass alpha and blur move **together and in the same direction**. At 0.65/8px
the spray field came through as recognisable dots and competed with the panel's
own chart — the two reddest things on screen read as one. At 0.90/20px it
arrives as tone. Raising opacity without raising blur makes the remaining
transmission *more* legible, not less.

### The elevation recipe

This is the most-revised decision in the system, so it is written out in full.

**A white surface — card, panel, switch, chip — takes a stroke AND a whisper of
shadow. Both, always, and always outset.**

```css
--v3-stroke:  0 0 0 1px rgba(33, 53, 40, 0.04);
--v3-whisper: 0 1px 2px rgba(40, 38, 30, 0.05);
--v3-lift:    var(--v3-stroke), var(--v3-whisper);   /* .story   */
--v2-lift:    var(--v2-stroke), var(--v2-whisper);   /* .map-wrap */
```

Byte-identical across the two skins on purpose.

**Why both.** They hold different edges. The stroke closes all four sides
equally, *including the top* — which a shadow can never draw, because light
comes from above, and a box with only a shadow reads as sliding off the page.
The shadow does the one thing the stroke cannot: separate the surface from the
surface behind it. Because each has a job the other cannot do, **neither has to
be loud.**

That is also why the stroke is at 0.04 after 0.04 was rejected once before. The
earlier note was right on its own terms — at 0.04 the line renders `#f4f5f4`
against the card, a 4/255 delta at the perception threshold — but it was
describing 0.04 as a *sole* treatment, with nothing else holding the edge. With
2px of contact shadow under it the line no longer carries the separation alone,
so it can sit at the threshold and read as quiet rather than absent.

| α | Composited on `#fdfdfd` | vs card | |
|---|---|---|---|
| 0.04 | `#f4f5f4` | 1.074 | **here**, paired with the whisper |
| 0.06 | `#f0f1f0` | 1.113 | the previous sole treatment |
| 0.136 | `#dee1df` | 1.295 | = `--rule`, the 1px border §3 removed |

Deeper shadows survive for the things that genuinely float. All of them carry
the same stroke, so every white surface on the site has one line and only the
separation differs:

| Token | Value | For |
|---|---|---|
| `--v3-shadow` | stroke + `0 1px 2px /.04`, `0 6px 20px /.05` | `.map-key`, `.close-action` |
| `--v3-shadow-control` | stroke + `0 1px 3px /.07` | controls on the MAP rather than on paper |
| `--v2-shadow` | stroke + `0 8px 28px /.02` | the Archive's two big frosted panels |
| `--v3-shadow-dark` | `0 10px 32px /.16` | a card over a photograph — no stroke; a 4% ink line on a dark ground is nothing |

**OUTSET, never inset — the trap that has now caught this project three times.**
An inset shadow is painted on the padding box, *beneath* children. Any child
with an opaque, full-bleed background erases it, and `getComputedStyle` will
report it as present, because it *is* set.

The third catch is the one worth remembering, because it shipped: the Archive's
`.explorer-agents` is a zero-padding row of full-bleed chips, so the switch's
own buttons painted over its outline. Measured on the shipped build, the top
edge darkened by **4.07 of 255** under the translucent chips and by **exactly
zero** under the opaque dark “All” — the control had no edge at the end a reader
looks at first, which is why it read as a dark block with four labels beside it
rather than as one switch. Outset, the same edge measures **9.21 uniformly
across the whole row.**

Verify with `elementFromPoint` at the border pixel, or by sampling pixels one
row *outside* the border box — an outset stroke does not live inside it.

---

## 5 · Shape

Radius is **0** everywhere except where roundness is the meaning: agent dots,
the compass dial, colour swatches, the map's own circles.

Buttons, panels, chips, switches and tooltips are rectangles. Chips butt
together into one block, divided by a 1px seam inset top and bottom, suppressed
on both sides of the active chip whose fill draws its own edges.

CSS triangles (`.act2-chip::after`, the pin tails) are geometry, not strokes,
and are not covered by the no-strokes rule. Neither is an instrument's own line
— the compass dial and the scale bar *are* their outline.

---

## 6 · The segmented switch

Five instances, one form, and they agree exactly:

| | |
|---|---|
| Story | `.rainbow-switch` / `.rainbow-chip` · `.map-key-view` · `.rainbow-mode` · `.eco-sort` |
| Archive | `.explorer-agents` / `.agent-chip` · `.archive-key .map-key-view` |

The form: `gap: 0`, one hairline on the **group** (not per member — per-chip
shadows bleed into the seams and draw vertical lines through what is meant to
read as one control), a 1px `::before` seam between neighbours, seams suppressed
either side of the active chip, active chip filled `--forest`.

`.method-tabs` looks like a sixth and is not: it is a bare flex row of two
independent toggles with no background for a group hairline to sit on. It takes
the button treatment and none of the container treatment.

---

## 7 · Space

No formal spacing scale is declared; the values in use cluster on
0.25 / 0.375 / 0.5 / 0.75 / 1 / 1.5 rem, and a new one-off should be pulled to
the nearest of those.

The Archive panel's block rhythm, which is the most deliberate part:

| Gap | rem |
|---|---|
| Between blocks (identity → controls) | 1 |
| Within a block (title → subtitle) | 0.5 |
| Subtitle → deck | 0.75 |
| Section label → its content | 0.5 |
| Label above a section | 1 |
| Inside a statement (figure → its counts) | 0.25 |

1rem rather than the Figma's 1.5: at 1.5 the panel read as five loose islands
rather than one instrument. **A divider sits equidistant** — the deck's bottom
margin and the transport's top padding are both 1rem, so the hairline between
them is centred by construction rather than by eye.

Panel width is **23.25rem** (316px on a laptop, 372 at full size), sized to the
agent row with headroom: an exact fit left 3.3px and the row wrapped on the
first machine whose subpixel rounding went the other way.

### Breakpoints

| | |
|---|---|
| 1600 / 641 | the density step (root 16 ↔ 13.6) |
| 1100 | Act II's two-column row collapses |
| 1024 | the Story card docks to the bottom (tablet and down) |
| 900 / 860 / 820 | Story section layouts |
| 640 | the phone layer, both surfaces — Archive panel becomes a bottom sheet |
| 400 | agent-chip padding clamps for narrow phones |

700 is gone. It was the Archive panel's own bottom-sheet breakpoint, 60px out
from the 640 everything else uses, so between 641 and 700 the Archive was
already a phone while the Story was still a tablet — and 641 is where the root
scale steps, which meant the Archive's sheet appeared while its type was still
at laptop density. Both the App.css rule and its restatement in
ArchiveSkinV2.css now break at 640.

---

## 8 · Components

**Transport button.** 1.875rem square, no radius. Primary = `--forest` fill,
`--forest-text` glyph. Ghost = translucent white, ink glyph. The pair butts into
one block carrying one hairline.

**Chip (agent filter).** 0.375rem/0.75rem padding, weight 500, no radius, no
border. Padding clamps below 400px so the row never overflows the sheet.

**Rule.** `1px solid var(--rule)`. Divides blocks. Never encloses.

**Tooltip.** 0.375/0.5625/0.4375rem padding, radius 0, control shadow. Both
lines at 0.6875rem; the tip is a rotated square.

**Inspect card.** Title states the subject and its span, not the container.
Data at 0.6875rem, labels at 0.625rem, one grammar for the figures (§2). Section
headings each take over the rule that would otherwise sit above the block they
head.

**Error notice.** Both surfaces say so when the map cannot be drawn — paper, the
hairline, 0.75rem ink-soft, centred on the map. The Story adds that its
reporting is unaffected, because it is; the Archive does not, because the map
*is* the Archive.

---

## 9 · The map

*(This section is being revised against the cartography and label audit now in
flight; the palette and zoom tables below are read from `mapConfig.ts` and
`mapTaxonomy.ts` as they stand.)*

Both surfaces run one **ground pass** — `quietBasemap()` — which turns off
buildings, vegetation and settlement dots, greys the boundaries, drops minor
roads, and gives water its own tone. Vegetation is off for a reason that belongs
in the system rather than in the code: positron's green is *today's* cover, half
a century after the record, and inviting a reader to read it as the forest that
was sprayed is the wrong inference to offer.

The two intended differences:

- **Water.** The Story uses `STORY_WATER` `#d9e2e0`, which sits in its
  orange–green system and measures 7.6% below the land tone; the Archive keeps
  its own cooler tone.
- **Label visibility.** The Story passes `{ labels: false }` and curates its own
  set; the Archive runs the basemap's. The label *type system* is shared — one
  face, one tier ladder, one halo recipe — and only the visibility policy is
  per-surface.

Zoom, from `mapConfig.ts`:

| | |
|---|---|
| Floor | derived per viewport by fitting `recordBounds`, minus 0.35 (≈5.3 phone, ≈6.6 on a 27") |
| `Z_NEAR` | 9 — fine grid hands off to raw runs |
| Ceiling | 11 — stops where the data does; past z12 a dot carries no more information |

Relief is always on at 0.28 and deepens to 0.6 when the reader tilts, on both
surfaces.

---

## 10 · Where the older documents went

`design-system-v2.md`, `design-system-v3.md` and `design-system-v3-serif.md` are
**historical**. They record how the Archive spike was proposed and then read
back, and the branch comparison (all-Geist vs Playfair) that the Story resolved
in favour of the pairing. They are kept as decision records and are no longer
accurate as specs — v3 §2 in particular says "Geist everywhere, no serif/sans
pairing", which describes a branch that did not win.

`design-system.html` is a generated specimen page built from
`design-system.src.html`. Its tokens are stale — it still carries the pre-ramp
`--ink: #213528` — so treat this file, not that page, as the reference.
