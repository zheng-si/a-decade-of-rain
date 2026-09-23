# NACIS 2026 Map Gallery placard

The gallery hangs a digital entry as one print: 11 in wide × 17 in tall, at
least 300 dpi, PDF, with a 2 × 2 in QR code in a corner that opens the map on
the visitor's own phone. This folder builds that print for A Decade of Rain.

Two variants share one copy block and one QR; the choice is the designer's.

| | file | what it is |
|---|---|---|
| A | `out/placard-a.pdf` | one portrait shot of the Atlas (3D flight tracks) nearly edge to edge under the masthead |
| A, dots | `out/placard-a-dots.pdf` | the same sheet with the flat dot view; the one chosen on 22 September 2026 |
| B | `out/placard-b.pdf` | a framed landscape shot of the Atlas with two smaller shots under it |
| | `out/contact.png` | the variants side by side |

Each PDF has vector text with the site's own fonts embedded (Courier Prime for
the title, as on the hero; Geist for everything else) and the shots as PNG at
300 dpi. `out/placard-*.png` is the same sheet as a 3300 × 5100 px image.

## The QR

Encodes `https://rain.sizheng.me/` at error-correction level M: version 2,
25 × 25 modules, so at 2 in a module is 2.0 mm and a phone reads it from about a
metre. It is drawn as rectangles (not strokes, which some RIPs thin) in the
ink colour on paper, with at least four modules of paper around it. The build
decodes the code back out of the rendered PNG and fails if it does not read
the URL.

## Rebuilding

```bash
cd poster/nacis-2026 && npm install
node capture.mjs        # the product shots, from the live site (see below)
node build.mjs          # out/placard-a.*, out/placard-b.*, out/contact.png
```

`capture.mjs` takes the shots with headless Chromium at print resolution; the
camera for each rides in the Atlas URL (`?cam=lng,lat,zoom,bearing,pitch`,
`&view=3d`), so a shot is reproducible from the numbers in the file. It uses
the Playwright Chromium under `/opt/pw-browsers` (`CHROME=` to point at
another) and honours `HTTPS_PROXY`; behind an intercepting proxy the proxy's
CA has to be in Chromium's NSS store (`~/.pki/nssdb`) or the page will not
load. WebGL runs on SwiftShader, so each shot takes about half a minute.

`SITE=http://localhost:4173 node capture.mjs` captures a local preview build
instead of the live site.

## Into Figma, and back

Each render also writes `out/placard-<variant>.layout.json`: every text box,
the shot, the mark and the QR with their positions in inches and their
computed type, read back out of the rendered page. `figma.mjs` turns that into
Figma Plugin API code:

```bash
node figma.mjs a-dots > out/figma-a-dots.js
```

Run through the Figma MCP `use_figma` tool (or a plugin console), it builds
the sheet as one frame at 72 units to the inch (792 × 1224), so a PDF exported
from Figma comes out at 11 × 17 in. Text is live text in Courier Prime and
Geist (both on Google Fonts, so available in Figma), the mark and the QR are
vectors, and the shot is a rectangle to fill with `shots/<name>.png` through
the `upload_assets` tool. `PAGE_ID` and `AT_X`/`AT_Y` say where the frame
lands. A rerun replaces the frame it made before.

The frame is the hand-off for fine-tuning by hand. Once it comes back, the
final print is exported from Figma (File → Export, PDF), or the tweaks are
carried into `build.mjs` and the PDF rebuilt here, whichever the designer
prefers.

## Print

The sheet is designed to its trim: no bleed, 0.35 in (A) or 0.5 in (B) of
paper around everything, so it prints on a tabloid sheet without borderless
mode. The accent orange (`#ff5449`) sits outside the CMYK gamut and will print
a little duller; the ink green and the paper convert cleanly.
