import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.app'], // autorise tous les sous-domaines ngrok
  },
})
