# Tokyo TDC 2027 — physical-work print pack

Entry F373, ID number 【362】07_F373_01 (Category 7, Poster B), selected as an
Excellent Work. Physical works due at Tokyo TDC 26 Oct – 16 Nov 2026.

`out/`
- `ADOR_TDC2027_07_F373_01_{a_When,b_HowMuch,c_Record}_A1_CMYK.pdf`: the three
  submitted posters as A1 (594 × 841 mm) vector print masters, DeviceCMYK only,
  no transparency, Courier Prime embedded. Trim = media; the design's ~56 mm
  paper margin means no bleed is needed.
- `ADOR_TDC2027_F373_tags_A4.pdf`: four identical entry tags on A4, cut to A6.
- `ADOR_TDC2027_打印说明_给爸爸.pdf`: printing and shipping memo (Chinese).

Source: `poster/final/FINAL-{time5s8,vol,f4}.svg` on
`claude/youthful-bohr-pjf2v2` (commit cf91989, the version zipped as F373.zip;
re-rendered and checked against the submitted JPEGs).

`build/`
1. `prep.py` flattens each fill + fill-opacity pair into a solid placeholder colour.
2. `render.mjs` prints the placeholder SVG to an A1 PDF in Chromium.
3. `cmyk.py` swaps each placeholder for a hand-set CMYK value; opacity becomes a
   straight tint, because the paper colour #faf9f4 is left unprinted.

| colour | hex | C/M/Y/K |
|---|---|---|
| ink | #141109 | 0/0/0/100 |
| P | #8f5fc0 | 52/71/0/0 |
| O | #ef7409 | 0/67/100/0 |
| W | #3f5162 | 77/61/44/27 |
| B | #2f83c8 | 77/41/0/0 |
| X | #6f5c44 | 48/54/73/30 |
