import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    server: {
        host: true, // escuchar en todas las interfaces (localhost, 127.0.0.1, túneles)
        port: 3000,
        strictPort: false,
        allowedHosts: true, // permitir hosts de túneles (devtunnels, etc.)
        hmr: false, // desactivar websocket HMR para evitar prompts de acceso a red local en túneles
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
