import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { isCliEntryPoint, SIMULATOR_STATUSES } from "../../src/simulator/cycleStates";

describe("cycle state simulator", () => {
  it("cycles the 12 states in spec order", () => {
    expect(SIMULATOR_STATUSES).toEqual([
      "idle",
      "happy",
      "sleepy",
      "thinking",
      "angry",
      "not-found",
      "message",
      "sleeping",
      "head-pat",
      "dragging",
      "loading",
      "signal-weak"
    ]);
  });

  it("detects tsx CLI execution from a platform file URL", () => {
    const scriptPath = resolve("src/simulator/cycleStates.ts");

    expect(isCliEntryPoint(pathToFileURL(scriptPath).href, scriptPath)).toBe(true);
  });
});
