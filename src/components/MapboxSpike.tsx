// ─────────────────────────────────────────────────────────────────────────
//  Mapbox spike — a BASEMAP COMPARISON HARNESS, not a second explorer.
//
//  It renders the same ground, the same framing and the same spray record as
//  the Archive, on Mapbox Streets instead of OpenMapTiles, with the label
//  controls that OpenMapTiles cannot offer wired to live sliders.
//
//  Deliberately NOT a port of the Archive. Rebuilding the three-tier grid, the
//  agent filter, the transport and the inspect card against a second SDK
//  before deciding whether to adopt it would be doing the expensive half of
//  the migration to answer a question the cheap half already answers. What is
//  under evaluation is the basemap; everything else is ours and moves over
//  unchanged (the style spec and expression language are the same language —
//  MapLibre is a fork of mapbox-gl-js v1.13).
//
//  TO REMOVE: delete this file, MapboxSpike.css, src/config/mapboxConfig.ts,
//  the /archive-mapbox route in App.tsx, and `npm rm mapbox-gl`.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { loadSpray } from '../data/spray'
import { agentIndexColors, stampEventColors } from './volumeGrid'
import {
  MAPBOX_TOKEN,
  hasMapboxToken,
  MAPBOX_STYLES,
  SETTLEMENT_DEFAULTS,
  recordBounds,
  fitPadding,
  minZoomMargin,
  maxZoom,
} from '../config/mapboxConfig'
import './MapboxSpike.css'

const SPRAY_SOURCE = 'spray'
const SPRAY_LAYER = 'spray-raw'

/** Mapbox Streets v8 label layers we want to reach. Names are stable across
 *  the mapbox/* styles; if a style renames one, the guard below skips it
 *  rather than throwing. */
const SETTLEMENT_LAYER = 'settlement-label'
const SETTLEMENT_MINOR = 'settlement-minor-label'
const SETTLEMENT_MAJOR = 'settlement-major-label'

export default function MapboxSpike() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(0)
  const [symbolrank, setSymbolrank] = useState(SETTLEMENT_DEFAULTS.maxSymbolrank)
  const [filterrank, setFilterrank] = useState(SETTLEMENT_DEFAULTS.maxFilterrank)
  const [labelLayers, setLabelLayers] = useState<string[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !hasMapboxToken) return
    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLES.light,
      bounds: recordBounds,
      fitBoundsOptions: { padding: fitPadding },
      maxZoom,
    })
    mapRef.current = map

    map.on('zoom', () => setZoom(+map.getZoom().toFixed(2)))

    map.on('load', async () => {
      // Same floor rule as the Archive: "furthest out" means "the whole
      // record", derived from the fit rather than hard-coded.
      map.setMinZoom(map.getZoom() - minZoomMargin)
      setZoom(+map.getZoom().toFixed(2))

      // What labels does this style actually ship? The point of the spike is
      // to see the tiering, so list it rather than assume it.
      setLabelLayers(
        map
          .getStyle()
          .layers.filter((l) => l.type === 'symbol')
          .map((l) => l.id),
      )

      const spray = await loadSpray()
      const colors = agentIndexColors(spray)
      stampEventColors(spray, colors)
      map.addSource(SPRAY_SOURCE, { type: 'geojson', data: spray.features })
      map.addLayer({
        id: SPRAY_LAYER,
        type: 'circle',
        source: SPRAY_SOURCE,
        paint: {
          'circle-color': ['get', 'c'],
          'circle-opacity': 0.72,
          'circle-pitch-alignment': 'map',
          'circle-pitch-scale': 'map',
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            ['min', ['*', 0.02, ['sqrt', ['get', 'gallons']]], 10],
            12,
            ['min', ['*', 0.34, ['sqrt', ['get', 'gallons']]], 18],
          ],
        },
      })
      setReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // The dial OpenMapTiles cannot offer: settlement density as one continuous
  // filter instead of four on/off layers.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const filter = [
      'all',
      ['<=', ['coalesce', ['get', 'symbolrank'], 20], symbolrank],
      ['<=', ['coalesce', ['get', 'filterrank'], 5], filterrank],
    ] as never
    for (const id of [SETTLEMENT_LAYER, SETTLEMENT_MINOR, SETTLEMENT_MAJOR]) {
      if (map.getLayer(id)) map.setFilter(id, filter)
    }
  }, [ready, symbolrank, filterrank])

  if (!hasMapboxToken) {
    return (
      <div className="mbx-missing">
        <h1>Mapbox spike</h1>
        <p>
          No token. Put <code>VITE_MAPBOX_TOKEN=pk.…</code> in <code>.env.local</code> (local) or in
          the Vercel project&apos;s environment variables (preview/production), then reload.
        </p>
        <p>
          The token is inlined into the client bundle by Vite, so it is public by construction —
          restrict it by URL in the Mapbox account rather than treating it as a secret.
        </p>
      </div>
    )
  }

  return (
    <div className="mbx-wrap">
      <div ref={containerRef} className="mbx-map" />
      <aside className="mbx-panel">
        <p className="mbx-kicker">Mapbox spike</p>
        <h1>Streets, not OpenMapTiles</h1>
        <p className="mbx-dek">
          Same ground, same framing, same 24,604 runs as the Archive. What changes is the basemap
          underneath and the two dials on the right, which OpenMapTiles has no equivalent for.
        </p>

        <p className="mbx-stat">
          zoom <strong>{zoom}</strong>
        </p>

        <label className="mbx-field">
          <span>
            symbolrank ≤ <strong>{symbolrank}</strong>
          </span>
          <input
            type="range"
            min={4}
            max={18}
            step={1}
            value={symbolrank}
            onChange={(e) => setSymbolrank(Number(e.target.value))}
          />
          <em>Global importance, 1–18. Lower keeps only the big places.</em>
        </label>

        <label className="mbx-field">
          <span>
            filterrank ≤ <strong>{filterrank}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={filterrank}
            onChange={(e) => setFilterrank(Number(e.target.value))}
          />
          <em>Density gate, 1–5. This is the dial we do not have today.</em>
        </label>

        <details className="mbx-layers">
          <summary>{labelLayers.length} symbol layers in this style</summary>
          <ul>
            {labelLayers.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </details>

        <p className="mbx-note">
          Compare against <a href="/archive">/archive</a>. Judge the basemap, not the UI — the panel
          here is throwaway.
        </p>
      </aside>
    </div>
  )
}
