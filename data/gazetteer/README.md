# Gazetteer — US installations in South Vietnam

First-pass place table for the Location Lookup's name search (brief: Task B).
`bases.csv` — one row per installation, fields:

```
name_canonical, name_variants, type, lat, lng, province_rvn, province_modern,
source_url, confidence, notes
```

- `type`: airbase / army_base / marine_base / firebase / lz / camp / city / town / other
- `name_variants`: pipe-separated; Wikipedia redirect titles plus a
  diacritics-stripped form of the canonical name
- `confidence`: high (source coordinate cross-checked against a second,
  independent source within 2 km) / medium (source gives a coordinate, not
  yet cross-checked) / low (coordinate inferred — **none in this build**, by
  rule: no coordinate is ever invented here)

## Sources

1. **Wikipedia (CC BY-SA 4.0)** — harvest date **2026-08-27**, via the
   MediaWiki API. The brief names three list pages; those titles do not exist
   on Wikipedia. What it maintains instead are categories, verified by reading
   the category tags off Bien Hoa Air Base and Khe Sanh Combat Base:
   - `Category:Installations of the United States Army in South Vietnam`
   - `Category:Military installations of the United States Marine Corps in South Vietnam`
   - `Category:Installations of the United States Air Force in South Vietnam`

   Coordinates come from each article's own coordinate tag, with a fallback
   to the article's Wikidata item (P625) where the page has no local tag
   (marked `coord via Wikidata P625` in notes). Every row keeps its
   `source_url`.
2. **NGA GEOnet** (name variants) — **pending**: geonames.nga.mil's bulk
   country-file endpoints return 403/404 through this environment's egress
   proxy (the site is a JS application with WAF-fronted downloads). Variants
   currently come from Wikipedia redirects; a GEOnet pass can be layered on
   later without changing the schema.
3. **Ray Smith, "Where We Were in Vietnam"** — verification only, per the
   brief; nothing copied. Not yet applied (Task C review is the first
   verification round).

## Cleaning rules, and what was dropped

- 167 distinct articles found across the three category trees (≤2 levels).
- **Dropped: 92** — pages with no coordinate on Wikipedia *or* Wikidata
  (mostly firebase/LZ stubs), per the no-inference rule. Their titles are
  recoverable by re-running the harvest with a logging flag; locating them by
  hand (Ray Smith cross-check) is the intended path to grow the table.
- Kept: **75 rows**, all inside the Vietnam box (8–18°N, 102–110.8°E).
- Bare 2–4-letter acronym redirects (e.g. "AB") are dropped from variants.
- `province_modern` by point-in-polygon against `public/data/provinces.geojson`
  (2 coastal/island rows resolve to none and stay blank).
- `province_rvn` is left blank throughout: filling it needs an RVN-era
  (pre-1975) boundary source, which this repo does not yet carry.

## Known gap vs the brief

The brief targets 300–600 rows. Wikipedia's georeferenced coverage of these
installations yields 75 under the no-inference rule. The path to scale is
(a) a GEOnet pass once the bulk files are reachable, (b) hand-locating the
92 coordinate-less articles against Ray Smith, and (c) adding city/town rows
from a general gazetteer. Recorded here rather than padded over.

## Re-run

```
NODE_USE_ENV_PROXY=1 node scripts/gazetteer/harvest-wikipedia.mjs   # rebuilds bases.csv
node scripts/gazetteer/make-review.mjs                              # rebuilds the review sheet
```

Deterministic given the same API responses; the review sample is seeded, not
random, so a re-run reproduces the same sheet.
