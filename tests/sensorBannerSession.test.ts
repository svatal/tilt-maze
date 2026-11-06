import { describe, expect, it } from "vitest";
import {
  recordSensorBannerShown,
  shouldShowSensorBannerKind,
  markUserDismissedSensorBanner,
  markValidSensorRecovery
} from "../src/sensorBannerSession";

function createMemoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => {
      m.delete(k);
    },
    setItem: (k: string, v: string) => {
      m.set(k, v);
    }
  };
}

describe("sensorBannerSession (jednou za relaci)", () => {
  it("po recordSensorBannerShown už desktop_hint neprojde", () => {
    const s = createMemoryStorage();
    expect(shouldShowSensorBannerKind(s, "desktop_hint")).toBe(true);
    recordSensorBannerShown(s, "desktop_hint");
    expect(shouldShowSensorBannerKind(s, "desktop_hint")).toBe(false);
  });

  it("simulace mnoha pokusů o zobrazení → banner jen jednou", () => {
    const s = createMemoryStorage();
    let shown = 0;
    for (let i = 0; i < 60; i++) {
      if (!shouldShowSensorBannerKind(s, "desktop_hint")) continue;
      recordSensorBannerShown(s, "desktop_hint");
      shown += 1;
    }
    expect(shown).toBe(1);
  });

  it("po dismiss už žádný druh", () => {
    const s = createMemoryStorage();
    markUserDismissedSensorBanner(s);
    expect(shouldShowSensorBannerKind(s, "desktop_hint")).toBe(false);
    expect(shouldShowSensorBannerKind(s, "full_warning")).toBe(false);
  });

  it("po obnovení senzorů (recovery) už nic", () => {
    const s = createMemoryStorage();
    markValidSensorRecovery(s);
    expect(shouldShowSensorBannerKind(s, "desktop_hint")).toBe(false);
    expect(shouldShowSensorBannerKind(s, "full_warning")).toBe(false);
  });
});
