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
      <div className="intro-card">
        <p className="eyebrow">A Decade of Rain · The Archive</p>
        <h1>Every recorded mission, 1961–1971</h1>
        <p className="lede">
          The complete HERBS record of Operation Ranch Hand — 24,604 herbicide runs, digitised
          behind Stellman et&nbsp;al. (2003). Press play to watch the decade accumulate, isolate an
          agent, or tilt the terrain into 3D. Ringed markers are the three dioxin hotspot airbases.
        </p>
        <p className="intro-links">
          <Link to="/">← Read the story</Link>
        </p>
      </div>
    </div>
  )
}
