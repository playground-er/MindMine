import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite does not read PORT on its own; honouring it lets the dev server be
// started on an assigned port when 5173 is already taken.
const port = process.env.PORT ? Number(process.env.PORT) : 5173

export default defineConfig({
  plugins: [react()],
  server: { port },
})
