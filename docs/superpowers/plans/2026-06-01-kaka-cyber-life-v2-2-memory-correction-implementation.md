# Kaka Cyber Life v2.2 Memory Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users correct Kaka's long-term memories and mark unwanted memories as `不要再记`, with future automatic extraction filtered by local block rules.

**Architecture:** Add a focused local memory blocklist store beside the existing context memory store, extend `memoryManagementService` with edit/block operations, and filter DeepSeek extraction candidates before they are merged into `context-memory.jsonl`. Expose the new operations through Electron IPC and `petBridge`, then add inline edit/block controls to the existing `MemoryPanel` and `App` memory flow.

**Tech Stack:** Electron main process IPC, React renderer, TypeScript, Vitest, jsdom renderer tests, Node filesystem/path APIs, local JSON/JSONL memory stores.

---

## File Structure

Create:

- `src/app/main/memory/memoryBlocklistStore.ts`
  - Reads and writes `%APPDATA%/cline-desktop-pet/memory-blocklist.json`.
  - Creates block rules from user-visible memory text.
  - Filters candidate `ContextMemoryItem` values before storage.
- `tests/app/main/memoryBlocklistStore.test.ts`
  - Covers missing file, round-trip writes, duplicate prevention, exact blocking, similar same-kind blocking, and different-kind non-blocking.

Modify:

- `src/shared/paths.ts`
  - Add `memoryBlocklistFile`.
- `src/app/main/memory/memoryTypes.ts`
  - Add `MemoryBlockRule`.
- `src/app/main/memory/memoryDeduplication.ts`
  - Export `memoryTextOverlapScore()` and keep `mergeContextMemory()` behavior unchanged.
- `src/app/main/memory/memoryManagementService.ts`
  - Add edit/block service functions and export block rule metadata.
- `src/app/main/memory/memoryExtractionService.ts`
  - Filter blocked extraction candidates before merge/write.
- `src/app/main/main.ts`
  - Register `memory:update` and `memory:block` IPC handlers.
- `src/app/renderer/petBridge.ts`
  - Add update/block response types, IPC overloads, and bridge methods.
- `src/app/renderer/memoryTypes.ts`
  - Re-export new renderer-safe memory response types if needed by tests.
- `src/app/renderer/MemoryPanel.tsx`
  - Add inline edit controls and `不要再记` action.
- `src/app/renderer/App.tsx`
  - Add update/block handlers, state updates, and friendly notice bubbles.
- `src/app/renderer/petStyles.css`
  - Add inline editor and block button styles.
- `tests/app/main/memoryManagementService.test.ts`
  - Extend v2.1 service tests for edit/block/export semantics.
- `tests/app/main/memoryExtractionService.test.ts`
  - Add blocked extraction filtering tests.
- `tests/app/renderer/petBridge.test.ts`
  - Verify new IPC bridge methods.
- `tests/app/renderer/MemoryPanel.test.ts`
  - Verify edit/block UI callbacks and disabled empty save.
- `tests/app/renderer/App.test.ts`
  - Verify integrated edit/block flows and notice behavior.
- `tests/app/renderer/petStyles.test.ts`
  - Verify new CSS selectors.
- `docs/development/kaka-development-guide.md`
  - Document v2.2 memory correction and blocklist behavior.
- `docs/development/kaka-compact.md`
  - Update latest commits, built features, local files, and next tasks.

---

## Task 1: Memory Blocklist Store And Matching Helpers

**Files:**

- Create: `tests/app/main/memoryBlocklistStore.test.ts`
- Create: `src/app/main/memory/memoryBlocklistStore.ts`
- Modify: `src/shared/paths.ts`
- Modify: `src/app/main/memory/memoryTypes.ts`
- Modify: `src/app/main/memory/memoryDeduplication.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/app/main/memoryBlocklistStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```powershell
npm test -- tests/app/main/memoryBlocklistStore.test.ts
```

Expected: FAIL because `memoryBlocklistStore.ts`, `MemoryBlockRule`, and `memoryBlocklistFile` do not exist yet.

- [ ] **Step 3: Add the blocklist path**

Modify `src/shared/paths.ts` so `getPaths()` includes `memoryBlocklistFile` directly after `contextMemoryFile`:

```ts
export function getPaths(env = process.env) {
  const root = getAppDataRoot(env);
  return {
    root,
    logs: join(root, "logs"),
    petPacks: join(root, "pets"),
    stateFile: join(root, "state.json"),
    profileMemoryFile: join(root, "profile.json"),
    relationshipMemoryFile: join(root, "relationship.json"),
    contextMemoryFile: join(root, "context-memory.jsonl"),
    memoryBlocklistFile: join(root, "memory-blocklist.json"),
    chatHistoryFile: join(root, "chat-history.jsonl"),
    appLog: join(root, "logs", "pet-app.log"),
    mcpLog: join(root, "logs", "mcp-server.log")
  };
}
```

- [ ] **Step 4: Add the block rule type**

Modify `src/app/main/memory/memoryTypes.ts` after `ContextMemoryItem`:

```ts
export type MemoryBlockRule = {
  id: string;
  text: string;
  normalizedText: string;
  kind?: ContextMemoryItem["kind"];
  sourceMemoryId?: string;
  createdAt: string;
};
```

- [ ] **Step 5: Export the shared overlap helper**

Modify `src/app/main/memory/memoryDeduplication.ts` so the internal overlap function becomes exported and `mergeContextMemory()` uses the exported name:

```ts
import type { ContextMemoryItem } from "./memoryTypes.js";

