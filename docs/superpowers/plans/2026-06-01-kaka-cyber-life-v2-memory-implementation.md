# Kaka Cyber Life v2.1 Memory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local memory management UI and relationship overview so users can inspect, delete, clear, and export Kaka's long-term memories.

**Architecture:** Add a focused main-process memory management service over the existing `contextStore` and `relationshipStore`, expose it through IPC and `petBridge`, then render a new overlay `MemoryPanel` next to the existing history panel. The UI keeps chat history and long-term memory separate while reusing the current overlay and notice bubble patterns.

**Tech Stack:** Electron main process IPC, React renderer, TypeScript, Vitest, jsdom renderer tests, Node filesystem APIs, existing local JSON/JSONL memory stores.

---

## File Structure

Create:

- `src/app/main/memory/memoryManagementService.ts`
  - Derives relationship overview.
  - Reads/sorts renderer-safe context memories.
  - Deletes one context memory.
  - Clears all context memories.
  - Exports context memories as formatted JSON.
- `src/app/renderer/MemoryPanel.tsx`
  - Overlay UI for relationship overview and memory controls.
- `src/app/renderer/memoryTypes.ts`
  - Re-exports renderer memory types from `petBridge.ts` for component tests and future renderer code.
- `tests/app/main/memoryManagementService.test.ts`
  - Main service tests.
- `tests/app/renderer/MemoryPanel.test.ts`
  - Renderer component tests.

Modify:

- `src/app/main/main.ts`
  - Register `memory:get-overview`, `memory:delete`, `memory:clear`, `memory:export` IPC handlers.
- `src/app/renderer/petBridge.ts`
  - Add memory overview types and bridge methods.
- `src/app/renderer/App.tsx`
  - Add memory panel state and flows for open/delete/clear/export.
- `src/app/renderer/PetView.tsx`
  - Add `记忆` trigger next to `历史`.
- `src/app/renderer/petStyles.css`
  - Add memory panel and trigger styles.
- `tests/app/renderer/petBridge.test.ts`
  - Verify new IPC channels.
- `tests/app/renderer/App.test.ts`
  - Verify integrated memory panel behavior.
- `tests/app/renderer/petStyles.test.ts`
  - Verify required selectors exist.
- `docs/development/kaka-development-guide.md`
  - Document v2.1 memory management.
- `docs/development/kaka-compact.md`
  - Update current status/next-task compact.

---

## Task 1: Main Memory Management Service

**Files:**

- Create: `tests/app/main/memoryManagementService.test.ts`
- Create: `src/app/main/memory/memoryManagementService.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/main/memoryManagementService.test.ts` with this content:

```ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMemories(root: string, memories: ContextMemoryItem[]) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  mkdirSync(join(file, ".."), { recursive: true });
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
    mkdirSync(join(paths.chatHistoryFile, ".."), { recursive: true });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/app/main/memoryManagementService.test.ts
```

Expected: FAIL because `src/app/main/memory/memoryManagementService.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/memory/memoryManagementService.ts`:

