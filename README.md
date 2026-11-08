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

Herní plocha má **pevné rozlišení 360×640** logických pixelů; Phaser používá **Scale.FIT** — na širokém monitoru tedy uvidíte **letterbox** (tmavé okraje), ale celá deska i zdi zůstávají uvnitř hnědého rámu. V pravém dolním rohu je **řádek sestavení** (větev, hash, čas Europe/Prague): generuje ho `scripts/inject-build-info.mjs` do `src/buildInfo.generated.ts` (soubor je v **`.gitignore`**, před `dev`/`build` přes npm lifecycle). U náhledů PR workflow nastaví `BUILD_INFO_SHA` na head commit PR (ne merge ref).

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

## GitHub Pages (větev `gh-pages`)

Nasazení běží přes workflow **`.github/workflows/gh-pages.yml`**: sestavení (`npm run build`), **Vitest** a **Playwright**, poté push do větve **`gh-pages`** ([peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages)).

- **Produkce (main):** obsah `dist/` se zapisuje do **kořene** větve `gh-pages` → stránka je na **`https://svatal.github.io/tilt-maze/`** (GitHub stránky projektů vždy mají kořen `/repo-name/`).
- **Náhled z PR (stejný fork):** pro události `opened` / `synchronize` / `reopened` se build s `VITE_BASE_PATH=/tilt-maze/pr-<číslo>/` uloží do složky **`pr-<číslo>/`** na `gh-pages` → **`https://svatal.github.io/tilt-maze/pr-<číslo>/`**. Pod PR se automaticky přidá nebo aktualizuje komentář s odkazem.
- **Zavření PR:** job smaže **`pr-<číslo>/`** z `gh-pages` a upraví komentář.

Forky od cizích účtů se **nenasazují** (nemá smysl pouštět cizí kód s `GITHUB_TOKEN`).

**Jednorázové nastavení v GitHubu (vlastník repozitáře):**

1. Otevřete **Settings → Pages**.
2. U **Build and deployment** zvolte **Deploy from a branch**.
3. **Branch:** `gh-pages`, složka **`/ (root)`**, uložte.

Dřívější režim „GitHub Actions“ u deploy-pages už není potřeba — publikuje se přímo commit na `gh-pages`.

### Ladění senzorů na telefonu

Přidejte **`?sensorDebug=1`** (např. náhled PR nebo produkce). V levém horním rohu uvidíte počty událostí, poslední hodnoty a stav oprávnění – vhodné při hlášení z Brave/Chrome.

### Lokální simulace cesty jako u PR

```bash
VITE_BASE_PATH=/tilt-maze/pr-2/ VITE_IS_PR_PREVIEW=true VITE_DISABLE_PWA=true E2E_BASE_PATH=/tilt-maze/pr-2/ npm run build
VITE_BASE_PATH=/tilt-maze/pr-2/ E2E_BASE_PATH=/tilt-maze/pr-2/ npm run preview
```

### PWA u náhledů

U buildů z PR je **`VITE_DISABLE_PWA=true`** (žádný service worker ani manifest v balíčku), aby starý SW z produkce **nezasahoval** do `/tilt-maze/pr-…/`. Plnohodnotná PWA zůstává jen u produkčního nasazení z `main`; scope SW je vždy vázaný na `VITE_BASE_PATH`.

## Capacitor (budoucí APK)

Struktura je připravená na doplnění nativního obalu — viz soubor `capacitor-setup.md`.

## Licence

MIT
