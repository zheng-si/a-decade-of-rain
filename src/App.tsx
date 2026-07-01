import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Story from './pages/Story'
import Explore from './pages/Explore'
import './App.css'

function Nav() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'site-nav-link is-active' : 'site-nav-link'
  return (
    <nav className="site-nav">
      <NavLink to="/" end className={cls}>
        Story
      </NavLink>
      <NavLink to="/explore" className={cls}>
        Explore
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Story />} />
        <Route path="/explore" element={<Explore />} />
      </Routes>
    </BrowserRouter>
  )
}
