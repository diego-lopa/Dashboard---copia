import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    server: {
        host: '127.0.0.1', // localhost IPv4 para evitar problemas con Brave/proxy en Windows
        port: 3000,
        strictPort: false,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/osm': {
                target: 'https://tile.openstreetmap.org',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/osm/, ''),
                headers: { 'User-Agent': 'CORNEA/1.0 (+https://github.com/neutroninsights/cornea)' },
            },
        },
    },
})
