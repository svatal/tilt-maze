---
name: verify-tilt-maze
description: Drive tilt-maze in a browser to prove the menu, a CDP tilt win on level 1, and the build label. Use after a tilt, menu, or preview change, and before calling a PR verified.
---

# Verify tilt-maze

Tilt-maze is a Phaser 3 game. The primary surface is the browser. A player starts from the menu, then rolls the ball by tilting the phone or by using the mouse. Local preview is `http://127.0.0.1:4173/tilt-maze/`. A pull request preview is `https://svatal.github.io/tilt-maze/pr-N/`.

## Launch

From the repo root:

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`npm run build` runs `scripts/inject-build-info.mjs` first. That script writes `src/buildInfo.generated.ts`. The label is the branch, the first 7 characters of `BUILD_INFO_SHA` or `GITHUB_SHA` or `git rev-parse HEAD`, and the Prague build time.

Ready when `curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:4173/tilt-maze/` prints `200`. The menu is drawn by Phaser after load, so a 200 is not yet a playable menu. The drive step waits for `[data-testid="main-menu"]`.

`npm run test:e2e` starts the same preview through `playwright.config.ts` on port 4173. Outside CI, Playwright reuses a preview that is already listening. Two drives on one port share that process. Use another port when you need a second instance.

Teardown for a preview you started yourself is to stop that process. Record the pid at start and kill that pid. Do not kill every `vite` or `node` by name.

## Doctor

Run this before the first drive, and again after a failed drive.

1. `test -f dist/index.html`
2. The preview URL returns HTTP 200.
3. Open `/?e2e=1`. `#tilt-maze-build-info` contains the same 7 characters that `git rev-parse HEAD` starts with. `inject-build-info.mjs` slices the full sha. It does not use `git rev-parse --short`.
4. For `https://svatal.github.io/tilt-maze/pr-N/`, the same element contains the pull request head sha. CI sets `BUILD_INFO_SHA` to that head. A label from an older build is a failed doctor check.

## Drive

Open the app with `?e2e=1` and without `skipMenu=1`. `skipMenu=1` jumps straight into the board. That is for Matter checks. It is not a menu or screenshot proof.

Menu path, also implemented by `startGameFromMenu(page, 0)` in `tests/e2e/helpers/playwrightTilt.ts`:

1. Wait for `[data-testid="main-menu"]`.
2. Click `button[data-level-index="0"]`.
3. Click `#menu-btn-play`.
4. Expect `#tilt-maze-menu` to be hidden and `#tilt-maze-ui` to be visible.

Mobile context for a phone proof: `viewport` 390×844, `isMobile: true`, `hasTouch: true`. Desktop shots use 1280×800 without mobile emulation.

CDP tilt uses one session from `page.context().newCDPSession(page)`.

- Grant `accelerometer`, `gyroscope`, and `magnetometer` before the page listens. With no grant, `deviceorientation` stays null and the ball does not move.
- `Emulation.setDeviceOrientationOverride` is not in this Chromium. The helper tries it, then `DeviceOrientation.setDeviceOrientationOverride`, then `Page.setDeviceOrientationOverride`. The command that works here is `DeviceOrientation.setDeviceOrientationOverride`.
- That command emits one `deviceorientation` event per distinct angle. Sending the same angles again does not emit another event. `src/tiltMapping.ts` ignores orientation older than 550ms.
- `startCdpDeviceOrientation(page, beta, gamma)` refreshes the override every 200ms and writes accelerometer readings with `Emulation.setSensorOverrideReadings` (`reading.xyz`, not `readings`). `devicemotion` keeps streaming, so the ball still rolls after the single orientation sample goes stale.
- Arm that override before `#menu-btn-play`. If the game has already been listening for about 600ms, a later accelerometer override does not attach and `motionValid` stays 0.
- `tryEnableCdpSensorOverrides` and the hold path also call `Emulation.setSensorOverrideEnabled` for `gravity`. The command succeeds on this Chromium. The helper then disables gravity. A connected `GravitySensor` adds a z term that pushes the level 1 ball into the top wall.
- Level 1 starts at the bottom left and the goal is the top right. Negative beta rolls up. Positive gamma rolls right. The script is `LEVEL1_CDP_TILT_PHASES`: beta 0 gamma 0, then beta -40 gamma 15.
- Win proof is `#btn-next` inside the win overlay. You can also poll `__tiltMazeScene.goalSettling`. The button remains after settling ends.
- `?e2e=1` does not install the banner callbacks in `GameScene`. Still require `#tilt-maze-sensor-warn` to be absent. `maybeShowFullSensorWarning` creates that id.

Mouse drive is the **Myš** button and `driveMouseTilt`. Sensor dispatch for the mouse specs is `dispatchDeviceOrientation`, which calls the CDP hold.

## Evidence

Save proof under `/opt/cursor/artifacts/`. Do not delete those files during cleanup.

| Proof | File or check |
| --- | --- |
| Mobile playfield, ball in motion, 390×844 | `cdp-tilt-mobile-midroll.png` |
| Mobile win overlay | `cdp-tilt-mobile-complete.png` |
| Desktop playfield, 1280×800 | `cdp-tilt-desktop-midroll.png` |
| Desktop win overlay | `cdp-tilt-desktop-complete.png` |
| Build label in the shot | `#tilt-maze-build-info` matches the built sha |
| Scripted win | `npm run test:e2e -- tests/e2e/cdpTiltLevel1.spec.ts` |

Run `npm run test:unit` and `npm run test:e2e` before a commit that changes tilt or the menu. Screenshots use `fullPage: false` so the viewport is the playfield, the HUD, and the build label.

On this Chromium the level 1 spec logged `orientation=DeviceOrientation.setDeviceOrientationOverride`, `accel=ok`, `gravity=ok`, `orientValid=1`, and `motionValid` above 0 for both viewports.

## Cleanup

Stop the preview pid you started. Call `stopCdpTiltForPage(page)` or `stopCdpDeviceOrientation(session)` so the Node timer does not keep sending CDP after the page closes. Leave `/opt/cursor/artifacts/` in place.

## Helpers

`tests/e2e/helpers/playwrightTilt.ts`

- `grantCdpSensorPermissions(page)`
- `startCdpDeviceOrientation(page, beta, gamma)`
- `setCdpTilt(page, { beta, gamma })`
- `stopCdpDeviceOrientation(session)` and `stopCdpTiltForPage(page)`
- `dispatchDeviceOrientation(page, beta, gamma)`
- `tryEnableCdpSensorOverrides(page)` returns whether the accelerometer override enabled
- `cdpTiltStatus(page)` returns the orientation command plus `sensorOverride` and `gravityOverride`
- `startGameFromMenu(page, levelIndex)` and `assertMenuHiddenAfterPlay(page)`
- `driveMouseTilt(page, { nx, ny })`
- `LEVEL1_CDP_TILT_PHASES` and `runCdpTiltPhases(page, phases)`

Feature map: `.cursor/skills/verify-tilt-maze/features/`.

Keep the map current with `/maintain-verification-skill`.
