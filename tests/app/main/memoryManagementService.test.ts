import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getPaths } from "../../../src/shared/paths";
import { readContextMemories } from "../../../src/app/main/memory/contextStore";
import {
  clearContextMemoriesForUser,
  deleteContextMemoryForUser,
  deriveRelationshipOverview,
  exportContextMemoriesForUser,
  getMemoryOverview
} from "../../../src/app/main/memory/memoryManagementService";
import type { ContextMemoryItem, RelationshipMemory } from "../../../src/app/main/memory/memoryTypes";

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "kaka-memory-management-"));
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

function memory(input: Partial<ContextMemoryItem> & Pick<ContextMemoryItem, "id" | "kind" | "text">): ContextMemoryItem {
  return {
    tags: [],
    weight: 40,
    createdAt: "2026-06-01T01:00:00.000Z",
    updatedAt: "2026-06-01T01:00:00.000Z",
    ...input
  };
}

describe("memoryManagementService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("derives relationship stages from the average relationship score", () => {
    const base: RelationshipMemory = {
      familiarity: 0,
      affection: 0,
      engagement: 0,
      trust: 0,
      recentEvents: [],
      updatedAt: "2026-06-01T00:00:00.000Z"
    };

    expect(deriveRelationshipOverview(base).stage).toBe("new");
    expect(deriveRelationshipOverview({ ...base, familiarity: 30, affection: 30, engagement: 30, trust: 30 }).stage).toBe("familiar");
    expect(deriveRelationshipOverview({ ...base, familiarity: 50, affection: 50, engagement: 50, trust: 50 }).stage).toBe("close");
    expect(deriveRelationshipOverview({ ...base, familiarity: 80, affection: 80, engagement: 80, trust: 80 }).stage).toBe("trusted");
  });

  it("returns relationship overview and memories sorted by updatedAt descending", () => {
    const root = makeRoot();
    roots.push(root);
    const paths = getPaths({ APPDATA: root } as NodeJS.ProcessEnv);
    writeJson(paths.relationshipMemoryFile, {
      familiarity: 40,
      affection: 50,
      engagement: 60,
      trust: 70,
      recentEvents: [],
      updatedAt: "2026-06-01T04:00:00.000Z"
    });
    writeMemories(root, [
      memory({ id: "old", kind: "fact", text: "用户喜欢晚上写代码", updatedAt: "2026-06-01T01:00:00.000Z" }),
      memory({ id: "new", kind: "preference", text: "用户喜欢卡卡温柔提醒", tags: ["chat"], weight: 80, updatedAt: "2026-06-01T03:00:00.000Z" })
    ]);

    const overview = getMemoryOverview(root);

    expect(overview.relationship.stage).toBe("close");
    expect(overview.relationship.stageLabel).toBe("亲近");
    expect(overview.memories.map((item) => item.id)).toEqual(["new", "old"]);
    expect(overview.memories[0]).toMatchObject({ kind: "preference", text: "用户喜欢卡卡温柔提醒", weight: 80 });
  });

  it("deletes one context memory by id", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [
      memory({ id: "keep", kind: "fact", text: "保留" }),
      memory({ id: "delete-me", kind: "preference", text: "删除" })
    ]);

    const result = deleteContextMemoryForUser(root, "delete-me");

    expect(result).toEqual({ ok: true });
    expect(readContextMemories(root).map((item) => item.id)).toEqual(["keep"]);
  });

  it("returns a clear error for invalid or missing memory ids", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "known", kind: "fact", text: "存在" })]);

    expect(deleteContextMemoryForUser(root, "  ")).toEqual({ ok: false, errorCode: "INVALID_MEMORY_ID", message: "记忆 id 无效。" });
    expect(deleteContextMemoryForUser(root, "missing")).toEqual({ ok: false, errorCode: "MEMORY_NOT_FOUND", message: "这条记忆已经不存在了。" });
  });

  it("clears long-term context memories without touching chat history", () => {
    const root = makeRoot();
    roots.push(root);
    const paths = getPaths({ APPDATA: root } as NodeJS.ProcessEnv);
    writeMemories(root, [memory({ id: "m1", kind: "fact", text: "需要清空" })]);
    mkdirSync(dirname(paths.chatHistoryFile), { recursive: true });
    writeFileSync(paths.chatHistoryFile, "{\"id\":\"chat\"}\n", "utf8");

    expect(clearContextMemoriesForUser(root)).toEqual({ ok: true });

    expect(readContextMemories(root)).toEqual([]);
    expect(readFileSync(paths.chatHistoryFile, "utf8")).toContain("chat");
  });

  it("exports formatted memory JSON with metadata", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "m1", kind: "project-context", text: "项目在做桌宠" })]);

    const result = exportContextMemoriesForUser(root, "2026-06-01T05:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.data) as { exportedAt: string; count: number; memories: ContextMemoryItem[] };
    expect(parsed.exportedAt).toBe("2026-06-01T05:00:00.000Z");
    expect(parsed.count).toBe(1);
    expect(parsed.memories[0].text).toBe("项目在做桌宠");
  });
});