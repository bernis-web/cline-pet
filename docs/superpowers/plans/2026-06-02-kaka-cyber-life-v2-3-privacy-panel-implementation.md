# Kaka Cyber Life v2.3 Privacy Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified privacy panel where users can inspect and control Kaka's long-term memories, `不要再记` block rules, chat history, export JSON, and clearing actions from one local UI.

**Architecture:** Add focused main-process privacy helpers that compose existing memory, blocklist, relationship, and chat-history stores. Expose a small renderer bridge surface for unified overview/export/blocklist mutations. Replace separate App-level history/memory panels with one tabbed privacy panel while preserving the existing `历史` and `记忆` entry buttons.

**Tech Stack:** Electron IPC, React, TypeScript, Vitest, jsdom renderer tests, local JSON/JSONL stores in `%APPDATA%/cline-desktop-pet/`.

---

## File Structure

- Create `src/app/main/memory/privacyManagementService.ts`
  - Builds `PrivacyOverview` from existing local stores.
  - Exports unified privacy JSON.
  - Deletes and clears memory blocklist rules through the blocklist store.
- Modify `src/app/main/memory/memoryBlocklistStore.ts`
  - Add low-level `deleteMemoryBlockRule()` and `clearMemoryBlockRules()` helpers.
- Create `tests/app/main/privacyManagementService.test.ts`
  - Verifies overview, export, blocklist delete/clear, and independence between memory/history/blocklist data.
- Modify `tests/app/main/memoryBlocklistStore.test.ts`
  - Covers the new blocklist helper functions.
- Modify `src/app/renderer/petBridge.ts`
  - Add privacy overview/export types and bridge methods.
  - Add blocklist delete/clear bridge methods.
- Modify `tests/app/renderer/petBridge.test.ts`
  - Verifies the new IPC channel names and payloads.
- Modify `src/app/main/main.ts`
  - Register `privacy:get-overview`, `privacy:export`, `memory-blocklist:delete`, and `memory-blocklist:clear` handlers.
- Create `src/app/renderer/privacyTypes.ts`
  - Re-export privacy-related renderer types from `petBridge.ts`.
- Create `src/app/renderer/PrivacyPanel.tsx`
  - Tabbed UI for `长期记忆`, `不要再记`, `聊天历史`, and `导出/清除`.
- Create `tests/app/renderer/PrivacyPanel.test.ts`
  - Component tests for tabs, memory actions, blocklist actions, history, export, and empty states.
- Modify `src/app/renderer/App.tsx`
  - Replace separate `MemoryPanel` and `ChatHistoryPanel` usage with `PrivacyPanel`.
  - Keep `历史` and `记忆` buttons but open different initial tabs.
- Modify `tests/app/renderer/App.test.ts`
  - Update integration tests to use the unified privacy panel.
- Modify `src/app/renderer/petStyles.css`
  - Add privacy panel tabs, blocklist, export, and clear-section styles.
- Modify `tests/app/renderer/petStyles.test.ts`
  - Assert key privacy panel selectors exist.
- Modify `docs/development/kaka-development-guide.md` and `docs/development/kaka-compact.md`
  - Document Cyber Life v2.3 after implementation is verified.

---

### Task 1: Add blocklist delete and clear helpers

**Files:**
- Modify: `tests/app/main/memoryBlocklistStore.test.ts`
- Modify: `src/app/main/memory/memoryBlocklistStore.ts`

- [ ] **Step 1: Write failing tests for deleting and clearing block rules**

Add these tests at the end of `tests/app/main/memoryBlocklistStore.test.ts` inside the existing `describe("memoryBlocklistStore", ...)` block:

```ts
  it("deletes one block rule by id without touching other rules", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemoryBlockRules(root, [
      {
        id: "rule-keep",
        text: "保留规则",
        normalizedText: "保留规则",
        kind: "fact",
        createdAt: "2026-06-01T01:00:00.000Z"
      },
      {
        id: "rule-delete",
        text: "删除规则",
        normalizedText: "删除规则",
        kind: "preference",
        sourceMemoryId: "memory-old",
        createdAt: "2026-06-01T02:00:00.000Z"
      }
    ]);

    expect(deleteMemoryBlockRule(root, "rule-delete")).toBe(true);

    expect(readMemoryBlockRules(root).map((rule) => rule.id)).toEqual(["rule-keep"]);
  });

  it("returns false when deleting an invalid or missing block rule id", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemoryBlockRules(root, [{
      id: "rule-known",
      text: "存在的规则",
      normalizedText: "存在的规则",
      kind: "preference",
      createdAt: "2026-06-01T01:00:00.000Z"
    }]);

    expect(deleteMemoryBlockRule(root, "  ")).toBe(false);
    expect(deleteMemoryBlockRule(root, "missing")).toBe(false);
    expect(readMemoryBlockRules(root).map((rule) => rule.id)).toEqual(["rule-known"]);
  });

  it("clears all memory block rules", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemoryBlockRules(root, [{
      id: "rule-1",
      text: "不要记咖啡",
      normalizedText: "不要记咖啡",
      kind: "preference",
      createdAt: "2026-06-01T01:00:00.000Z"
    }]);

    clearMemoryBlockRules(root);

    expect(readMemoryBlockRules(root)).toEqual([]);
  });
```

