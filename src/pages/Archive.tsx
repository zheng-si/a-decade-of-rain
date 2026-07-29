import { useEffect } from 'react'
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
      {/* The identity block now lives inside MapView's control panel — one
          frosted card carries the title, transport and the volume chart. */}
      <MapView />
    </div>
  )
}
