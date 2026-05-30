import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../src/shared/errors";
import { petPackManifestSchema, updatePetStatusSchema } from "../../src/shared/schemas";

const v2States = {
  idle: "idle.png",
  happy: "happy.png",
  sleepy: "sleepy.png",
  thinking: "thinking.png",
  angry: "angry.png",
  "not-found": "not-found.png",
  message: "message.png",
  sleeping: "sleeping.png",
  "head-pat": "head-pat.png",
  dragging: "dragging.png",
  loading: "loading.png",
  "signal-weak": "signal-weak.png"
};

describe("schemas", () => {
  it("normalizes a standard 12-state status update", () => {
    const result = updatePetStatusSchema.parse({
      status: "loading",
      task: "Implementing 12 states",
      message: "Updating the pet.",
      source: "cline"
    });
    expect(result.status).toBe("loading");
    expect(result.visibleStatus).toBe("loading");
    expect(result.baseStatus).toBe("loading");
    expect(result.overlayStatus).toBeNull();
    expect(result.normalizedFrom).toBeUndefined();
  });

  it("accepts old status aliases and records normalizedFrom", () => {
    const result = updatePetStatusSchema.parse({ status: "working", task: "test" });
    expect(result.status).toBe("loading");
    expect(result.normalizedFrom).toBe("working");
  });

  it("supports explicit overlay updates", () => {
    const result = updatePetStatusSchema.parse({ status: "head-pat", layer: "overlay", durationMs: 1200 });
    expect(result.status).toBe("head-pat");
    expect(result.visibleStatus).toBe("head-pat");
    expect(result.baseStatus).toBe("idle");
    expect(result.overlayStatus).toBe("head-pat");
    expect(result.durationMs).toBe(1200);
  });

  it("rejects an invalid status update", () => {
    expect(() => updatePetStatusSchema.parse({ status: "reading" })).toThrow();
  });

  it("validates a legacy six-state pet pack manifest", () => {
    const manifest = petPackManifestSchema.parse({
      id: "cyber-cat",
      name: "Cyber Cat",
      version: "1.0.0",
      states: {
        idle: "idle.gif",
        thinking: "thinking.gif",
        working: "working.gif",
        "waiting-approval": "waiting-approval.gif",
        done: "done.gif",
        error: "error.gif"
      }
    });
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.id).toBe("cyber-cat");
  });

  it("validates a formatVersion 2 12-state pet pack manifest", () => {
    const manifest = petPackManifestSchema.parse({
      id: "kaka-desktop-pet",
      name: "卡卡桌宠小人",
      version: "1.0.0",
      formatVersion: 2,
      states: v2States,
      metadata: { source: "local-user-assets", assetType: "transparent-png", recommendedSize: 1024 }
    });
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.states.loading).toBe("loading.png");
  });

  it("rejects a v2 manifest missing a 12-state key", () => {
    const { loading: _loading, ...missingLoading } = v2States;
    expect(() => petPackManifestSchema.parse({
      id: "broken-kaka",
      name: "Broken Kaka",
      formatVersion: 2,
      states: missingLoading
    })).toThrow();
  });

  it("includes INVALID_PET_PACK", () => {
    expect(ERROR_CODES.INVALID_PET_PACK).toBe("INVALID_PET_PACK");
  });
});
