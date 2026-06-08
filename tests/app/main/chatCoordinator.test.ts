import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runKakaChatTurn } from "../../../src/app/main/chatCoordinator";
import { appendContextMemory } from "../../../src/app/main/memory/contextStore";
import { readChatHistory } from "../../../src/app/main/memory/chatHistoryStore";
import { loadRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

const config = { apiKey: "key", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };

describe("chatCoordinator", () => {
  const roots: string[] = [];

  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "cline-chat-coordinator-"));
    roots.push(root);
    return root;
  }

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("injects relevant memories, persists history, and returns mood payload", async () => {
    const root = tempRoot();
    appendContextMemory(root, { kind: "preference", text: "用户喜欢温柔但不过分卖萌的卡卡", tags: ["preference"], weight: 90 });
    const chatRequester = vi.fn().mockResolvedValue({ ok: true, data: { text: "我记得，你喜欢温柔一点的陪伴。" } });
    const extractionRequester = vi.fn().mockResolvedValue({ ok: true, data: { text: JSON.stringify({
      shouldRemember: true,
      conversationSummary: "用户测试卡卡记忆闭环。",
      sentiment: "positive",
      facts: [], preferences: [], projectContext: [], careSignals: [], relationshipEvent: "chat"
    }) } });

    const result = await runKakaChatTurn({
      root,
      config,
      text: "你记得我喜欢什么样的卡卡吗？",
      now: "2026-06-01T04:00:00.000Z",
      latestVisibleStatus: "idle",
      chatRequester,
      extractionRequester
    });

    expect(result.ok).toBe(true);
    expect(chatRequester).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining("温柔但不过分卖萌") })
    ]) }));
    expect(readChatHistory(root)[0]).toEqual(expect.objectContaining({ userText: "你记得我喜欢什么样的卡卡吗？" }));
    expect(loadRelationshipMemory(root).playfulChatUntil).toBe("2026-06-01T04:15:00.000Z");
    if (result.ok) expect(result.moodStatus.status).toBe("happy");
  });
});