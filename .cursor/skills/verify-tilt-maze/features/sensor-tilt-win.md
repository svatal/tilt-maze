# Sensor tilt win

On a phone, the player tilts the device and the ball rolls into the goal. Level 1 is an open board. The start is the bottom left. The goal is the top right. While orientation data is arriving, the full sensor warning is not on screen.

## Sub-features

- `cdp-orientation` feeds beta and gamma through Chrome DevTools.
- `level-1-win` puts the ball in the goal and shows the win actions.
- `no-full-banner` leaves `#tilt-maze-sensor-warn` out of the document.

## How to get to it (user POV)

- Follow [Menu and start](./menu-play.md) for level 1.
- Leave **Myš** off. Tilt the phone.

## Driving it with Playwright

Preconditions:

- Doctor passed.
- Context is 390×844 with `isMobile: true` and `hasTouch: true` for the phone proof. Repeat at 1280×800 for the desktop shot.
- `startGameFromMenu(page, 0)` has armed a zero tilt before Play, so calibration stores a level device.

- **Hold zero.** `startCdpDeviceOrientation(page, 0, 0)` for 900ms. This matches the first row of `LEVEL1_CDP_TILT_PHASES`.
- **Roll up and right.** `startCdpDeviceOrientation(page, -40, 15)`. Negative beta rolls up. Positive gamma rolls right.
- **Mid-roll shot.** When the ball's Matter `y` is between 180 and 460 and `#btn-next` is absent, save `cdp-tilt-mobile-midroll.png` or `cdp-tilt-desktop-midroll.png`.
- **Win.** `expect(page.locator('#btn-next')).toBeVisible({ timeout: 45000 })`. `__tiltMazeScene.goalSettling` is true during the sink, then the button stays.
- **No full warning.** `expect(page.locator('#tilt-maze-sensor-warn')).toHaveCount(0)`.
- **Sensor actually delivered.** `tilt.getSensorSnapshot()` has `orientValid > 0` and `motionValid > 0`.
- **Spec.** `tests/e2e/cdpTiltLevel1.spec.ts`.

## Gotchas

- Grant accelerometer, gyroscope, and magnetometer before load. Without that grant the ball stays on the start.
- `Emulation.setDeviceOrientationOverride` is missing in this Chromium. Use the helper. It selects `DeviceOrientation.setDeviceOrientationOverride`.
- One orientation event does not keep the ball forced after 550ms. The helper also writes accelerometer `reading.xyz` and refreshes every 200ms.
- Turn gravity override off after the probe. Leaving `GravitySensor` connected sends this level into the top wall.
- Arm the accelerometer before Play. Arming it half a second later does not attach to `devicemotion`.
- `?e2e=1` skips the banner callbacks. The absent `#tilt-maze-sensor-warn` node is still the check. That id is created in `maybeShowFullSensorWarning`.
