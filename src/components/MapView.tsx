import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HOTSPOTS, VIETNAM_VIEW } from '../data/hotspots'

// OpenFreeMap provides free vector tiles + styles with no API key required.
// https://openfreemap.org
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

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