Update the import list at the top of the same test file:

```ts
import {
  appendMemoryBlockRule,
  clearMemoryBlockRules,
  deleteMemoryBlockRule,
  filterBlockedContextMemoryCandidates,
  readMemoryBlockRules,
  writeMemoryBlockRules
} from "../../../src/app/main/memory/memoryBlocklistStore";
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack
npm test -- tests/app/main/memoryBlocklistStore.test.ts
```

Expected: FAIL because `deleteMemoryBlockRule` and `clearMemoryBlockRules` are not exported.

- [ ] **Step 3: Implement the blocklist helpers**

Append these functions to `src/app/main/memory/memoryBlocklistStore.ts` after `appendMemoryBlockRule()` and before `isContextMemoryBlocked()`:

```ts
export function deleteMemoryBlockRule(root: string, id: string): boolean {
  const normalizedId = id.trim();
  if (!normalizedId) return false;

  const rules = readMemoryBlockRules(root);
  const next = rules.filter((rule) => rule.id !== normalizedId);
  if (next.length === rules.length) return false;

  writeMemoryBlockRules(root, next);
  return true;
}

export function clearMemoryBlockRules(root: string) {
  writeMemoryBlockRules(root, []);
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm test -- tests/app/main/memoryBlocklistStore.test.ts
```

Expected: PASS for `memoryBlocklistStore.test.ts`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/memoryBlocklistStore.test.ts src/app/main/memory/memoryBlocklistStore.ts
git commit -m "feat: add memory blocklist management helpers"
```

---

### Task 2: Add privacy management service

**Files:**
- Create: `tests/app/main/privacyManagementService.test.ts`
- Create: `src/app/main/memory/privacyManagementService.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/app/main/privacyManagementService.test.ts`:

```ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- tests/app/main/privacyManagementService.test.ts
```

Expected: FAIL because `privacyManagementService` does not exist.

- [ ] **Step 3: Implement the service**

Create `src/app/main/memory/privacyManagementService.ts`:

```ts
import { readChatHistory, type ChatHistoryTurn } from "./chatHistoryStore.js";
import { clearMemoryBlockRules, deleteMemoryBlockRule, readMemoryBlockRules } from "./memoryBlocklistStore.js";
import { getMemoryOverview, type MemoryOverview } from "./memoryManagementService.js";
import type { MemoryBlockRule } from "./memoryTypes.js";

export type RendererMemoryBlockRule = Pick<MemoryBlockRule, "id" | "text" | "kind" | "sourceMemoryId" | "createdAt">;

export type PrivacyOverview = MemoryOverview & {
  blockRules: RendererMemoryBlockRule[];
  chatHistory: ChatHistoryTurn[];
  counts: {
    memories: number;
    blockRules: number;
    chatHistoryTurns: number;
  };
};

export type PrivacyOverviewResponse =
  | { ok: true; data: PrivacyOverview }
  | { ok: false; errorCode: string; message: string };

export type PrivacyExportResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };

export type BlockRuleMutationResponse =
  | { ok: true }
  | { ok: false; errorCode: "INVALID_BLOCK_RULE_ID" | "BLOCK_RULE_NOT_FOUND"; message: string };

function byCreatedAtDesc(left: RendererMemoryBlockRule, right: RendererMemoryBlockRule) {
  return (right.createdAt || "").localeCompare(left.createdAt || "");
}

function toRendererBlockRule(rule: MemoryBlockRule): RendererMemoryBlockRule {
  return {
    id: rule.id,
    text: rule.text,
    ...(rule.kind ? { kind: rule.kind } : {}),
    ...(rule.sourceMemoryId ? { sourceMemoryId: rule.sourceMemoryId } : {}),
    createdAt: rule.createdAt
  };
}

export function getPrivacyOverview(root: string): PrivacyOverview {
  const memoryOverview = getMemoryOverview(root);
  const blockRules = readMemoryBlockRules(root).map(toRendererBlockRule).sort(byCreatedAtDesc);
  const chatHistory = readChatHistory(root);
  return {
    ...memoryOverview,
    blockRules,
    chatHistory,
    counts: {
      memories: memoryOverview.memories.length,
      blockRules: blockRules.length,
      chatHistoryTurns: chatHistory.length
    }
  };
}

export function exportPrivacyDataForUser(root: string, now = new Date().toISOString()): PrivacyExportResponse {
  const overview = getPrivacyOverview(root);
  return {
    ok: true,
    data: JSON.stringify({
      exportedAt: now,
      counts: overview.counts,
      relationship: overview.relationship,
      memories: overview.memories,
      blockRules: overview.blockRules,
      chatHistory: overview.chatHistory
    }, null, 2)
  };
}

export function deleteMemoryBlockRuleForUser(root: string, id: string): BlockRuleMutationResponse {
  const normalizedId = id.trim();
  if (!normalizedId) return { ok: false, errorCode: "INVALID_BLOCK_RULE_ID", message: "不要再记规则 id 无效。" };
  return deleteMemoryBlockRule(root, normalizedId)
    ? { ok: true }
    : { ok: false, errorCode: "BLOCK_RULE_NOT_FOUND", message: "这条不要再记规则已经不存在了。" };
}