export function normalizeMemoryText(text: string) {
  return text.toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "").trim();
}

export function memoryTextOverlapScore(a: string, b: string) {
  const aTerms = new Set(a.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const bTerms = new Set(b.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  if (!aTerms.size || !bTerms.size) return 0;
  const hits = [...aTerms].filter((term) => bTerms.has(term)).length;
  return hits / Math.max(aTerms.size, bTerms.size);
}

export function mergeContextMemory(existing: ContextMemoryItem[], candidate: ContextMemoryItem): ContextMemoryItem[] {
  const normalizedCandidate = normalizeMemoryText(candidate.text);
  const matchIndex = existing.findIndex((item) => {
    if (item.kind !== candidate.kind) return false;
    if (normalizeMemoryText(item.text) === normalizedCandidate) return true;
    return memoryTextOverlapScore(item.text, candidate.text) >= 0.75;
  });
  if (matchIndex === -1) return [candidate, ...existing];

  return existing.map((item, index) => index === matchIndex
    ? {
        ...item,
        tags: Array.from(new Set([...item.tags, ...candidate.tags])),
        weight: Math.max(item.weight, candidate.weight),
        updatedAt: candidate.updatedAt,
        lastAccessedAt: candidate.updatedAt
      }
    : item);
}
```

- [ ] **Step 6: Add the blocklist store implementation**

Create `src/app/main/memory/memoryBlocklistStore.ts`:

```ts
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";
import { memoryTextOverlapScore, normalizeMemoryText } from "./memoryDeduplication.js";
import type { ContextMemoryItem, MemoryBlockRule } from "./memoryTypes.js";

export type MemoryBlockRuleInput = {
  text: string;
  kind?: ContextMemoryItem["kind"];
  sourceMemoryId?: string;
  now?: string;
};

function isMemoryKind(value: unknown): value is ContextMemoryItem["kind"] {
  return ["conversation-summary", "fact", "preference", "project-context"].includes(String(value));
}

function isRule(value: unknown): value is MemoryBlockRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<MemoryBlockRule>;
  return typeof rule.id === "string"
    && typeof rule.text === "string"
    && typeof rule.normalizedText === "string"
    && typeof rule.createdAt === "string"
    && (rule.kind === undefined || isMemoryKind(rule.kind))
    && (rule.sourceMemoryId === undefined || typeof rule.sourceMemoryId === "string");
}

export function readMemoryBlockRules(root: string): MemoryBlockRule[] {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).memoryBlocklistFile;
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRule) : [];
  } catch {
    return [];
  }
}

export function writeMemoryBlockRules(root: string, rules: MemoryBlockRule[]) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).memoryBlocklistFile;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(rules, null, 2)}\n`, "utf8");
}

export function createMemoryBlockRule(input: MemoryBlockRuleInput): MemoryBlockRule {
  const text = input.text.trim();
  return {
    id: randomUUID(),
    text,
    normalizedText: normalizeMemoryText(text),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.sourceMemoryId ? { sourceMemoryId: input.sourceMemoryId } : {}),
    createdAt: input.now ?? new Date().toISOString()
  };
}

export function appendMemoryBlockRule(root: string, input: MemoryBlockRuleInput): MemoryBlockRule {
  const nextRule = createMemoryBlockRule(input);
  const rules = readMemoryBlockRules(root);
  const duplicate = rules.find((rule) => rule.normalizedText === nextRule.normalizedText && rule.kind === nextRule.kind);
  if (duplicate) return duplicate;
  writeMemoryBlockRules(root, [nextRule, ...rules]);
  return nextRule;
}

export function isContextMemoryBlocked(candidate: ContextMemoryItem, rules: MemoryBlockRule[]): boolean {
  const normalized = normalizeMemoryText(candidate.text);
  return rules.some((rule) => {
    if (rule.normalizedText === normalized) return true;
    return rule.kind === candidate.kind && memoryTextOverlapScore(rule.text, candidate.text) >= 0.75;
  });
}

export function filterBlockedContextMemoryCandidates(candidates: ContextMemoryItem[], rules: MemoryBlockRule[]): ContextMemoryItem[] {
  if (rules.length === 0) return candidates;
  return candidates.filter((candidate) => !isContextMemoryBlocked(candidate, rules));
}
```

- [ ] **Step 7: Run the blocklist tests to verify they pass**

Run:

```powershell
npm test -- tests/app/main/memoryBlocklistStore.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add src/shared/paths.ts src/app/main/memory/memoryTypes.ts src/app/main/memory/memoryDeduplication.ts src/app/main/memory/memoryBlocklistStore.ts tests/app/main/memoryBlocklistStore.test.ts
git commit -m "feat: add memory blocklist store"
```

---

## Task 2: Memory Edit And Block Main Service

