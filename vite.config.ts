import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/tilt-maze/";

export default defineConfig({
  base,
  publicDir: "public",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      scope: base,
      base,
      manifestFilename: "manifest.webmanifest",
      manifest: {
        name: "Sklopený labyrint",
        short_name: "Labyrint",
        description: "Kulička v dřevěném labyrintu — ovládání nakloněním telefonu.",
        start_url: `${base}?source=pwa`,
        display: "fullscreen",
        orientation: "portrait",
        background_color: "#2d1f12",
        theme_color: "#5c3d21",
        lang: "cs",
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,wasm}"],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/]
      }
    })
  ],
  build: {
    assetsDir: "assets",
    emptyOutDir: true,
    sourcemap: false
  }
});
