# Senzorový tilt a výhra

## Driving it with Playwright

- `driveCdpTiltToLevel1Goal(page)` after `startGameFromMenu(page, 0)`.
- `setCdpTilt` / `clearCdpTilt` for orientation only.
- Spec: `tests/e2e/cdpTiltLevel1.spec.ts` (`beforeAll` runs `npm run build`).

Accelerometer CDP: `tests/e2e/cdpAccelerometer.spec.ts`.

## Gotchas

- `isMobile: true` and sensor permissions required for CDP orientation.
- With live CDP orientation, expect `#tilt-maze-sensor-warn` count 0 after the win path.
- Without orientation (plain desktop context), the full sensor banner should appear; dismiss via `#sensor-dismiss` only when the test needs mouse play.