```ts
import { readContextMemories, writeContextMemories } from "./contextStore.js";
import { loadRelationshipMemory } from "./relationshipStore.js";
import type { ContextMemoryItem, RelationshipMemory } from "./memoryTypes.js";

export type RelationshipStage = "new" | "familiar" | "close" | "trusted";

export type RendererRelationshipOverview = {
  stage: RelationshipStage;
  stageLabel: string;
  stageDescription: string;
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  updatedAt: string;
};

export type RendererContextMemory = Pick<ContextMemoryItem, "id" | "kind" | "text" | "tags" | "weight" | "createdAt" | "updatedAt">;

export type MemoryOverview = {
  relationship: RendererRelationshipOverview;
  memories: RendererContextMemory[];
};

export type MemoryMutationResponse =
  | { ok: true }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "MEMORY_NOT_FOUND"; message: string };

export type ExportMemoriesServiceResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function deriveRelationshipOverview(relationship: RelationshipMemory): RendererRelationshipOverview {
  const familiarity = clampScore(relationship.familiarity);
  const affection = clampScore(relationship.affection);
  const engagement = clampScore(relationship.engagement);
  const trust = clampScore(relationship.trust);
  const average = (familiarity + affection + engagement + trust) / 4;

  if (average >= 70) {
    return { stage: "trusted", stageLabel: "信赖", stageDescription: "卡卡很信赖你，也会更稳定地陪在旁边。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  if (average >= 45) {
    return { stage: "close", stageLabel: "亲近", stageDescription: "卡卡和你更亲近了，会更自然地回应你的习惯。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  if (average >= 20) {
    return { stage: "familiar", stageLabel: "熟悉", stageDescription: "卡卡已经记得一些与你相处的节奏。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  return { stage: "new", stageLabel: "初识", stageDescription: "卡卡正在慢慢认识你。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
}

function toRendererMemory(item: ContextMemoryItem): RendererContextMemory {
  return {
    id: item.id,
    kind: item.kind,
    text: item.text,
    tags: item.tags,
    weight: item.weight,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function byUpdatedAtDesc(left: RendererContextMemory, right: RendererContextMemory) {
  return (right.updatedAt || "").localeCompare(left.updatedAt || "");
}

export function getMemoryOverview(root: string): MemoryOverview {
  return {
    relationship: deriveRelationshipOverview(loadRelationshipMemory(root)),
    memories: readContextMemories(root).map(toRendererMemory).sort(byUpdatedAtDesc)
  };
}

export function deleteContextMemoryForUser(root: string, id: string): MemoryMutationResponse {
  const normalizedId = id.trim();
  if (!normalizedId) return { ok: false, errorCode: "INVALID_MEMORY_ID", message: "记忆 id 无效。" };

  const memories = readContextMemories(root);
  const next = memories.filter((item) => item.id !== normalizedId);
  if (next.length === memories.length) return { ok: false, errorCode: "MEMORY_NOT_FOUND", message: "这条记忆已经不存在了。" };

  writeContextMemories(root, next);
  return { ok: true };
}

export function clearContextMemoriesForUser(root: string): MemoryMutationResponse {
  writeContextMemories(root, []);
  return { ok: true };
}

export function exportContextMemoriesForUser(root: string, now = new Date().toISOString()): ExportMemoriesServiceResponse {
  const memories = readContextMemories(root).map(toRendererMemory).sort(byUpdatedAtDesc);
  return {
    ok: true,
    data: JSON.stringify({ exportedAt: now, count: memories.length, memories }, null, 2)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- tests/app/main/memoryManagementService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/memoryManagementService.test.ts src/app/main/memory/memoryManagementService.ts
git commit -m "feat: add memory management service"
```

---

## Task 2: Memory IPC and Renderer Bridge

**Files:**

- Modify: `tests/app/renderer/petBridge.test.ts`
- Modify: `src/app/renderer/petBridge.ts`
- Modify: `src/app/main/main.ts`

- [ ] **Step 1: Write the failing bridge test**

Append this test to `tests/app/renderer/petBridge.test.ts` inside the existing `describe("renderer pet bridge", () => { ... })` block:

```ts
  it("manages long-term memory through IPC", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { relationship: null, memories: [] } })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, data: "{}" });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.getMemoryOverview();
    await bridge.deleteMemory("memory-1");
    await bridge.clearMemories();
    await bridge.exportMemories();

    expect(invoke).toHaveBeenNthCalledWith(1, "memory:get-overview");
    expect(invoke).toHaveBeenNthCalledWith(2, "memory:delete", { id: "memory-1" });
    expect(invoke).toHaveBeenNthCalledWith(3, "memory:clear");
    expect(invoke).toHaveBeenNthCalledWith(4, "memory:export");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: FAIL because `getMemoryOverview`, `deleteMemory`, `clearMemories`, and `exportMemories` are not defined.

- [ ] **Step 3: Extend `petBridge.ts`**

Add these types after `ClearChatHistoryResponse`:

```ts
export type RelationshipStage = "new" | "familiar" | "close" | "trusted";

export type RendererRelationshipOverview = {
  stage: RelationshipStage;
  stageLabel: string;
  stageDescription: string;
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  updatedAt: string;
};