**Files:**

- Modify: `tests/app/main/memoryManagementService.test.ts`
- Modify: `src/app/main/memory/memoryManagementService.ts`

- [ ] **Step 1: Extend the failing service tests**

Modify the import block in `tests/app/main/memoryManagementService.test.ts`:

```ts
import { readMemoryBlockRules, writeMemoryBlockRules } from "../../../src/app/main/memory/memoryBlocklistStore";
import {
  blockContextMemoryForUser,
  clearContextMemoriesForUser,
  deleteContextMemoryForUser,
  deriveRelationshipOverview,
  exportContextMemoriesForUser,
  getMemoryOverview,
  updateContextMemoryForUser
} from "../../../src/app/main/memory/memoryManagementService";
```

Append these tests inside the existing `describe("memoryManagementService", () => { ... })` block:

```ts
  it("edits memory text and updatedAt without changing identity or metadata", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({
      id: "m1",
      kind: "preference",
      text: "用户喜欢很吵的提醒",
      tags: ["chat", "preference"],
      weight: 80,
      createdAt: "2026-06-01T01:00:00.000Z",
      updatedAt: "2026-06-01T01:00:00.000Z"
    })]);

    const result = updateContextMemoryForUser(root, {
      id: "m1",
      text: "用户喜欢安静温柔的提醒",
      now: "2026-06-01T06:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      id: "m1",
      kind: "preference",
      text: "用户喜欢安静温柔的提醒",
      tags: ["chat", "preference"],
      weight: 80,
      createdAt: "2026-06-01T01:00:00.000Z",
      updatedAt: "2026-06-01T06:00:00.000Z"
    });
    expect(readContextMemories(root)[0].text).toBe("用户喜欢安静温柔的提醒");
  });

  it("rejects invalid edit input", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "m1", kind: "fact", text: "存在" })]);

    expect(updateContextMemoryForUser(root, { id: " ", text: "新内容" })).toEqual({ ok: false, errorCode: "INVALID_MEMORY_ID", message: "记忆 id 无效。" });
    expect(updateContextMemoryForUser(root, { id: "m1", text: "   " })).toEqual({ ok: false, errorCode: "INVALID_MEMORY_TEXT", message: "记忆内容不能为空。" });
    expect(updateContextMemoryForUser(root, { id: "missing", text: "新内容" })).toEqual({ ok: false, errorCode: "MEMORY_NOT_FOUND", message: "这条记忆已经不存在了。" });
  });

  it("blocks one memory by removing it and writing a local block rule", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [
      memory({ id: "keep", kind: "fact", text: "保留" }),
      memory({ id: "block-me", kind: "preference", text: "用户喜欢夜里喝咖啡" })
    ]);

    const result = blockContextMemoryForUser(root, { id: "block-me", now: "2026-06-01T06:00:00.000Z" });

    expect(result).toEqual({ ok: true, data: { blockedCount: 1 } });
    expect(readContextMemories(root).map((item) => item.id)).toEqual(["keep"]);
    expect(readMemoryBlockRules(root)).toEqual([expect.objectContaining({
      text: "用户喜欢夜里喝咖啡",
      kind: "preference",
      sourceMemoryId: "block-me",
      createdAt: "2026-06-01T06:00:00.000Z"
    })]);
  });

  it("keeps delete and clear separate from block rules", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [
      memory({ id: "delete-me", kind: "fact", text: "只删除" }),
      memory({ id: "clear-me", kind: "preference", text: "会被清空" })
    ]);
    writeMemoryBlockRules(root, [{
      id: "rule-1",
      text: "不要记住旧偏好",
      normalizedText: "不要记住旧偏好",
      kind: "preference",
      sourceMemoryId: "old",
      createdAt: "2026-06-01T02:00:00.000Z"
    }]);

    expect(deleteContextMemoryForUser(root, "delete-me")).toEqual({ ok: true });
    expect(readMemoryBlockRules(root)).toHaveLength(1);

    expect(clearContextMemoriesForUser(root)).toEqual({ ok: true });
    expect(readContextMemories(root)).toEqual([]);
    expect(readMemoryBlockRules(root)).toHaveLength(1);
  });

  it("exports formatted memory JSON with block rule metadata", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "m1", kind: "project-context", text: "项目在做桌宠" })]);
    writeMemoryBlockRules(root, [{
      id: "rule-1",
      text: "不要记住咖啡",
      normalizedText: "不要记住咖啡",
      kind: "preference",
      sourceMemoryId: "m-old",
      createdAt: "2026-06-01T02:00:00.000Z"
    }]);

    const result = exportContextMemoriesForUser(root, "2026-06-01T07:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.data) as { blockedCount: number; blockedMemories: unknown[] };
    expect(parsed.blockedCount).toBe(1);
    expect(parsed.blockedMemories).toEqual([expect.objectContaining({ text: "不要记住咖啡", sourceMemoryId: "m-old" })]);
  });
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run:

```powershell
npm test -- tests/app/main/memoryManagementService.test.ts
```

Expected: FAIL because `updateContextMemoryForUser()` and `blockContextMemoryForUser()` are not exported yet, and export JSON does not include block metadata.

- [ ] **Step 3: Implement edit/block/export service behavior**

Modify `src/app/main/memory/memoryManagementService.ts`.

Add imports:

```ts
import { appendMemoryBlockRule, readMemoryBlockRules } from "./memoryBlocklistStore.js";
```

Replace or extend response types with:

```ts
export type MemoryMutationResponse =
  | { ok: true }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "MEMORY_NOT_FOUND"; message: string };

