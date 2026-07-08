// Citation registry for the story. Each quote / claim references a source id.
// Keep this the single place where source URLs live.

export interface Source {
  id: string
  title: string
  publisher: string
  url: string
}

export const SOURCES: Record<string, Source> = {
  usaf_ranchhand: {
    id: 'usaf_ranchhand',
    title: 'Operation Ranch Hand: The Air Force and Herbicides in Southeast Asia, 1961–1971',
    publisher: 'W. A. Buckingham · U.S. Air Force Office of History',
    url: 'https://www.govinfo.gov/app/details/GOVPUB-D301-PURL-LPS48689',
  },
  va_news: {
    id: 'va_news',
    title: '10 Things Every Veteran Should Know About Agent Orange',
    publisher: 'VA News (news.va.gov)',
    url: 'https://news.va.gov/17744/10-things-every-veteran-know-agent-orange/',
  },
  aorecord_hotspots: {
    id: 'aorecord_hotspots',
    title: 'Hotspots',
    publisher: 'Agent Orange Record',
    url: 'https://www.agentorangerecord.org/hotspots',
  },
  aspen_bienhoa: {
    id: 'aspen_bienhoa',
    title: 'Dioxin Clean-up at Former American Air Base, Bien Hoa',
    publisher: 'Aspen Institute',
    url: 'https://www.aspeninstitute.org/programs/agent-orange-in-vietnam-program/dioxin-clean-former-american-air-base-bien-hoa/',
  },
  pulitzer_forest: {
    id: 'pulitzer_forest',
    title: 'Through the Forest, a Clearer View of the Needs of People',
    publisher: 'Pulitzer Center',
    url: 'https://pulitzercenter.org/stories/through-forest-clearer-view-needs-people',
  },
  stellman_2003: {
    id: 'stellman_2003',
    title:
      'The extent and patterns of usage of Agent Orange and other herbicides in Vietnam (Nature 422:681-687)',
    publisher: 'Stellman et al. 2003',
    url: 'https://www.nature.com/articles/nature01537',
  },
  va_basics: {
    id: 'va_basics',
    title: 'Facts About Herbicides',
    publisher: 'U.S. Dept. of Veterans Affairs',
    url: 'https://www.publichealth.va.gov/exposures/agentorange/basics.asp',
  },
  aso_stoten: {
    id: 'aso_stoten',
    title: 'Characteristics of PCDD/Fs in soil and sediment samples collected from A-So former airbase in Central Vietnam',
    publisher: 'Science of the Total Environment (2019)',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0048969719301792',
  },
  aspen_whatis: {
    id: 'aspen_whatis',
    title: 'What is Agent Orange?',
    publisher: 'Aspen Institute',
    url: 'https://www.aspeninstitute.org/programs/agent-orange-in-vietnam-program/what-is-agent-orange/',
  },
  nas_1974: {
    id: 'nas_1974',
    title: 'The Effects of Herbicides in South Vietnam (1974)',
    publisher: 'U.S. National Academy of Sciences',
    url: 'https://www.nal.usda.gov/exhibits/speccoll/items/show/1318',
  },
  westing_bioscience: {
    id: 'westing_bioscience',
    title: 'Ecological Effects of Military Defoliation on the Forests of South Vietnam',
    publisher: 'Westing, BioScience 21 (1971)',
    url: 'https://academic.oup.com/bioscience/article-abstract/21/17/893/226033',
  },
  usaid_danang: {
    id: 'usaid_danang',
    title: 'Dioxin Remediation at Danang Airport and Bien Hoa Airbase Area (fact sheet)',
    publisher: 'USAID',
    url: 'https://2017-2020.usaid.gov/vietnam/documents/fact-sheet-dioxin-remediation-danang-airport-and-bien-hoa-airbase-area',
  },
  usembassy_bienhoa: {
    id: 'usembassy_bienhoa',
    title: 'Fact Sheets: Dioxin Remediation at Bien Hoa Airbase Area',
    publisher: 'U.S. Embassy in Vietnam',
    url: 'https://vn.usembassy.gov/fact-sheets-dioxin-remediation-at-bien-hoa-airbase-area/',
  },
  undp_hotspots: {
    id: 'undp_hotspots',
    title: 'Comprehensive report: Agent Orange / dioxin contamination at three hotspots — Bien Hoa, Da Nang and Phu Cat airbases',
    publisher: 'UNDP Viet Nam',
    url: 'https://www.undp.org/vietnam/publications/comprehensive-report-agent-orange/dioxin-contamination-three-hotspots-bien-hoa-da-nang-and-phu-cat-airbases',
  },
  yale_e360: {
    id: 'yale_e360',
    title: 'Fifty Years After, A Daunting Cleanup of Vietnam’s Toxic Legacy',
    publisher: 'Yale Environment 360',
    url: 'https://e360.yale.edu/features/fifty-years-after-a-daunting-cleanup-of-vietnam-toxic-legacy-dioxin-agent-orange',
  },
}