export type RendererContextMemory = {
  id: string;
  kind: "conversation-summary" | "fact" | "preference" | "project-context";
  text: string;
  tags: string[];
  weight: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryOverview = {
  relationship: RendererRelationshipOverview;
  memories: RendererContextMemory[];
};

export type MemoryOverviewResponse =
  | { ok: true; data: MemoryOverview }
  | { ok: false; errorCode: string; message: string };

export type DeleteMemoryResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export type ClearMemoriesResponse = DeleteMemoryResponse;

export type ExportMemoriesResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };
```

Add these overloads to `IpcLike`:

```ts
  invoke(channel: "memory:get-overview"): Promise<MemoryOverviewResponse>;
  invoke(channel: "memory:delete", payload: { id: string }): Promise<DeleteMemoryResponse>;
  invoke(channel: "memory:clear"): Promise<ClearMemoriesResponse>;
  invoke(channel: "memory:export"): Promise<ExportMemoriesResponse>;
```

Add these methods in `createRendererPetBridge()` after `clearChatHistory()`:

```ts
    getMemoryOverview() {
      return ipc.invoke("memory:get-overview");
    },
    deleteMemory(id: string) {
      return ipc.invoke("memory:delete", { id });
    },
    clearMemories() {
      return ipc.invoke("memory:clear");
    },
    exportMemories() {
      return ipc.invoke("memory:export");
    },
```

- [ ] **Step 4: Add main IPC handlers**

In `src/app/main/main.ts`, import the service functions:

```ts
import { clearContextMemoriesForUser, deleteContextMemoryForUser, exportContextMemoriesForUser, getMemoryOverview } from "./memory/memoryManagementService.js";
```

Add handlers after chat history handlers:

```ts
  ipcMain.handle("memory:get-overview", () => ({ ok: true, data: getMemoryOverview(appDataBaseDir) }));
  ipcMain.handle("memory:delete", (_event, payload: { id?: string }) => deleteContextMemoryForUser(appDataBaseDir, payload?.id ?? ""));
  ipcMain.handle("memory:clear", () => clearContextMemoriesForUser(appDataBaseDir));
  ipcMain.handle("memory:export", () => exportContextMemoriesForUser(appDataBaseDir));
```

- [ ] **Step 5: Run bridge test**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add tests/app/renderer/petBridge.test.ts src/app/renderer/petBridge.ts src/app/main/main.ts
git commit -m "feat: expose memory management bridge"
```

---

## Task 3: MemoryPanel Component

**Files:**

- Create: `tests/app/renderer/MemoryPanel.test.ts`
- Create: `src/app/renderer/memoryTypes.ts`
- Create: `src/app/renderer/MemoryPanel.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/app/renderer/MemoryPanel.test.ts`:

```ts
// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryPanel } from "../../../src/app/renderer/MemoryPanel";
import type { MemoryOverview } from "../../../src/app/renderer/memoryTypes";

const overview: MemoryOverview = {
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
  memories: [
    {
      id: "m1",
      kind: "preference",
      text: "用户喜欢温柔提醒",
      tags: ["chat", "preference"],
      weight: 80,
      createdAt: "2026-06-01T01:00:00.000Z",
      updatedAt: "2026-06-01T03:00:00.000Z"
    },
    {
      id: "m2",
      kind: "project-context",
      text: "项目是卡卡桌宠",
      tags: ["project"],
      weight: 65,
      createdAt: "2026-06-01T01:00:00.000Z",
      updatedAt: "2026-06-01T02:00:00.000Z"
    }
  ]
};

function renderPanel(props: Partial<React.ComponentProps<typeof MemoryPanel>> = {}) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  const callbacks = {
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    onExport: vi.fn()
  };
  act(() => {
    root.render(React.createElement(MemoryPanel, {
      open: true,
      pending: false,
      overview,
      ...callbacks,
      ...props
    }));
  });
  return { rootElement, root, callbacks };
}

describe("MemoryPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders relationship overview and memories", () => {
    const { rootElement } = renderPanel();

    expect(rootElement.querySelector(".memory-panel")?.textContent).toContain("记忆与关系");
    expect(rootElement.textContent).toContain("亲近");
    expect(rootElement.textContent).toContain("熟悉度");
    expect(rootElement.textContent).toContain("用户喜欢温柔提醒");
  });

  it("filters memories by search text and kind", async () => {
    const { rootElement } = renderPanel();
    const search = rootElement.querySelector('input[name="memorySearch"]') as HTMLInputElement;
    const kind = rootElement.querySelector('select[name="memoryKind"]') as HTMLSelectElement;

    await act(async () => {
      search.value = "桌宠";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rootElement.textContent).toContain("项目是卡卡桌宠");
    expect(rootElement.textContent).not.toContain("用户喜欢温柔提醒");

    await act(async () => {
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      kind.value = "preference";
      kind.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(rootElement.textContent).toContain("用户喜欢温柔提醒");
    expect(rootElement.textContent).not.toContain("项目是卡卡桌宠");
  });

  it("fires delete, clear, and export callbacks", async () => {
    const { rootElement, callbacks } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-memory-delete="m1"]') as HTMLButtonElement).click();
      (rootElement.querySelector(".memory-clear") as HTMLButtonElement).click();
      (rootElement.querySelector(".memory-export") as HTMLButtonElement).click();
    });

    expect(callbacks.onDelete).toHaveBeenCalledWith("m1");
    expect(callbacks.onClear).toHaveBeenCalledOnce();
    expect(callbacks.onExport).toHaveBeenCalledOnce();
  });

  it("shows an empty state", () => {
    const { rootElement } = renderPanel({ overview: { ...overview, memories: [] } });

    expect(rootElement.querySelector(".memory-empty")?.textContent).toContain("卡卡还没有长期记忆");
  });

  it("renders nothing while closed", () => {
    const { rootElement } = renderPanel({ open: false });

    expect(rootElement.querySelector(".memory-panel")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/app/renderer/MemoryPanel.test.ts
```

