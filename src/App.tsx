import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Story from './pages/Story'
import Archive from './pages/Archive'
import './App.css'

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
      <Routes>
        <Route path="/" element={<Story />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/explore" element={<LegacyExploreRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
