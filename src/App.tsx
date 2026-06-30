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
          Interactive map prototype. Red markers are the major dioxin hotspot
          airbases — click them. Next: real Operation Ranch Hand spray data on a
          time axis, then scrollytelling narrative.
        </p>
      </div>
    </div>
  )
}

export default App
