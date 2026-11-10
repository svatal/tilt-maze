---
name: verify-tilt-maze
description: Drive tilt-maze in a browser to prove the menu, a CDP tilt win on level 1, and the build label. Use after a tilt, menu, or preview change, and before calling a PR verified.
---

# Verify tilt-maze

Local preview is `http://127.0.0.1:4173/tilt-maze/`. PR preview is `https://svatal.github.io/tilt-maze/pr-N/`.

## Launch

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Commit first when screenshots must show the PR head sha, then `npm run build` so `BUILD_INFO_LABEL` matches.

## Doctor

1. `test -f dist/index.html`
2. `#tilt-maze-build-info` matches the sha embedded in `src/buildInfo.generated.ts` from that build.
3. On the PR preview, the label matches the pull request head commit.

## Drive

No `skipMenu=1` for menu or tilt proofs. Use `startGameFromMenu(page, 0)` and expect `#tilt-maze-menu` hidden.

CDP orientation (level 1 win path): mobile context, sensor permissions, `setCdpTilt(page, { beta, gamma })`, `clearCdpTilt(page)`, `driveCdpTiltToLevel1Goal(page)`. Chromium here only accepts `DeviceOrientation.setDeviceOrientationOverride`.

Accelerometer CDP is separate: `tests/e2e/cdpAccelerometer.spec.ts`.

## Evidence

`/opt/cursor/artifacts/cdp-tilt-*`. Run `npm run test:e2e -- tests/e2e/cdpTiltLevel1.spec.ts` after `npm run build`.

## Cleanup

`clearCdpTilt(page)` before closing the tab.

## Helpers

`setCdpTilt`, `clearCdpTilt`, `driveCdpTiltToLevel1Goal`, `startGameFromMenu`, `assertMenuHiddenAfterPlay`, `dismissSensorBannerIfPresent`, `driveMouseTilt` in `tests/e2e/helpers/playwrightTilt.ts`.

`?e2e=1` does not hide sensor banners; dismiss with `#sensor-dismiss` when driving desktop mouse tests. CDP orientation wins should keep `#tilt-maze-sensor-warn` absent.

Window hooks under `?e2e=1`: `__tiltMazeScene`, `__tiltMazeGame`, `__debugCompleteLevel`, and hole geometry helpers (`__e2ePlaceBall`, `__e2eTickHoles`, `__e2eHoleState`, `__e2eHoleLocalMag`) — not `skipMenu`, `__loadLevel`, or `sensorDebug`.

Feature map: `.cursor/skills/verify-tilt-maze/features/`.
