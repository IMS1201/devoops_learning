import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use /bar1/ when built for ingress/Nginx subpath; use / for direct :6789 access
  base: process.env.VITE_BASE || '/',
})
