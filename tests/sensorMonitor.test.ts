import { describe, expect, it } from "vitest";
import { NO_VALID_DATA_MS, SensorMonitor } from "../src/sensorMonitor";

function orient(gamma: number | null, beta: number | null): DeviceOrientationEvent {
  return { gamma, beta } as DeviceOrientationEvent;
}

function motion(ax: number, ay: number, az = 0): DeviceMotionEvent {
  return {
    accelerationIncludingGravity: { x: ax, y: ay, z: az }
  } as DeviceMotionEvent;
}

describe("SensorMonitor", () => {
  it("classify: desktop bez událostí → po okně no_sensors_desktop", () => {
    const m = new SensorMonitor();
    m.start(0);
    m.setPermissionStates("granted", "granted", "granted");
    m.setGravityConstructorResult(false);
    const t = NO_VALID_DATA_MS + 100;
    expect(m.classifySensorIssue(t)).toBe("no_sensors_desktop");
    expect(m.shouldWarnNoValidData(t, false)).toBe(true);
  });

  it("classify: události orientace s null úhly → sensor_blocked_or_invalid", () => {
    const m = new SensorMonitor();
    m.start(1000);
    m.setPermissionStates("granted", "granted", "granted");
    let t = 1000;
    for (let i = 0; i < 5; i++) {
      m.recordOrientation(orient(null, null), (t += 50));
    }
    const now = t + NO_VALID_DATA_MS + 100;
    expect(m.classifySensorIssue(now)).toBe("sensor_blocked_or_invalid");
  });

  it("chybějící GravitySensor API nepočítá jako gravityConstructorFailed", () => {
    const m = new SensorMonitor();
    m.setGravityConstructorResult(false);
    expect(m.gravityConstructorFailed).toBe(false);
    expect(m.classifySensorIssue(NO_VALID_DATA_MS + 500)).toBe("no_sensors_desktop");
  });

  it("null úhly nepočítá jako validní; po okně se zobrazí varování", () => {
    const m = new SensorMonitor();
    m.start(1000);
    m.setPermissionStates("granted", "granted", "granted");
    let t = 1000;
    for (let i = 0; i < 5; i++) {
      m.recordOrientation(orient(null, null), (t += 50));
    }
    expect(m.shouldWarnNoValidData(t + NO_VALID_DATA_MS + 100, false)).toBe(true);
  });

  it("konstantní gravitace ~9.81 bez variance → varování", () => {
    const m = new SensorMonitor();
    m.start(0);
    m.setPermissionStates("granted", "granted", "granted");
    let t = 0;
    for (let i = 0; i < 12; i++) {
      m.recordMotion(motion(0, 0, 9.81), (t += 40));
    }
    expect(m.shouldWarnNoValidData(NO_VALID_DATA_MS + 500, false)).toBe(true);
  });

  it("platné gamma → bez varování dokud přicházejí vzorky", () => {
    const m = new SensorMonitor();
    m.start(0);
    m.setPermissionStates("granted", "granted", "granted");
    for (let t = 100; t <= 4000; t += 400) {
      m.recordOrientation(orient(10 + (t % 5), 38), t);
    }
    expect(m.shouldWarnNoValidData(4200, false)).toBe(false);
  });

  it("explicitní denied z permissions API → varování brzy", () => {
    const m = new SensorMonitor();
    m.start(100);
    m.setPermissionStates("denied", "granted", "granted");
    expect(m.shouldWarnNoValidData(600, false)).toBe(true);
    expect(m.classifySensorIssue(600)).toBe("sensor_blocked_or_invalid");
  });
});
