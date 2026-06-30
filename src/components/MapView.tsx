import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HOTSPOTS, VIETNAM_VIEW } from '../data/hotspots'
import { loadSpray } from '../data/spray'

// OpenFreeMap provides free vector tiles + styles with no API key required.
// https://openfreemap.org
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

const SPRAY_SOURCE = 'spray'
const SPRAY_LAYER = 'spray-heat'

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: VIETNAM_VIEW.center,
      zoom: VIETNAM_VIEW.zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Spray heat map: load the data, then add a heatmap layer weighted by the
    // gallons sprayed at each run (see src/data/spray.ts).
    Promise.all([
      loadSpray(),
      new Promise<void>((resolve) => map.once('load', () => resolve())),
    ]).then(([spray]) => {
      if (!mapRef.current) return

      map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
      map.addLayer({
        id: SPRAY_LAYER,
        type: 'heatmap',
        source: SPRAY_SOURCE,
        paint: {
          'heatmap-weight': ['get', 'w'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 9, 2.5],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 7, 18, 10, 40],
          'heatmap-opacity': 0.85,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.15, 'rgba(254,235,178,0.55)',
            0.4, 'rgb(254,196,79)',
            0.65, 'rgb(240,128,40)',
            0.85, 'rgb(214,69,40)',
            1, 'rgb(150,20,20)',
          ],
        },
      })
    })

    // Add a marker + popup for each dioxin hotspot airbase.
    HOTSPOTS.forEach((h) => {
      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
        `<strong>${h.name}</strong><br/><span style="font-size:12px;color:#555">${h.note}</span>`,
      )
      new maplibregl.Marker({ color: '#d6453d' })
        .setLngLat([h.lng, h.lat])
        .setPopup(popup)
        .addTo(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="map-root" />
}
