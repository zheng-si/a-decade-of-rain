import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Put maplibre's chunk on the first flight.
 *
 *  Both routes are lazy (see src/App.tsx), so the only module the HTML names
 *  is the entry. maplibre is reachable only through a route chunk, which means
 *  the browser cannot know it needs ~1 MB of map SDK until that chunk has been
 *  fetched AND parsed — two serial round trips before the map can even start
 *  downloading. A modulepreload in the <head> tells it immediately, and the
 *  two requests overlap instead of queueing.
 *
 *  It has to be injected rather than written into index.html by hand because
 *  the filename carries a content hash that changes with every maplibre bump.
 *  A stale hardcoded path would silently preload a 404 — the page would still
 *  work, which is exactly what makes it the kind of bug nobody notices.
 *
 *  The stylesheet goes with it. maplibre's CSS moved into an async chunk when
 *  the routes split, and it is what positions the controls and the compass; a
 *  frame of unpositioned furniture over the map is worth one <link> to avoid. */
function preloadMaplibre(): Plugin {
  return {
    name: 'preload-maplibre',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return
        const tags = []
        for (const [file, chunk] of Object.entries(ctx.bundle)) {
          if (!file.includes('maplibre')) continue
          if (file.endsWith('.js') && chunk.type === 'chunk') {
            tags.push({
              tag: 'link',
              attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
              injectTo: 'head' as const,
            })
          } else if (file.endsWith('.css')) {
            tags.push({
              tag: 'link',
              // crossorigin to MATCH the request Vite's stylesheet link makes:
              // a preload whose credentials mode differs from the eventual
              // fetch is discarded, and this file downloaded twice (~10 KB and
              // 4-5 console warnings per load).
              attrs: { rel: 'preload', as: 'style', crossorigin: true, href: `/${file}` },
              injectTo: 'head' as const,
            })
          }
        }
        return tags
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadMaplibre()],
  build: {
    rolldownOptions: {
      output: {
        // MapLibre is ~half the bundle and never changes with app code:
        // its own chunk loads in parallel and stays cached across deploys.
        advancedChunks: {
          groups: [{ name: 'maplibre', test: /node_modules[\/]maplibre-gl/ }],
        },
      },
    },
  },
  // host: true lets the dev server be reachable from GitHub Codespaces /
  // other cloud IDEs (binds 0.0.0.0 instead of localhost).
  server: {
    host: true,
  },
})