Expected: FAIL because `MemoryPanel` does not exist.

- [ ] **Step 3: Create renderer memory type re-export**

Create `src/app/renderer/memoryTypes.ts`:

```ts
export type {
  MemoryOverview,
  RendererContextMemory,
  RendererRelationshipOverview,
  RelationshipStage
} from "./petBridge";
```

- [ ] **Step 4: Create `MemoryPanel.tsx`**

Create `src/app/renderer/MemoryPanel.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { MemoryOverview, RendererContextMemory } from "./memoryTypes";

export type MemoryPanelProps = {
  open: boolean;
  pending: boolean;
  overview: MemoryOverview | null;
  onClose(): void;
  onDelete(id: string): void;
  onClear(): void;
  onExport(): void;
};

const kindLabels: Record<RendererContextMemory["kind"], string> = {
  "conversation-summary": "对话摘要",
  fact: "事实",
  preference: "偏好",
  "project-context": "项目"
};

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export function MemoryPanel({ open, pending, overview, onClose, onDelete, onClear, onExport }: MemoryPanelProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | RendererContextMemory["kind"]>("all");

  const memories = overview?.memories ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesKind = kind === "all" || memory.kind === kind;
      const haystack = `${memory.text} ${memory.tags.join(" ")} ${kindLabels[memory.kind]}`.toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      return matchesKind && matchesQuery;
    });
  }, [kind, memories, query]);

  if (!open) return null;

  return (
    <section className="memory-panel" aria-label="记忆与关系">
      <header>
        <strong>记忆与关系</strong>
        <button type="button" onClick={onClose}>关闭</button>
      </header>

      {overview ? (
        <section className="relationship-card" aria-label="关系概览">
          <div>
            <strong>{overview.relationship.stageLabel}</strong>
            <p>{overview.relationship.stageDescription}</p>
          </div>
          <dl>
            <div className="relationship-score"><dt>熟悉度</dt><dd>{overview.relationship.familiarity}</dd></div>
            <div className="relationship-score"><dt>亲密度</dt><dd>{overview.relationship.affection}</dd></div>
            <div className="relationship-score"><dt>互动度</dt><dd>{overview.relationship.engagement}</dd></div>
            <div className="relationship-score"><dt>信任度</dt><dd>{overview.relationship.trust}</dd></div>
          </dl>
        </section>
      ) : (
        <p className="memory-empty">正在读取卡卡的记忆...</p>
      )}

      <section className="memory-controls" aria-label="记忆工具">
        <input name="memorySearch" value={query} onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} placeholder="搜索长期记忆..." />
        <select name="memoryKind" value={kind} onChange={(event) => setKind(event.currentTarget.value as "all" | RendererContextMemory["kind"])}>
          <option value="all">全部</option>
          <option value="preference">偏好</option>
          <option value="fact">事实</option>
          <option value="project-context">项目</option>
          <option value="conversation-summary">对话摘要</option>
        </select>
        <button className="memory-export" type="button" disabled={pending || memories.length === 0} onClick={onExport}>导出</button>
        <button className="memory-clear" type="button" disabled={pending || memories.length === 0} onClick={onClear}>清空</button>
      </section>

      {filtered.length === 0 ? (
        <p className="memory-empty">卡卡还没有长期记忆。和我聊一会儿，我会只记住对你有帮助的事。</p>
      ) : (
        <ol className="memory-list">
          {filtered.map((memory) => (
            <li key={memory.id}>
              <div>
                <span className="memory-kind">{kindLabels[memory.kind]}</span>
                <time>{formatTime(memory.updatedAt)}</time>
              </div>
              <p>{memory.text}</p>
              <small>weight {memory.weight}{memory.tags.length > 0 ? ` · ${memory.tags.join(" · ")}` : ""}</small>
              <button className="memory-delete" data-memory-delete={memory.id} type="button" disabled={pending} onClick={() => onDelete(memory.id)}>删除</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run component test**

Run:

```powershell
npm test -- tests/app/renderer/MemoryPanel.test.ts
```

Expected: PASS. jsdom may print existing `act(...)` warnings only if the final Vitest result is still passing.

- [ ] **Step 6: Commit**

Run:

```powershell
git add tests/app/renderer/MemoryPanel.test.ts src/app/renderer/memoryTypes.ts src/app/renderer/MemoryPanel.tsx
git commit -m "feat: add Kaka memory panel"
```

---

## Task 4: App and PetView Integration

**Files:**

- Modify: `tests/app/renderer/App.test.ts`
- Modify: `tests/app/renderer/petStyles.test.ts`
- Modify: `src/app/renderer/App.tsx`
- Modify: `src/app/renderer/PetView.tsx`
- Modify: `src/app/renderer/petStyles.css`

- [ ] **Step 1: Add failing App integration test**

Add or update a test in `tests/app/renderer/App.test.ts` that renders `App`, stubs `window.clinePet`, clicks `记忆`, and verifies the panel opens. Use this test body:

```ts
  it("opens memory panel and manages memories", async () => {
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
        memories: [{
          id: "m1",
          kind: "preference",
          text: "用户喜欢温柔提醒",
          tags: ["chat"],
          weight: 80,
          createdAt: "2026-06-01T01:00:00.000Z",
          updatedAt: "2026-06-01T01:00:00.000Z"
        }]
      }
    });
    const deleteMemory = vi.fn().mockResolvedValue({ ok: true });
    const clearMemories = vi.fn().mockResolvedValue({ ok: true });
    const exportMemories = vi.fn().mockResolvedValue({ ok: true, data: "{\n  \"count\": 1\n}" });
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    window.confirm = vi.fn().mockReturnValue(true);
    window.clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ id: "default", name: "Default", stateImages: {} }),
      getMemoryOverview,
      deleteMemory,
      clearMemories,
      exportMemories
    } as any;

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });
    await act(async () => {
      Array.from(rootElement.querySelectorAll("button")).find((button) => button.textContent === "记忆")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getMemoryOverview).toHaveBeenCalledOnce();
    expect(rootElement.querySelector(".memory-panel")?.textContent).toContain("用户喜欢温柔提醒");

    await act(async () => {
      (rootElement.querySelector('[data-memory-delete="m1"]') as HTMLButtonElement).click();
    });
    expect(deleteMemory).toHaveBeenCalledWith("m1");

    await act(async () => {
      (rootElement.querySelector(".memory-export") as HTMLButtonElement).click();
    });
    expect(exportMemories).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("{\n  \"count\": 1\n}");

    await act(async () => {
      (rootElement.querySelector(".memory-clear") as HTMLButtonElement).click();
    });
    expect(clearMemories).toHaveBeenCalledOnce();
  });
