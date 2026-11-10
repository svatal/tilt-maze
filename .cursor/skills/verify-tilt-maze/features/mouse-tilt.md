# Mouse tilt

On a desktop the player turns on **Myš** and points inside the board. The ball follows the pointer. While **Myš** is on, device tilt does not move the ball. Turning **Myš** off returns control to the sensor.

## Sub-features

- `mouse-arm` shows the mouse overlay.
- `mouse-roll` applies force from the pointer.
- `mouse-suppresses-sensor` ignores device tilt until **Myš** is turned off.

## How to get to it (user POV)

- Start a level from the menu.
- Click **Myš**, or press `M` while focus is outside a text field.
- Move the pointer over the board.

## Driving it with Playwright

Preconditions:

- Doctor passed.
- `startGameFromMenu(page, 0)` has returned. The ball body exists.

- **Idle pointer.** Move over the canvas before clicking **Myš**. `tilt.isMouseArmed()` is false and `#tilt-maze-mouse-overlay` is hidden.
- **Arm.** Click the button named `Myš`. The overlay `#tilt-maze-mouse-overlay` is visible.
- **Roll right.** Move the pointer to the right of the canvas center. `tilt.update(16, 1).ax` is greater than 0.02.
- **Disarm.** Click **Myš** again. The overlay is hidden.
- **Sensor while armed.** `dispatchDeviceOrientation(page, 28, 5)`, then click **Myš** and move the pointer to the right. `ax` stays above 0.04 and `ay` stays below 0.2.
- **Sensor after disarm.** Click **Myš** off and call `dispatchDeviceOrientation(page, 28, 5)` again. `ay` is greater than 0.03.
- **Spec.** `tests/e2e/mouseTilt.spec.ts`.

## Gotchas

- `dispatchDeviceOrientation` calls `startCdpDeviceOrientation`.
- The same beta and gamma do not emit a second orientation event. Accelerometer readings keep `devicemotion` fresh, which is what the disarm check needs after 550ms.
- `driveMouseTilt` clicks **Myš** itself. A second click before the helper turns the mode off.
