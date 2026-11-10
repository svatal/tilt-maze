/** Stejná sans jako kořen #tilt-maze-menu — overlay na body musí dědit explicitně. */
export const UI_FONT_FAMILY = "system-ui,Segoe UI,Roboto,sans-serif";

export const BTN_PRIMARY =
  "padding:14px 28px;font-size:1.05rem;border-radius:12px;border:none;background:#c9a227;color:#1a120a;font-weight:700;cursor:pointer;min-height:44px;min-width:44px";

export const BTN_SECONDARY =
  "padding:10px 16px;border-radius:10px;border:1px solid #c9a227;background:#3d2918;color:#f5e6d3;font-size:0.9rem;cursor:pointer;min-height:44px;min-width:44px";

export const BTN_LEVEL =
  "padding:12px 10px;border-radius:10px;border:1px solid rgba(201,162,39,0.55);background:#2a1c10;color:#f5e6d3;font-size:0.88rem;cursor:pointer;min-height:48px;height:auto;text-align:left;width:100%;max-width:100%;min-width:0;box-sizing:border-box";

export const BTN_LEVEL_SELECTED =
  "padding:11px 9px;border-radius:10px;border:2px solid #c9a227;background:#3d2918;color:#fff3d0;font-size:0.88rem;cursor:pointer;min-height:48px;height:auto;text-align:left;width:100%;max-width:100%;min-width:0;box-sizing:border-box;box-shadow:0 0 0 1px rgba(201,162,39,0.25)";

/** Skupina bez pastí — chladnější zelenohnědý odstín + levý akcent. */
export const BTN_LEVEL_WALLS =
  "padding:10px 8px 10px 10px;border-radius:10px;border:1px solid rgba(110,150,118,0.45);border-left:3px solid rgba(76,132,96,0.95);background:#18221a;color:#e8f0e8;font-size:0.82rem;cursor:pointer;min-height:52px;height:auto;text-align:left;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden";

export const BTN_LEVEL_WALLS_SELECTED =
  "padding:9px 7px 9px 9px;border-radius:10px;border:2px solid rgba(120,168,130,0.75);border-left:4px solid rgba(92,158,112,1);background:#1f2e22;color:#f2f9f0;font-size:0.82rem;cursor:pointer;min-height:52px;height:auto;text-align:left;width:100%;max-width:100%;min-width:0;box-sizing:border-box;box-shadow:0 0 0 1px rgba(76,132,96,0.35);overflow:hidden";

/** Skupina s pastmi — teplejší červenohnědý odstín + levý akcent. */
export const BTN_LEVEL_TRAPS =
  "padding:10px 8px 10px 10px;border-radius:10px;border:1px solid rgba(175,105,68,0.5);border-left:3px solid rgba(172,86,48,0.95);background:#2a1712;color:#faece0;font-size:0.82rem;cursor:pointer;min-height:52px;height:auto;text-align:left;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden";

export const BTN_LEVEL_TRAPS_SELECTED =
  "padding:9px 7px 9px 9px;border-radius:10px;border:2px solid rgba(200,118,72,0.8);border-left:4px solid rgba(198,96,52,1);background:#3a2218;color:#fff3e8;font-size:0.82rem;cursor:pointer;min-height:52px;height:auto;text-align:left;width:100%;max-width:100%;min-width:0;box-sizing:border-box;box-shadow:0 0 0 1px rgba(172,86,48,0.35);overflow:hidden";

export const PANEL_OVERLAY =
  `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,10,6,0.92);pointer-events:auto;padding:16px 20px;box-sizing:border-box;text-align:left;color:#f5e6d3;overflow:auto;font-family:${UI_FONT_FAMILY}`;
