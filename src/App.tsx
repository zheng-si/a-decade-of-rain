import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Story from './pages/Story'
import Explore from './pages/Explore'
import './App.css'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'site-nav-link is-active' : 'site-nav-link'

/** Top-right control panel: Story/Explore tabs, plus any page controls. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <nav className="site-nav">
      <NavLink to="/" end className={linkCls}>
        Story
      </NavLink>
      <NavLink to="/explore" className={linkCls}>
        Explore
      </NavLink>
      {children && <span className="site-nav-sep" />}
      {children}
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Story />} />
        <Route path="/explore" element={<Explore />} />
      </Routes>
    </BrowserRouter>
  )
}
