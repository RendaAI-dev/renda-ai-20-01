
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          icons: ['lucide-react'],
          animations: ['framer-motion'],
          charts: ['recharts'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          routing: ['react-router-dom'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    // Enable compression and optimize chunks
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    target: 'es2020'
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Renda AI',
        short_name: 'Renda AI',
        description: 'Gerencie suas finanças com o Renda AI',
        theme_color: '#4ECDC4',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        categories: ['finance', 'productivity']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,ttf,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
        runtimeCaching: [
          {
            urlPattern: ({url}) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            urlPattern: ({url}) => url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico)$/),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ],
        // Adicionar esta configuração para lidar com todas as rotas de navegação
        navigateFallback: 'index.html',
        // Opcionalmente, você pode excluir algumas rotas da navegação fallback
        // navigateFallbackDenylist: [/^\/api\//]
      },
      devOptions: {
        enabled: true,
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
