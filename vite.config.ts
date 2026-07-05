import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
