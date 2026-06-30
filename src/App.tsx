import MapView from './components/MapView'
import './App.css'

function App() {
  return (
    <div className="app">
      <MapView />
      <div className="intro-card">
        <p className="eyebrow">Remedial Vietnam · GIS prototype</p>
        <h1>Agent Orange &amp; Dioxin Remediation</h1>
        <p className="lede">
          Red markers are the major dioxin hotspot airbases — click them. The
          heat map is real Operation Ranch Hand spraying (1961–1971, Stellman
          et al. 2003); press play to watch it accumulate, or isolate an agent.
        </p>
      </div>
    </div>
  )
}

export default App
