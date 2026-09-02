# Where the Herbicide Fell: A Note on Reading HERBS as Flight Tracks

## What we did with the record behind *A Decade of Rain* and *The Herbicide Atlas of Vietnam*

Si Zheng
Draft for comment, September 2026. Prepared for Jeanne Mager Stellman and Andrew B. Stellman.
Live pages: <https://adecadeofrain.sizheng.me/> (the Story) and <https://adecadeofrain.sizheng.me/archive> (the Atlas). Source, scripts and a longer methods note: <https://github.com/zheng-si/a-decade-of-rain>.

---

## 1 Why this note

Two web pages draw the HERBS file as republished in Andrew Stellman's open hea-v repository (data/herbs.json, MIT licence, pinned to commit cb5948b): a scroll-driven narrative of the decade, and an explorer in which the decade plays month by month and any place or mission number returns the individual runs behind it. Every number below was recomputed from that commit with the scripts in the repository.

This note exists to let the people who built HERBS check what we have done with it. One thing we found seems worth your attention on its own: the file books each mission's entire volume at a single waypoint while recording the track as a chain of further waypoints, and a map drawn straight from the fields inherits that convention without saying so. Section 3 measures what that costs. Section 6 lists the questions we would most value an answer to.

## 2 What the record says

The file has 24,604 rows and fourteen fields. Grouped, they are 9,141 missions and 11,273 Mission + Run pairs. The Leg field is a number and a letter: the number is the spray track within the mission, the letter the waypoint within the track (A the start, later letters the turns and the stop), which is how the 1985 record layout describes columns 60 to 62 (Christian, 1985). A run is therefore a chain of waypoints; the most common run has two, a straight line from A to B, and the median run is a 10.9 km polyline.

**All 19,490,690 gallons sit on rows labelled 1A. Every other leg label sums to exactly zero.** The layout defines the gallons field as the "number of gallons of herbicide dispensed during the mission cited", a per-mission quantity, and describes a successive track number as "an additional spray track" flown on the same mission. The file agrees: the 2,132 runs that have no 1A row, all of them the second and later tracks of multi-track missions, carry no volume, and among fixed-wing missions with a recorded aircraft count the median volume per aircraft is 1,000 gallons whether the mission flew one track or six. A C-123's tank held 1,000 gallons.

So the file books a mission's whole load once, against the first waypoint of its first track. This is an accounting convention, and a sensible one for a tape. It is not a statement about where the herbicide fell.

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

## 3 What we did

**Georeferencing.** The grid references are eight-character military grid references with the UTM zone omitted, and the country spans zones 48 and 49. We convert each reference under every candidate zone and latitude band (48 and 49 by N, P, Q, R) and keep the candidate that lands nearest a point of the 0.01° lattice in hea-v's gridpoints.json, accepting it only within 0.05°. The correct zone lands within about 0.01° of the lattice; the wrong one lands roughly 6° away, in the sea. All 24,604 rows convert and none is dropped. Coordinates are rounded to 0.001°, about 111 m, close to the 100 m precision of the source.

**Reconstructing runs.** Rows are grouped by Mission and Run in the file's own order (sorting by the leg letter would be a second opinion about the flight path), and a run is split where its leg number changes. That gives 8,753 line segments from 8,545 runs, plus 2,831 single-point records from runs logged at one grid reference. Consecutive waypoints are joined by straight lines; the median spacing between them is 2.6 km, well inside the smallest cell any map uses.

**Spreading the volume.** Each mission's gallons are spread along every line track the mission flew, in proportion to length, on the physical argument that an aircraft with the valve open lays down a roughly constant amount per kilometre. Totals are conserved: the build asserts that the gallons leaving by every door equal the gallons that came in, and at the pinned commit the balance is 19,490,688 against 19,490,690, the difference being whole-gallon rounding. A run logged at one point keeps its gallons at that point.

The choice of *mission* rather than *run* as the unit follows the layout. We first spread each run's gallons along that run alone, which left the later tracks of the 1,434 multi-track missions (16.7% of the volume) carrying nothing; spreading per mission moves 4.8% of the volume at a 3 km cell relative to that. Spreading by length rather than equally across a mission's tracks moves a further 1.3%. Both corrections are small next to the one in Section 3, and both are now in the shipped files.

**What is drawn.** At national and provincial zooms the Atlas bins the reconstructed lines into cells of 0.12° and 0.03° and draws dots whose area is proportional to gallons; close in, it draws the lines themselves, with width proportional to gallons per kilometre. The Story's field is the same lines binned into 0.03° cells by month and smoothed with a kernel. Nothing on either page is drawn from the 1A points directly.

## 4 How much the booking convention matters

We compared two readings of the same file over the same cells: the volume booked at the mission's first waypoint, and the volume spread along the mission's tracks. Both carry 19.49 million gallons; the disagreement is purely spatial. "Volume to move" is the share of all gallons that would have to be relocated to turn one field into the other.

