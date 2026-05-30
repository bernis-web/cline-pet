import { describe, expect, it, vi } from "vitest";
import { createRendererPetBridge } from "../../../src/app/renderer/petBridge";

describe("renderer pet bridge", () => {
  it("reports effective head-pat interactions through IPC", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.reportHeadPatInteraction({
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });

    expect(invoke).toHaveBeenCalledWith("interaction:head-pat", {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });
  });
});