export type UpdateMemoryResponse =
  | { ok: true; data: RendererContextMemory }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "INVALID_MEMORY_TEXT" | "MEMORY_NOT_FOUND"; message: string };

export type BlockMemoryResponse =
  | { ok: true; data: { blockedCount: number } }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "MEMORY_NOT_FOUND"; message: string };
```

Add helpers near `byUpdatedAtDesc()`:

```ts
function invalidId(): Extract<MemoryMutationResponse, { ok: false }> {
  return { ok: false, errorCode: "INVALID_MEMORY_ID", message: "记忆 id 无效。" };
}

function notFound(): Extract<MemoryMutationResponse, { ok: false }> {
  return { ok: false, errorCode: "MEMORY_NOT_FOUND", message: "这条记忆已经不存在了。" };
}
```

Update `deleteContextMemoryForUser()` to reuse the helper messages:

```ts
export function deleteContextMemoryForUser(root: string, id: string): MemoryMutationResponse {
  const normalizedId = id.trim();
  if (!normalizedId) return invalidId();

  const memories = readContextMemories(root);
  const next = memories.filter((item) => item.id !== normalizedId);
  if (next.length === memories.length) return notFound();

  writeContextMemories(root, next);
  return { ok: true };
}
```

Add the new functions:

```ts
export function updateContextMemoryForUser(root: string, input: { id: string; text: string; now?: string }): UpdateMemoryResponse {
  const normalizedId = input.id.trim();
  if (!normalizedId) return invalidId();
  const text = input.text.trim();
  if (!text) return { ok: false, errorCode: "INVALID_MEMORY_TEXT", message: "记忆内容不能为空。" };

  const memories = readContextMemories(root);
  const matchIndex = memories.findIndex((item) => item.id === normalizedId);
  if (matchIndex === -1) return notFound();

  const updated = { ...memories[matchIndex], text, updatedAt: input.now ?? new Date().toISOString() };
  const next = memories.map((item, index) => index === matchIndex ? updated : item);
  writeContextMemories(root, next);
  return { ok: true, data: toRendererMemory(updated) };
}

export function blockContextMemoryForUser(root: string, input: { id: string; now?: string }): BlockMemoryResponse {
  const normalizedId = input.id.trim();
  if (!normalizedId) return invalidId();

  const memories = readContextMemories(root);
  const target = memories.find((item) => item.id === normalizedId);
  if (!target) return notFound();

  appendMemoryBlockRule(root, {
    text: target.text,
    kind: target.kind,
    sourceMemoryId: target.id,
    now: input.now
  });
  writeContextMemories(root, memories.filter((item) => item.id !== normalizedId));
  return { ok: true, data: { blockedCount: readMemoryBlockRules(root).length } };
}
```

Update `exportContextMemoriesForUser()`:

```ts
export function exportContextMemoriesForUser(root: string, now = new Date().toISOString()): ExportMemoriesServiceResponse {
  const memories = readContextMemories(root).map(toRendererMemory).sort(byUpdatedAtDesc);
  const blockedMemories = readMemoryBlockRules(root);
  return {
    ok: true,
    data: JSON.stringify({
      exportedAt: now,
      count: memories.length,
      blockedCount: blockedMemories.length,
      memories,
      blockedMemories
    }, null, 2)
  };
}
```

- [ ] **Step 4: Run service tests to verify they pass**

Run:

```powershell
npm test -- tests/app/main/memoryBlocklistStore.test.ts tests/app/main/memoryManagementService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add src/app/main/memory/memoryManagementService.ts tests/app/main/memoryManagementService.test.ts
git commit -m "feat: add memory correction service"
```

---

## Task 3: DeepSeek Extraction Block Filtering

**Files:**

- Modify: `tests/app/main/memoryExtractionService.test.ts`
- Modify: `src/app/main/memory/memoryExtractionService.ts`

- [ ] **Step 1: Add failing extraction filtering tests**

Modify imports in `tests/app/main/memoryExtractionService.test.ts`:

```ts
import { appendMemoryBlockRule } from "../../../src/app/main/memory/memoryBlocklistStore";
```

Append these tests inside `describe("memoryExtractionService", () => { ... })`:

```ts
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
```

- [ ] **Step 2: Run extraction tests to verify they fail**

Run:

```powershell
npm test -- tests/app/main/memoryExtractionService.test.ts
```

Expected: FAIL because extraction still writes blocked candidates.

- [ ] **Step 3: Implement blocked candidate filtering**

Modify imports in `src/app/main/memory/memoryExtractionService.ts`:

```ts
import { filterBlockedContextMemoryCandidates, readMemoryBlockRules } from "./memoryBlocklistStore.js";
```

Replace the candidate merge section at the end of `extractAndStoreMemories()` with:

```ts
  const nextItems = filterBlockedContextMemoryCandidates(
    toItems(parsed.data, input.turn.createdAt),
    readMemoryBlockRules(input.root)
  );
  const merged = nextItems.reduce((items, candidate) => mergeContextMemory(items, candidate), readContextMemories(input.root));
  writeContextMemories(input.root, merged);
  return { ok: true as const, data: { extraction: parsed.data, memoryIds: nextItems.map((memory) => memory.id) } };
