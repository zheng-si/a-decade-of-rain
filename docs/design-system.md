# Design system — Remedial Vietnam

The editable source of truth is the token block at the top of **`src/App.css`**
(`:root { … }`); fonts are declared in `src/fonts.css`. Change a token there and
everything that consumes it follows. This document explains what each token is
for and records the contrast maths (WCAG 2.x AA).

Design idea in one line: **warm paper cartography, forest-green ink, and one
orange accent family — orange draws, forest speaks.**

## 1 · Colour

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--paper` | `250,249,244` (rgb tuple) | page background, glass panels (with alpha) |
| `--forest` | `#213528` | dark surfaces: story cards |
| `--forest-2` | `#2c3730` | raised dark surface (stat pill) |

### Text on paper (ink scale)

| Token | Value | Role | Contrast on paper |
|---|---|---|---|
| `--ink` | `#213528` | headings, primary text | 12.4:1 |
| `--ink-soft` | `#4e6355` | secondary text, UI labels | 6.2:1 |
| `--ink-faint` | `#647468` | captions, smallest print | 4.7:1 — AA floor for small text; don't lighten |
| `--rule` | `#dfe3d9` | hairline dividers (non-text) | — |

### Text on forest (dark cards)

| Token | Value | Role | Contrast on forest |
|---|---|---|---|
| `--forest-text` | `#e8ece6` | primary | 11.0:1 |
| `--forest-text-soft` | `#b4ccba` | secondary | 7.7:1 |
| `--mint` | `#92f7bc` | decorative borders only — never text | — |

### The accent family — one hue, four jobs

The brand orange stays vivid where it's *drawing* and gets tuned one step
where it's *carrying text*, so every pairing passes AA:

| Token | Value | Job | Ratio |
|---|---|---|---|
| `--accent` | `#ff5449` | **geometry**: dots, pulse rings, heatmap, rain, scan line | n/a (decorative) |
| `--accent-chip` | `#d63328` | **chip fill** behind white text (map labels, timeline chip) | 4.8:1 vs #fff |
| `--accent-bright` | `#ff7a70` | accent **text on forest** (stat number, quote link) | 5.2:1 |
| `--accent-deep` | `#cf3720` | accent **text on paper** (MILITARY REGION tags); equals the heat-ramp deep end | 4.7:1 |
| `--accent-line` | `#e8443a` | **map linework** on paper (MR dashes, landmark outline, leader hairline) | 3.5:1 (non-text ≥3) |

Rule of thumb: if it's a shape → `--accent`; a line → `--accent-line`; a chip →
`--accent-chip`; orange *words* → `--accent-bright` on dark, `--accent-deep` on
light. The 23px card eyebrow is large text (AA needs only 3:1) so it may use
raw `--accent`.

## 2 · Type scale

Serif = Gambarino (`--font-serif`), sans = Switzer (`--font-sans`).
Sizes/line-heights live as `--type-*` tokens in `src/App.css`.

| Level | Token pair | Face & weight | Used for |
|---|---|---|---|
| **h1** | `--type-h1-size` `clamp(44px,8vw,92px)` / lh 1.02 | serif 400 | hook banner title |
| **h2** | `--type-h2-size` 26px / lh 1.14 | serif 400 | story-card title |
| **h3** | `--type-h3-size` 23px | serif 400, accent | card period ("1961–62") |
| **lead** | `--type-lead-size` 16px / lh 1.68 | sans 300 | hook dek |
| **dek** | `--type-dek-size` 15px / lh 1.4 | sans 500 | card dek |
| **body** | `--type-body-size` 14px / lh 1.65 | sans 300 | card body copy |
| **quote** | `--type-quote-size` 17px / lh 1.35 | serif 400 | pull quotes |
| **caption** | `--type-caption-size` 12px | sans 400–600 | cite lines, UI small print |
| **chip** | `--type-chip-size` 11px / `--type-chip-weight` 600 | sans | map label chips |

UI micro-sizes below caption (timeline years 11px, legend 9.5–11px, chip unit
8px) are component-local; anything at these sizes must use `--ink-soft` or
stronger (or white on `--accent-chip`/`--forest`).

## 3 · Map markers — one system

Spec implemented by `.map-dot` / `.map-area-label` in `src/pages/Story.css`.

**Point** (`.map-dot`) — anything that points at a *place*:
solid `--accent` dot (12px, white halo) + pulsing ring, plus a chip
(`--accent-chip` fill, white text, 4px radius). Chip placement:

| Variant | Placement | Pointer |
|---|---|---|
| default | above the dot | triangle pointing down |
| `--below` | below the dot | triangle pointing up |
| `--leader` | led `--leader`px right on an `--accent-line` hairline (90px on mobile) | none — the line is the pointer |

**Area** (`.map-area-label`) — anything that names a *region* (Cà Mau,
A Lưới): the pulsing `--accent-line` boundary outline is the pointer, so the
chip floats alone at the label anchor, centred, **no pointer triangle, no dot**.

Used by: test-spray sites (point), no-boundary references like War Zone C/D /
Iron Triangle / Biên Hòa airbase (point), real-boundary landmarks (area).

## 4 · Map linework

| Element | Style |
|---|---|
| Military-region dividers | `--accent-line`, 2.2px, dash 2.4/1.8 — internal lines only |
| MILITARY REGION tags | `--accent-deep` text, uppercase, paper halo, ≤z8.5 |
| Landmark boundary outline | `--accent-line`, 3px, opacity pulsing 0.5–0.95 |
| National border / provinces | basemap's own, sub-national knocked back (`mapTheme.ts`) |

## 5 · Motion

- Hook rain: plays at the top, fades out (~1.4s) after half a viewport of
  scroll, parks (rAF stopped), fades back in (~0.8s) at the very top.
- Pulses: dot ring (CSS, 2.2s), landmark outline (rAF sine).
- **`prefers-reduced-motion: reduce` disables all three** (rain, ring, outline
  pulse) — keep this invariant when adding any new animation.

## 6 · Basemap labels

See `docs/map-labels.md` for the tier system, and `normalizePlaceLabels()`
(casing + " Ward"-suffix normalisation).
