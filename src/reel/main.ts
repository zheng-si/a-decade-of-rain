// ── the reel: deterministic, frame-addressable shots ──────────────────────
// Not a page anyone reads. Each shot is a pure function of time t (seconds):
// `seek(t)` puts the map and the overlay in the state for that instant and
// resolves once MapLibre has finished drawing it, so scripts/reel/render.mjs
// can screenshot frame after frame with no dropped or half-drawn frames, which
// a screen recording of the live site cannot promise.
//
//   /reel/?shot=3          the shot, seekable from the console
//   /reel/?shot=3&t=7.5    parked at one instant (for stills)
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './reel.css'
import { mapConfig } from '../config/mapConfig'
import { resolveMapStyle, applyMapTheme, addHillshade, setHillshade, STORY_WATER } from '../components/mapTheme'
import { applyLabelCuration } from '../components/labelLayers'
import { quietBasemap } from '../components/volumeGrid'
import { shot3 } from './shot3'
import { shot7 } from './shot7'

export interface Shot {
  duration: number
  /** Camera the map is created at (before the first seek). */
  camera: { center: [number, number]; zoom: number }
  setup(map: maplibregl.Map, overlay: HTMLElement): Promise<void>
  /** Put everything in its state for time t. Synchronous; the caller waits for
   *  the map to settle. */
  apply(t: number): void
}

const SHOTS: Record<string, Shot> = { '3': shot3, '7': shot7 }

declare global {
  interface Window {
    reel: {
      ready: Promise<void>
      duration: number
      seek(t: number): Promise<void>
    }
  }
}

const params = new URLSearchParams(location.search)
const shot = SHOTS[params.get('shot') ?? '3']
if (!shot) throw new Error(`unknown shot ${params.get('shot')}`)

const DEM_SOURCE = 'terrain-dem'

async function boot(): Promise<maplibregl.Map> {
  const style = await resolveMapStyle()
  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: shot.camera.center,
    zoom: shot.camera.zoom,
    interactive: false,
    attributionControl: false,
    // No label fade: a fade is wall-clock driven and would differ between
    // frames rendered at different speeds.
    fadeDuration: 0,
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
  })
  await new Promise<void>((r) => map.once('load', () => r()))
  applyMapTheme(map)
  applyLabelCuration(map)
  quietBasemap(map, { labels: false, water: STORY_WATER })
  if (mapConfig.terrain) {
    map.addSource(DEM_SOURCE, {
      type: 'raster-dem',
      tiles: [mapConfig.terrain.demUrl],
      tileSize: 256,
      encoding: mapConfig.terrain.encoding,
      maxzoom: 15,
    })
    addHillshade(map, DEM_SOURCE)
    setHillshade(map, true, 0.28)
    // Terrarium carries bathymetry, and on a still frame the sea-floor relief
    // reads as noise. Slide the relief under the first water fill so the sea
    // stays one flat tone.
    const water = map.getStyle().layers?.find((l) => l.type === 'fill' && /water/.test(l.id))
    if (water) map.moveLayer('hillshade', water.id)
  }
  return map
}

function settle(map: maplibregl.Map): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    map.once('idle', finish)
    map.triggerRepaint()
    // A frame with nothing new to draw may never report idle again.
    setTimeout(() => {
      if (map.loaded() && !map.isMoving()) finish()
    }, 60)
    setTimeout(finish, 8000)
  })
}

const overlay = document.getElementById('overlay')!
let mapRef: maplibregl.Map | null = null

const ready = (async () => {
  await document.fonts.ready
  const map = await boot()
  mapRef = map
  await shot.setup(map, overlay)
  await document.fonts.ready
  shot.apply(0)
  await settle(map)
})()

window.reel = {
  ready,
  duration: shot.duration,
  async seek(t: number) {
    await ready
    shot.apply(t)
    await settle(mapRef!)
  },
}

const t0 = params.get('t')
if (t0 != null) ready.then(() => window.reel.seek(Number(t0)))
else if (params.has('play')) {
  // Wall-clock preview; not frame-exact.
  ready.then(() => {
    const start = performance.now()
    const tick = () => {
      const t = (performance.now() - start) / 1000
      shot.apply(Math.min(t, shot.duration))
      if (t < shot.duration) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
