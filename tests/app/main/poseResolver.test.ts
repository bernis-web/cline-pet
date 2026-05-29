import { describe, expect, it } from "vitest";
import { resolveDisplayedPose } from "../../../src/app/main/poseResolver";

describe("pose resolver", () => {
  it("keeps base status mapping for calm idle mood", () => {
    expect(resolveDisplayedPose({ mood: "calm", activity: "idle", bondStage: "familiar" })).toEqual({ status: "idle" });
  });

  it("prefers head-pat style response for attached mood", () => {
    expect(resolveDisplayedPose({ mood: "attached", activity: "chatting", bondStage: "close" })).toEqual({ status: "head-pat" });
  });
});