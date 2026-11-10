# Tilt-maze verification map

This directory is the source for user-visible tilt-maze checks. Read it before a drive, then follow the feature file.

## Baseline preconditions

- `npm run build` has produced `dist/index.html` for the commit you are proving.
- Preview is `http://127.0.0.1:4173/tilt-maze/`, or set `E2E_BASE_PATH` when the base path differs.
- Doctor passes. `#tilt-maze-build-info` contains the 7-character sha prefix from the build.
- Drive only the preview this run started, or the Playwright `webServer` attached to that run.

## Driving conventions

- Playwright project `chromium`.
- Enter through the menu with `?e2e=1`. Do not add `skipMenu=1` for a menu, tilt, or screenshot proof.
- Prefer `#tilt-maze-menu`, `#menu-btn-play`, `#btn-next`, and `[data-testid="main-menu"]`.
- Screenshot with `fullPage: false` at 1280×800 and at 390×844.
- Keep files in `/opt/cursor/artifacts/`.

## Proof and skip reporting

- Capture the action and the resulting state. A win shot without the preceding roll is incomplete.
- Record the feature id with the artifact.
- If a path cannot be reached, report the command you ran and the missing precondition. Do not mark it verified through a different entry.

## Features

- [Menu and start](./menu-play.md) covers picking level 1 and hiding the menu.
- [Sensor tilt win](./sensor-tilt-win.md) covers CDP tilt from the menu through the level 1 win overlay.
- [Mouse tilt](./mouse-tilt.md) covers the Myš control and sensor suppression.
