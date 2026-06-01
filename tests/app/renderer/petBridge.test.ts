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

  it("loads and clears chat history through IPC", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.getChatHistory();
    await bridge.clearChatHistory();

    expect(invoke).toHaveBeenNthCalledWith(1, "chat:get-history");
    expect(invoke).toHaveBeenNthCalledWith(2, "chat:clear-history");
  });

  it("reports presence reading activity through IPC", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.setPresenceActivity({ userIsReading: true });

    expect(invoke).toHaveBeenCalledWith("presence:set-activity", { userIsReading: true });
  });
});