```

- [ ] **Step 4: Run extraction tests to verify they pass**

Run:

```powershell
npm test -- tests/app/main/memoryExtractionService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add src/app/main/memory/memoryExtractionService.ts tests/app/main/memoryExtractionService.test.ts
git commit -m "feat: filter blocked memory extraction"
```

---

## Task 4: IPC And Renderer Bridge

**Files:**

- Modify: `tests/app/renderer/petBridge.test.ts`
- Modify: `src/app/renderer/petBridge.ts`
- Modify: `src/app/main/main.ts`

- [ ] **Step 1: Add failing bridge tests**

Modify `tests/app/renderer/petBridge.test.ts` inside `it("manages long-term memory through IPC", async () => { ... })` so the mock has two extra responses and the bridge calls update/block:

```ts
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
```

- [ ] **Step 2: Run bridge tests to verify they fail**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: FAIL because `updateMemory()` and `blockMemory()` do not exist.

- [ ] **Step 3: Extend renderer bridge types and methods**

Modify `src/app/renderer/petBridge.ts` after `DeleteMemoryResponse`:

```ts
export type UpdateMemoryResponse =
  | { ok: true; data: RendererContextMemory }
  | { ok: false; errorCode: string; message: string };

export type BlockMemoryResponse =
  | { ok: true; data: { blockedCount: number } }
  | { ok: false; errorCode: string; message: string };
```

Add IPC overloads to `IpcLike`:

```ts
  invoke(channel: "memory:update", payload: { id: string; text: string }): Promise<UpdateMemoryResponse>;
  invoke(channel: "memory:block", payload: { id: string }): Promise<BlockMemoryResponse>;
```

Add bridge methods after `exportMemories()`:

```ts
    updateMemory(id: string, text: string) {
      return ipc.invoke("memory:update", { id, text });
    },
    blockMemory(id: string) {
      return ipc.invoke("memory:block", { id });
    },
```

- [ ] **Step 4: Register main IPC handlers**

Modify imports in `src/app/main/main.ts`:

```ts
import {
  blockContextMemoryForUser,
  clearContextMemoriesForUser,
  deleteContextMemoryForUser,
  exportContextMemoriesForUser,
  getMemoryOverview,
  updateContextMemoryForUser
} from "./memory/memoryManagementService.js";
```

Add handlers after `memory:export`:

```ts
  ipcMain.handle("memory:update", (_event, payload: { id?: string; text?: string }) => updateContextMemoryForUser(appDataBaseDir, { id: payload?.id ?? "", text: payload?.text ?? "" }));
  ipcMain.handle("memory:block", (_event, payload: { id?: string }) => blockContextMemoryForUser(appDataBaseDir, { id: payload?.id ?? "" }));
```

- [ ] **Step 5: Run bridge tests to verify they pass**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```powershell
git add src/app/main/main.ts src/app/renderer/petBridge.ts tests/app/renderer/petBridge.test.ts
git commit -m "feat: expose memory correction bridge"
```

---

## Task 5: MemoryPanel Inline Edit And Block Controls

**Files:**

- Modify: `tests/app/renderer/MemoryPanel.test.ts`
- Modify: `src/app/renderer/MemoryPanel.tsx`

- [ ] **Step 1: Add failing component tests**

Modify the callbacks object in `tests/app/renderer/MemoryPanel.test.ts`:

```ts
  const callbacks = {
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    onExport: vi.fn(),
    onUpdate: vi.fn(),
    onBlock: vi.fn()
  };
```

Append these tests:

```ts
  it("edits a memory inline and calls onUpdate", async () => {
    const { rootElement, callbacks } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-memory-edit="m1"]') as HTMLButtonElement).click();
    });
    const editor = rootElement.querySelector('textarea[name="memoryEditText"]') as HTMLTextAreaElement;
    expect(editor.value).toBe("用户喜欢温柔提醒");

    await act(async () => {
      editor.value = "用户喜欢安静温柔的提醒";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      (rootElement.querySelector(".memory-edit-save") as HTMLButtonElement).click();
    });

    expect(callbacks.onUpdate).toHaveBeenCalledWith("m1", "用户喜欢安静温柔的提醒");
  });

  it("cancels editing without saving and disables empty save", async () => {
    const { rootElement, callbacks } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-memory-edit="m1"]') as HTMLButtonElement).click();
    });
    const editor = rootElement.querySelector('textarea[name="memoryEditText"]') as HTMLTextAreaElement;
    await act(async () => {
      editor.value = "   ";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect((rootElement.querySelector(".memory-edit-save") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      (rootElement.querySelector(".memory-edit-cancel") as HTMLButtonElement).click();
    });
    expect(rootElement.querySelector('textarea[name="memoryEditText"]')).toBeNull();
    expect(callbacks.onUpdate).not.toHaveBeenCalled();
  });

  it("fires the block callback from the do-not-remember action", async () => {
    const { rootElement, callbacks } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-memory-block="m1"]') as HTMLButtonElement).click();
    });

    expect(callbacks.onBlock).toHaveBeenCalledWith("m1");
  });
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```powershell
npm test -- tests/app/renderer/MemoryPanel.test.ts
```

