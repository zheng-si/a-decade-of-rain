import { useEffect, useState } from 'react'
import { BIOHAZARD } from './biohazard'
import { getTheme, toggleTheme, type Theme } from '../theme'
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
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
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
      </div>

      {/* Theme switch: its own cell between the contents and the credits.
          Icon + label name the mode the button switches TO. */}
      <div className="story-rail-theme-wrap">
        <button
          type="button"
          className="story-rail-theme"
          aria-pressed={theme === 'dark'}
          onClick={() => setThemeState(toggleTheme())}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4.4" />
              <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8Z" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>

      <div className="story-rail-foot">
        <p>Data &amp; reporting</p>
        <img src={usaidWhite} alt="USAID" />
        <p className="story-rail-foot-more">UNDP · U.S. National Archives</p>
      </div>
    </nav>
  )
}
