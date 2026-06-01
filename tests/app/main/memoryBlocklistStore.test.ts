import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendMemoryBlockRule,
  filterBlockedContextMemoryCandidates,
  readMemoryBlockRules,
  writeMemoryBlockRules
} from "../../../src/app/main/memory/memoryBlocklistStore";
import type { ContextMemoryItem, MemoryBlockRule } from "../../../src/app/main/memory/memoryTypes";
import { getPaths } from "../../../src/shared/paths";

function makeRoot() {
  return mkdtempSync(join(tmpdir(), "kaka-memory-blocklist-"));
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

describe("memoryBlocklistStore", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("returns empty rules when the blocklist file is missing", () => {
    const root = makeRoot();
    roots.push(root);

    expect(getPaths({ APPDATA: root } as NodeJS.ProcessEnv).memoryBlocklistFile).toContain("memory-blocklist.json");
    expect(readMemoryBlockRules(root)).toEqual([]);
  });

  it("writes and reads block rules", () => {
    const root = makeRoot();
    roots.push(root);
    const rules: MemoryBlockRule[] = [{
      id: "rule-1",
      text: "用户不想让卡卡记住咖啡偏好",
      normalizedText: "用户不想让卡卡记住咖啡偏好",
      kind: "preference",
      sourceMemoryId: "memory-1",
      createdAt: "2026-06-01T02:00:00.000Z"
    }];

    writeMemoryBlockRules(root, rules);

    expect(readMemoryBlockRules(root)).toEqual(rules);
  });

  it("does not create duplicate rules for the same normalized text and kind", () => {
    const root = makeRoot();
    roots.push(root);

    appendMemoryBlockRule(root, {
      text: "User likes gentle reminders at night.",
      kind: "preference",
      sourceMemoryId: "memory-1",
      now: "2026-06-01T02:00:00.000Z"
    });
    appendMemoryBlockRule(root, {
      text: "User likes gentle reminders at night",
      kind: "preference",
      sourceMemoryId: "memory-2",
      now: "2026-06-01T03:00:00.000Z"
    });

    const rules = readMemoryBlockRules(root);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ kind: "preference", sourceMemoryId: "memory-1" });
  });

  it("filters exact normalized blocked candidates regardless of kind", () => {
    const rules: MemoryBlockRule[] = [{
      id: "rule-1",
      text: "用户不想记住咖啡",
      normalizedText: "用户不想记住咖啡",
      kind: "preference",
      sourceMemoryId: "memory-1",
      createdAt: "2026-06-01T02:00:00.000Z"
    }];

    const filtered = filterBlockedContextMemoryCandidates([
      memory({ id: "candidate", kind: "fact", text: "用户不想记住咖啡" })
    ], rules);

    expect(filtered).toEqual([]);
  });

  it("filters similar same-kind candidates but keeps similar different-kind candidates", () => {
    const rules: MemoryBlockRule[] = [{
      id: "rule-1",
      text: "user likes gentle reminders at night",
      normalizedText: "userlikesgentleremindersatnight",
      kind: "preference",
      sourceMemoryId: "memory-1",
      createdAt: "2026-06-01T02:00:00.000Z"
    }];

    const sameKind = memory({ id: "same-kind", kind: "preference", text: "user likes gentle reminders at night please" });
    const differentKind = memory({ id: "different-kind", kind: "fact", text: "user likes gentle reminders at night please" });

    expect(filterBlockedContextMemoryCandidates([sameKind], rules)).toEqual([]);
    expect(filterBlockedContextMemoryCandidates([differentKind], rules).map((item) => item.id)).toEqual(["different-kind"]);
  });
});