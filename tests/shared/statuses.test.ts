import { describe, expect, it } from "vitest";
import {
  BASE_PET_STATUSES,
  isPetStatus,
  normalizePetStatus,
  OVERLAY_PET_STATUSES,
  PET_STATUS_ALIASES,
  PET_STATUSES,
  PET_VISIBLE_STATUSES,
  statusLayerFor,
  toStatusLabel
} from "../../src/shared/statuses";

describe("pet statuses", () => {
  it("contains the 12 standard visible states in asset order", () => {
    expect(PET_STATUSES).toEqual([
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
    expect(PET_VISIBLE_STATUSES).toEqual(PET_STATUSES);
  });

  it("separates base and overlay states", () => {
    expect(BASE_PET_STATUSES).toEqual([
      "idle",
      "happy",
      "sleepy",
      "thinking",
      "not-found",
      "message",
      "sleeping",
      "loading",
      "signal-weak"
    ]);
    expect(OVERLAY_PET_STATUSES).toEqual(["angry", "head-pat", "dragging"]);
    expect(statusLayerFor("loading")).toBe("base");
    expect(statusLayerFor("head-pat")).toBe("overlay");
  });

  it("validates only standard visible status strings", () => {
    expect(isPetStatus("loading")).toBe(true);
    expect(isPetStatus("working")).toBe(false);
    expect(isPetStatus("reading")).toBe(false);
  });

  it("normalizes old six-state aliases", () => {
    expect(PET_STATUS_ALIASES).toEqual({
      idle: "idle",
      thinking: "thinking",
      working: "loading",
      "waiting-approval": "message",
      done: "happy",
      error: "not-found"
    });
    expect(normalizePetStatus("working")).toEqual({ status: "loading", normalizedFrom: "working" });
    expect(normalizePetStatus("loading")).toEqual({ status: "loading" });
    expect(normalizePetStatus("reading")).toBeNull();
  });

  it("returns English plus Chinese labels", () => {
    expect(toStatusLabel("loading")).toBe("loading（加载中）");
    expect(toStatusLabel("signal-weak")).toBe("signal-weak（信号弱）");
  });
});
