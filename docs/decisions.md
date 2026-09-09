# Decisions

A log of the design and data decisions behind the site, kept so that the
reasoning survives the conversations it was made in. Newest first. Each
entry says what was decided, why, what was tried and set aside, and where
the change lives. Standing rules and open questions are at the foot.

Dates are the day the decision landed on `master` unless noted. Pull
request numbers refer to this repository.

## 2026-09-09 · The phone pass's questions, answered (PR #195)

The nine questions the pass left open, and three smaller ones from its
findings, were put to the designer as options and decided the same
morning. Each is recorded with what was set aside. The mocks that
informed them were CSS injected on the branch's build, not code; the
changes below are.

- **The sheet's foot on phones.** The HOW TO READ THIS label goes with the
  guide and the citation it headed; the rule it carried moves to the Read
  the Story link, which stays as the way out. Set aside: showing the guide
  and the citation on the phone now that the sheet scrolls, which would
  have needed the guide's verbs rewritten for touch.
- **The key block.** Stays whole in the expanded sheet, as shipped. Set
  aside: chips only, the arrangement before PR #190, which keeps the model
  switch and the hit grid off the phone.
- **The notes on touch.** The (i) is a toggle on a touch screen: a tap
  opens the note, a second tap on the mark or a tap anywhere else closes
  it, Escape too, and the mark carries `aria-expanded`. The hover rule is
  fenced to pointers that hover, so a tap's emulated hover cannot hold
  open a note the reader closed. Set aside: notes inline under their label
  on touch screens (the model note landed between the label and its switch
  and needed the two-switch row rebuilt), and leaving plain focus.
- **A second door to the Atlas on phones.** A fifth card in the close's
  actions, phone only: The Record, Explore the Record, on the accent, the
  site's own door among the four organisations'. The desktop keeps the
  rail. Set aside: a link beside Back to top (too quiet for the one way
  in), a fixed strip (costs the phone height on every screen of the Story).
- **The way back from a record card.** Closing the card puts the sheet
  back as the card found it: expanded if it was expanded, at the scroll
  position it had, so a lookup's list and its back link are where the
  reader left them. A sheet already at its peek stays there. Set aside: a
  Back link in place of the × (loses the general close), one line of the
  lookup kept in the peek (a third sheet height).
- **iPad.** Between 641 and 900px both columns come down from 23.25rem to
  20rem with 1.25rem insets, and the two rows sized to the wider column
  wrap instead of clipping: the model switch and the view switch take a
  row each, the agent chips run in two rows on one track. The strip of
  map between the columns goes from 95 to about 180px on an iPad mini.
  Set aside: a key column that starts folded to its search row (the map
  first, the key on demand), and leaving it.
- **A phone on its side.** Stays the desktop layout, scrolling under 760px
  tall. Set aside: the sheet layout on short touch screens, a second
  breakpoint the site has never had.
- **The record node's deck card.** The body is cut from seven lines to
  five on a phone: the years and the run count go (the stat pill under it
  carries the count), the three verbs stay. Set aside: dropping the stat
  where a CTA follows; a height cap on short screens, against the deck's
  own rule.
- **A loading state for the Atlas.** One line in the load error's own
  card, centred on the map: Loading the record until the record lands,
  Loading the hit grid while the grid does, a sentence if the grid fails.
  A status role, so it is announced as well as seen. Set aside: rendering
  the panel's head before the data; accepting the bare paper.
- **The Story's key note on phones.** The first card carries the field's
  encoding as one line under its stat, shown only where the key is hidden.
  Set aside: a compact key in the top strip; recording the omission.
- **The search box in the sheet.** On phones the lookup moves from the
  foot of the sheet to under the transport and its chart, above the way
  out; the desktop's column order is unchanged. Set aside: leaving it last.
- **The locator pins.** Opening a card from a pin scrolls the card into
  view when it is not already on the screen, on every layout that stacks
  the cards under the map; closing from a pin leaves the reader where they
  are; reduced motion gets an instant scroll. Set aside: pins as
  decoration, with the chips alone selecting.

