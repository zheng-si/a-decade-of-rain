import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapConfig } from '../config/mapConfig'
import { HOTSPOTS } from '../content/actions/hotspots'

// Marker colour per cleanup status, matching each card's top border.
const STATUS_COLOR: Record<string, string> = {
  Completed: '#3f8f5f',
  Ongoing: '#cf3720',
  Contained: '#5a7ca8',
}

// A static locator map for Act II: the three dioxin hotspot air bases pinned
// down the central-southern coast. Non-interactive — it orients, it doesn't
// invite exploration (the Act I map already does that).
export default function ActionsMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    // Reuse the site basemap; swap in the self-hosted glyphs like MapView does.
    async function resolveStyle(): Promise<string | maplibregl.StyleSpecification> {
      if (!mapConfig.glyphsUrl) return mapConfig.baseStyleUrl
      const resp = await fetch(mapConfig.baseStyleUrl)
      const style = (await resp.json()) as maplibregl.StyleSpecification
      style.glyphs = mapConfig.glyphsUrl
      return style
    }

    resolveStyle()
      .then((style) => {
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [107.8, 13.5],
          zoom: 5.3,
          interactive: false,
          attributionControl: { compact: true },
        })
        mapRef.current = map

        map.once('load', () => {
          const b = new maplibregl.LngLatBounds()
          HOTSPOTS.forEach((h) => b.extend(h.lngLat))
          map.fitBounds(b, {
            padding: { top: 54, bottom: 54, left: 64, right: 64 },
            maxZoom: 7,
            duration: 0,
          })
        })

        HOTSPOTS.forEach((h) => {
          const el = document.createElement('div')
          el.className = `act2-pin is-${h.status.toLowerCase()}`
          el.style.setProperty('--pin', STATUS_COLOR[h.status] ?? '#647468')
          el.innerHTML =
            `<span class="act2-pin-label">${h.name}</span>` + `<span class="act2-pin-dot"></span>`
          new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(h.lngLat).addTo(map)
        })
      })
      .catch(() => {
        /* basemap tiles unreachable (e.g. offline preview) — pins still render */
      })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="act2-map-root"
      role="img"
      aria-label="Locator map of the three dioxin hotspot air bases: Đà Nẵng, Phú Cát and Biên Hòa, down Vietnam’s central and southern coast"
    />
  )
}
