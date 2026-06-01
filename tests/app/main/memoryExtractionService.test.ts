import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readContextMemories } from "../../../src/app/main/memory/contextStore";
import { appendMemoryBlockRule } from "../../../src/app/main/memory/memoryBlocklistStore";
import { extractAndStoreMemories, parseMemoryExtractionJson } from "../../../src/app/main/memory/memoryExtractionService";

const config = { apiKey: "key", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };

describe("memoryExtractionService", () => {
  const roots: string[] = [];

  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "cline-memory-extract-"));
    roots.push(root);
    return root;
  }

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("parses strict DeepSeek extraction JSON", () => {
    expect(parseMemoryExtractionJson(JSON.stringify({
      shouldRemember: true,
      conversationSummary: "用户在推进卡卡赛博生命。",
      sentiment: "focused",
      facts: ["用户正在开发卡卡"],
      preferences: ["用户希望卡卡更关心自己"],
      projectContext: ["卡卡需要历史对话功能"],
      careSignals: ["用户担心长回复看不完"],
      relationshipEvent: "work-session"
    }))).toEqual({ ok: true, data: expect.objectContaining({ shouldRemember: true, sentiment: "focused" }) });
  });

  it("rejects malformed extraction output", () => {
    expect(parseMemoryExtractionJson("not json")).toEqual({ ok: false, errorCode: "MEMORY_EXTRACTION_BAD_RESPONSE" });
  });

  it("stores mapped memories and deduplicates repeated preferences", async () => {
    const root = tempRoot();
    const requester = vi.fn().mockResolvedValue({ ok: true, data: { text: JSON.stringify({
      shouldRemember: true,
      conversationSummary: "用户想把卡卡做成赛博生命。",
      sentiment: "focused",
      facts: [],
      preferences: ["用户喜欢温柔但不过分卖萌的卡卡。", "用户喜欢温柔但不过分卖萌的卡卡"],
      projectContext: ["Cyber Life v1 包含对话历史和长期记忆。"],
      careSignals: ["用户希望长回复能读完。"],
      relationshipEvent: "work-session"
    }) } });

    const result = await extractAndStoreMemories({
      root,
      config,
      turn: {
        userText: "继续做 Cyber Life v1",
        assistantText: "我们会加历史和记忆。",
        createdAt: "2026-06-01T03:00:00.000Z"
      },
      relationshipSummary: "familiarity=10 affection=8 engagement=20 trust=12",
      relevantMemorySummaries: [],
      recentChatSummaries: [],
      requester
    });

    expect(result.ok).toBe(true);
    const memories = readContextMemories(root);
    expect(memories.map((memory) => memory.kind)).toEqual(expect.arrayContaining(["preference", "project-context", "conversation-summary"]));
    expect(memories.filter((memory) => memory.kind === "preference")).toHaveLength(1);
    expect(memories[0].tags).toContain("deepseek-extracted");
  });

  it("does not store exact blocked extraction candidates", async () => {
    const root = tempRoot();
    appendMemoryBlockRule(root, {
      text: "用户喜欢夜里喝咖啡",
      kind: "preference",
      sourceMemoryId: "old-memory",
      now: "2026-06-01T01:00:00.000Z"
    });
    const requester = vi.fn().mockResolvedValue({ ok: true, data: { text: JSON.stringify({
      shouldRemember: true,
      conversationSummary: null,
      sentiment: "neutral",
      facts: [],
      preferences: ["用户喜欢夜里喝咖啡"],
      projectContext: [],
      careSignals: [],
      relationshipEvent: "chat"
    }) } });

    const result = await extractAndStoreMemories({
      root,
      config,
      turn: { userText: "咖啡", assistantText: "记下来了", createdAt: "2026-06-01T03:00:00.000Z" },
      relationshipSummary: "",
      relevantMemorySummaries: [],
      recentChatSummaries: [],
      requester
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.memoryIds).toEqual([]);
    expect(readContextMemories(root)).toEqual([]);
  });

  it("filters similar same-kind candidates without blocking different kinds", async () => {
    const root = tempRoot();
    appendMemoryBlockRule(root, {
      text: "user likes gentle reminders at night",
      kind: "preference",
      sourceMemoryId: "old-memory",
      now: "2026-06-01T01:00:00.000Z"
    });
    const requester = vi.fn().mockResolvedValue({ ok: true, data: { text: JSON.stringify({
      shouldRemember: true,
      conversationSummary: null,
      sentiment: "focused",
      facts: ["user likes gentle reminders at night please"],
      preferences: ["user likes gentle reminders at night please"],
      projectContext: [],
      careSignals: [],
      relationshipEvent: "work-session"
    }) } });

    const result = await extractAndStoreMemories({
      root,
      config,
      turn: { userText: "reminders", assistantText: "ok", createdAt: "2026-06-01T03:00:00.000Z" },
      relationshipSummary: "",
      relevantMemorySummaries: [],
      recentChatSummaries: [],
      requester
    });

    expect(result.ok).toBe(true);
    const memories = readContextMemories(root);
    expect(memories.map((memory) => memory.kind)).toEqual(["fact"]);
    expect(memories[0].text).toBe("user likes gentle reminders at night please");
  });
});