import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
// T100.1: Enable bundle analysis with ANALYZE=true npm run build
var analyze = process.env.ANALYZE === 'true';
export default defineConfig({
    plugins: [
        react(),
        // T100.1: Bundle analyzer - generates stats.html when ANALYZE=true
        analyze && visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
        }),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'FreightRoll GTM Hub',
                short_name: 'FreightRoll',
                description: 'GTM Pipeline Management for Manifest 2026',
                theme_color: '#3b82f6',
                background_color: '#1f2937',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit for large bundles
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'firestore-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 // 24 hours
                            },
                            networkTimeoutSeconds: 10
                        }
                    },
                    {
                        urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'firebase-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24
                            }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        chunkSizeWarningLimit: 2500, // Increase warning limit to 2.5 MB
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
                    'vendor-charts': ['recharts'],
                    'vendor-utils': ['zod', 'fuse.js'],
                    'vendor-lucide': ['lucide-react'],
                },
            },
        },
    },
});
