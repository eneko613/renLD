import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This is CRITICAL for GitHub Pages. 
  // It ensures assets are looked for relative to the current path, not the root domain.
  base: './', 
})