export function clearMemoryBlockRulesForUser(root: string): Extract<BlockRuleMutationResponse, { ok: true }> {
  clearMemoryBlockRules(root);
  return { ok: true };
}
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```powershell
npm test -- tests/app/main/privacyManagementService.test.ts tests/app/main/memoryBlocklistStore.test.ts
```

Expected: PASS for both files.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/privacyManagementService.test.ts src/app/main/memory/privacyManagementService.ts tests/app/main/memoryBlocklistStore.test.ts src/app/main/memory/memoryBlocklistStore.ts
git commit -m "feat: add privacy management service"
```

---

### Task 3: Expose privacy IPC and renderer bridge methods

**Files:**
- Modify: `tests/app/renderer/petBridge.test.ts`
- Modify: `src/app/renderer/petBridge.ts`
- Modify: `src/app/main/main.ts`

- [ ] **Step 1: Write failing bridge test**

Add this test to `tests/app/renderer/petBridge.test.ts` inside the existing `describe("renderer pet bridge", ...)` block:

```ts
  it("manages unified privacy data through IPC", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { counts: { memories: 0, blockRules: 0, chatHistoryTurns: 0 }, memories: [], blockRules: [], chatHistory: [] } })
      .mockResolvedValueOnce({ ok: true, data: "{}" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.getPrivacyOverview();
    await bridge.exportPrivacyData();
    await bridge.deleteMemoryBlockRule("rule-1");
    await bridge.clearMemoryBlockRules();

    expect(invoke).toHaveBeenNthCalledWith(1, "privacy:get-overview");
    expect(invoke).toHaveBeenNthCalledWith(2, "privacy:export");
    expect(invoke).toHaveBeenNthCalledWith(3, "memory-blocklist:delete", { id: "rule-1" });
    expect(invoke).toHaveBeenNthCalledWith(4, "memory-blocklist:clear");
  });
```

- [ ] **Step 2: Run the bridge test and verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: FAIL because the bridge methods do not exist.

- [ ] **Step 3: Add bridge types and methods**

Modify `src/app/renderer/petBridge.ts`.

Add these types after `ExportMemoriesResponse`:

```ts
export type RendererMemoryBlockRule = {
  id: string;
  text: string;
  kind?: RendererContextMemory["kind"];
  sourceMemoryId?: string;
  createdAt: string;
};

export type PrivacyOverview = MemoryOverview & {
  blockRules: RendererMemoryBlockRule[];
  chatHistory: RendererChatHistoryTurn[];
  counts: {
    memories: number;
    blockRules: number;
    chatHistoryTurns: number;
  };
};

export type PrivacyOverviewResponse =
  | { ok: true; data: PrivacyOverview }
  | { ok: false; errorCode: string; message: string };

export type PrivacyExportResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };

export type BlockRuleMutationResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };
```

Add these `IpcLike.invoke` overloads near the existing memory/chat overloads:

```ts
  invoke(channel: "privacy:get-overview"): Promise<PrivacyOverviewResponse>;
  invoke(channel: "privacy:export"): Promise<PrivacyExportResponse>;
  invoke(channel: "memory-blocklist:delete", payload: { id: string }): Promise<BlockRuleMutationResponse>;
  invoke(channel: "memory-blocklist:clear"): Promise<BlockRuleMutationResponse>;
```

Add these methods to the object returned by `createRendererPetBridge()` near the existing memory methods:

```ts
    getPrivacyOverview() {
      return ipc.invoke("privacy:get-overview");
    },
    exportPrivacyData() {
      return ipc.invoke("privacy:export");
    },
    deleteMemoryBlockRule(id: string) {
      return ipc.invoke("memory-blocklist:delete", { id });
    },
    clearMemoryBlockRules() {
      return ipc.invoke("memory-blocklist:clear");
    },
```

- [ ] **Step 4: Add main process IPC handlers**

Modify `src/app/main/main.ts`.

Extend the memory management import with the privacy service functions:

```ts
import {
  clearMemoryBlockRulesForUser,
  deleteMemoryBlockRuleForUser,
  exportPrivacyDataForUser,
  getPrivacyOverview
} from "./memory/privacyManagementService.js";
```

Add these handlers next to the existing `memory:*` handlers:

```ts
  ipcMain.handle("privacy:get-overview", () => ({ ok: true, data: getPrivacyOverview(appDataBaseDir) }));
  ipcMain.handle("privacy:export", () => exportPrivacyDataForUser(appDataBaseDir));
  ipcMain.handle("memory-blocklist:delete", (_event, payload: { id?: string }) => deleteMemoryBlockRuleForUser(appDataBaseDir, payload?.id ?? ""));
  ipcMain.handle("memory-blocklist:clear", () => clearMemoryBlockRulesForUser(appDataBaseDir));
```

- [ ] **Step 5: Run focused tests and build type check through Vite build**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts tests/app/main/privacyManagementService.test.ts
npm run build
```

