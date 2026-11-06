import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TiltController } from "../src/tilt";

type EvFn = (ev: Event) => void;

function makeWindowStub() {
  const listeners = new Map<string, Set<EvFn>>();
  const win = {
    addEventListener(type: string, fn: EvFn, _opts?: unknown) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EvFn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchOrient(ev: Partial<DeviceOrientationEvent>) {
      for (const fn of listeners.get("deviceorientation") ?? []) {
        fn(ev as DeviceOrientationEvent);
      }
    }
  };
  return { win, listeners };
}

describe("TiltController checkSensorHealth", () => {
  let virtualTime = 0;

  beforeEach(() => {
    virtualTime = 0;
    vi.spyOn(performance, "now").mockImplementation(() => virtualTime);
    vi.useFakeTimers();
    delete (globalThis as { GravitySensor?: unknown }).GravitySensor;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("bez událostí senzorů: po okně volá desktop hint, ne plné varování", async () => {
    const { win } = makeWindowStub();
    vi.stubGlobal("window", win);

    const desktop: unknown[] = [];
    const full: unknown[] = [];

    const c = new TiltController({
      onSensorDesktopHint: () => desktop.push(virtualTime),
      onSensorDataStale: () => full.push(virtualTime)
    });

    await c.startSensors();

    virtualTime = 2000;
    vi.advanceTimersByTime(2000);

    expect(desktop.length).toBeGreaterThanOrEqual(1);
    expect(full.length).toBe(0);

    const nDesktop = desktop.length;
    virtualTime = 4000;
    vi.advanceTimersByTime(2000);
    expect(desktop.length).toBeGreaterThan(nDesktop);

    c.destroy();
  });

  it("události orientace s null: plné varování, ne desktop hint", async () => {
    const { win } = makeWindowStub();
    vi.stubGlobal("window", win);

    const desktop: unknown[] = [];
    const full: unknown[] = [];

    const c = new TiltController({
      onSensorDesktopHint: () => desktop.push(1),
      onSensorDataStale: () => full.push(1)
    });

    await c.startSensors();

    for (let i = 0; i < 5; i++) {
      win.dispatchOrient({ gamma: null, beta: null });
    }

    virtualTime = 2500;
    vi.advanceTimersByTime(2500);

    expect(full.length).toBeGreaterThanOrEqual(1);
    expect(desktop.length).toBe(0);

    c.destroy();
  });
});
