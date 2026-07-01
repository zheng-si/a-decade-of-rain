import MapView from '../components/MapView'
import { TopBar } from '../App'

export default function Explore() {
  return (
    <div className="app">
      <TopBar />
      <MapView />
      <div className="intro-card">
        <p className="eyebrow">Remedial Vietnam · Explore</p>
        <h1>Agent Orange &amp; Dioxin Remediation</h1>
        <p className="lede">
          The heat map is real Operation Ranch Hand spraying (1961–1971, Stellman
          et al. 2003). Press play to watch it accumulate, isolate an agent, or
          tilt into 3D. Red rings are the major dioxin hotspot airbases.
        </p>
      </div>
    </div>
  )
}
