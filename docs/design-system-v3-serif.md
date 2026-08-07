# Design system v3 — serif variant

**This document is a delta, not a fork.** It replaces exactly two sections of
[`design-system-v3.md`](./design-system-v3.md): §2 *Family* and §11 *Where v2
and v3 differ*. Every other section of that document — colour, surfaces, shape,
elevation, space, components, the map, and how the system bends for the Story —
applies here unchanged.

It is written as a delta on purpose. The base document runs to four hundred
lines and the two variants agree on all but a dozen of them; a full copy would
be four hundred lines that drift apart the first time anyone edits one of them.
The base document's §11 promised "identical but for §2 and §11", which would
have meant that copy. This is the same promise kept in a form that cannot rot.

Implemented on branch `claude/ds-v3-playfair` (`src/StorySkinV3.css`). The
all-Geist reading is `claude/ds-v3-geist`. The two branches differ in their type
section and nowhere else — `git diff` between them is the whole argument.

---

## 2 · Type — *replaces §2 "Family"*

### Family

```
--font-sans:  'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
```

Two families, two jobs, and the boundary between them is not decorative:

| | Family | Carries |
|---|---|---|
| Sans tier | Geist | running text, decks, labels, controls, data, every figure |
| Display tier | Playfair Display | hook title, section titles, pull-quotes, the big stat values |

That boundary is checked, not assumed. Walking every rendered element under
`.story` and keeping the ones that compute to Playfair, the longest are a
159-character closing line, three pull-quotes of 64–111 characters, and
62-character decks. Everything longer — the narrative card bodies, the timeline
card text, the method and ecosystem copy — is Geist. **Playfair never sets body
copy on this page.** A serif pairing goes wrong when the display face creeps
into running text at 14px, and this one does not; the split Story.css already
drew turns out to be the right one to keep.

**The sans tier is the same decision as the all-Geist branch.** Geist replaces
Public Sans in both. Four web weights ship (300/400/500/600), each in three
subsets — latin, latin-ext, **vietnamese**. The vietnamese subset is not
optional: Geist's latin subset stops at U+00FF, so without it `Đà Nẵng` and
`Phù Cát` render half in Geist and half in a system fallback.

**The display tier is where the branches part.** Playfair Display stays,
self-subset from the official variable font (SIL OFL) with the same vietnamese
range, for the same reason.

### Why the scale in §2 still holds

The base document's nine-rung scale and its stat grammar are specified in px and
weight, not in family, and both survive the pairing intact. One row of the stat
grammar is worth restating because it is easy to get wrong: the **figure** is
11px/600 `--accent-deep`, and 600 means Geist Semibold, not Playfair. Figures
are data, and data is the sans tier's job. Playfair sets the big narrative
values — `3.1M ha`, `150,000+`, `19.5M` — where the number is a headline rather
than a reading.

### What the pairing does NOT need

The all-Geist branch lifts twenty heading classes to weight 500 and tightens
three tracking values. Those exist to make a neutral sans carry emphasis that a
high-contrast serif carries on its own: Playfair has steep stroke contrast, a
small x-height against tall ascenders, and real serifs terminating each stem.
It reads as a heading at 400.

So the serif branch's type section is empty, and that is the finding rather than
an omission. Story.css already tuned its serif rules against these letterforms.
Restating them would at best change nothing and at worst give Playfair a
semibold it was never drawn to need.

### Case

Unchanged from §2. Uppercase is reserved for the 10px label tier and for map
labels — both sans, both branches.

---

## 9 · The map — *unchanged, and worth saying why*

MapLibre renders labels from SDF glyph PBFs, not from webfonts, so the map's
type is settled by `scripts/build-glyphs.mjs` and not by either token above.
The shipped stacks are Roboto Condensed. **Neither branch touches the map.**
Whatever the page decides about Playfair, a reader moving from the Story to the
Archive meets the same labels.

---

## 11 · Where the two v3 branches differ — *replaces §11*

Against v2, everything in the base document's §11 table still applies — panel
glass 0.90, control shadow 0.07, block gap 16, one stat grammar, the map
palette, label sizes, hand-offs. Those are shared.

The branches themselves differ only here:

| | `claude/ds-v3-geist` | `claude/ds-v3-playfair` |
|---|---|---|
| Families | one | two |
| Sans tier | Geist | Geist |
| Display tier | Geist | Playfair Display |
| `--font-serif` | redefined to the sans | left alone |
| Heading weight | 500 (20 classes overridden) | 400 (Story.css, untouched) |
| Display tracking | −0.015em title, −0.01em / −0.02em on three more | untouched |
| Hook title clamp | `clamp(2.5rem, 6vw, 4rem)` | `clamp(2.5rem, 6.5vw, 4.5rem)` — `--type-h1-size`, untouched |
| Webfont payload | one family | two |
| Shape / strokes / elevation / space / controls | identical | identical |

### How to read them against each other

The honest comparison is the hook, the wall stats, and any section title with
Vietnamese diacritics — those are the three places the display tier actually
speaks. Everything else on the page is sans in both branches and will look the
same, which is the intended result: the variable under test is one tier, not a
redesign.

Two things to weigh that a screenshot will not show:

- **Payload.** The pairing ships a second variable font in three subsets. The
  Story already loads it today, so on that page the serif branch is the cheaper
  of the two and the all-Geist branch is the saving.
- **Consistency with the Archive.** The Archive is all-Geist as shipped. The
  serif branch makes the Story typographically distinct from it, which is
  either the point — the Story is a narrative and the Archive is an instrument
  — or a seam, depending on how closely the two are meant to read as one site.
  That is a judgement call, and it is the actual decision in front of you; it
  is not something the CSS can settle.
