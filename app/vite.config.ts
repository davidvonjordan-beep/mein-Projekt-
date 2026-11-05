import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // `npm run build:demo`: alles in eine HTML-Datei (z. B. zum Teilen als Artifact)
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
  server: {
    // API-Aufrufe im Entwicklungsmodus an den GolfMap-Server weiterleiten
    proxy: { '/api': 'http://localhost:3001' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3001' },
  },
}))
