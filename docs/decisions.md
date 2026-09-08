# Decisions

A log of the design and data decisions behind the site, kept so that the
reasoning survives the conversations it was made in. Newest first. Each
entry says what was decided, why, what was tried and set aside, and where
the change lives. Standing rules and open questions are at the foot.

Dates are the day the decision landed on `master` unless noted. Pull
request numbers refer to this repository.

## 2026-09-08 · The Story keeps its heat field (PR #194)

### The field stays
**Decided.** The Story keeps its heat field. The question was whether the
one encoding on the site that is neither the record's own marks nor the
authors' own model could be replaced by one that needs no paragraph of its
own. Not at the size the page needs; so the paragraph is written instead
(`docs/methods.md` §6 and §7, `docs/methods-paper.md` §6.4): a reading aid
over the same gallons as the Atlas's fine tier, smoothed over about two
cells, an ordinal scale, no claim of deposition, every constant listed.
**Why.** Three alternatives were drawn on the real page behind a URL flag
at six nodes, on the preview with the basemap. The hit grid went first: the
shipped table carries no time, and a Story without the playhead is not the
Story. The Atlas's dots at their own size, which is sized to sit inside
their cell, were too small to carry the page. Enlarged (2.5 to 4.5 times),
soft-edged and with the coarse tier held to z8, they approached the field
at the country zoom, but in the valleys the lattice showed and the field's
kernel was doing the filling. The designer's call.
**Set aside.** The prototype: each cell's months turned into a cumulative
series so the playhead is one filter, the Atlas's dot rule with a scale on
it, four knobs on the URL. It is in this branch's history and out of the
tree.

## 2026-09-08 · The Story's switches and the key's note (PR #192)

Opened the day PR #190 merged; in review as this entry is written, so the
date is the decision's, not the landing's.

### The Story's switches follow the Archive's
**Decided.** Every switch on the Story is the segmented control PR #190
settled on the Archive: a 2px track at 6% forest, the selected segment as
a thumb with the skin's 2px corner. One rule at the end of
`StorySkinV3.css` covers the key's Flat/3D pair, the agent chips (over
their own colours), the chart's Accumulation/Each year pair and the
ecosystems' sort pair. The agent row's track takes the corner it never
had; the seams between unselected chips stay.
**Why.** The switch a reader meets on one page is the switch they meet on
the other. The rule sits last in the file on purpose: each of these rows
zeroes its own padding further up, and it has to win by source order.
**Not a switch.** The method tabs are two independent toggles on bare
paper, with nothing for a track to sit on. They keep the button treatment
and take none of the track.

### The (i) and its note are shared furniture
**Decided.** `InfoMark.css` travels with the component and carries the
mark, the note's structure and the open state. Each skin lays its own
surface over it: the ground, the corner, the shadow and the width. The
Archive's rules that were exact duplicates are gone.
**Why.** The same arrangement as `MapKey.css`: what is structural is
shared, and each skin wins on specificity rather than on load order.
**Checked.** The Archive's four notes render pixel-identical before and
after (compared at 2x, 0 differing pixels in each).

### The Story's key takes the Archive's rule for notes
**Decided.** One (i) on a new Map Key label, and it says how the marks
are drawn. On the heat nodes: colour is the gallons logged along every run
that crossed each 3 km cell, month by month up to the date shown, blurred
into one field; darker is more; all agents share one hue. At the handover:
each line is one recorded run at one width, and the dark is where runs
overlap. The note opens below the label and spans the key's inner width.
**Why.** The key is 12rem wide and sits at the screen's right edge; the
Archive's 16rem note would run off it.

