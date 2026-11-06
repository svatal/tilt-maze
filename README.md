# Sklopený labyrint (tilt-maze)

Hra **kulička v labyrintu** pro telefon: ovládání nakloněním (DeviceOrientation), záloha **šipkami / WASD** na počítači. Postaveno na **TypeScript**, **Phaser 3** s **Matter.js**, bundler **Vite**, nasazení jako **PWA** (manifest, service worker, offline, celá obrazovka, portrét).

## Požadavky

- Node.js 20+ (doporučeno 22)
- npm

## Vývoj

```bash
npm install
npm run dev
```

Automatická kontrola, že jsou všechny úrovně BFS řešitelné (hrubá mřížka):

```bash
npm run test:unit
```

Otevřete v prohlížeči URL z Vite (např. `http://localhost:5173/tilt-maze/`). Pro test naklonění na Androidu je potřeba **HTTPS** (např. tunel přes `ngrok` / Cloudflare Tunnel) nebo připojení z `https://localhost` podle prostředí.

## Sestavení

```bash
npm run build
```

Výstup je ve složce `dist/`. `base` je nastaven na `/tilt-maze/`, aby šla stránka nasadit pod **GitHub Pages** na projektové cestě.

## Náhled produkční sestavy

```bash
npm run preview
```

## Test v headless Chromium (Playwright)

Nejdřív sestavte projekt, pak:

```bash
npx playwright install chromium
npm run test:e2e
```

Scénáře: úroveň 1 **šipkami nahoru/vpravo** (s `?e2e=1&matterDebug=1` je vidět overlay Matter.js), a regresní test s `__debugCompleteLevel()`. Společně s `npm run test:unit` ověří BFS průchodnost úrovní.

## Ladění fyziky v prohlížeči

Přidejte do URL **`?matterDebug=1`** — zobrazí se kontury Matter těles (měly by přesně sedět na vykreslené zdi).

## Test na telefonu (Android Chrome)

1. Nahrajte `dist/` na HTTPS hosting nebo použijte GitHub Pages po zapnutí workflow (viz níže).
2. V Chrome na telefonu otevřete nasazenou adresu.
3. Přihlaste se přes **„Přidat na plochu“** / PWA (volitelné).
4. Klepněte **Start** — aplikace může vyžádat celoobrazovkový režim a zámek na výšku.

**Brave (Android):** pokud se po Start do ~1,5 s neobjeví žádná data ze senzorů, zobrazí se česká nápověda — zkontrolujte oprávnění **Motion sensors** u stránky a vypněte **Shields** pro tento web; Chrome vyžaduje HTTPS. (Některé buildy Brave události de/facto blokují nebo vracejí nuly.)

**Poznámka:** skutečné naklonění se na stolním Chromium netestuje; vyžaduje fyzické zařízení s gyroskopem.

## GitHub Pages z tohoto repozitáře

Po sloučení do výchozí větve (`main`) workflow `.github/workflows/pages.yml` sestaví projekt a nasadí ho přes **actions/deploy-pages**.

**V nastavení repozitáře na GitHubu musíte:**

1. **Settings → Pages → Build and deployment → Source:** zvolit **GitHub Actions** (ne „Deploy from branch“).

Po prvním úspěšném běhu bude aplikace obvykle na adrese:

**https://svatal.github.io/tilt-maze/**

(Pokud je repozitře `tilt-maze` pod uživatelem `svatal`.)

## Capacitor (budoucí APK)

Struktura je připravená na doplnění nativního obalu — viz soubor `capacitor-setup.md`.

## Licence

MIT
