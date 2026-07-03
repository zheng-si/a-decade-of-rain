// Citation registry for the story. Each quote / claim references a source id.
// Keep this the single place where source URLs live.

export interface Source {
  id: string
  title: string
  publisher: string
  url: string
}

export const SOURCES: Record<string, Source> = {
  ranchHand_wiki: {
    id: 'ranchHand_wiki',
    title: 'Operation Ranch Hand',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Operation_Ranch_Hand',
  },
  impact_wiki: {
    id: 'impact_wiki',
    title: 'Impact of Agent Orange in Vietnam',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Impact_of_Agent_Orange_in_Vietnam',
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
  aspen_whatis: {
    id: 'aspen_whatis',
    title: 'What is Agent Orange?',
    publisher: 'Aspen Institute',
    url: 'https://www.aspeninstitute.org/programs/agent-orange-in-vietnam-program/what-is-agent-orange/',
  },
}
