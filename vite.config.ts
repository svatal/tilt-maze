import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { getBuildInfoLabel } from "./scripts/build-info-label";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const rawBase = env.VITE_BASE_PATH ?? "/tilt-maze/";
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  const isPrPreview = env.VITE_IS_PR_PREVIEW === "true";
  const enablePwa = env.VITE_DISABLE_PWA !== "true" && !isPrPreview;
  const buildInfoLabel = getBuildInfoLabel();

  return {
    base,
    define: {
      "import.meta.env.VITE_BUILD_INFO_LABEL": JSON.stringify(buildInfoLabel)
    },
    publicDir: "public",
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        scope: base,
        base,
        manifestFilename: "manifest.webmanifest",
        disable: !enablePwa,
        selfDestroying: isPrPreview,
        manifest: enablePwa
          ? {
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
            }
          : false,
        workbox: enablePwa
          ? {
              globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,wasm}"],
              navigateFallback: `${base}index.html`,
              navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/]
            }
          : undefined
      })
    ],
    build: {
      assetsDir: "assets",
      emptyOutDir: true,
      sourcemap: false
    }
  };
});