## 2026-09-09 · The phone pass after PRs #185 to #194 (PR #195)

Six areas of both surfaces were walked on an iPhone 14, an iPhone SE, a
Pixel 7, a phone on its side and an iPad mini, in a headless harness with
the record's own layers over a local paper ground (the tile hosts are out
of reach there). 57 findings; every one that was fixed was reproduced a
second time first. The fixes are fenced inside the 640px block, the
`isPhone` branch or a pointer query, and the desktop states of both
surfaces render pixel-identical before and after.

### The key block comes to the phone
**Decided.** The block under the title (model switch, Map View, model
line, agent chips, band row, Map Key) shows in the phone's expanded sheet
and goes in the peek and its two glide frames. The transport's phone-only
3D chip and the one-line legend at the sheet's foot retire with it.
**Why.** PR #190 moved the switches, the chips and the band row into the
block, and the phone hid the block: the four colours went unnamed, the
hit grid could be reached only by URL, and in grid mode the phone had no
band row, no key and no notes. The sheet scrolls, so the block costs the
map nothing in peek. The chip and the legend line existed because the
block was hidden; the legend line was also wrong under the grid.
**Set aside.** Chips only, outside the block, the arrangement before
PR #190 plus a mode-aware legend line: it keeps the model switch off the
phone, and one line cannot say what the key's rows and their (i) say.
Rendered for comparison.

### Touch has no hover
**Decided.** The (i) is a 24px target and its note stays open on a tap,
until the reader taps elsewhere (plain focus under `hover: none`). A tap
on the grid opens a card with the cell's hits within each band and by
agent. A finger picks a run through a 24px box around the tap. The
lookup's idle line says "Tap a year" on a touch screen.
**Why.** The house had already retired the hover card on touch
(App.css, `hover: none`: "the tap's real answer is the inspect sheet");
the grid's numbers and the notes were the two places that still lived
only in a hover. The 24px is WCAG 2.5.8's floor, which the sheet's handle
already cites. The strokes are a pixel wide at most zooms: two blind
sweeps of sixty taps opened nothing.
**Open.** Whether the notes should toggle on a tap (a state on the host)
or sit inline on touch screens (below).

### The camera reserves the sheet
**Decided.** A fit reserves the sheet's live height at the bottom, the
way the desktop reserves the column's width at the left; a place is
eased with an offset of half that height.
**Why.** A mission's runs were centred on the whole canvas and two thirds
landed under the sheet; a place showed 8px of its circle. An offset, not
`easeTo`'s padding, which maplibre keeps in the transform for every later
move.

### Hints take their width and ride the sheet
**Decided.** Every map hint takes its content's width, capped to the map
less a margin. On a phone the zoom hint rides the sheet's live height and
goes while a card is up; between phone and laptop widths it centres in
the strip the column leaves free.
**Why.** An absolute box with only a left edge shrink-wraps into half the
map: 195px on a phone, three lines and a button broken in two. The foot
of the screen is the sheet on a phone.

### Short screens scroll the column
**Decided.** Under 760px tall the desktop column caps to the viewport and
scrolls; between 641 and 1000px wide the zoom hint steps off the scale
bar.
**Why.** A phone on its side gets the desktop layout at 844 wide, and the
column was 707px tall on a 390px screen with no scroll, the transport and
the foot unreachable.
**Open.** Whether short touch screens should get the sheet layout instead
(a second breakpoint the site has never had), below.

### Fixed on the way
The sheet's phone padding never ran (the skin's two-class rule beat it):
24px of paper above the handle, no safe-area inset. The collapse clamp
was the peek as first measured (91px) against a peek of 140: one custom
property, measured at 112, for both. The grab handle takes the sheet's
paper. The results list stops being a scroller inside the scroller. The
by-year axis comes up to the 10px tier on phones. The record card's ×
takes its hit area on the left, inside the card. The Story's methods
diagram reserves the room its longest label measures, and the pilot
node's chip keeps "Jan 1962" together.

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
