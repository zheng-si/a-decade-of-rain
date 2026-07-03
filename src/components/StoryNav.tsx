import { useEffect, useState } from 'react'
import { BIOHAZARD } from './biohazard'

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
      { id: 'sec-missions', label: 'The Spraying Missions' },
      { id: 'sec-rainbow', label: 'The Rainbow Herbicides' },
      { id: 'sec-ecosystems', label: 'The War-disrupted Ecosystems' },
    ],
  },
  { act: 'Interlude', items: [{ id: 'sec-consequences', label: 'The Consequences' }] },
  { act: 'Act 2', items: [{ id: 'sec-actions', label: 'The Actions' }] },
]

const LIVE = NAV.flatMap((g) => g.items).filter((i) => !i.upcoming)

export default function StoryNav() {
  const [active, setActive] = useState(LIVE[0].id)

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
    <nav className="story-rail" aria-label="Story sections">
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
                    <span className="story-rail-caret" aria-hidden="true">
                      ▸
                    </span>
                    <span className="story-rail-label">{it.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