Expected: tests PASS; build PASS. If build reports a type-only mismatch in `main.ts`, correct import ordering or response type annotations while preserving the channel names above.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/app/renderer/petBridge.ts tests/app/renderer/petBridge.test.ts src/app/main/main.ts
git commit -m "feat: expose privacy panel bridge"
```

---

### Task 4: Build the tabbed PrivacyPanel component

**Files:**
- Create: `src/app/renderer/privacyTypes.ts`
- Create: `src/app/renderer/PrivacyPanel.tsx`
- Create: `tests/app/renderer/PrivacyPanel.test.ts`

- [ ] **Step 1: Create privacy type re-exports**

Create `src/app/renderer/privacyTypes.ts`:

```ts
export type {
  BlockRuleMutationResponse,
  PrivacyExportResponse,
  PrivacyOverview,
  PrivacyOverviewResponse,
  RendererMemoryBlockRule
} from "./petBridge";

export type PrivacyTab = "memories" | "blocklist" | "history" | "export";
```

- [ ] **Step 2: Write failing PrivacyPanel tests**

Create `tests/app/renderer/PrivacyPanel.test.ts`:

```ts
// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyPanel } from "../../../src/app/renderer/PrivacyPanel";
import type { PrivacyOverview, PrivacyTab } from "../../../src/app/renderer/privacyTypes";

const overview: PrivacyOverview = {
  relationship: {
    stage: "close",
    stageLabel: "亲近",
    stageDescription: "卡卡和你更亲近了，会更自然地回应你的习惯。",
    familiarity: 50,
    affection: 60,
    engagement: 70,
    trust: 80,
    updatedAt: "2026-06-01T04:00:00.000Z"
  },
  memories: [{
    id: "m1",
    kind: "preference",
    text: "用户喜欢温柔提醒",
    tags: ["chat"],
    weight: 80,
    createdAt: "2026-06-01T01:00:00.000Z",
    updatedAt: "2026-06-01T03:00:00.000Z"
  }],
  blockRules: [{
    id: "rule-1",
    text: "不要记住咖啡",
    kind: "preference",
    sourceMemoryId: "old-memory",
    createdAt: "2026-06-01T02:00:00.000Z"
  }],
  chatHistory: [{
    id: "turn-1",
    userText: "今天好累",
    assistantText: "先喝口水，我在旁边陪你。",
    createdAt: "2026-06-01T04:00:00.000Z",
    sentiment: "tired",
    memoryIds: ["m1"]
  }],
  counts: { memories: 1, blockRules: 1, chatHistoryTurns: 1 }
};

function renderPanel(initialTab: PrivacyTab = "memories", props: Partial<React.ComponentProps<typeof PrivacyPanel>> = {}) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  const callbacks = {
    onClose: vi.fn(),
    onDeleteMemory: vi.fn(),
    onClearMemories: vi.fn(),
    onExportPrivacyData: vi.fn(),
    onUpdateMemory: vi.fn(),
    onBlockMemory: vi.fn(),
    onDeleteBlockRule: vi.fn(),
    onClearBlockRules: vi.fn(),
    onClearChatHistory: vi.fn()
  };
  act(() => {
    root.render(React.createElement(PrivacyPanel, {
      open: true,
      pending: false,
      overview,
      initialTab,
      ...callbacks,
      ...props
    }));
  });
  return { rootElement, root, callbacks };
}

