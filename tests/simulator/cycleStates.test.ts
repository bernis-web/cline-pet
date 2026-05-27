import { describe, expect, it } from "vitest";
import { SIMULATOR_STATUSES } from "../../src/simulator/cycleStates";

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
});