**Table 2. Booked at the first waypoint versus spread along the tracks, whole record.**

| Cell | Cells with volume | Volume to move | Dosed cells read as zero | Rank correlation |
|---|---|---|---|---|
| 1 km | 4,880 → 37,257 | 83% | 88% | 0.11 |
| 3 km | 2,960 → 7,620 | 59% | 63% | 0.34 |
| 13 km | 839 → 1,017 | 26% | 19% | 0.80 |
| 28 km | 289 → 313 | 12% | 8% | 0.95 |

The disagreement dies at the scale of a run. Above about 28 km a run stays inside its own cell and the convention stops mattering; at 3 km, the Atlas's fine cell, 59% of the gallons sit somewhere else and 63% of the cells that received herbicide read as zero. The booked reading is nearly right on a thumbnail of the country and worst exactly where someone looks closely.

Spreading along the track assumes a constant rate, which is an assumption, so we pushed it. Under rate profiles twice as heavy at the front or the back of each track, the field moves 14% at 3 km relative to constant rate; middle-heavy or ends-heavy, 7%. Booking at the first waypoint sits at 59%, roughly four times outside that whole envelope. Within the family of readings the record itself admits, that the herbicide fell somewhere along the recorded track, the answer is settled to about ±14%; the booked reading is not one plausible reading among several.

![Figure 1. One window, Zone D and Đồng Xoài, 2,181 runs on the same 3 km cells and the same dot-area scale: the record as recorded (left), the volume booked at each mission's first waypoint (centre), and the volume spread along the tracks (right). Rings on the centre panel mark the 496 cells that were dosed and that reading leaves empty; 37% of the window's volume lies in them, and the booked reading's hottest cell is 3.1 times hotter than any ground was.](figures/binning-comparison.svg)

## 5 What the maps do not claim

They show where the record says herbicide was released, not where it landed or whom it reached: no drift, no swath width, no degradation, no canopy or soil interception, no population. Direction is not known; the fade along each track runs from the first waypoint on file, a reading cue and not a heading claim.

Two things we corrected while writing the longer note: the maps had spread volume per run rather than per mission (above), and the Atlas's caveat said the record was fixed-wing only. By our reading of the Method field the file holds 2,108 helicopter and 446 ground missions, 4% of the gallons, and the maps draw them; the caveat now says so. The 1985 report says the original tape lacked most helicopter missions before 1968 and had nothing on ground spraying, which the Services HERBS supplement set out to add. How complete that supplement is, we cannot tell from the file.

## 6 Questions for the authors of the record

1. **Spreading across tracks.** The layout records gallons per mission and calls a successive track number a further spray track on the same mission. Is spreading that load by length across all of the mission's tracks a defensible reading, or did the load typically go down on the first track?
2. **Codes the 1985 layout does not list.** What do Method S, Source A, Agent K (the layout lists Pink as R) and CTZ 5, 6 and 7 denote? The 668 rows tagged CTZ 5 plot west of the Annamite border, in Laos. And what are the three two-digit fields of FWAC? We read the last as the number of aircraft that sprayed.
3. **Rate along the track.** Does the operational record (spray-on and spray-off points, altitude, airspeed, swath width) argue for a rate profile other than constant, or for a swath we should draw?
4. **Helicopter and ground coverage.** Should those records be mapped alongside the Ranch Hand runs as we now do, or are they incomplete enough to need a stronger caveat or a separate treatment?
5. **The lattice.** Is gridpoints.json the study-area grid of the 2003 work, and is there a published estimate of the georeferencing accuracy of the grid references?
6. **Spot checks.** Would you compare three places against your own maps: the A Sầu valley (the Story says 224 runs crossed it between 1965 and 1970), Biên Hòa within 5 km, and the Cà Mau peninsula?
7. **Attribution.** How would you like the record and the repository cited on the pages? The current line is "the complete record behind Stellman et al. (2003)", linked to hea-v.

## References

Christian, R. S. (1985). *Services HERBS Tape: A Record of Helicopter and Ground Spraying Missions, Aborts, Leaks, and Incidents*. Washington, DC: Headquarters, Department of the Army (DAAG-ESG), 12 September 1985.

Stellman, A. (2026). *hea-v: Herbicide Exposure Assessment, Vietnam* [data set and software]. GitHub, commit cb5948b. MIT licence. https://github.com/andrewstellman/hea-v

Stellman, J. M., Stellman, S. D., Christian, R., Weber, T., & Tomasallo, C. (2003). The extent and patterns of usage of Agent Orange and other herbicides in Vietnam. *Nature*, 422(6933), 681–687. https://doi.org/10.1038/nature01537

---

*Prepared with the help of an AI coding assistant; every figure was recomputed from the pinned source. The full methods note is docs/methods-paper.md in the repository.*
