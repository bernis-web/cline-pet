import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getPaths } from "../../../src/shared/paths";
import { readChatHistory } from "../../../src/app/main/memory/chatHistoryStore";
import { readContextMemories } from "../../../src/app/main/memory/contextStore";
import { readMemoryBlockRules, writeMemoryBlockRules } from "../../../src/app/main/memory/memoryBlocklistStore";
import {
  clearMemoryBlockRulesForUser,
  deleteMemoryBlockRuleForUser,
  exportPrivacyDataForUser,
  getPrivacyOverview
} from "../../../src/app/main/memory/privacyManagementService";
import type { ContextMemoryItem } from "../../../src/app/main/memory/memoryTypes";

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "kaka-privacy-management-"));
}

function writeJson(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMemories(root: string, memories: ContextMemoryItem[]) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, memories.map((item) => JSON.stringify(item)).join("\n") + "\n", "utf8");
}

function writeHistory(root: string) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({
    id: "turn-1",
    userText: "今天好累",
    assistantText: "先喝口水，我在旁边陪你。",
    createdAt: "2026-06-01T04:00:00.000Z",
    sentiment: "tired",
    memoryIds: ["memory-1"]
  })}\n`, "utf8");
}

function memory(input: Partial<ContextMemoryItem> & Pick<ContextMemoryItem, "id" | "kind" | "text">): ContextMemoryItem {
  return {
    tags: [],
    weight: 40,
    createdAt: "2026-06-01T01:00:00.000Z",
    updatedAt: "2026-06-01T01:00:00.000Z",
    ...input
  };
}

describe("privacyManagementService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("builds a unified overview from local memory, blocklist, relationship, and history", () => {
    const root = makeRoot();
    roots.push(root);
    const paths = getPaths({ APPDATA: root } as NodeJS.ProcessEnv);
    writeJson(paths.relationshipMemoryFile, {
      familiarity: 40,
      affection: 50,
      engagement: 60,
      trust: 70,
      recentEvents: [],
      updatedAt: "2026-06-01T05:00:00.000Z"
    });
    writeMemories(root, [memory({ id: "memory-1", kind: "preference", text: "用户喜欢温柔提醒", updatedAt: "2026-06-01T03:00:00.000Z" })]);
    writeMemoryBlockRules(root, [{
      id: "rule-1",
      text: "不要记住咖啡",
      normalizedText: "不要记住咖啡",
      kind: "preference",
      sourceMemoryId: "old-memory",
      createdAt: "2026-06-01T02:00:00.000Z"
    }]);
    writeHistory(root);

    const overview = getPrivacyOverview(root);

    expect(overview.relationship.stageLabel).toBe("亲近");
    expect(overview.memories.map((item) => item.id)).toEqual(["memory-1"]);
    expect(overview.blockRules).toEqual([expect.objectContaining({ id: "rule-1", text: "不要记住咖啡", sourceMemoryId: "old-memory" })]);
    expect(overview.blockRules[0]).not.toHaveProperty("normalizedText");
    expect(overview.chatHistory.map((turn) => turn.id)).toEqual(["turn-1"]);
    expect(overview.counts).toEqual({ memories: 1, blockRules: 1, chatHistoryTurns: 1 });
  });

  it("exports unified privacy JSON without config paths or normalized blocklist metadata", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "memory-1", kind: "fact", text: "项目是卡卡桌宠" })]);
    writeMemoryBlockRules(root, [{
      id: "rule-1",
      text: "不要记住咖啡",
      normalizedText: "internal-normalized-value",
      kind: "preference",
      createdAt: "2026-06-01T02:00:00.000Z"
    }]);
    writeHistory(root);

    const result = exportPrivacyDataForUser(root, "2026-06-02T00:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.data) as { exportedAt: string; counts: unknown; memories: unknown[]; blockRules: unknown[]; chatHistory: unknown[] };
    expect(parsed.exportedAt).toBe("2026-06-02T00:00:00.000Z");
    expect(parsed.memories).toHaveLength(1);
    expect(parsed.blockRules).toEqual([expect.not.objectContaining({ normalizedText: expect.any(String) })]);
    expect(JSON.stringify(parsed)).not.toContain("config.json");
    expect(JSON.stringify(parsed)).not.toContain("internal-normalized-value");
  });

  it("deletes one block rule and reports invalid or missing ids clearly", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemoryBlockRules(root, [
      { id: "keep", text: "保留", normalizedText: "保留", createdAt: "2026-06-01T01:00:00.000Z" },
      { id: "delete", text: "删除", normalizedText: "删除", createdAt: "2026-06-01T02:00:00.000Z" }
    ]);

    expect(deleteMemoryBlockRuleForUser(root, "  ")).toEqual({ ok: false, errorCode: "INVALID_BLOCK_RULE_ID", message: "不要再记规则 id 无效。" });
    expect(deleteMemoryBlockRuleForUser(root, "missing")).toEqual({ ok: false, errorCode: "BLOCK_RULE_NOT_FOUND", message: "这条不要再记规则已经不存在了。" });
    expect(deleteMemoryBlockRuleForUser(root, "delete")).toEqual({ ok: true });
    expect(readMemoryBlockRules(root).map((rule) => rule.id)).toEqual(["keep"]);
  });

  it("clears block rules without clearing long-term memory or chat history", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "memory-1", kind: "fact", text: "保留记忆" })]);
    writeMemoryBlockRules(root, [{ id: "rule-1", text: "清空规则", normalizedText: "清空规则", createdAt: "2026-06-01T01:00:00.000Z" }]);
    writeHistory(root);

    expect(clearMemoryBlockRulesForUser(root)).toEqual({ ok: true });

    expect(readMemoryBlockRules(root)).toEqual([]);
    expect(readContextMemories(root).map((item) => item.id)).toEqual(["memory-1"]);
    expect(readChatHistory(root).map((turn) => turn.id)).toEqual(["turn-1"]);
  });
});