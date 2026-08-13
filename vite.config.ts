import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Preload the three.js vendor chunk from the HTML parse phase, before the
 * lazy SolarSystem chunk that imports it has even been requested. three
 * (~600KB min) is the single largest module in the graph — fetching it in
 * parallel with the entry bundles shaves 1 round-trip off scene boot.
 */
function preloadThreeChunk(): Plugin {
  return {
    name: "preload-three-chunk",
    apply: "build",
    transformIndexHtml(_html, ctx) {
      const bundle = (ctx as { bundle?: Record<string, { fileName?: string }> }).bundle;
      if (!bundle) return undefined;
      const entry = Object.keys(bundle).find(
        (k) => k.startsWith("vendor_three-") && k.endsWith(".js"),
      );
      if (!entry) return undefined;
      return [
        {
          tag: "link",
          attrs: { rel: "modulepreload", href: `/assets/${entry}` },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadThreeChunk(),
    visualizer({ filename: "stats.html", open: false }),
  ],
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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Only the real react packages — `id.includes('react')` would also
            // catch @react-three/* and react-spring, pulling three into
            // vendor_react and creating a vendor_react <-> vendor_shared
            // circular chunk (breaks react-dom hook init at runtime).
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor_react';
            // three + its stdlib go to their own chunk (one-way dependency —
            // drei/fiber only ever import FROM three, never the reverse, so
            // the chunk graph stays acyclic). Preloaded via modulepreload.
            if (/node_modules[\\/](three|three-stdlib)[\\/]/.test(id)) return 'vendor_three';
            return 'vendor_shared';
          }
        },
      },
    },
  },

  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
  base: "/",
});
