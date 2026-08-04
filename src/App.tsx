import type { ReactNode } from 'react'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import Story from './pages/Story'
import Archive from './pages/Archive'
import './App.css'

// TEMPORARY — basemap-vendor spike, unlinked from the nav. See the header of
// MapboxSpike.tsx and docs/mapbox-evaluation.md.
//
// Lazily, and that is not a detail: mapbox-gl is ~800 kB of JS that only this
// route uses. Imported statically it lands in the entry chunk and every reader
// of the Story downloads a second map SDK to look at photographs. Split out,
// the spike costs nothing to anyone who does not open it.
const MapboxSpike = lazy(() => import('./components/MapboxSpike'))

const linkCls = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'site-nav-link is-active' : 'site-nav-link'

/** Top-right control panel: Story/Archive tabs, plus any page controls. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <nav className="site-nav">
      <NavLink to="/" end className={linkCls}>
        Story
      </NavLink>
      <NavLink to="/archive" className={linkCls}>
        Archive
      </NavLink>
      {children && <span className="site-nav-sep" />}
      {children}
    </nav>
  )
}

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
        {/* Not in the nav on purpose — reachable by URL while the vendor
            question is open, and deleted with the spike either way. */}
        <Route
          path="/archive-mapbox"
          element={
            <Suspense fallback={null}>
              <MapboxSpike />
            </Suspense>
          }
        />
        <Route path="/explore" element={<LegacyExploreRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
