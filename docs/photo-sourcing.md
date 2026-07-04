# Interlude photo sourcing — the plan to go all public-domain / CC

The Interlude has two photo walls: **The Land** (ecological toll) and
**The Body** (public-health toll). We are replacing every copyrighted or
un-provenanced image with a public-domain (PD) or Creative-Commons (CC)
source, so the piece can be published and entered for awards without a
licensing liability.

Status legend:
- ✅ **KEEP** — already PD/CC, no change needed
- 🔁 **REPLACE** — swap for the listed PD/CC file
- ⚠️ **HARD** — no strong PD/CC equivalent found; see note

The blocker: this build sandbox can only reach GitHub, so the actual image
files must be downloaded by hand and dropped into a zip (same as Photos.zip).
For each REPLACE below, download the **original-resolution** file from the
Wikimedia Commons page, keep the credit line, and hand the zip back.

---

## 🌿 The Land — can go fully public domain

Nearly all Vietnam-War defoliation imagery is U.S. military / NARA work =
public domain. This wall is an easy, clean win.

| Slot | Now | Action | PD/CC source | Credit line |
|------|-----|--------|--------------|-------------|
| land-1 | C-123 spraying (classic) | ✅ KEEP | `File:UC-123B Ranch Hand spraying 1962.jpg` | U.S. Air Force (public domain) |
| land-2 | Huey spraying | ✅ KEEP* | `File:Defoliation agent spraying.jpg` (UH-1D, 336th Avn Co.) | U.S. Army / NARA (public domain) |
| land-3 | Rừng Sác aerial 1968 | ✅ KEEP | RANCH HAND Collection | RANCH HAND Collection, Vietnam Archive, Texas Tech University |
| land-4 | dead mangrove trunks | 🔁 REPLACE | `File:VA042083 River Bank Defoliation.jpg` | NARA / U.S. Army (public domain) |
| land-5 | figures in dead forest | ⚠️ HARD | best PD option: `Category:Operation Ranch Hand` aftermath frames | NARA (public domain) |
| land-6 | aerial line (LIFE) | 🔁 REPLACE | `File:VA002930 Spraying Agent Orange in Mekong Delta near Can Tho.jpg` | NARA / U.S. Army (public domain) |
| land-7 | barren ground | ⚠️ HARD | best PD option: `Category:Agent Orange` aftermath frames | NARA (public domain) |

\* land-2: if the frame we currently use is *not* the NARA UH-1D file, replace
it with `File:Defoliation agent spraying.jpg` to be safe.

**The two HARD slots (land-5, land-7 — decades-later "barren aftermath"
photos)** are the weak spot: the most striking recovery/aftermath shots tend
to come from research collections (Stellman etc.) that are copyrighted.
Options: (a) use another NARA wartime "destroyed forest" frame instead, or
(b) drop the wall from 7 to 5 tiles. Recommend (a).

Browse these two categories and pick any 2–3 more aftermath frames you like —
everything in them is PD:
- https://commons.wikimedia.org/wiki/Category:Operation_Ranch_Hand
- https://commons.wikimedia.org/wiki/Category:Agent_Orange

---

## 🩸 The Body — the honest hard part

Almost every *striking* victim portrait is copyrighted (Magnum / Philip Jones
Griffiths, Tobias Nicolai, NYT, Getty). The PD/CC images that exist are more
documentary and less shocking. This is the real trade-off of going legal.

| Slot | Now | Action | PD/CC source | Credit line |
|------|-----|--------|--------------|-------------|
| body-1 | young man portrait | 🔁 REPLACE | © Tobias Nicolai — must go | see PD/CC options below |
| body-2 | mother & child | 🔁 REPLACE | © Tobias Nicolai — must go | see PD/CC options below |
| body-3 | woman in wheelchair | 🔁 REPLACE | NYT 2021 — must go | see PD/CC options below |
| body-4 | doctor + children | ✅ KEEP | already the Commons *Nguyễn Thị Ngọc Phượng, HCMC Dec 2004* photo | U.S. Gov / Wikimedia Commons (verify PD-USGov vs CC on the file page) |
| body-5 | man on stairs | 🟡 VERIFY | if it's the Flickr-CC file, keep + fix credit | attribute the Flickr author, CC BY |
| body-6 | two children | 🔁 REPLACE | age fotostock — must go | see PD/CC options below |
| body-7 | skin damage | ⚠️ HARD | no clean PD/CC equivalent | recommend dropping this tile |

**PD/CC victim photos that do exist** (search these on Commons and pick):
- *Nguyễn Thị Ngọc Phượng with disabled children, Ho Chi Minh City, 2004*
- *Kan Lay (55) holding her 14-year-old son* — Agent Orange birth defect
- *Hoang Duc Mui / veterans at Friendship Village, Hanoi, 2003*
- `Category:Victims of Agent Orange` on Wikimedia Commons

**Recommendation for The Body:** replace the copyrighted frames with the 3–4
Commons victim photos above, drop body-7, and lean on the big number + the
consent gate to carry the emotional weight. It will be less visceral than the
Nicolai/Magnum work, but it is publishable. If you want the visceral version,
the alternative is to *license* the Nicolai images directly (he is reachable
by email) rather than use them unlicensed.

---

## Once the replacement zip is ready

Drop it in and I will: swap the files under `src/assets/consequences/`,
update every `credit:` line in `src/content/interlude/consequences.ts` to the
verified attribution, and re-verify the walls with a headless snapshot.
