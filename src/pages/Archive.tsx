import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import MapView from '../components/MapView'
import { TopBar } from '../App'

// The Archive — the product face of the project: the complete HERBS record as
// a replayable, filterable map. The story is the guided tour; this is the
// stacks. Its whole view state lives in the URL (see MapView), so any view can
// be bookmarked, shared, or deep-linked from the story.
export default function Archive() {
  useEffect(() => {
    const prev = document.title
    document.title = 'The Archive · A Decade of Rain'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="app">
      <TopBar />
      <MapView />
      {/* Identity card in the story-card language (forest surface, serif
          period line, stat pill) — no kicker, same as the scrolly cards. */}
      <div className="archive-card">
        <p className="story-eyebrow">1961–1971</p>
        <h1 className="story-name">The Archive</h1>
        <p className="story-dek">Every recorded mission of Operation Ranch Hand, replayable.</p>
        <p className="story-body">
          The complete HERBS record digitised behind Stellman et&nbsp;al. (2003). Press play to
          watch the decade fall month by month, isolate an agent, or tilt the terrain into 3D —
          every view is shareable straight from the URL. Ringed markers are the three dioxin
          hotspot airbases.
        </p>
        <p className="story-stat">
          <strong>24,604</strong> missions · 19.5M gallons
        </p>
        <p className="archive-links">
          <Link to="/">← Read the story</Link>
        </p>
      </div>
    </div>
  )
}