### The heat legend keeps its words
**Decided.** The ramp's end labels stay "Less / More sprayed". The
quantity is named once, behind the (i), and not on the surface.
**Why.** "Sprayed" is the Story's own verb: the cards say "sprayed eleven
times" and "sprayed over Vietnam", and the site's rule accepts it (the
herbicide was sprayed over Vietnam, not that it fell). The pair is the
sibling of the handover's "One run / Flown repeatedly": a short left, and
on the right a past participle of the act the map draws, so the key's two
states speak one grammar. Read cold at 0.625rem in a corner, "less
sprayed, more sprayed" is one pass. Five pairs were rendered on the key at
both root sizes and judged on four lenses (fidelity to the record, the
reader at a glance, one system across the site, the row's typography);
the pair as shipped led on three of the four and on the total.
**Set aside.** "Less / More gallons logged", the most faithful pair:
"logged" is a bookkeeping word in a narrative corner, the label takes 56%
of the row and starts under the ramp's pale half, and it repeats the
note's own sentence on the surface. "Less / More": beside the handover
pair it is the one label in the key that names nothing. "Fewer gallons /
More gallons": symmetric ends read as a numeric scale over a ramp whose
light end is near nothing, and gallons on a place is the claim the site
does not make. "Less / More herbicide logged": the record logs gallons,
not herbicide. Two pairs outside the five were considered and not taken:
"Less / More gallons sprayed" (the site's own phrase, on the Rainbow
figure and the timeline) and "Lightly / Heavily sprayed".

## 2026-09-08 · The Atlas panel and the hit grid (PR #190)

### Two models on one map, not three
**Decided.** The Atlas shows two visualisation models: **Flight Track**
(the record's own runs, drawn where they were flown and weighted by
gallons per kilometre) and **Hit Frequency** (the Stellmans' own 2004
model, drawn from their Exposure_Master table). The E4 exposure index is
computed by the build script but not shipped.
**Why.** Jeanne Stellman's critique was about representation: a single
line at nominal 100 m precision claims more than the record supports.
Their hits table is their own answer to that, and hea-v ships it, so the
site can draw their model rather than invent one. E4 adds a residence
interval and a decay assumption that we cannot defend without them; it
waits on their advice.
**Set aside.** A 500 m positional halo under the tracks (PR #189, closed,
branch kept). It stacked per run and read as a black corridor where many
runs overlapped; drawn once per geometry it read as a smear that said
nothing the hits do not say better.

### Nothing is modelled on this side
**Decided.** `scripts/build-proximity.mjs` only sums the source rows per
cell and agent group. One repair: mission 989 at point 226078 carries a
stray bit (hits2km of 65536 against hits5km of 1); nesting is enforced
from the outside in and the script reports the rows touched (1).
**Why.** The layer's whole claim is "their model, drawn". A single
undocumented transformation would make it ours.

### The hit grid is an image, and the record steps aside
**Decided.** The grid is painted into a canvas in Mercator rows and shown
through an image source with nearest resampling. When it is up the dots
and the strokes are hidden.
**Why.** Cells land where the table puts them and stay square at every
zoom. Two encodings over each other (a coloured grid under coloured or
inked runs) read as neither.
**Set aside.** An ink flight-track reference over the grid, off by
default. Removed in the first review.

### Colour belongs to the agent, on both models
**Decided.** Hit counts are drawn in the selected agent's hue, in five
fixed classes (1–2, 3–5, 6–10, 11–20, 21+); the "All" view uses the brand
red. A hover lists the count per agent. The lookup's hit runs keep their
agent colours over the grid, with a heavier veil (0.82 in the site's own
paper) to hold the focus.
**Set aside.** Inking the lookup's hits over the grid: it made the hits a
third encoding.

### The key returns to the left panel
**Decided.** The key sits under the title, read top to bottom: the two
switches on one row (Visualisation Model, Map View), a one-line
description of the model, the agent chips, Hit distance when the grid is
up, then Map Key. The bar along the foot of the map (PR #175) is gone.
**Why.** The bar cost readability, hid its note behind a hover, and the
grid's key did not fit it. The panel-height stepping it existed to avoid
is solved differently (below).

### The key never changes height
**Decided.** Map Key has two rows at every zoom and every filter: one
row for the marks (the dot, or the line and the point in one swatch) and
one for the border. No Other Agents row; the chips say which agent is
isolated and the note says the rest stay grey. The model line under the
switch holds two lines' height for both models.
**Why.** Every change in row count moved the transport and the chart.
**Set aside.** Three and four fixed rows with a hidden placeholder row
(two intermediate commits). Placeholders were rejected as a visible hole.

### One (i) per question
**Decided.** Notes are split by what they answer. The always-visible
model line says what the model is. An (i) on the model label carries the
source and its limits; an (i) on Hit distance carries the bands; the
key's (i) carries the encoding only; the lookup's radius (i) says what
the circle counts and that the cells count a different unit. `InfoMark`
is the one component behind all of them.
**Set aside.** One long note per mode, and a "Showing hit frequency" sign
over the map (the switch names the mode and is its own way out).

### Copy is checked against the papers
**Decided.** Flight Track: the revised HERBS file behind Stellman et al.
(2003), 9,141 missions, 11,273 runs; waypoints joined by straight lines;
coordinates accurate to roughly 500 m; flight paths, not where herbicide
landed. Hit Frequency: Stellman and Stellman (2004), a hit is a spray-path
leg within the chosen distance, proximity rather than deposition or
exposure. Citation forms: "Stellman et al. (2003)" for the Nature and EHP
papers, "Stellman and Stellman (2004)" for the JEEEA paper. No em dashes
in Archive copy.
**Settled.** The Story's heat-field legend keeps "Less / More sprayed"
(above, under PR #192).

### The switches are conventional segmented controls
**Decided.** Every switch on the Archive (model, view, agents, band,
radius, unit) is a 2px track at 6% forest with the selected segment as a
thumb carrying the skin's 2px corner. Unselected segments keep their
hairline seams. Play and reset stand 4px apart as two controls.
**Set aside.** A 1px inset stroke on the selected segment (invisible on
the dark thumb); a 10% forest track (too heavy against the panel).

### Section labels drop 0.5rem, with two exceptions
**Decided.** Every caps label drops 0.5rem to what it heads (measured
across the panel, the lookup and both inspect cards). Two rows keep their
own measure on purpose: the transport's heading to its counts (0.3125rem,
one readout in two lines) and the lookup's By Agent row (its 0.5rem is
measured from the unit toggle beside the label, which is taller). The
model and view labels are foot-aligned in their shared 1rem box.
**Set aside.** Shrinking the unit toggle so the label could make the
0.5rem itself; the toggle lost its weight.

### The foot of the panel
**Decided.** The rule over HOW TO READ THIS pays what the key's rule over
the transport pays (15 and 15). The guide and the citation are 0.6875rem
on a 1.4 lead; the citation and the Read the Story link sit 0.625rem under
what precedes them. The run card has no stroke and a 2px corner.
**Fixed on the way.** The cell card's close button overhung the card by
6px and, the card being a scroll box, drew a horizontal scrollbar wherever
scrollbars are shown. Headless renders hide scrollbars, which is why the
before-and-after screenshots never showed it.

## 2026-09-02 · The record's volume (PR #185, #186)

**Decided.** A mission's logged volume is spread across every track it
flew, by length, not booked to its first track. The lookup searches HERBS
missions by number. The panel subtitle and the empty state describe the
file, not Ranch Hand alone (fixed-wing flights carry 95% of the gallons;
helicopter and ground spraying the rest).
**Why.** Measured in `docs/methods-paper.md`: at a 3 km cell, 59% of all
gallons sit in a different place under the file's own booking than under
the along-track reading.

## 2026-09-01 · Panel hierarchy and depth (PR #177 to #183)

**Decided.** The instructions move to the foot of the panel under a
label and a rule; the head is title, subtitle, then controls. One
elevation recipe (a 4% stroke and a whisper of shadow, outset) and a 2px
corner on every raised surface. A leading scale with Regular in the head.

## 2026-08-31 · Colour and the key (PR #172 to #176)

**Decided.** The colour channel is spent on the agent, not on the brand:
Orange #ff7700, White #8c9cb1, Blue #2b99ee, Other #b781ea, chosen in a
palette console. The Archive names itself The Herbicide Atlas of
Vietnam. The panel stops being glass.
**Superseded.** The key's move to a bar under the map (PR #175) was
reversed in PR #190 (above).

## 2026-08-27 · One switch system (PR #165)

**Decided.** Both surfaces share one switch grammar: a grey track,
segments butted together, notes on the row rhythm. PR #190 refines it
(2px track, thumb corner) on the Archive; PR #192 carries the refinement
to the Story.

## 2026-08-12 · The Archive (PR #152)

**Decided.** The record drawn as lines at near zoom and as gallons-sized
dots at far zoom, on one design system shared with the Story. Two
surfaces split into two stylesheets (`StorySkinV3.css`,
`ArchiveSkinV2.css`) under one token set.

## Standing rules

- No fabricated fields. Every number on the site traces to a row in the
  revised HERBS file or to a published table; where a value is derived
  the method is written down in `docs/methods.md`.
- No backend, no database, no external API at runtime. Everything is a
  static file under `public/`.
- The Story's entry is not modified without a separate decision.
- The branch `claude/youthful-bohr-pjf2v2` is the poster archive and is
  kept.
- Design choices are the designer's. Alternatives are rendered side by
  side with before-and-after screenshots and measurements before one is
  chosen.
- A Playwright regression pass (53 checks over both surfaces at desktop
  and phone widths, kept outside the repository) runs against the preview
  before every merge. Known failures as of PR #190: Story terrain tile
  requests on desktop and phone, Story phone map credit, "legend at dot
  zoom" at z9.2, one em dash in Story copy.

## Open questions

- **E4.** Whether to draw the Stellmans' exposure index as a third model,
  and with what caveats. Waiting on Jeanne Stellman's advice.
- **Mission numbering.** The JEEEA 2004 paper's Figure 1 shows mission
  3087; hea-v's mission 3087 is a different date. Numbering between the
  paper and the shipped file may differ; to ask.
- **Publication.** Zenodo DOI and `CITATION.cff`; a Data and methods page
  on the site; the methods note (PR #184) still in draft.
