import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

// Packages pulled in only by the lazy AR page (@react-three/xr stack + its
// transitive deps) — routed to vendor_xr so they load on demand and never
// inflate the eagerly-loaded vendor_shared chunk.
const XR_PACKAGES = new Set([
  "@react-three/xr",
  "@pmndrs/xr",
  "@pmndrs/pointer-events",
  "@pmndrs/handle",
  "iwer",
  "@iwer/devui",
  "@iwer/sem",
  "meshline",
  "suspend-react",
  "tunnel-rat",
  "gl-matrix",
  "@fortawesome/fontawesome-svg-core",
  "@fortawesome/free-solid-svg-icons",
  "@fortawesome/react-fontawesome",
  "@fortawesome/fontawesome-common-types",
  "styled-components",
  "@emotion/is-prop-valid",
  "@emotion/memoize",
  "camelize",
  "case-anything",
  "css-color-keywords",
  "css-to-react-native",
  "stylis",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Preload the three.js vendor chunks from the HTML parse phase, before the
 * lazy SolarSystem chunk that imports them has even been requested. three
 * (~600KB min split across chunks) is the largest module in the graph — 
 * fetching it in parallel with the entry bundles shaves 1 round-trip off scene boot.
 */
function preloadThreeChunk(): Plugin {
  return {
    name: "preload-three-chunk",
    apply: "build",
    transformIndexHtml(_html, ctx) {
      const bundle = (ctx as { bundle?: Record<string, { fileName?: string }> }).bundle;
      if (!bundle) return undefined;
      
      // Preload three.js core and react integration chunks
      const chunks = Object.keys(bundle).filter(
        (k) => (k.startsWith("vendor_three_") && k.endsWith(".js"))
      );
      
      if (chunks.length === 0) return undefined;
      
      return chunks.map(entry => ({
        tag: "link",
        attrs: { rel: "modulepreload", href: `/assets/${entry}` },
        injectTo: "head-prepend" as const,
      }));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadThreeChunk(),
    visualizer({ filename: "stats.html", open: false }),
    
    // PWA with offline support
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-96x96.png', 'icons/*.png', 'draco/*.wasm'],
      
      manifest: {
        name: 'Solar System · Cinematic 3D Tour',
        short_name: 'Solar System',
        description: 'An interactive 3D solar system with cinematic camera tour through 29+ celestial bodies and NASA spacecraft',
        theme_color: '#070814',
        background_color: '#02030a',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        shortcuts: [
          {
            name: 'Orrery in Your Space',
            short_name: 'Orrery AR',
            description: 'Place a miniature solar system in your room with WebXR',
            url: '/#/ar/orrery',
            icons: [
              {
                src: '/icons/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              }
            ]
          }
        ],
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['education', 'entertainment', 'science'],
        screenshots: []
      },
      
      workbox: {
        // Precache all static assets
        globPatterns: ['**/*.{js,css,html,woff,woff2}'],
        // The AR page (vendor_xr + ARPage) loads on demand only — don't
        // precache it (5 MB WebXR stack would stall install for every client).
        globIgnores: ['**/vendor_xr-*.js', '**/ARPage-*.js'],
        
        // Cache GLB models and Draco WASM files separately
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/models\/.*\.glb$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'glb-models',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/draco\/.*\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'draco-decoder',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          }
        ],
        
        // Don't cache source maps in production
        navigateFallback: null
      },
      
      devOptions: {
        enabled: false // Disable in dev to avoid conflicts with Vite HMR
      }
    }),
    
    // Sentry source maps upload (only in production builds with auth token)
    process.env.SENTRY_AUTH_TOKEN && process.env.NODE_ENV === 'production'
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            assets: './dist/assets/**',
            ignore: ['node_modules'],
          },
          release: {
            name: process.env.SENTRY_RELEASE || `solar-system@${Date.now()}`,
          },
        })
      : undefined,
  ].filter(Boolean),
  server: {
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/venv/**", "**/__pycache__/**"],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },

  root: path.resolve(__dirname, "client"),

  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    sourcemap: true, // Enable source maps for Sentry
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // React core packages
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor_react';
            
            // Three.js core - split into smaller chunks
            if (/node_modules[\\/]three[\\/]/.test(id)) {
              // Separate three.js main from addons
              if (id.includes('three/examples/jsm')) return 'vendor_three_addons';
              return 'vendor_three_core';
            }
            
            // Three.js ecosystem
            if (/node_modules[\\/]three-stdlib[\\/]/.test(id)) return 'vendor_three_stdlib';
            if (/node_modules[\\/]@react-three[\\/](fiber|drei)/.test(id)) return 'vendor_three_react';
            
            // Postprocessing effects
            if (/node_modules[\\/]@react-three[\\/]postprocessing/.test(id)) return 'vendor_fx';
            if (/node_modules[\\/]postprocessing[\\/]/.test(id)) return 'vendor_fx';
            
            // Animation libraries
            if (/node_modules[\\/](maath|@react-spring)/.test(id)) return 'vendor_animation';
            
            // State management
            if (/node_modules[\\/]zustand[\\/]/.test(id)) return 'vendor_state';
            
            // WebXR stack (only pulled in by the lazy AR page). Includes the
            // full transitive set — controller icons (FontAwesome), the Quest
            // emulator devui (styled-components + friends), gl-matrix, iwer.
            const xrPkg = id.match(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/)?.[1];
            if (xrPkg && XR_PACKAGES.has(xrPkg)) return 'vendor_xr';
            
            // Everything else
            return 'vendor_shared';
          }
        },
      },
    },
  },

  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
  base: "/",
});