```

If the file does not yet import `App`, `React`, `act`, `createRoot`, or `vi`, add the same import style already used in that file.

- [ ] **Step 2: Add failing style test**

In `tests/app/renderer/petStyles.test.ts`, add required selectors:

```ts
expect(css).toContain(".memory-trigger");
expect(css).toContain(".memory-panel");
expect(css).toContain(".relationship-card");
expect(css).toContain(".memory-list");
expect(css).toContain(".memory-delete");
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/app/renderer/App.test.ts tests/app/renderer/petStyles.test.ts
```

Expected: FAIL because the `记忆` trigger and styles are not implemented.

- [ ] **Step 4: Update `PetView.tsx`**

Add prop:

```ts
  onOpenMemory(): void;
```

Add `onOpenMemory` to the function parameter list.

Add this button after the history button:

```tsx
      <button className="memory-trigger" type="button" onClick={onOpenMemory} title="查看长期记忆">记忆</button>
```

- [ ] **Step 5: Update `App.tsx` global bridge type and imports**

Import `MemoryPanel` and memory types:

```ts
import { MemoryPanel } from "./MemoryPanel";
import type { MemoryOverview } from "./memoryTypes";
```

Extend `Window.clinePet`:

```ts
      getMemoryOverview?(): Promise<MemoryOverviewResponse>;
      deleteMemory?(id: string): Promise<DeleteMemoryResponse>;
      clearMemories?(): Promise<ClearMemoriesResponse>;
      exportMemories?(): Promise<ExportMemoriesResponse>;
