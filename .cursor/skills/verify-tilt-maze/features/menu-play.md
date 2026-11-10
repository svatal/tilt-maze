# Menu and start

The player picks a level on the main screen and starts it with Hrát. The menu then hides and the board HUD appears.

## Sub-features

- `level-pick` selects a level tile.
- `play` starts that level.
- `menu-hidden` removes the menu from the board.

## How to get to it (user POV)

- Open the local preview or `https://svatal.github.io/tilt-maze/pr-N/`.
- Wait until the level list is on screen.

## Driving it with Playwright

Preconditions:

- Doctor passed for this preview.
- The URL query is `e2e=1` and does not include `skipMenu=1`.

- **Open the menu.** Load the preview. Run `page.goto` with `${basePath}?e2e=1`. `[data-testid="main-menu"]` is visible.
- **Choose level 1.** Click the first level. Run `page.locator('button[data-level-index="0"]').click()`.
- **Start the board.** Click Hrát. Run `page.locator('#menu-btn-play').click()`.
- **Menu is gone.** Run `expect(page.locator('#tilt-maze-menu')).toBeHidden()` and `expect(page.locator('#tilt-maze-ui')).toBeVisible()`.
- **Same path in one call.** `startGameFromMenu(page, 0)` in `tests/e2e/helpers/playwrightTilt.ts` performs the steps above and waits until the ball body exists.
- **Build label.** `#tilt-maze-build-info` contains the 7-character sha from the build.

## Gotchas

- Do not bypass the menu with removed debug query flags; only the real menu flow proves this feature.
- The menu root is `#tilt-maze-menu`. The test id `main-menu` is on that same node. After Hrát, `#tilt-maze-menu` is hidden.
- On a pull request preview, compare the label with the PR head sha. A green page with an older sha is the wrong build.
