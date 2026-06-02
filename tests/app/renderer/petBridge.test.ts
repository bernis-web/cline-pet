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

  it("manages long-term memory through IPC", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { relationship: null, memories: [] } })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, data: "{}" })
      .mockResolvedValueOnce({ ok: true, data: { id: "memory-1", text: "修正后的记忆" } })
      .mockResolvedValueOnce({ ok: true, data: { blockedCount: 1 } });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.getMemoryOverview();
    await bridge.deleteMemory("memory-1");
    await bridge.clearMemories();
    await bridge.exportMemories();
    await bridge.updateMemory("memory-1", "修正后的记忆");
    await bridge.blockMemory("memory-1");

    expect(invoke).toHaveBeenNthCalledWith(1, "memory:get-overview");
    expect(invoke).toHaveBeenNthCalledWith(2, "memory:delete", { id: "memory-1" });
    expect(invoke).toHaveBeenNthCalledWith(3, "memory:clear");
    expect(invoke).toHaveBeenNthCalledWith(4, "memory:export");
    expect(invoke).toHaveBeenNthCalledWith(5, "memory:update", { id: "memory-1", text: "修正后的记忆" });
    expect(invoke).toHaveBeenNthCalledWith(6, "memory:block", { id: "memory-1" });
  });

  it("manages unified privacy data through IPC", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { counts: { memories: 0, blockRules: 0, chatHistoryTurns: 0 }, memories: [], blockRules: [], chatHistory: [] } })
      .mockResolvedValueOnce({ ok: true, data: "{}" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.getPrivacyOverview();
    await bridge.exportPrivacyData();
    await bridge.deleteMemoryBlockRule("rule-1");
    await bridge.clearMemoryBlockRules();
    await bridge.blockChatHistoryTurn("turn-1");

    expect(invoke).toHaveBeenNthCalledWith(1, "privacy:get-overview");
    expect(invoke).toHaveBeenNthCalledWith(2, "privacy:export");
    expect(invoke).toHaveBeenNthCalledWith(3, "memory-blocklist:delete", { id: "rule-1" });
    expect(invoke).toHaveBeenNthCalledWith(4, "memory-blocklist:clear");
    expect(invoke).toHaveBeenNthCalledWith(5, "chat-history:block", { id: "turn-1" });
  });
});