```

Extend the bridge response import:

```ts
import type { ChatHistoryResponse, ClearChatHistoryResponse, ClearMemoriesResponse, DeepSeekSettings, DeepSeekSettingsInput, DeepSeekSettingsResponse, DeleteMemoryResponse, ExportMemoriesResponse, MemoryOverviewResponse, RendererPetPack } from "./petBridge";
```

- [ ] **Step 6: Update `App.tsx` state and handlers**

Add state near history state:

```ts
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryPending, setMemoryPending] = useState(false);
  const [memoryOverview, setMemoryOverview] = useState<MemoryOverview | null>(null);
```

Add handlers near history handlers:

```ts
  async function refreshMemoryOverview() {
    setMemoryPending(true);
    const result = await window.clinePet?.getMemoryOverview?.();
    setMemoryPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("记忆通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setMemoryOverview(result.data);
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function openMemoryPanel() {
    setMemoryOpen(true);
    await refreshMemoryOverview();
  }

  async function deleteMemoryFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("删除这条长期记忆？之后卡卡不会再用它理解你。") : true;
    if (!confirmed) return;
    setMemoryPending(true);
    const result = await window.clinePet?.deleteMemory?.(id);
    setMemoryPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("记忆通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setMemoryOverview((current) => current ? { ...current, memories: current.memories.filter((memory) => memory.id !== id) } : current);
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function clearMemoriesFromPanel() {
    const confirmed = typeof window.confirm === "function" ? window.confirm("清空所有长期记忆？对话历史不会被删除，但卡卡会忘掉已提炼的长期记忆。") : true;
    if (!confirmed) return;
    setMemoryPending(true);
    const result = await window.clinePet?.clearMemories?.();
    setMemoryPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("记忆通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setMemoryOverview((current) => current ? { ...current, memories: [] } : current);
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function exportMemoriesFromPanel() {
    setMemoryPending(true);
    const result = await window.clinePet?.exportMemories?.();
    setMemoryPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("记忆通道还没有准备好。"));
      return;
    }
    if (!result.ok) {
      pushBubble(bubbleFromNotice(result.message));
      return;
    }
    try {
      await navigator.clipboard?.writeText?.(result.data);
      pushBubble(bubbleFromNotice("长期记忆 JSON 已复制到剪贴板。"));
    } catch {
      pushBubble(bubbleFromNotice("剪贴板不可用，暂时无法复制长期记忆。"));
    }
  }
```

Pass `onOpenMemory={openMemoryPanel}` into `PetView`.

Render `MemoryPanel` after `ChatHistoryPanel`:

```tsx
      <MemoryPanel
        open={memoryOpen}
        pending={memoryPending}
        overview={memoryOverview}
        onClose={() => setMemoryOpen(false)}
        onDelete={deleteMemoryFromPanel}
        onClear={clearMemoriesFromPanel}
        onExport={exportMemoriesFromPanel}
      />
```

- [ ] **Step 7: Add CSS**

Append to `src/app/renderer/petStyles.css` near chat history styles:

```css
.memory-trigger {
  position: absolute;
  right: 66px;
  top: 14px;
  z-index: 2;
  border: 0;
  border-radius: 999px;
  padding: 6px 9px;
  cursor: pointer;
  color: #fff;
  background: rgba(30, 64, 175, 0.76);
  -webkit-app-region: no-drag;
}

.memory-panel {
  position: absolute;
  inset: 10px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 18px;
  color: #e5e7eb;
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.34);
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.memory-panel header,
.memory-controls,
.memory-list li > div,
.relationship-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.memory-panel button,
.memory-panel input,
.memory-panel select {
  border: 0;
  border-radius: 999px;
  padding: 6px 9px;
}

.memory-panel button {
  cursor: pointer;
}

.relationship-card {
  padding: 9px;
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.86);
}

.relationship-card p {
  margin: 4px 0 8px;
  color: #cbd5e1;
  font-size: 11px;
}

.relationship-card dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 0;
}

.relationship-score dt,
.relationship-score dd {
  margin: 0;
}

.relationship-score dd {
  color: #fbbf24;
}

.memory-controls {
  flex-wrap: wrap;
}

.memory-controls input {
  min-width: 120px;
  flex: 1;
}

.memory-export {
  background: #60a5fa;
  color: #0f172a;
}

.memory-clear,
.memory-delete {
  background: #fbbf24;
  color: #111827;
}

.memory-list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.memory-list li {
  position: relative;
  padding: 8px 0;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}

.memory-list p {
  margin: 5px 0;
}

.memory-list time,
.memory-list small,
.memory-empty {
  color: #cbd5e1;
  font-size: 11px;
}

.memory-kind {
  border-radius: 999px;
  padding: 2px 7px;
  color: #0f172a;
  background: #bfdbfe;
  font-size: 10px;
}
```

- [ ] **Step 8: Run integration tests**

Run:

```powershell
npm test -- tests/app/renderer/App.test.ts tests/app/renderer/petStyles.test.ts tests/app/renderer/MemoryPanel.test.ts
```

Expected: PASS. Existing jsdom `act(...)` warnings are acceptable only if Vitest exits 0.

- [ ] **Step 9: Commit**

Run:

```powershell
git add tests/app/renderer/App.test.ts tests/app/renderer/petStyles.test.ts src/app/renderer/App.tsx src/app/renderer/PetView.tsx src/app/renderer/petStyles.css
git commit -m "feat: integrate Kaka memory controls"
```

---

## Task 5: Documentation, Full Verification, and Push

**Files:**

- Modify: `docs/development/kaka-development-guide.md`
- Modify: `docs/development/kaka-compact.md`

- [ ] **Step 1: Update development guide**

Add a `Cyber Life v2.1` subsection documenting:

```md
## Cyber Life v2.1

- Adds a renderer `MemoryPanel` opened from the `记忆` button.
- Shows relationship overview from `relationship.json`.
- Shows long-term context memories from `context-memory.jsonl`.
- Supports search, kind filtering, deleting one memory, clearing all long-term memories, and copying an export JSON to the clipboard.
- Long-term memory operations do not clear `chat-history.jsonl`.
- The feature does not read files, screens, terminals, browser data, logs, API keys, or external user data.
```

- [ ] **Step 2: Update compact**

Update `docs/development/kaka-compact.md` so the current status includes:

```md
- Cyber Life v2.1 memory management UI is in progress/completed on `feat/12-state-local-pet-pack`.
- New memory controls: view/search/filter/delete/clear/export long-term memories.
- Relationship overview: 初识 / 熟悉 / 亲近 / 信赖 derived from relationship scores.
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm test
npm run build
git status --short --branch
```

Expected:

- `npm test` exits 0.
- `npm run build` exits 0.
- `git status --short --branch` shows only intended doc changes before commit, or only `.superpowers/` after final commit.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "docs: update Kaka memory management notes"
```

- [ ] **Step 5: Push**

Run:

```powershell
git push origin feat/12-state-local-pet-pack
```

Expected: remote branch updates successfully.

---

## Self-Review Checklist

- Spec coverage: the tasks cover memory visibility, search, kind filter, delete, clear, export, relationship overview, IPC, bridge, App integration, styling, docs, and verification.
- Placeholder scan: no task uses TBD/TODO/fill-in language as a substitute for implementation details.
- Type consistency: `MemoryOverview`, `RendererContextMemory`, `RendererRelationshipOverview`, `RelationshipStage`, and IPC response types are introduced in Task 2 and reused by Tasks 3-4.
- Scope check: v2.1 stays focused on memory management and relationship overview; editing memories, save dialogs, and settings-center restructuring are deferred.
- Privacy check: long-term memory deletion only rewrites `context-memory.jsonl`; chat history, profile, relationship, DeepSeek settings, logs, and secrets are untouched.
