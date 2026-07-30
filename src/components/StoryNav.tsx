import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BIOHAZARD } from './biohazard'
import usaidWhite from '../assets/brand/usaid-white.png'

// Persistent left rail: a table of contents for the (now long) story. Each
// live item scrolls to its section anchor; the active item tracks the scroll.
// "Upcoming" items (Interlude / Act II) are shown but disabled until built.
interface NavItem {
  id: string
  label: string
  upcoming?: boolean
}
interface NavGroup {
  act: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    act: 'Act 1',
    items: [
      { id: 'sec-facts', label: 'The Facts' },
      { id: 'sec-missions', label: 'The Missions' },
      { id: 'sec-rainbow', label: 'The Herbicides' },
      { id: 'sec-ecosystems', label: 'The Ecosystems' },
    ],
  },
  {
    act: 'Interlude',
    items: [
      { id: 'sec-land', label: 'The Land' },
      { id: 'sec-body', label: 'The Body' },
    ],
  },
  {
    act: 'Act 2',
    items: [
      { id: 'sec-actions', label: 'The Hotspots' },
      { id: 'sec-alternatives', label: 'The Alternatives' },
      { id: 'sec-methods', label: 'The Methods' },
      { id: 'sec-timeline', label: 'The Timeline' },
    ],
  },
  {
    act: 'Epilogue',
    items: [
      { id: 'sec-close', label: 'Take Action' },
      { id: 'sec-sources', label: 'Sources' },
    ],
  },
]

const LIVE = NAV.flatMap((g) => g.items).filter((i) => !i.upcoming)

export default function StoryNav() {
  const [active, setActive] = useState(LIVE[0].id)
  // The rail stays hidden over the banner (the big centred title carries the
  // name there) and slides in once the reader scrolls into the story.
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Active = the last section whose top has crossed the viewport's 40% line.
    const onScroll = () => {
      const line = window.innerHeight * 0.4
      let cur = LIVE[0].id
      for (const it of LIVE) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top <= line) cur = it.id
      }
      setActive(cur)
      setShown(window.scrollY > window.innerHeight * 0.55)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const go = (it: NavItem) => {
    if (it.upcoming) return
    document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className={`story-rail${shown ? ' is-shown' : ''}`} aria-label="Story sections">
      <a
        className="story-rail-mark"
        href="#top"
        onClick={(e) => {
          e.preventDefault()
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      >
        <svg viewBox="0 0 38 35" className="story-rail-bio" fill="currentColor" aria-hidden="true">
          {BIOHAZARD.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
        <span>
          A Decade
          <br />
          of Rain
        </span>
      </a>

      <div className="story-rail-body">
        {NAV.map((g) => (
          <div className="story-rail-group" key={g.act}>
            <p className="story-rail-act">{g.act}</p>
            <ul>
              {g.items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    className={`story-rail-link${active === it.id ? ' is-on' : ''}${it.upcoming ? ' is-upcoming' : ''}`}
                    aria-current={active === it.id ? 'true' : undefined}
                    disabled={it.upcoming}
                    onClick={() => go(it)}
                  >
                    <span className="story-rail-label">{it.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* TEMPORARY cross-link. The Archive already links back ("← Read the
            Story" in its panel) but the story had no way in. This is a plain
            rail entry until M4 builds the real story↔archive deep links
            (jumping to the moment in the record the current section is
            describing). A Link, not a scroll button — it leaves the page. */}
        <div className="story-rail-group">
          <p className="story-rail-act">The Record</p>
          <ul>
            <li>
              <Link className="story-rail-link story-rail-out" to="/archive">
                <span className="story-rail-label">Archive</span>
                <span className="story-rail-out-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="story-rail-foot">
        <p>Data and Reporting</p>
        <img src={usaidWhite} alt="USAID" />
        <p className="story-rail-foot-more">UNDP · U.S. National Archives</p>
      </div>
    </nav>
  )
}
