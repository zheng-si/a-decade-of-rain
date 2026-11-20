// ── the reel: deterministic, frame-addressable shots ──────────────────────
// Not a page anyone reads. Each shot is a pure function of time t (seconds):
// `seek(t)` puts the map and the overlay in the state for that instant and
// resolves once MapLibre has finished drawing it, so scripts/reel/render.mjs
// can screenshot frame after frame with no dropped or half-drawn frames.
//
// The shots are built from the product itself: the Story's and the Atlas's
// own stylesheets, map functions, colour and width parameters, content and
// card art. The reel adds timing, nothing else.
//
//   /reel/?shot=3          the shot, seekable from the console
//   /reel/?shot=3&t=7.5    parked at one instant (for stills)
//   /reel/?shot=3&play     wall-clock preview (not frame-exact)
import type maplibregl from 'maplibre-gl'

export interface Shot {
  duration: number
  /** Class(es) the stage takes so the product's own stylesheet applies. */
  stageClass: string
  /** Build the map in `mapEl` and the furniture in `overlay`. */
  setup(mapEl: HTMLElement, overlay: HTMLElement): Promise<maplibregl.Map>
  /** Put everything in its state for time t. The caller waits for the map. */
  apply(t: number): void
}

const LOADERS: Record<string, () => Promise<{ shot: Shot }>> = {
  '3': () => import('./storyDecade'),
  '7': () => import('./atlasLookup'),
}

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
const key = params.get('shot') ?? '3'
if (!LOADERS[key]) throw new Error(`unknown shot ${key}`)

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

const stage = document.getElementById('stage')!
const mapEl = document.getElementById('map')!
const overlay = document.getElementById('overlay')!
let shot: Shot
let map: maplibregl.Map

const ready = (async () => {
  shot = (await LOADERS[key]()).shot
  stage.className = shot.stageClass
  window.reel.duration = shot.duration
  await document.fonts.ready
  map = await shot.setup(mapEl, overlay)
  await document.fonts.ready
  // Every <img> the overlay holds (the card art) decoded before frame 0.
  await Promise.all([...overlay.querySelectorAll('img')].map((i) => i.decode().catch(() => {})))
  shot.apply(0)
  await settle(map)
})()

window.reel = {
  ready,
  duration: 0,
  async seek(t: number) {
    await ready
    shot.apply(t)
    await settle(map)
  },
}

const t0 = params.get('t')
if (t0 != null) ready.then(() => window.reel.seek(Number(t0)))
else if (params.has('play')) {
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
