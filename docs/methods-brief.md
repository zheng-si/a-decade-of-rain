# Reading HERBS as Flight Tracks

## A technical note on the spatial reconstruction behind *A Decade of Rain* and *The Herbicide Atlas of Vietnam*

Si Zheng
Draft for comment, September 2026. Prepared for Jeanne Mager Stellman and Andrew B. Stellman.
Live pages: <https://adecadeofrain.sizheng.me/> (the Story) and <https://adecadeofrain.sizheng.me/archive> (the Atlas). Source, scripts and a longer methods note: <https://github.com/zheng-si/a-decade-of-rain>.

---

## 1 Why this note

I built two web pages from the HERBS file republished in Andrew Stellman's open hea-v repository (data/herbs.json, MIT licence, pinned to commit cb5948b). *A Decade of Rain* is a scroll-driven narrative of the decade; *The Herbicide Atlas of Vietnam* is an explorer in which the record plays month by month and a place or mission number returns the individual runs behind it. All numbers in this note were recomputed from that commit with the scripts in the repository.

I am sending this note because I would like the people who built HERBS to check my reading of the record. One issue became especially important while I was mapping it. The file stores each mission's entire recorded volume at a single waypoint, while the rest of the track is represented by further waypoints. If those fields are mapped literally, that bookkeeping choice becomes a spatial claim. Section 4 shows how much difference it makes; Section 6 lists the points on which I would most value your correction.

## 2 What the record says

The file contains 24,604 rows and fourteen fields. Grouped by identifiers, these make 9,141 missions and 11,273 Mission + Run pairs. The Leg field combines a number and a letter. In the 1985 record layout, the number identifies the spray track within the mission and the letter identifies the waypoint within that track (A at the start, with later letters marking turns and the stop; Christian, 1985). Most runs have two waypoints, a straight A-to-B line. The median run is a 10.9 km polyline.

**All 19,490,690 gallons are recorded on rows labelled 1A; every other leg label sums to exactly zero.** The 1985 layout defines the gallons field as the "number of gallons of herbicide dispensed during the mission cited", which makes it a mission-level field, and describes a later track number as "an additional spray track" flown on the same mission. The data behave the same way: the 2,132 later runs in multi-track missions have no 1A row and carry no volume. Among fixed-wing missions with a recorded aircraft count, the median recorded volume is 1,000 gallons per aircraft whether a mission has one track or six. A C-123's tank held 1,000 gallons.

I therefore read 1A as the bookkeeping location for a mission-level quantity: the mission's recorded volume is stored once, at the first waypoint of its first track. That is a sensible way to store the record on tape, but it should not be read as a claim that the whole mission volume was released at 1A.

**Table 1. The shape of the record at the pinned commit.**

| | |
|---|---|
| Rows (waypoint records) | 24,604 |
| Missions; Mission + Run pairs | 9,141; 11,273 |
| Gallons, all on 1A rows | 19,490,690 |
| Waypoints per run | 1: 2,691; 2: 6,385; 3: 1,080; 4 or more: 1,117 |
| Runs per mission | 1: 7,707; 2: 1,107; 3 or more: 327 |
| Median run as a polyline | 10.9 km (p25 5.4, p75 17.0, max 354.6) |
| Method, share of gallons | fixed-wing 95.4%; helicopter 3.8%; ground 0.25%; unknown 0.5% |

## 3 What I did

**Georeferencing.** Each HERBS grid reference is an eight-character military grid reference with the UTM zone omitted; Vietnam spans zones 48 and 49. For each record, I test every candidate zone and latitude band (48 and 49 by N, P, Q, R) and keep the candidate nearest a point in hea-v's 0.01° gridpoints.json lattice, provided it is within 0.05°. In practice the candidates are easy to separate: the selected one falls within about 0.01° of the lattice, while the wrong zone is roughly 6° away, usually in the sea. All 24,604 rows convert and none is dropped. I round coordinates to 0.001° (about 111 m), close to the 100 m precision of the source.

**Reconstructing runs.** I group rows by Mission and Run but keep their original file order. I do not sort by leg letter, because that would impose an ordering that is not explicit in the source. I split a run when its leg number changes. This produces 8,753 line segments from 8,545 runs, plus 2,831 single-point records from runs logged at one grid reference. I join consecutive waypoints with straight lines; the median spacing between them is 2.6 km, well below the smallest cell used on the maps.

**Spreading the volume.** HERBS does not assign quantities to individual waypoints or tell us how the spray rate changed along a track. I therefore use a constant recorded volume per unit distance as a simple baseline. For each mission, I distribute its recorded gallons across its reconstructed line tracks in proportion to length; Section 4 tests alternative rate profiles. The build includes a conservation check so that redistribution does not change the total. At the pinned commit the output is 19,490,688 gallons from an input of 19,490,690, a two-gallon difference caused by whole-gallon rounding. A run logged at one point keeps its gallons at that point.

**Why the mission is the unit.** I originally spread the gallons attached to each run along that run alone. This left the later tracks of 1,434 multi-track missions, which account for 16.7% of the recorded volume, with no volume at all. Reading Gallons as a mission-level field and distributing the mission total across all of its tracks changes 4.8% of the 3 km field relative to that first implementation. Distributing by track length rather than equally across a mission's tracks changes a further 1.3%. These are modest changes compared with the first-waypoint versus track difference in Section 4, and both corrections are now in the current build.

**What is drawn.** At national and provincial zooms, the Atlas bins the reconstructed lines into 0.12° and 0.03° cells and draws proportional dots whose area represents recorded gallons. At closer zooms it draws the lines themselves, with width proportional to recorded gallons per kilometre. The Story uses the same reconstructed lines, bins them into 0.03° cells by month, and smooths those values with a kernel. Neither page draws directly from the 1A points.

