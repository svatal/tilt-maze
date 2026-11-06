# Capacitor (později)

Projekt je připravený jako čistá webová aplikace (Vite + Phaser). Pro budoucí nativní obal:

1. `npm run build`
2. `npm i -D @capacitor/core @capacitor/cli @capacitor/android`
3. `npx cap init "Sklopený labyrint" com.example.tiltmaze --web-dir=dist`
4. `npx cap add android` a v Android Studiu otevřít `android/`

**Base URL:** ve `vite.config.ts` je `base: "/tilt-maze/"` kvůli GitHub Pages. Pro APK zvažte `base: "./"` nebo konfiguraci Capacitor, aby kořen odpovídal `index.html`.

**HTTPS:** tilt vyžaduje zabezpečený origin (Android Chrome). Capacitor to splňuje.
