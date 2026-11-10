# Senzorový tilt a výhra

## Driving it with Playwright

- `driveCdpTiltToLevel1Goal(page)` after `startGameFromMenu(page, 0)`.
- `setCdpTilt` / `clearCdpTilt` for orientation only.
- Spec: `tests/e2e/cdpTiltLevel1.spec.ts` (`beforeAll` runs `npm run build`).

Accelerometer CDP: `tests/e2e/cdpAccelerometer.spec.ts`.

## Gotchas

- `isMobile: true` and sensor permissions required for CDP orientation.
