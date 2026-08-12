import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './App.css'

// The two surfaces are split, not statically imported, and the reason is that
// they barely overlap: the Story is eleven acts of scrollytelling with its own
// photo set, the Archive is a data explorer with a timeline and an inspect
// card. A reader who lands on one was downloading the other for nothing. Split,
// each route fetches its own chunk while the shell paints.
//
// maplibre is the exception that has to be handled by hand. It is the single
// biggest thing either route needs, it is already its own chunk (see
// vite.config.ts), and with the routes split it is no longer reachable from
// the entry — the browser would learn about it only after a route chunk
// parsed, serialising ~1 MB behind a second round trip. The modulepreload in
// index.html puts that request back on the first flight, in parallel with the
// route chunk instead of after it.
const Story = lazy(() => import('./pages/Story'))
const Archive = lazy(() => import('./pages/Archive'))

// The Story/Archive tab pill that used to live here is gone. It was exported
// and rendered by nothing — each surface grew its own way across: the Story's
// rail carries "Explore the Record", the Archive's panel carries "Read the
// Story". Two cross-links in the places a reader is already looking beat one
// floating pill in a corner, and the pill had stopped being drawn long before
// this deleted it.
//
// The /archive-mapbox spike is gone too. It answered its question — the
// verdict and the numbers behind it live in docs/mapbox-evaluation.md — and
// left ~800 kB of a second map SDK in node_modules to keep answering it.

/** The Archive lived at /explore in earlier versions — keep old links working
 *  (including any query string, which is the Archive's whole view state). */
function LegacyExploreRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/archive${search}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Deliberately blank rather than a spinner. Both routes open on paper
          and fade their own map in; a flash of loading furniture in the
          fraction of a second before that would be a worse first frame than
          the paper itself. */}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Story />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/explore" element={<LegacyExploreRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
