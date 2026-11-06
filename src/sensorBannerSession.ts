/**
 * Jednorázové zobrazení upozornění na senzory v rámci relace (sessionStorage).
 */

export const STORAGE_DISMISS = "tilt-maze-sensor-dismiss";
export const STORAGE_DESKTOP_HINT = "tilt-maze-sensor-desktop-hint";
export const STORAGE_FULL_WARN = "tilt-maze-sensor-full-warn";
export const STORAGE_VALID_RECOVERED = "tilt-maze-sensor-valid";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function isUserDismissedSensorBanner(storage: StorageLike): boolean {
  return storage.getItem(STORAGE_DISMISS) === "1";
}

export function markUserDismissedSensorBanner(storage: StorageLike): void {
  storage.setItem(STORAGE_DISMISS, "1");
}

export function hasShownDesktopSensorHint(storage: StorageLike): boolean {
  return storage.getItem(STORAGE_DESKTOP_HINT) === "1";
}

export function markDesktopSensorHintShown(storage: StorageLike): void {
  storage.setItem(STORAGE_DESKTOP_HINT, "1");
}

export function hasShownFullSensorWarning(storage: StorageLike): boolean {
  return storage.getItem(STORAGE_FULL_WARN) === "1";
}

export function markFullSensorWarningShown(storage: StorageLike): void {
  storage.setItem(STORAGE_FULL_WARN, "1");
}

export function hasValidSensorRecovery(storage: StorageLike): boolean {
  return storage.getItem(STORAGE_VALID_RECOVERED) === "1";
}

export function markValidSensorRecovery(storage: StorageLike): void {
  storage.setItem(STORAGE_VALID_RECOVERED, "1");
}

/** Vrací true, pokud lze zobrazit daný typ upozornění (respektuje dismiss a již zobrazené). */
export function shouldShowSensorBannerKind(
  storage: StorageLike,
  kind: "desktop_hint" | "full_warning"
): boolean {
  if (isUserDismissedSensorBanner(storage)) return false;
  if (hasValidSensorRecovery(storage)) return false;
  if (kind === "desktop_hint") {
    return !hasShownDesktopSensorHint(storage);
  }
  return !hasShownFullSensorWarning(storage);
}

/** Po zobrazení (nebo rozhodnutí zobrazit) — volat jednou pro daný typ. */
export function recordSensorBannerShown(storage: StorageLike, kind: "desktop_hint" | "full_warning"): void {
  if (kind === "desktop_hint") markDesktopSensorHintShown(storage);
  else markFullSensorWarningShown(storage);
}
