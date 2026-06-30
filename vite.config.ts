import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // host: true lets the dev server be reachable from GitHub Codespaces /
  // other cloud IDEs (binds 0.0.0.0 instead of localhost).
  server: {
    host: true,
  },
})
