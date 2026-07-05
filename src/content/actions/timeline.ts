// Act II — "The Timeline": the remediation programme year by year, 2009–2020.
// From the Đà Nẵng MOU through the finished cleanup and the hand-off to
// Biên Hòa. Milestones follow USAID / U.S. Embassy Vietnam public reporting
// (see sourceIds); the 2009 entries reproduce the project's Figma copy.

export interface TimelineYear {
  year: number
  events: string[]
}

export const TIMELINE: TimelineYear[] = [
  {
    year: 2009,
    events: [
      'USAID and Office 33 sign a Memorandum of Understanding establishing the framework for the Đà Nẵng Airport Remediation Project.',
      'USAID begins preparing an Environmental Assessment (EA) to assess the extent of dioxin contamination and approaches to remediate Đà Nẵng Airport.',
    ],
  },
  {
    year: 2010,
    events: [
      'Field sampling for the assessment maps where the dioxin actually sits: the former mixing, loading and storage areas, and the lake sediments beside them.',
    ],
  },
  {
    year: 2011,
    events: [
      'The Environmental Assessment is completed. In-pile thermal desorption, heating the soil until the dioxin molecule breaks apart, is selected as the treatment technology.',
    ],
  },
  {
    year: 2012,
    events: [
      'Ground is broken at Đà Nẵng in August: the first full-scale dioxin cleanup in Vietnam officially begins.',
    ],
  },
  {
    year: 2013,
    events: [
      'The treatment structure rises: a sealed above-ground pile the size of a football field. Excavation begins, and the first ~45,000 m³ of soil and sediment are loaded in.',
    ],
  },
  {
    year: 2014,
    events: [
      'Phase 1 heating switches on in April. Electrodes warm the pile to about 335 °C and hold it there for months, breaking the dioxin down inside the soil.',
    ],
  },
  {
    year: 2015,
    events: [
      'Phase 1 finishes with the dioxin destroyed; the treated soil is tested, cleared and unloaded.',
      'Phase 2 excavation begins, and the estimate of contaminated soil keeps growing.',
    ],
  },
  {
    year: 2016,
    events: [
      'Phase 2 loading: the remaining soil and dredged lake sediment go into the pile, bringing the treated total towards ~90,000 m³.',
    ],
  },
  {
    year: 2017,
    events: [
      'Phase 2 heating runs its course. Roughly 50,000 m³ of lightly contaminated soil is sealed under an engineered containment area on site instead of being heated.',
    ],
  },
  {
    year: 2018,
    events: [
      'November: the Đà Nẵng project is declared complete, with about 90,000 m³ treated, 50,000 m³ contained and roughly US$110 million spent. The land is handed back to expand the airport.',
    ],
  },
  {
    year: 2019,
    events: [
      'The front line moves south. In April the United States and Vietnam launch the Biên Hòa cleanup: roughly 500,000 m³ of contaminated soil, four times Đà Nẵng, planned to take a decade.',
    ],
  },
  {
    year: 2020,
    events: [
      'First soil moves at Biên Hòa: excavation begins in the most contaminated areas, and the long-term treatment and containment sites take shape. The work continues today.',
    ],
  },
]

export const TIMELINE_HEAD = {
  eyebrow: 'Act II · The timeline',
  title: 'Remediation Project Timeline',
  dek: 'Eleven years from a signature to a finished cleanup, and the start of a bigger one. Step through the years to follow the work from paper to soil.',
  note: 'Milestones from USAID and U.S. Embassy Vietnam fact sheets on the Đà Nẵng and Biên Hòa projects.',
  sourceId: 'usaid_danang',
}