Expected: FAIL because the component does not accept `onUpdate`/`onBlock` and does not render edit/block controls.

- [ ] **Step 3: Implement MemoryPanel controls**

Modify `src/app/renderer/MemoryPanel.tsx`.

Extend props:

```ts
export type MemoryPanelProps = {
  open: boolean;
  pending: boolean;
  overview: MemoryOverview | null;
  onClose(): void;
  onDelete(id: string): void;
  onClear(): void;
  onExport(): void;
  onUpdate(id: string, text: string): void;
  onBlock(id: string): void;
};
```

Update the function signature and local state:

```ts
export function MemoryPanel({ open, pending, overview, onClose, onDelete, onClear, onExport, onUpdate, onBlock }: MemoryPanelProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | RendererContextMemory["kind"]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
```

Add helper functions before `if (!open) return null;`:

```ts
  function startEditing(memory: RendererContextMemory) {
    setEditingId(memory.id);
    setEditingText(memory.text);
  }

  function saveEditing(memory: RendererContextMemory) {
    const nextText = editingText.trim();
    if (!nextText) return;
    onUpdate(memory.id, nextText);
    setEditingId(null);
    setEditingText("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingText("");
  }
```

Replace the memory list item body with this structure inside `filtered.map((memory) => (`:

```tsx
            <li key={memory.id}>
              <div>
                <span className="memory-kind">{kindLabels[memory.kind]}</span>
                <time>{formatTime(memory.updatedAt)}</time>
              </div>
              {editingId === memory.id ? (
                <div className="memory-editor">
                  <textarea
                    name="memoryEditText"
                    value={editingText}
                    disabled={pending}
                    onInput={(event) => setEditingText((event.currentTarget as HTMLTextAreaElement).value)}
                    aria-label="编辑长期记忆"
                  />
                  <div className="memory-editor-actions">
                    <button className="memory-edit-save" type="button" disabled={pending || editingText.trim().length === 0} onClick={() => saveEditing(memory)}>保存</button>
                    <button className="memory-edit-cancel" type="button" disabled={pending} onClick={cancelEditing}>取消</button>
                  </div>
                </div>
              ) : (
                <p>{memory.text}</p>
              )}
              <small>weight {memory.weight}{memory.tags.length > 0 ? ` · ${memory.tags.join(" · ")}` : ""}</small>
              <div className="memory-item-actions">
                <button className="memory-edit" data-memory-edit={memory.id} type="button" disabled={pending} onClick={() => startEditing(memory)}>编辑</button>
                <button className="memory-block" data-memory-block={memory.id} type="button" disabled={pending} onClick={() => onBlock(memory.id)}>不要再记</button>
                <button className="memory-delete" data-memory-delete={memory.id} type="button" disabled={pending} onClick={() => onDelete(memory.id)}>删除</button>
              </div>
            </li>
```

- [ ] **Step 4: Run component tests to verify they pass**

Run:

```powershell
npm test -- tests/app/renderer/MemoryPanel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```powershell
git add src/app/renderer/MemoryPanel.tsx tests/app/renderer/MemoryPanel.test.ts
git commit -m "feat: add memory correction controls"
```

---

## Task 6: App Integration For Edit And Do-not-remember

**Files:**

- Modify: `tests/app/renderer/App.test.ts`
- Modify: `src/app/renderer/App.tsx`

- [ ] **Step 1: Add failing integrated renderer test**

Append this test in `tests/app/renderer/App.test.ts` after the existing `opens memory panel and manages long-term memories` test:

```ts
  it("edits and blocks long-term memories from the memory panel", async () => {
    const getMemoryOverview = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        relationship: {
          stage: "familiar",
          stageLabel: "熟悉",
          stageDescription: "卡卡已经记得一些与你相处的节奏。",
          familiarity: 30,
          affection: 30,
          engagement: 30,
          trust: 30,
          updatedAt: "2026-06-01T01:00:00.000Z"
        },
        memories: [
          {
            id: "m1",
            kind: "preference",
            text: "用户喜欢很吵的提醒",
            tags: ["chat"],
            weight: 80,
            createdAt: "2026-06-01T01:00:00.000Z",
            updatedAt: "2026-06-01T01:00:00.000Z"
          },
          {
            id: "m2",
            kind: "fact",
            text: "用户不想记住咖啡",
            tags: ["chat"],
            weight: 60,
            createdAt: "2026-06-01T01:00:00.000Z",
            updatedAt: "2026-06-01T02:00:00.000Z"
          }
        ]
      }
    });
    const updateMemory = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "m1",
        kind: "preference",
        text: "用户喜欢安静温柔的提醒",
        tags: ["chat"],
        weight: 80,
        createdAt: "2026-06-01T01:00:00.000Z",
        updatedAt: "2026-06-01T06:00:00.000Z"
      }
    });
    const blockMemory = vi.fn().mockResolvedValue({ ok: true, data: { blockedCount: 1 } });
    window.confirm = vi.fn().mockReturnValue(true);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getMemoryOverview,
      updateMemory,
      blockMemory
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });
    await act(async () => {
      (document.querySelector(".memory-trigger") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    await act(async () => {
      (document.querySelector('[data-memory-edit="m1"]') as HTMLButtonElement).click();
    });
    const editor = document.querySelector('textarea[name="memoryEditText"]') as HTMLTextAreaElement;
    await act(async () => {
      editor.value = "用户喜欢安静温柔的提醒";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      (document.querySelector(".memory-edit-save") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(updateMemory).toHaveBeenCalledWith("m1", "用户喜欢安静温柔的提醒");
    expect(document.querySelector(".memory-panel")?.textContent).toContain("用户喜欢安静温柔的提醒");
    expect(document.querySelector(".speech-bubble")?.textContent).toContain("我记住修正啦");

    await act(async () => {
      (document.querySelector('[data-memory-block="m2"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(blockMemory).toHaveBeenCalledWith("m2");
    expect(document.querySelector(".memory-panel")?.textContent).not.toContain("用户不想记住咖啡");
    expect(document.querySelector(".speech-bubble")?.textContent).toContain("好，我以后不会再记类似内容");
  });
```

- [ ] **Step 2: Run the integrated test to verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/App.test.ts
```

Expected: FAIL because `App` does not expose update/block handlers to `MemoryPanel` yet.

- [ ] **Step 3: Extend the App bridge declaration and imports**

Modify `src/app/renderer/App.tsx` import from `petBridge`:

```ts
import type {
  BlockMemoryResponse,
  ChatHistoryResponse,
  ClearChatHistoryResponse,
  ClearMemoriesResponse,
  DeepSeekSettings,
  DeepSeekSettingsInput,
  DeepSeekSettingsResponse,
  DeleteMemoryResponse,
  ExportMemoriesResponse,
  MemoryOverviewResponse,
  RendererPetPack,
  UpdateMemoryResponse
} from "./petBridge";
```

Extend `Window.clinePet`:

```ts
      updateMemory?(id: string, text: string): Promise<UpdateMemoryResponse>;
      blockMemory?(id: string): Promise<BlockMemoryResponse>;
```

- [ ] **Step 4: Add App handlers**

Add these functions after `deleteMemoryFromPanel()` in `src/app/renderer/App.tsx`:

```ts
  async function updateMemoryFromPanel(id: string, text: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("保存这条长期记忆的修改？") : true;
    if (!confirmed) return;
    setMemoryPending(true);
    const result = await window.clinePet?.updateMemory?.(id, text);
    setMemoryPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("记忆通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setMemoryOverview((current) => current ? {
        ...current,
        memories: current.memories.map((memory) => memory.id === id ? result.data : memory)
      } : current);
      pushBubble(bubbleFromNotice("我记住修正啦。"));
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function blockMemoryFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("删除这条长期记忆，并让卡卡以后不要再记类似内容？") : true;
    if (!confirmed) return;
    setMemoryPending(true);
    const result = await window.clinePet?.blockMemory?.(id);
    setMemoryPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("记忆通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setMemoryOverview((current) => current ? { ...current, memories: current.memories.filter((memory) => memory.id !== id) } : current);
      pushBubble(bubbleFromNotice("好，我以后不会再记类似内容。"));
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }
```

Update the `MemoryPanel` render call:

```tsx
      <MemoryPanel
        open={memoryOpen}
        pending={memoryPending}
        overview={memoryOverview}
        onClose={() => setMemoryOpen(false)}
        onDelete={deleteMemoryFromPanel}
        onClear={clearMemoriesFromPanel}
        onExport={exportMemoriesFromPanel}
        onUpdate={updateMemoryFromPanel}
        onBlock={blockMemoryFromPanel}
      />
```

- [ ] **Step 5: Run integrated renderer tests to verify they pass**

Run:

```powershell
npm test -- tests/app/renderer/App.test.ts
```

Expected: PASS. jsdom `act(...)` warnings are acceptable only if Vitest exits 0.

- [ ] **Step 6: Commit Task 6**

Run:

```powershell
git add src/app/renderer/App.tsx tests/app/renderer/App.test.ts
git commit -m "feat: integrate memory correction flows"
```

---

## Task 7: Styles, Docs, Full Verification, And Push

**Files:**

- Modify: `tests/app/renderer/petStyles.test.ts`
- Modify: `src/app/renderer/petStyles.css`
- Modify: `docs/development/kaka-development-guide.md`
- Modify: `docs/development/kaka-compact.md`

- [ ] **Step 1: Add failing style selector test**

Modify the memory style test in `tests/app/renderer/petStyles.test.ts`:

```ts
  it("includes memory trigger, relationship overview, memory list, and correction styles", () => {
    expect(styles).toContain(".memory-trigger");
    expect(styles).toContain(".memory-panel");
    expect(styles).toContain(".relationship-card");
    expect(styles).toContain(".memory-list");
    expect(styles).toContain(".memory-delete");
    expect(styles).toContain(".memory-edit");
    expect(styles).toContain(".memory-block");
    expect(styles).toContain(".memory-editor");
    expect(styles).toContain(".memory-editor-actions");
  });
```

- [ ] **Step 2: Run style test to verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/petStyles.test.ts
```

Expected: FAIL until the new selectors exist in `petStyles.css`.

- [ ] **Step 3: Add CSS for memory correction controls**

Append or merge these selectors into `src/app/renderer/petStyles.css` near existing memory styles:

```css
.memory-item-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.memory-edit,
.memory-block,
.memory-delete {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  padding: 4px 8px;
}

.memory-block {
  border-color: rgba(255, 185, 120, 0.45);
  color: #ffd7ad;
}

.memory-editor {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.memory-editor textarea {
  min-height: 58px;
  resize: vertical;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  padding: 8px;
  font: inherit;
}

.memory-editor-actions {
  display: flex;
  gap: 8px;
}

.memory-edit-save,
.memory-edit-cancel {
  border: 0;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
}

.memory-edit-save {
  background: rgba(128, 219, 180, 0.24);
  color: #d9ffe9;
}

.memory-edit-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.82);
}
```

- [ ] **Step 4: Run focused renderer tests**

Run:

```powershell
npm test -- tests/app/renderer/petStyles.test.ts tests/app/renderer/MemoryPanel.test.ts tests/app/renderer/App.test.ts
```

Expected: PASS. jsdom `act(...)` warnings are acceptable only if Vitest exits 0.

- [ ] **Step 5: Update development guide**

In `docs/development/kaka-development-guide.md`, add this section after `## Cyber Life v2.1`:

```md
## Cyber Life v2.2

- 设计文档：`docs/superpowers/specs/2026-06-01-kaka-cyber-life-v2-2-memory-correction-design.md`。
- 实现计划：`docs/superpowers/plans/2026-06-01-kaka-cyber-life-v2-2-memory-correction-implementation.md`。
- `MemoryPanel` 在每条长期记忆上新增 `编辑` 和 `不要再记`。
- `编辑` 只修改长期记忆的 `text` 和 `updatedAt`，保留 id/kind/tags/weight/createdAt。
- `不要再记` 会删除当前长期记忆，并写入 `%APPDATA%/cline-desktop-pet/memory-blocklist.json`。
- DeepSeek 记忆提炼在写入 `context-memory.jsonl` 前会过滤已禁止或高度相似的同类候选记忆。
- 删除和清空长期记忆仍不影响 `chat-history.jsonl`；清空长期记忆也不会清空 blocklist，因为“不要再记”是用户的隐私偏好。
```

Also add `memory-blocklist.json` to the local data list near `context-memory.jsonl`.

- [ ] **Step 6: Update compact**

In `docs/development/kaka-compact.md` update:

- Latest important commits after implementation.
- Built features with v2.2 memory correction.
- Local memory files to include `memory-blocklist.json`.
- Main files to include `memoryBlocklistStore.ts`.
- Likely next tasks to point to blocklist UI management, history-level `不要再记`, and relationship/profile UI.

Use this exact bullet under built features:

```md
- Cyber Life v2.2 memory correction: users can edit long-term memory text and mark a memory as `不要再记`; blocked/similar future extraction candidates are filtered before writing `context-memory.jsonl`.
```

- [ ] **Step 7: Run full verification**

Run:

```powershell
npm test
npm run build
git status --short --branch
```

Expected:

- `npm test` exits 0.
- `npm run build` exits 0 for renderer, main, and preload builds.
- `git status --short --branch` shows only intended tracked changes plus untracked `.superpowers/`.

- [ ] **Step 8: Commit docs and style task**

Run:

```powershell
git add src/app/renderer/petStyles.css tests/app/renderer/petStyles.test.ts docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "docs: update Kaka memory correction notes"
```

- [ ] **Step 9: Push feature branch**

Run:

```powershell
git push origin feat/12-state-local-pet-pack
git status --short --branch
```

Expected: branch is synced with `origin/feat/12-state-local-pet-pack`; `.superpowers/` remains untracked and uncommitted.

---

## Plan Self-Review

- Spec coverage: Tasks cover new local file/path, block rule model, edit action, block action, extraction filtering, IPC/bridge, renderer UI, styles, docs, and verification.
- Scope check: The plan does not include full settings center, blocklist management UI, chat-history bulk actions, cloud sync, relationship editing, or external data access.
- Type consistency: The plan consistently uses `MemoryBlockRule`, `memoryBlocklistFile`, `updateContextMemoryForUser`, `blockContextMemoryForUser`, `UpdateMemoryResponse`, `BlockMemoryResponse`, `memory:update`, `memory:block`, `updateMemory`, and `blockMemory`.
- Privacy check: The plan only reads/writes Kaka-owned memory files and leaves `chat-history.jsonl`, DeepSeek config, logs, API keys, and external files untouched.