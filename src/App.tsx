import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import Story from './pages/Story'
import Archive from './pages/Archive'
import './App.css'

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
        <Route path="/explore" element={<LegacyExploreRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