## 4 How much the booking convention changes the map

To see how much this matters, I mapped the same recorded volume in two ways over the same grid. In the first-waypoint reading, each mission's full volume stays in the cell containing 1A. In the track reading, the same mission total is distributed along its reconstructed tracks. Both sum to 19.49 million gallons, so the difference is spatial rather than quantitative. I use "volume to move" for the share of all recorded gallons that would have to change cells to turn one field into the other.

**Table 2. First-waypoint reading versus track-based reconstruction, whole record.**

| Cell | Cells with volume | Volume to move | Track cells empty at 1A | Rank correlation |
|---|---|---|---|---|
| 1 km | 4,880 → 37,257 | 83% | 88% | 0.11 |
| 3 km | 2,960 → 7,620 | 59% | 63% | 0.34 |
| 13 km | 839 → 1,017 | 26% | 19% | 0.80 |
| 28 km | 289 → 313 | 12% | 8% | 0.95 |

The difference becomes smaller as the cells get larger. At 28 km, most runs stay within a single cell, so the two readings are close. At 3 km, however, 59% of the recorded gallons change cell, and 63% of the cells that carry volume in the track reconstruction are empty in the first-waypoint reading. The first-waypoint reading is close on a thumbnail of the country and differs most at the scale where someone inspects the map closely.

The constant-rate model is only a baseline, because HERBS does not record how spray rate changed along a track. I therefore tried four alternatives: twice as much volume near the front, near the back, in the middle, or at both ends. At a 3 km cell size, none changes the reconstructed field by more than about 14% relative to the constant-rate model. This is a sensitivity test of those assumptions, not an estimate of error against the real world. By comparison, keeping each mission's full volume at 1A changes the field by 59%.

![Figure 1. One window, Zone D and Đồng Xoài, with 2,181 runs shown on the same 3 km grid and the same dot-area scale. Left: reconstructed tracks. Centre: each mission's recorded volume placed at its first waypoint. Right: the same recorded volume distributed along the tracks. Rings on the centre panel mark 496 cells that carry volume in the track reading but none in the first-waypoint reading. Together they contain 37% of the window's recorded volume. The peak cell in the first-waypoint reading contains 3.1 times as much recorded volume as the peak cell in the track reconstruction.](figures/binning-comparison.svg)

## 5 What the maps do not claim

The maps show recorded flight paths and my spatial allocation of the recorded spray volume along them. They do not estimate where herbicide landed or who was exposed: there is no model of drift, swath width, degradation, canopy or soil interception, or population. The direction of travel is also unknown. The fade along each track starts at the first waypoint in the file; it is a reading cue, not a claim about aircraft heading.

While writing the longer note, I corrected two problems in the web maps. First, I had spread volume per run rather than per mission; the correction is described above. Second, the Atlas caveat incorrectly said the record was fixed-wing only. By my reading of the Method field, the file contains 2,108 helicopter missions and 446 ground missions, together accounting for 4% of the recorded gallons, and the maps include them. The 1985 report says the original tape omitted most helicopter missions before 1968 and contained no ground-spraying records; the Services HERBS supplement was intended to add them. I cannot tell from the file how complete that supplement is.

## 6 Questions for the authors of the record

1. **Spreading across tracks.** The 1985 layout defines gallons per mission and calls a later track number another spray track on the same mission. Is my choice to distribute a mission's recorded volume by length across all of its tracks defensible? If not, how should I interpret the Gallons field for missions with multiple spray tracks?
2. **Codes the 1985 layout does not list.** What do Method S, Source A, Agent K (the layout lists Pink as R), and CTZ 5, 6 and 7 mean? The 668 rows tagged CTZ 5 plot west of the Annamite border, in Laos. What are the three two-digit fields in FWAC? I currently read the last as the number of aircraft that sprayed.
3. **Rate along the track.** Do the operational records (spray-on and spray-off points, altitude, airspeed, swath width) support a rate profile other than constant, or a swath that I should draw?
4. **Helicopter and ground coverage.** Should I map these records alongside the Ranch Hand runs as I do now, or are they incomplete enough to need a stronger caveat or separate treatment?
5. **The lattice.** Is gridpoints.json the study-area grid used in the 2003 work, and is there a published estimate of the georeferencing accuracy of the grid references?
6. **Spot checks, only if convenient.** Would you be willing to compare three places with your own maps: the A Sầu valley (the Story says 224 runs crossed it between 1965 and 1970), Biên Hòa within 5 km, and the Cà Mau peninsula?
7. **Attribution.** How would you prefer the record and the repository to be cited on the pages? The current line is "the complete record behind Stellman et al. (2003)", linked to hea-v.

## References

Christian, R. S. (1985). *Services HERBS Tape: A Record of Helicopter and Ground Spraying Missions, Aborts, Leaks, and Incidents*. Washington, DC: Headquarters, Department of the Army (DAAG-ESG), 12 September 1985.

Stellman, A. (2026). *hea-v: Herbicide Exposure Assessment, Vietnam* [data set and software]. GitHub, commit cb5948b. MIT licence. https://github.com/andrewstellman/hea-v

Stellman, J. M., Stellman, S. D., Christian, R., Weber, T., & Tomasallo, C. (2003). The extent and patterns of usage of Agent Orange and other herbicides in Vietnam. *Nature*, 422(6933), 681–687. https://doi.org/10.1038/nature01537

---

*I used an AI coding assistant during implementation and exploratory analysis; every figure in this note was recomputed from the pinned source. The full methods note is docs/methods-paper.md in the repository.*
