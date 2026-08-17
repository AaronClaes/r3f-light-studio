import react from '@vitejs/plugin-react'
import { lightStudio } from 'r3f-light-studio/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), lightStudio('src/lights.json')],
  server: { port: 5173 },
})