describe("PrivacyPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders the unified privacy shell and tab buttons", () => {
    const { rootElement } = renderPanel();

    expect(rootElement.querySelector(".privacy-panel")?.textContent).toContain("隐私与记忆");
    expect(rootElement.querySelector('[data-privacy-tab="memories"]')?.textContent).toContain("长期记忆");
    expect(rootElement.querySelector('[data-privacy-tab="blocklist"]')?.textContent).toContain("不要再记");
    expect(rootElement.querySelector('[data-privacy-tab="history"]')?.textContent).toContain("聊天历史");
    expect(rootElement.querySelector('[data-privacy-tab="export"]')?.textContent).toContain("导出/清除");
  });

  it("opens on the requested initial tab", () => {
    const { rootElement } = renderPanel("history");

    expect(rootElement.querySelector(".privacy-history-section")?.textContent).toContain("今天好累");
    expect(rootElement.querySelector(".privacy-memory-section")).toBeNull();
  });

  it("switches tabs and shows blocklist rules", async () => {
    const { rootElement } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-privacy-tab="blocklist"]') as HTMLButtonElement).click();
    });

    expect(rootElement.querySelector(".privacy-blocklist-section")?.textContent).toContain("不要记住咖啡");
    expect(rootElement.querySelector(".privacy-blocklist-section")?.textContent).not.toContain("normalizedText");
  });

  it("fires memory callbacks from the memory tab", async () => {
    const { rootElement, callbacks } = renderPanel("memories");

    await act(async () => {
      (rootElement.querySelector('[data-memory-edit="m1"]') as HTMLButtonElement).click();
    });
    const editor = rootElement.querySelector('textarea[name="memoryEditText"]') as HTMLTextAreaElement;
    await act(async () => {
      editor.value = "用户喜欢安静温柔的提醒";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      (rootElement.querySelector(".memory-edit-save") as HTMLButtonElement).click();
      (rootElement.querySelector('[data-memory-block="m1"]') as HTMLButtonElement).click();
      (rootElement.querySelector('[data-memory-delete="m1"]') as HTMLButtonElement).click();
    });

    expect(callbacks.onUpdateMemory).toHaveBeenCalledWith("m1", "用户喜欢安静温柔的提醒");
    expect(callbacks.onBlockMemory).toHaveBeenCalledWith("m1");
    expect(callbacks.onDeleteMemory).toHaveBeenCalledWith("m1");
  });

  it("fires blocklist delete and clear callbacks", async () => {
    const { rootElement, callbacks } = renderPanel("blocklist");

    await act(async () => {
      (rootElement.querySelector('[data-block-rule-delete="rule-1"]') as HTMLButtonElement).click();
      (rootElement.querySelector(".block-rules-clear") as HTMLButtonElement).click();
    });

    expect(callbacks.onDeleteBlockRule).toHaveBeenCalledWith("rule-1");
    expect(callbacks.onClearBlockRules).toHaveBeenCalledOnce();
  });

  it("supports chat history search, copy, and clear", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { rootElement, callbacks } = renderPanel("history");

    const search = rootElement.querySelector('input[name="historySearch"]') as HTMLInputElement;
    await act(async () => {
      search.value = "喝口水";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      (rootElement.querySelector(".chat-history-copy") as HTMLButtonElement).click();
      (rootElement.querySelector(".chat-history-clear") as HTMLButtonElement).click();
    });

    expect(rootElement.querySelector(".privacy-history-section")?.textContent).toContain("先喝口水");
    expect(writeText).toHaveBeenCalledWith("你：今天好累\n卡卡：先喝口水，我在旁边陪你。");
    expect(callbacks.onClearChatHistory).toHaveBeenCalledOnce();
  });

  it("shows export and separated clear actions", async () => {
    const { rootElement, callbacks } = renderPanel("export");

    expect(rootElement.querySelector(".privacy-export-section")?.textContent).toContain("长期记忆 1");
    expect(rootElement.querySelector(".privacy-export-section")?.textContent).toContain("不要再记 1");
    expect(rootElement.querySelector(".privacy-export-section")?.textContent).toContain("聊天历史 1");

    await act(async () => {
      (rootElement.querySelector(".privacy-export-copy") as HTMLButtonElement).click();
      (rootElement.querySelector(".privacy-clear-memories") as HTMLButtonElement).click();
      (rootElement.querySelector(".privacy-clear-block-rules") as HTMLButtonElement).click();
      (rootElement.querySelector(".privacy-clear-history") as HTMLButtonElement).click();
    });

    expect(callbacks.onExportPrivacyData).toHaveBeenCalledOnce();
    expect(callbacks.onClearMemories).toHaveBeenCalledOnce();
    expect(callbacks.onClearBlockRules).toHaveBeenCalledOnce();
    expect(callbacks.onClearChatHistory).toHaveBeenCalledOnce();
  });

  it("renders nothing while closed", () => {
    const { rootElement } = renderPanel("memories", { open: false });

    expect(rootElement.querySelector(".privacy-panel")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the component test and verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/PrivacyPanel.test.ts
```

Expected: FAIL because `PrivacyPanel.tsx` does not exist.

- [ ] **Step 4: Implement `PrivacyPanel.tsx`**

Create `src/app/renderer/PrivacyPanel.tsx`. The implementation must include these public props and helper labels:

```ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { RendererContextMemory } from "./memoryTypes";
import type { PrivacyOverview, PrivacyTab, RendererMemoryBlockRule } from "./privacyTypes";

export type PrivacyPanelProps = {
  open: boolean;
  pending: boolean;
  overview: PrivacyOverview | null;
  initialTab: PrivacyTab;
  onClose(): void;
  onDeleteMemory(id: string): void;
  onClearMemories(): void;
  onExportPrivacyData(): void;
  onUpdateMemory(id: string, text: string): void;
  onBlockMemory(id: string): void;
  onDeleteBlockRule(id: string): void;
  onClearBlockRules(): void;
  onClearChatHistory(): void;
};

const kindLabels: Record<RendererContextMemory["kind"], string> = {
  "conversation-summary": "对话摘要",
  fact: "事实",
  preference: "偏好",
  "project-context": "项目"
};

const tabLabels: Record<PrivacyTab, string> = {
  memories: "长期记忆",
  blocklist: "不要再记",
  history: "聊天历史",
  export: "导出/清除"
};
```

The component must render:

- Shell selector: `.privacy-panel`.
- Tab buttons with `data-privacy-tab="memories"`, `data-privacy-tab="blocklist"`, `data-privacy-tab="history"`, `data-privacy-tab="export"`.
- Memory tab section selector: `.privacy-memory-section`.
- Blocklist tab section selector: `.privacy-blocklist-section`.
- History tab section selector: `.privacy-history-section`.
- Export tab section selector: `.privacy-export-section`.

Use the existing memory edit pattern from `MemoryPanel.tsx`: `editingId`, `editingText`, and `editingTextRef` so save uses the current textarea value in jsdom tests.

Use this per-turn copy text in the history tab:

```ts
void navigator.clipboard?.writeText?.(`你：${turn.userText}\n卡卡：${turn.assistantText}`);
```

Use this text for the blocklist empty state:

```tsx
<p className="privacy-empty">还没有“不要再记”规则。你标记过的内容会出现在这里，之后也可以撤销。</p>
```

Use this warning in the export/clear tab:

```tsx
<p className="privacy-note">清除操作只影响对应数据。清空长期记忆不会清空聊天历史，也不会清空“不要再记”规则。</p>
```

- [ ] **Step 5: Run the component test and verify it passes**

Run:

```powershell
npm test -- tests/app/renderer/PrivacyPanel.test.ts
```

Expected: PASS for `PrivacyPanel.test.ts`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/app/renderer/privacyTypes.ts src/app/renderer/PrivacyPanel.tsx tests/app/renderer/PrivacyPanel.test.ts
git commit -m "feat: add unified privacy panel"
```

---

### Task 5: Integrate PrivacyPanel into App

**Files:**
- Modify: `src/app/renderer/App.tsx`
- Modify: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Update failing App integration tests**

Modify the existing App tests that currently expect `.chat-history-panel` or `.memory-panel`:

1. In `opens the chat history panel and loads stored conversations`, replace the mocked `getChatHistory` with `getPrivacyOverview`, and assert `.privacy-panel` plus `.privacy-history-section`.
2. In `opens memory panel and manages long-term memories`, replace `getMemoryOverview` with `getPrivacyOverview`, `exportMemories` with `exportPrivacyData`, and assert `.privacy-panel` plus `.privacy-memory-section`.
3. In `edits and blocks long-term memories from the memory panel`, replace `getMemoryOverview` with `getPrivacyOverview` and update `.memory-panel` assertions to `.privacy-panel`.

Add this new integration test near the memory/history panel tests:

```ts
  it("manages blocklist rules and unified privacy export from the privacy panel", async () => {
    const getPrivacyOverview = vi.fn().mockResolvedValue({
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
        memories: [],
        blockRules: [{
          id: "rule-1",
          text: "不要记住咖啡",
          kind: "preference",
          sourceMemoryId: "old-memory",
          createdAt: "2026-06-01T02:00:00.000Z"
        }],
        chatHistory: [],
        counts: { memories: 0, blockRules: 1, chatHistoryTurns: 0 }
      }
    });
    const deleteMemoryBlockRule = vi.fn().mockResolvedValue({ ok: true });
    const clearMemoryBlockRules = vi.fn().mockResolvedValue({ ok: true });
    const exportPrivacyData = vi.fn().mockResolvedValue({ ok: true, data: "{\n  \"counts\": {\n    \"blockRules\": 1\n  }\n}" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.confirm = vi.fn().mockReturnValue(true);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getPrivacyOverview,
      deleteMemoryBlockRule,
      clearMemoryBlockRules,
      exportPrivacyData
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
      (document.querySelector('[data-privacy-tab="blocklist"]') as HTMLButtonElement).click();
    });

    expect(document.querySelector(".privacy-blocklist-section")?.textContent).toContain("不要记住咖啡");

    await act(async () => {
      (document.querySelector('[data-block-rule-delete="rule-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(deleteMemoryBlockRule).toHaveBeenCalledWith("rule-1");

    await act(async () => {
      (document.querySelector(".block-rules-clear") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(clearMemoryBlockRules).toHaveBeenCalledOnce();

    await act(async () => {
      (document.querySelector('[data-privacy-tab="export"]') as HTMLButtonElement).click();
      (document.querySelector(".privacy-export-copy") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(exportPrivacyData).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("{\n  \"counts\": {\n    \"blockRules\": 1\n  }\n}");
  });
```

- [ ] **Step 2: Run App tests and verify they fail**

Run:

```powershell
npm test -- tests/app/renderer/App.test.ts
```

Expected: FAIL because App still renders separate `ChatHistoryPanel` and `MemoryPanel`, and `Window.clinePet` does not declare privacy methods.

- [ ] **Step 3: Update App imports and Window bridge declaration**

In `src/app/renderer/App.tsx`, replace `ChatHistoryPanel` and `MemoryPanel` imports with:

```ts
import { PrivacyPanel } from "./PrivacyPanel";
```

Add these type imports from `petBridge`:

```ts
BlockRuleMutationResponse,
PrivacyExportResponse,
PrivacyOverview,
PrivacyOverviewResponse,
```

Update `Window.clinePet` with:

```ts
      getPrivacyOverview?(): Promise<PrivacyOverviewResponse>;
      exportPrivacyData?(): Promise<PrivacyExportResponse>;
      deleteMemoryBlockRule?(id: string): Promise<BlockRuleMutationResponse>;
      clearMemoryBlockRules?(): Promise<BlockRuleMutationResponse>;
```

- [ ] **Step 4: Replace separate panel state with unified privacy state**

Replace these App state groups:

```ts
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPending, setHistoryPending] = useState(false);
  const [chatHistory, setChatHistory] = useState<RendererChatHistoryTurn[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryPending, setMemoryPending] = useState(false);
  const [memoryOverview, setMemoryOverview] = useState<MemoryOverview | null>(null);
```

with:

```ts
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyInitialTab, setPrivacyInitialTab] = useState<"memories" | "blocklist" | "history" | "export">("memories");
  const [privacyPending, setPrivacyPending] = useState(false);
  const [privacyOverview, setPrivacyOverview] = useState<PrivacyOverview | null>(null);
```

- [ ] **Step 5: Add unified privacy refresh and open helpers**

Replace `refreshChatHistory`, `openChatHistory`, `refreshMemoryOverview`, and `openMemoryPanel` with:

```ts
  async function refreshPrivacyOverview() {
    setPrivacyPending(true);
    const result = await window.clinePet?.getPrivacyOverview?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setPrivacyOverview(result.data);
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function openPrivacyPanel(tab: "memories" | "blocklist" | "history" | "export") {
    setPrivacyInitialTab(tab);
    setPrivacyOpen(true);
    await refreshPrivacyOverview();
  }
```

- [ ] **Step 6: Update mutation handlers to refresh unified data**

Change memory/history handlers to use `privacyPending`, `privacyOverview`, and `refreshPrivacyOverview()`.

Add these new handlers:

```ts
  async function deleteBlockRuleFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("撤销这条“不要再记”规则？以后类似内容可能会再次被卡卡提炼为长期记忆。") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.deleteMemoryBlockRule?.(id);
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("这条不要再记规则已撤销。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function clearBlockRulesFromPanel() {
    const confirmed = typeof window.confirm === "function" ? window.confirm("清空所有“不要再记”规则？这不会恢复已删除的长期记忆，但以后类似内容可能会再次被记住。") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.clearMemoryBlockRules?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("不要再记规则已清空。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function exportPrivacyDataFromPanel() {
    setPrivacyPending(true);
    const result = await window.clinePet?.exportPrivacyData?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (!result.ok) {
      pushBubble(bubbleFromNotice(result.message));
      return;
    }
    try {
      await navigator.clipboard?.writeText?.(result.data);
      pushBubble(bubbleFromNotice("隐私数据 JSON 已复制到剪贴板。"));
    } catch {
      pushBubble(bubbleFromNotice("剪贴板不可用，暂时无法复制隐私数据。"));
    }
  }
```

For existing `deleteMemoryFromPanel`, `updateMemoryFromPanel`, `blockMemoryFromPanel`, `clearMemoriesFromPanel`, and `clearChatHistoryFromPanel`, keep the same confirmation wording or make it more specific, call the same bridge method, and on success call `await refreshPrivacyOverview()` instead of updating `memoryOverview`, `chatHistory`, or `memoryPending`.

- [ ] **Step 7: Render `PrivacyPanel` and keep existing entry buttons**

Update the `PetView` props:

```tsx
        onOpenHistory={() => void openPrivacyPanel("history")}
        onOpenMemory={() => void openPrivacyPanel("memories")}
```

Replace `<ChatHistoryPanel ... />` and `<MemoryPanel ... />` with:

```tsx
      <PrivacyPanel
        open={privacyOpen}
        pending={privacyPending}
        overview={privacyOverview}
        initialTab={privacyInitialTab}
        onClose={() => setPrivacyOpen(false)}
        onDeleteMemory={deleteMemoryFromPanel}
        onClearMemories={clearMemoriesFromPanel}
        onExportPrivacyData={exportPrivacyDataFromPanel}
        onUpdateMemory={updateMemoryFromPanel}
        onBlockMemory={blockMemoryFromPanel}
        onDeleteBlockRule={deleteBlockRuleFromPanel}
        onClearBlockRules={clearBlockRulesFromPanel}
        onClearChatHistory={clearChatHistoryFromPanel}
      />
```

- [ ] **Step 8: Run focused App and panel tests**

Run:

```powershell
npm test -- tests/app/renderer/App.test.ts tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/petBridge.test.ts
```

Expected: PASS. Existing jsdom `act(...)` warnings may appear; final Vitest summary must pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add src/app/renderer/App.tsx tests/app/renderer/App.test.ts src/app/renderer/PrivacyPanel.tsx tests/app/renderer/PrivacyPanel.test.ts src/app/renderer/privacyTypes.ts
git commit -m "feat: integrate unified privacy panel"
```

---

### Task 6: Add styles and update docs

**Files:**
- Modify: `tests/app/renderer/petStyles.test.ts`
- Modify: `src/app/renderer/petStyles.css`
- Modify: `docs/development/kaka-development-guide.md`
- Modify: `docs/development/kaka-compact.md`

- [ ] **Step 1: Write failing style assertions**

Modify `tests/app/renderer/petStyles.test.ts`. Replace the last test name and add privacy selectors:

```ts
  it("includes unified privacy panel, tabs, blocklist, and export styles", () => {
    expect(styles).toContain(".memory-trigger");
    expect(styles).toContain(".privacy-panel");
    expect(styles).toContain(".privacy-tabs");
    expect(styles).toContain(".privacy-tab");
    expect(styles).toContain(".privacy-blocklist-section");
    expect(styles).toContain(".block-rule-list");
    expect(styles).toContain(".privacy-export-section");
    expect(styles).toContain(".privacy-clear-actions");
    expect(styles).toContain(".memory-edit");
    expect(styles).toContain(".memory-block");
    expect(styles).toContain(".memory-editor");
  });
```

- [ ] **Step 2: Run style test and verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/petStyles.test.ts
```

Expected: FAIL because `.privacy-panel` and related selectors do not exist yet.

- [ ] **Step 3: Add privacy panel CSS**

Modify `src/app/renderer/petStyles.css`. Reuse the existing panel look by keeping `.memory-panel` styles if present and add these selectors near the memory/history panel styles:

```css
.privacy-panel {
  position: fixed;
  inset: 12px;
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 250, 244, 0.96);
  box-shadow: 0 14px 36px rgba(88, 62, 42, 0.22);
  color: #4c3324;
  box-sizing: border-box;
  overflow: hidden;
}

.privacy-panel header,
.privacy-tabs,
.privacy-clear-actions,
.memory-item-actions,
.memory-editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.privacy-panel header {
  justify-content: space-between;
}

.privacy-tabs {
  flex-wrap: wrap;
}

.privacy-tab {
  border: 1px solid rgba(144, 92, 57, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  padding: 5px 9px;
  color: #6b4530;
}

.privacy-tab-active {
  background: #ffe0bd;
  color: #4f2f1d;
  font-weight: 700;
}

.privacy-body {
  min-height: 0;
  overflow: auto;
}

.privacy-memory-section,
.privacy-blocklist-section,
.privacy-history-section,
.privacy-export-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block-rule-list,
.privacy-data-list {
  margin: 0;
  padding-left: 18px;
}

.block-rule-list li,
.privacy-data-card {
  margin-bottom: 8px;
  border: 1px solid rgba(144, 92, 57, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
  padding: 8px;
}

.privacy-note,
.privacy-empty {
  color: #7a5a42;
  font-size: 12px;
}

.privacy-clear-actions {
  flex-wrap: wrap;
}
```

If existing `.memory-panel` and `.chat-history-panel` styles contain reusable selectors, keep them for backward compatibility because their component tests still exist.

- [ ] **Step 4: Run focused renderer tests**

Run:

```powershell
npm test -- tests/app/renderer/petStyles.test.ts tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update development docs**

In `docs/development/kaka-development-guide.md`, add a `Cyber Life v2.3` section after v2.2:

```md
## Cyber Life v2.3

- 设计文档：`docs/superpowers/specs/2026-06-02-kaka-cyber-life-v2-3-privacy-panel-design.md`。
- 实现计划：`docs/superpowers/plans/2026-06-02-kaka-cyber-life-v2-3-privacy-panel-implementation.md`。
- 统一隐私面板将长期记忆、`不要再记` 规则、聊天历史、导出和清除入口收束到同一个顶部标签式弹层。
- `历史` 和 `记忆` 入口仍保留，但打开同一个隐私面板并切到对应标签。
- 导出第一版只复制 JSON 到剪贴板，不写入下载目录。
- 每个清除动作都有二次确认，并且长期记忆、聊天历史、`不要再记` 规则互不隐式清空。
```

In `docs/development/kaka-compact.md`, update:

- Latest important commit list with the new feature commits.
- What is already built with `Cyber Life v2.3 privacy panel`.
- Main files to know with `src/app/main/memory/privacyManagementService.ts` and `src/app/renderer/PrivacyPanel.tsx`.
- Likely next tasks by moving `history-level 不要再记` to the top after v2.3.

- [ ] **Step 6: Commit docs and styles**

Run:

```powershell
git add tests/app/renderer/petStyles.test.ts src/app/renderer/petStyles.css docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "docs: update Kaka privacy panel notes"
```

---

### Task 7: Full verification and PR update

**Files:**
- No code changes unless verification reveals a defect.

- [ ] **Step 1: Run full tests and build**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack
npm test
npm run build
```

Expected:

```text
Test Files  passed
Tests       passed
renderer/main/preload build passed
```

Existing jsdom `act(...)` warnings are acceptable only if Vitest exits 0 and the summary says all tests passed.

- [ ] **Step 2: Inspect git state**

Run:

```powershell
git status --short --branch
git --no-pager log --oneline -8
```

Expected:

- Branch is ahead of `origin/feat/12-state-local-pet-pack` by the v2.3 commits.
- Only `.superpowers/` is untracked.
- No unstaged source, test, or doc changes remain.

- [ ] **Step 3: Push the feature branch**

Run:

```powershell
git push origin feat/12-state-local-pet-pack
```

Expected: push succeeds and PR #1 updates to the latest v2.3 commit.

- [ ] **Step 4: Confirm PR status**

Use GitHub MCP or CLI to inspect PR #1:

```powershell
git status --short --branch
```

Expected local status after push:

```text
## feat/12-state-local-pet-pack...origin/feat/12-state-local-pet-pack
?? .superpowers/
```

If GitHub status checks are unavailable or `total_count` is 0, report that local `npm test` and `npm run build` are the verification evidence.

---

## Self-Review Checklist

- Spec coverage: tasks cover unified overview, blocklist review/revoke, clipboard export, separated clearing, App entry points, privacy UI, errors, tests, docs, and verification.
- No unfinished markers: this plan contains no open-ended implementation tasks.
- Type consistency: plan uses `PrivacyOverview`, `RendererMemoryBlockRule`, `PrivacyTab`, `getPrivacyOverview`, `exportPrivacyDataForUser`, `deleteMemoryBlockRuleForUser`, `clearMemoryBlockRulesForUser`, and the same bridge method names throughout.
- Scope control: history-level `不要再记`, relationship/profile editing, file download export, and MCP diagnostics remain outside v2.3.
