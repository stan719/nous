import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' pozwala hostować build w dowolnym podkatalogu (np. GitHub Pages /nous/)
export default defineConfig({
  base: './',
  define: {
    // znacznik wersji widoczny w „Twoich mapach” (data i godzina builda, UTC)
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Nous — mapa myśli',
        short_name: 'Nous',
        description: 'Prywatna mapa myśli działająca w pełni lokalnie.',
        lang: 'pl',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0b',
        theme_color: '#0a0a0b',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // czcionki .ttf są potrzebne do PDF także offline
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ttf}'],
      },
    }),
  ],
  server: { host: true },
})
