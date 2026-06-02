# Kaka Cyber Life v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cyber Life v1 so Kaka can show readable long replies, keep local chat history, extract and reuse memories, grow relationship state, and offer gentle proactive presence without violating local-first privacy boundaries.

**Architecture:** Keep the existing Electron main + React renderer + preload bridge + local JSON/JSONL memory architecture. Add focused main-process services for chat history, memory extraction, deduplication, relationship events, and chat coordination; add renderer-side reading mode, history panel, and bubble queue without changing the MCP/Bridge status pipeline.

**Tech Stack:** TypeScript, React, Electron IPC, Vite, Vitest, jsdom, Node.js filesystem/path APIs, DeepSeek chat completions, local `%APPDATA%/cline-desktop-pet` data files.

---

## Current Context

- Approved spec: `docs/superpowers/specs/2026-06-01-kaka-cyber-life-v1-design.md`.
- Repo worktree: `d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack`.
- Current branch: `feat/12-state-local-pet-pack`.
- Existing chat path: `src/app/main/main.ts` handles `chat:send` and calls `createChatReply()` from `src/app/main/chatService.ts`.
- Existing memory files: `profile.json`, `relationship.json`, `context-memory.jsonl` under `%APPDATA%/cline-desktop-pet/`.
- Existing renderer chat flow: `App.tsx` calls `window.clinePet.sendChatMessage()`, sets a transient `BubbleMessage`, and closes `ChatInput`.
- Do not commit `.superpowers/`, local `%APPDATA%` data, logs, user PNG assets, API keys, or `config.json`.

## Scope Check

The spec spans renderer UX, local storage, memory extraction, chat coordination, relationship/mood, and docs. These subsystems are coupled by the chat lifecycle and should ship as one Cyber Life v1 slice: the user sends a message, Kaka replies, the reply is readable, the turn is stored, memory is extracted, future replies can use memory, and presence respects active reading.

## File Structure

```text
src/shared/paths.ts
  Add chatHistoryFile path under the existing app data root.

src/app/main/memory/chatHistoryStore.ts
  Append, read, cap, and clear local chat turn JSONL.

src/app/main/memory/memoryDeduplication.ts
  Normalize memory text and merge exact/near duplicate context memories.

src/app/main/memory/contextStore.ts
  Add replace/write helpers used by deduplication while preserving append/read APIs.

src/app/main/memory/memoryExtractionService.ts
  Build DeepSeek extraction prompts, parse strict JSON, map results to memory writes.

src/app/main/memory/relationshipEvents.ts
  Apply bounded chat-driven relationship updates with daily diminishing returns.

src/app/main/chatCoordinator.ts
  Coordinate memory loading, chat reply, history persistence, extraction, relationship, and mood payload.

src/app/main/main.ts
  Replace inline chat handling with chatCoordinator and expose history IPC.

src/app/renderer/petBridge.ts
  Add chat history IPC types and bridge methods.

src/app/renderer/chatHistoryTypes.ts
  Renderer-friendly chat history types.

src/app/renderer/bubbleQueue.ts
  Prioritize chat, notice, status, and presence bubbles.

src/app/renderer/bubbleTypes.ts
  Add reading mode metadata and long-reply detection.

src/app/renderer/SpeechBubble.tsx
  Add click-to-read, close button, and readable mode rendering.

src/app/renderer/ChatHistoryPanel.tsx
  Render searchable local history with copy and clear actions.

src/app/renderer/PetView.tsx
  Pass bubble interaction handlers and history panel trigger.

src/app/renderer/App.tsx
  Wire bubble queue, reading mode, history loading, history panel, and chat coordinator responses.

src/app/renderer/petStyles.css
  Style readable bubble, history trigger, and history panel.

src/app/main/moodEngine.ts
  Accept richer chat sentiment and keep stressed/tired users supported.

src/app/main/presenceService.ts
  Add active-reading and long-work-session guards.

docs/development/kaka-development-guide.md
docs/development/kaka-compact.md
  Document Cyber Life v1 data flow, commands, privacy, and roadmap.
```

## Task 1: Local Chat History Store

**Files:**
- Modify: `src/shared/paths.ts`
- Create: `src/app/main/memory/chatHistoryStore.ts`
- Test: `tests/app/main/chatHistoryStore.test.ts`

- [ ] **Step 1: Write the failing chat history store test**

Create `tests/app/main/chatHistoryStore.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { appendChatHistoryTurn, clearChatHistory, readChatHistory } from "../../../src/app/main/memory/chatHistoryStore";
import { getPaths } from "../../../src/shared/paths";

describe("chatHistoryStore", () => {
  const roots: string[] = [];

  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "cline-chat-history-"));
    roots.push(root);
    return root;
  }

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("adds chat-history.jsonl to shared paths", () => {
    const root = tempRoot();
    expect(getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile).toBe(join(root, "cline-desktop-pet", "chat-history.jsonl"));
  });

  it("appends turns and reads newest first", () => {
    const root = tempRoot();

    const first = appendChatHistoryTurn(root, {
      userText: "今天好累",
      assistantText: "先喝口水，我在旁边陪你。",
      createdAt: "2026-06-01T01:00:00.000Z",
      sentiment: "tired",
      memoryIds: []
    });
    const second = appendChatHistoryTurn(root, {
      userText: "继续做卡卡",
      assistantText: "我们慢慢来，把它做成赛博生命。",
      createdAt: "2026-06-01T02:00:00.000Z",
      sentiment: "focused",
      summary: "用户继续开发卡卡 Cyber Life v1。",
      memoryIds: ["m1"]
    });

    const turns = readChatHistory(root);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toEqual(second);
    expect(turns[1]).toEqual(first);
  });

  it("caps stored turns at the requested retention", () => {
    const root = tempRoot();
    for (let index = 0; index < 5; index += 1) {
      appendChatHistoryTurn(root, {
        userText: `u${index}`,
        assistantText: `a${index}`,
        createdAt: `2026-06-01T00:00:0${index}.000Z`,
        sentiment: "neutral",
        memoryIds: []
      }, { maxTurns: 3 });
    }

    expect(readChatHistory(root).map((turn) => turn.userText)).toEqual(["u4", "u3", "u2"]);
  });

  it("skips malformed JSONL rows and clears history", () => {
    const root = tempRoot();
    const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `not-json\n${JSON.stringify({
      id: "valid",
      userText: "hello",
      assistantText: "hi",
      createdAt: "2026-06-01T00:00:00.000Z",
      sentiment: "positive",
      memoryIds: []
    })}\n`, "utf8");

    expect(readChatHistory(root)).toHaveLength(1);

    clearChatHistory(root);

    expect(readChatHistory(root)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'
npm test -- tests/app/main/chatHistoryStore.test.ts
```

Expected: FAIL because `chatHistoryStore.ts` and `chatHistoryFile` do not exist.

- [ ] **Step 3: Add `chatHistoryFile` path**

Modify `src/shared/paths.ts` so `getPaths()` returns the new file path:

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
    chatHistoryFile: join(root, "chat-history.jsonl"),
    appLog: join(root, "logs", "pet-app.log"),
    mcpLog: join(root, "logs", "mcp-server.log")
  };
}
```

- [ ] **Step 4: Implement chat history store**

Create `src/app/main/memory/chatHistoryStore.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";

export type ChatHistorySentiment = "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";

export type ChatHistoryTurn = {
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: ChatHistorySentiment;
  summary?: string;
  memoryIds: string[];
};

export type NewChatHistoryTurn = Omit<ChatHistoryTurn, "id"> & { id?: string };

function chatHistoryFile(root: string) {
  return getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile;
}

function parseTurn(line: string): ChatHistoryTurn | null {
  try {
    const value = JSON.parse(line) as ChatHistoryTurn;
    if (!value.id || !value.userText || !value.assistantText || !value.createdAt) return null;
    return { ...value, memoryIds: Array.isArray(value.memoryIds) ? value.memoryIds : [] };
  } catch {
    return null;
  }
}

export function readChatHistory(root: string, options: { limit?: number } = {}): ChatHistoryTurn[] {
  const file = chatHistoryFile(root);
  if (!existsSync(file)) return [];
  const turns = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseTurn)
    .filter((turn): turn is ChatHistoryTurn => Boolean(turn))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return typeof options.limit === "number" ? turns.slice(0, options.limit) : turns;
}

export function appendChatHistoryTurn(root: string, input: NewChatHistoryTurn, options: { maxTurns?: number } = {}): ChatHistoryTurn {
  const file = chatHistoryFile(root);
  const turn: ChatHistoryTurn = {
    id: input.id ?? randomUUID(),
    userText: input.userText,
    assistantText: input.assistantText,
    createdAt: input.createdAt,
    sentiment: input.sentiment,
    ...(input.summary ? { summary: input.summary } : {}),
    memoryIds: input.memoryIds ?? []
  };
  const maxTurns = options.maxTurns ?? 200;
  const oldestFirst = [...readChatHistory(root), turn]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-maxTurns);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${oldestFirst.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
  return turn;
}

export function clearChatHistory(root: string) {
  const file = chatHistoryFile(root);
  if (existsSync(file)) rmSync(file, { force: true });
}
```

- [ ] **Step 5: Run the focused passing test**

Run:

```powershell
npm test -- tests/app/main/chatHistoryStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/shared/paths.ts src/app/main/memory/chatHistoryStore.ts tests/app/main/chatHistoryStore.test.ts
git commit -m "feat: add local chat history store"
```

## Task 2: Memory Deduplication And DeepSeek Extraction

**Files:**
- Modify: `src/app/main/memory/contextStore.ts`
- Create: `src/app/main/memory/memoryDeduplication.ts`
- Create: `src/app/main/memory/memoryExtractionService.ts`
- Test: `tests/app/main/memoryExtractionService.test.ts`

- [ ] **Step 1: Write failing extraction and deduplication tests**

Create `tests/app/main/memoryExtractionService.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readContextMemories } from "../../../src/app/main/memory/contextStore";
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
});
```

- [ ] **Step 2: Run the focused failing test**

```powershell
npm test -- tests/app/main/memoryExtractionService.test.ts
```

Expected: FAIL because the extraction and deduplication services do not exist.

- [ ] **Step 3: Add context store write helper**

Append this export to `src/app/main/memory/contextStore.ts`:

```ts
export function writeContextMemories(root: string, items: ContextMemoryItem[]) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  mkdirSync(dirname(file), { recursive: true });
  const body = items.map((item) => JSON.stringify(item)).join("\n");
  writeFileSync(file, body ? `${body}\n` : "", "utf8");
}
```

- [ ] **Step 4: Implement deduplication helper**

Create `src/app/main/memory/memoryDeduplication.ts`:

```ts
import type { ContextMemoryItem } from "./memoryTypes.js";

export function normalizeMemoryText(text: string) {
  return text.toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "").trim();
}

function overlapScore(a: string, b: string) {
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
    return overlapScore(item.text, candidate.text) >= 0.75;
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

- [ ] **Step 5: Implement DeepSeek extraction service**

Create `src/app/main/memory/memoryExtractionService.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { DeepSeekConfig } from "../config.js";
import { requestDeepSeekChat, type DeepSeekChatResult, type DeepSeekMessage } from "../deepseekClient.js";
import { readContextMemories, writeContextMemories } from "./contextStore.js";
import { mergeContextMemory } from "./memoryDeduplication.js";
import type { ContextMemoryItem } from "./memoryTypes.js";

export type MemoryExtractionSentiment = "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";
export type RelationshipEventKind = "chat" | "support" | "work-session" | "stress" | "none";

export type MemoryExtractionResult = {
  shouldRemember: boolean;
  conversationSummary: string | null;
  sentiment: MemoryExtractionSentiment;
  facts: string[];
  preferences: string[];
  projectContext: string[];
  careSignals: string[];
  relationshipEvent: RelationshipEventKind;
};

export type MemoryExtractionParseResult =
  | { ok: true; data: MemoryExtractionResult }
  | { ok: false; errorCode: "MEMORY_EXTRACTION_BAD_RESPONSE" };

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function sentiment(value: unknown): MemoryExtractionSentiment {
  return ["positive", "neutral", "negative", "tired", "stressed", "focused"].includes(String(value)) ? value as MemoryExtractionSentiment : "neutral";
}

function relationshipEvent(value: unknown): RelationshipEventKind {
  return ["chat", "support", "work-session", "stress", "none"].includes(String(value)) ? value as RelationshipEventKind : "none";
}

export function parseMemoryExtractionJson(text: string): MemoryExtractionParseResult {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        shouldRemember: Boolean(value.shouldRemember),
        conversationSummary: typeof value.conversationSummary === "string" && value.conversationSummary.trim() ? value.conversationSummary.trim() : null,
        sentiment: sentiment(value.sentiment),
        facts: stringArray(value.facts),
        preferences: stringArray(value.preferences),
        projectContext: stringArray(value.projectContext),
        careSignals: stringArray(value.careSignals),
        relationshipEvent: relationshipEvent(value.relationshipEvent)
      }
    };
  } catch {
    return { ok: false, errorCode: "MEMORY_EXTRACTION_BAD_RESPONSE" };
  }
}

function messages(input: { userText: string; assistantText: string; relationshipSummary: string; relevantMemorySummaries: string[]; recentChatSummaries: string[] }): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: "你是卡卡的本地记忆整理器。只基于用户聊天内容提炼记忆，不要声称读取文件、代码、屏幕或终端。只输出严格 JSON。"
    },
    {
      role: "user",
      content: JSON.stringify({
        relationshipSummary: input.relationshipSummary,
        relevantMemorySummaries: input.relevantMemorySummaries.slice(0, 3),
        recentChatSummaries: input.recentChatSummaries.slice(0, 5),
        currentTurn: { userText: input.userText, assistantText: input.assistantText },
        outputShape: {
          shouldRemember: true,
          conversationSummary: "string|null",
          sentiment: "positive|neutral|negative|tired|stressed|focused",
          facts: ["string"],
          preferences: ["string"],
          projectContext: ["string"],
          careSignals: ["string"],
          relationshipEvent: "chat|support|work-session|stress|none"
        }
      })
    }
  ];
}

function item(kind: ContextMemoryItem["kind"], text: string, tags: string[], weight: number, now: string): ContextMemoryItem {
  return { id: randomUUID(), kind, text, tags, weight, createdAt: now, updatedAt: now };
}

function toItems(result: MemoryExtractionResult, now: string): ContextMemoryItem[] {
  if (!result.shouldRemember) return [];
  const base = ["chat", "deepseek-extracted", `sentiment:${result.sentiment}`];
  return [
    ...result.facts.map((text) => item("fact", text, [...base, "fact"], 60, now)),
    ...result.preferences.map((text) => item("preference", text, [...base, "preference"], 80, now)),
    ...result.projectContext.map((text) => item("project-context", text, [...base, "project"], 65, now)),
    ...result.careSignals.map((text) => item("conversation-summary", text, [...base, "care"], 60, now)),
    ...(result.conversationSummary ? [item("conversation-summary", result.conversationSummary, [...base, "summary"], 40, now)] : [])
  ];
}

export async function extractAndStoreMemories(input: {
  root: string;
  config: DeepSeekConfig;
  turn: { userText: string; assistantText: string; createdAt: string };
  relationshipSummary: string;
  relevantMemorySummaries: string[];
  recentChatSummaries: string[];
  requester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}) {
  const requester = input.requester ?? requestDeepSeekChat;
  const response = await requester({
    config: input.config,
    messages: messages({
      userText: input.turn.userText,
      assistantText: input.turn.assistantText,
      relationshipSummary: input.relationshipSummary,
      relevantMemorySummaries: input.relevantMemorySummaries,
      recentChatSummaries: input.recentChatSummaries
    }),
    timeoutMs: 15000
  });
  if (!response.ok) return response;
  const parsed = parseMemoryExtractionJson(response.data.text);
  if (!parsed.ok) return parsed;
  const nextItems = toItems(parsed.data, input.turn.createdAt);
  const merged = nextItems.reduce((items, candidate) => mergeContextMemory(items, candidate), readContextMemories(input.root));
  writeContextMemories(input.root, merged);
  return { ok: true as const, data: { extraction: parsed.data, memoryIds: nextItems.map((memory) => memory.id) } };
}
```

- [ ] **Step 6: Run focused passing test**

```powershell
npm test -- tests/app/main/memoryExtractionService.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/app/main/memory/contextStore.ts src/app/main/memory/memoryDeduplication.ts src/app/main/memory/memoryExtractionService.ts tests/app/main/memoryExtractionService.test.ts
git commit -m "feat: add DeepSeek memory extraction"
```

## Task 3: Relationship Events And Mood Inputs

**Files:**
- Create: `src/app/main/memory/relationshipEvents.ts`
- Modify: `src/app/main/moodEngine.ts`
- Modify: `src/app/main/chatMood.ts`
- Test: `tests/app/main/relationshipEvents.test.ts`
- Test: `tests/app/main/moodEngine.test.ts`
- Test: `tests/app/main/chatMood.test.ts`

- [ ] **Step 1: Write failing relationship event tests**

Create `tests/app/main/relationshipEvents.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { applyChatRelationshipEvent } from "../../../src/app/main/memory/relationshipEvents";
import { loadRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

describe("relationshipEvents", () => {
  const roots: string[] = [];
  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "cline-relationship-event-"));
    roots.push(root);
    return root;
  }

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("adds bounded chat growth and records recent event", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T04:00:00.000Z",
      sentiment: "focused",
      relationshipEvent: "work-session"
    });

    expect(updated).toEqual(expect.objectContaining({ familiarity: 1, engagement: 2 }));
    expect(updated.recentEvents[0].text).toContain("一起专注了一会儿");
    expect(loadRelationshipMemory(root).engagement).toBe(2);
  });

  it("uses diminishing returns for repeated same-day chat growth", () => {
    const root = tempRoot();
    applyChatRelationshipEvent(root, { now: "2026-06-01T04:00:00.000Z", sentiment: "focused", relationshipEvent: "work-session" });
    const updated = applyChatRelationshipEvent(root, { now: "2026-06-01T05:00:00.000Z", sentiment: "focused", relationshipEvent: "work-session" });

    expect(updated.engagement).toBeLessThanOrEqual(3);
    expect(updated.recentEvents.filter((event) => event.text.includes("一起专注了一会儿"))).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run failing relationship test**

```powershell
npm test -- tests/app/main/relationshipEvents.test.ts
```

Expected: FAIL because `relationshipEvents.ts` does not exist.

- [ ] **Step 3: Implement relationship event updates**

Create `src/app/main/memory/relationshipEvents.ts`:

```ts
import { saveRelationshipMemory } from "./relationshipStore.js";
import type { RelationshipMemory } from "./memoryTypes.js";
import type { MemoryExtractionSentiment, RelationshipEventKind } from "./memoryExtractionService.js";

function eventText(kind: RelationshipEventKind, sentiment: MemoryExtractionSentiment) {
  if (kind === "work-session" || sentiment === "focused") return "今天和用户一起专注了一会儿";
  if (kind === "support" || sentiment === "tired" || sentiment === "stressed") return "今天轻轻陪用户缓了一会儿";
  if (kind === "stress") return "今天用户有点压力，卡卡要更温柔";
  return "今天和用户聊了聊天";
}

function hasEventToday(relationship: RelationshipMemory, text: string, now: string) {
  const day = now.slice(0, 10);
  return relationship.recentEvents.some((event) => event.text === text && event.createdAt.slice(0, 10) === day);
}

export function applyChatRelationshipEvent(root: string, input: {
  now: string;
  sentiment: MemoryExtractionSentiment;
  relationshipEvent: RelationshipEventKind;
}) {
  return saveRelationshipMemory(root, (current) => {
    const text = eventText(input.relationshipEvent, input.sentiment);
    const repeatedToday = hasEventToday(current, text, input.now);
    const normalChat = repeatedToday ? 0 : 1;
    const supportive = !repeatedToday && (["support", "stress"].includes(input.relationshipEvent) || ["tired", "stressed"].includes(input.sentiment));
    const work = !repeatedToday && (input.relationshipEvent === "work-session" || input.sentiment === "focused");
    const recentEvents = repeatedToday
      ? current.recentEvents
      : [{ text, createdAt: input.now, weight: work ? 2 : 1 }, ...current.recentEvents].slice(0, 20);

    return {
      ...current,
      familiarity: current.familiarity + normalChat,
      affection: current.affection + (supportive ? 1 : 0),
      engagement: current.engagement + (work ? 2 : normalChat),
      trust: current.trust + (supportive ? 1 : 0),
      lastInteractionAt: input.now,
      recentEvents
    };
  });
}
```

- [ ] **Step 4: Update mood tests for stressed and focused sentiment**

Modify `tests/app/main/moodEngine.test.ts` by adding:

```ts
it("keeps stressed users in a calm supportive mood instead of angry", () => {
  expect(deriveMoodState({
    now: "2026-06-01T12:00:00.000Z",
    relationship: { familiarity: 10, affection: 10, engagement: 10, trust: 10, recentEvents: [], updatedAt: "2026-06-01T00:00:00.000Z" },
    hasRecentChat: true,
    lastChatSentiment: "stressed",
    memoryHitCount: 0,
    clineVisibleStatus: "idle"
  })).toEqual({ name: "calm", suggestedStatus: "idle" });
});

it("shows curiosity during focused work sessions", () => {
  expect(deriveMoodState({
    now: "2026-06-01T12:00:00.000Z",
    relationship: { familiarity: 10, affection: 10, engagement: 80, trust: 10, recentEvents: [], updatedAt: "2026-06-01T00:00:00.000Z" },
    hasRecentChat: true,
    lastChatSentiment: "focused",
    memoryHitCount: 1,
    clineVisibleStatus: "idle"
  })).toEqual({ name: "curious", suggestedStatus: "thinking" });
});
```

- [ ] **Step 5: Update mood engine types and logic**

Modify `src/app/main/moodEngine.ts`:

```ts
export type ChatSentiment = "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";

export function deriveMoodState(input: {
  now: string;
  relationship: RelationshipMemory;
  hasRecentChat: boolean;
  lastChatSentiment: ChatSentiment;
  memoryHitCount: number;
  clineVisibleStatus: PetStatus;
}): MoodState {
  const hour = new Date(input.now).getUTCHours();
  const activeWarmth = hasActiveWarmth(input.relationship, input.now);

  if (input.clineVisibleStatus === "loading" || input.clineVisibleStatus === "thinking") {
    return { name: "curious", suggestedStatus: input.clineVisibleStatus };
  }
  if (input.lastChatSentiment === "stressed") return { name: "calm", suggestedStatus: "idle" };
  if (input.lastChatSentiment === "focused" && input.hasRecentChat) return { name: "curious", suggestedStatus: "thinking" };
  if (!input.hasRecentChat && (hour >= 23 || hour < 6)) return { name: "sleepy", suggestedStatus: hour >= 23 ? "sleepy" : "sleeping" };
  if (input.lastChatSentiment === "negative") return activeWarmth ? { name: "calm", suggestedStatus: "idle" } : { name: "upset", suggestedStatus: "angry" };
  if (input.lastChatSentiment === "tired") return { name: "sleepy", suggestedStatus: "sleepy" };
  if (input.lastChatSentiment === "positive" && input.hasRecentChat) return { name: "happy", suggestedStatus: "happy" };
  if (input.memoryHitCount >= 2 && input.relationship.affection >= 50) return { name: "attached", suggestedStatus: "head-pat" };
  return { name: "calm", suggestedStatus: "idle" };
}
```

- [ ] **Step 6: Update chat mood helper to accept sentiment and memory hits**

Modify `src/app/main/chatMood.ts` so `createChatMoodStatus()` accepts optional sentiment and memory hit count:

```ts
import type { ChatSentiment } from "./moodEngine.js";

export function createChatMoodStatus(input: {
  now: string;
  relationship: RelationshipMemory;
  latestVisibleStatus: PetStatus;
  sentiment?: ChatSentiment;
  memoryHitCount?: number;
}): UpdatePetStatusInput {
  const mood = deriveMoodState({
    now: input.now,
    relationship: input.relationship,
    hasRecentChat: true,
    lastChatSentiment: input.sentiment ?? "positive",
    memoryHitCount: input.memoryHitCount ?? 0,
    clineVisibleStatus: input.latestVisibleStatus
  });
  return { status: mood.suggestedStatus, visibleStatus: mood.suggestedStatus, baseStatus: mood.suggestedStatus, overlayStatus: null, task: "", source: "chat", updatedAt: input.now };
}
```

- [ ] **Step 7: Run focused tests**

```powershell
npm test -- tests/app/main/relationshipEvents.test.ts tests/app/main/moodEngine.test.ts tests/app/main/chatMood.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```powershell
git add src/app/main/memory/relationshipEvents.ts src/app/main/moodEngine.ts src/app/main/chatMood.ts tests/app/main/relationshipEvents.test.ts tests/app/main/moodEngine.test.ts tests/app/main/chatMood.test.ts
git commit -m "feat: grow relationship from chat memory"
```

## Task 4: Chat Coordinator And History IPC

**Files:**
- Create: `src/app/main/chatCoordinator.ts`
- Modify: `src/app/main/main.ts`
- Modify: `src/app/renderer/petBridge.ts`
- Test: `tests/app/main/chatCoordinator.test.ts`
- Test: `tests/app/renderer/petBridge.test.ts`

- [ ] **Step 1: Write failing chat coordinator test**

Create `tests/app/main/chatCoordinator.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runKakaChatTurn } from "../../../src/app/main/chatCoordinator";
import { appendContextMemory } from "../../../src/app/main/memory/contextStore";
import { readChatHistory } from "../../../src/app/main/memory/chatHistoryStore";

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
    if (result.ok) expect(result.moodStatus.status).toBe("happy");
  });
});
```

- [ ] **Step 2: Run failing coordinator test**

```powershell
npm test -- tests/app/main/chatCoordinator.test.ts
```

Expected: FAIL because `chatCoordinator.ts` does not exist.

- [ ] **Step 3: Implement chat coordinator**

Create `src/app/main/chatCoordinator.ts`:

```ts
import type { DeepSeekConfig } from "./config.js";
import type { DeepSeekChatResult, DeepSeekMessage } from "./deepseekClient.js";
import { createChatMoodStatus } from "./chatMood.js";
import { createChatReply, type ChatReplyResult } from "./chatService.js";
import { appendChatHistoryTurn } from "./memory/chatHistoryStore.js";
import { buildMemoryPromptContext } from "./memory/memoryService.js";
import { readContextMemories } from "./memory/contextStore.js";
import { extractAndStoreMemories } from "./memory/memoryExtractionService.js";
import type { MemoryExtractionSentiment } from "./memory/memoryExtractionService.js";
import { loadProfileMemory } from "./memory/profileStore.js";
import { applyChatRelationshipEvent } from "./memory/relationshipEvents.js";
import { loadRelationshipMemory } from "./memory/relationshipStore.js";
import { searchContextMemories } from "./memory/retrieval.js";
import type { PetStatus } from "../../shared/statuses.js";

export type KakaChatTurnResult =
  | { ok: true; text: string; moodStatus: ReturnType<typeof createChatMoodStatus> }
  | { ok: false; errorCode: string; message: string };

export async function runKakaChatTurn(input: {
  root: string;
  config: DeepSeekConfig;
  text: string;
  now: string;
  latestVisibleStatus: PetStatus;
  chatRequester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
  extractionRequester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}): Promise<KakaChatTurnResult> {
  const profile = loadProfileMemory(input.root);
  const relationship = loadRelationshipMemory(input.root);
  const memories = readContextMemories(input.root);
  const relevantMemories = searchContextMemories(memories, input.text, 3);
  const memoryContext = buildMemoryPromptContext({ profile, relationship, memories: relevantMemories });
  const reply: ChatReplyResult = await createChatReply({ text: input.text, config: input.config, memoryContext, requester: input.chatRequester });
  if (!reply.ok) return { ok: false, errorCode: reply.errorCode, message: reply.message };

  appendChatHistoryTurn(input.root, { userText: input.text.trim(), assistantText: reply.data.text, createdAt: input.now, sentiment: "neutral", memoryIds: [] });
  const extraction = await extractAndStoreMemories({
    root: input.root,
    config: input.config,
    turn: { userText: input.text.trim(), assistantText: reply.data.text, createdAt: input.now },
    relationshipSummary: memoryContext.relationshipSummary ?? "",
    relevantMemorySummaries: relevantMemories.map((memory) => memory.text),
    recentChatSummaries: [],
    requester: input.extractionRequester
  });
  const sentiment: MemoryExtractionSentiment = extraction.ok ? extraction.data.extraction.sentiment : "positive";
  const relationshipEvent = extraction.ok ? extraction.data.extraction.relationshipEvent : "chat";
  const nextRelationship = applyChatRelationshipEvent(input.root, { now: input.now, sentiment, relationshipEvent });
  return {
    ok: true,
    text: reply.data.text,
    moodStatus: createChatMoodStatus({ now: input.now, relationship: nextRelationship, latestVisibleStatus: input.latestVisibleStatus, sentiment, memoryHitCount: relevantMemories.length })
  };
}
```

- [ ] **Step 4: Add bridge history method test**

Append to `tests/app/renderer/petBridge.test.ts`:

```ts
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
```

- [ ] **Step 5: Extend renderer bridge types and methods**

Modify `src/app/renderer/petBridge.ts` with these additions:

```ts
export type RendererChatHistoryTurn = {
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: string;
  summary?: string;
  memoryIds: string[];
};

export type ChatHistoryResponse =
  | { ok: true; data: RendererChatHistoryTurn[] }
  | { ok: false; errorCode: string; message: string };

export type ClearChatHistoryResponse = { ok: true } | { ok: false; errorCode: string; message: string };
```

Extend `IpcLike`:

```ts
invoke(channel: "chat:get-history"): Promise<ChatHistoryResponse>;
invoke(channel: "chat:clear-history"): Promise<ClearChatHistoryResponse>;
```

Add methods in `createRendererPetBridge()`:

```ts
getChatHistory() {
  return ipc.invoke("chat:get-history");
},
clearChatHistory() {
  return ipc.invoke("chat:clear-history");
}
```

- [ ] **Step 6: Wire main chat and history IPC**

Modify imports in `src/app/main/main.ts`:

```ts
import { runKakaChatTurn } from "./chatCoordinator.js";
import { clearChatHistory, readChatHistory } from "./memory/chatHistoryStore.js";
```

Replace the existing `ipcMain.handle("chat:send", ...)` body with:

```ts
ipcMain.handle("chat:send", async (_event, payload: { text?: string }) => {
  const config = loadDeepSeekConfig(paths.root);
  if (!config.ok) return { ok: false, errorCode: config.errorCode, message: config.message };
  const result = await runKakaChatTurn({
    root: appDataBaseDir,
    config: config.data,
    text: payload.text ?? "",
    now: new Date().toISOString(),
    latestVisibleStatus: latestStatus.visibleStatus
  });
  if (!result.ok) return result;
  notifyRenderer(win, result.moodStatus);
  return { ok: true, text: result.text };
});
ipcMain.handle("chat:get-history", () => ({ ok: true, data: readChatHistory(appDataBaseDir) }));
ipcMain.handle("chat:clear-history", () => {
  clearChatHistory(appDataBaseDir);
  return { ok: true };
});
```

- [ ] **Step 7: Run focused tests**

```powershell
npm test -- tests/app/main/chatCoordinator.test.ts tests/app/renderer/petBridge.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add src/app/main/chatCoordinator.ts src/app/main/main.ts src/app/renderer/petBridge.ts tests/app/main/chatCoordinator.test.ts tests/app/renderer/petBridge.test.ts
git commit -m "feat: coordinate Kaka chat memory loop"
```

## Task 5: Bubble Queue And Reading Mode

**Files:**
- Create: `src/app/renderer/bubbleQueue.ts`
- Modify: `src/app/renderer/bubbleTypes.ts`
- Modify: `src/app/renderer/SpeechBubble.tsx`
- Modify: `src/app/renderer/App.tsx`
- Test: `tests/app/renderer/bubbleQueue.test.ts`
- Test: `tests/app/renderer/bubbleTypes.test.ts`
- Test: `tests/app/renderer/SpeechBubble.test.ts`
- Test: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Write failing bubble queue test**

Create `tests/app/renderer/bubbleQueue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { enqueueBubble } from "../../../src/app/renderer/bubbleQueue";
import type { BubbleMessage } from "../../../src/app/renderer/bubbleTypes";

function bubble(id: string, kind: BubbleMessage["kind"], text = id): BubbleMessage {
  return { id, kind, text, createdAt: `2026-06-01T00:00:0${id.length}.000Z`, autoHideMs: 5000, mode: "transient", isLongText: false };
}

describe("bubbleQueue", () => {
  it("blocks lower-priority bubbles while a readable chat bubble is active", () => {
    const current = { ...bubble("chat", "chat"), mode: "readable" as const };
    const result = enqueueBubble({ current, queue: [] }, bubble("presence", "status", "喝口水"));
    expect(result).toEqual({ current, queue: [] });
  });

  it("keeps chat ahead of presence and caps the queue", () => {
    let state = { current: bubble("status", "status"), queue: [] as BubbleMessage[] };
    state = enqueueBubble(state, bubble("presence1", "status"));
    state = enqueueBubble(state, bubble("chat1", "chat"));
    expect(state.queue[0].kind).toBe("chat");
    expect(state.queue.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Update failing bubble type tests**

Modify `tests/app/renderer/bubbleTypes.test.ts` to expect chat metadata:

```ts
expect(bubbleFromChat("这是一段很长很长很长很长很长很长很长很长很长很长很长很长很长的回复")).toEqual(expect.objectContaining({
  kind: "chat",
  autoHideMs: 5000,
  mode: "transient",
  isLongText: true
}));
```

- [ ] **Step 3: Run failing focused tests**

```powershell
npm test -- tests/app/renderer/bubbleQueue.test.ts tests/app/renderer/bubbleTypes.test.ts
```

Expected: FAIL because queue and metadata do not exist.

- [ ] **Step 4: Extend bubble types**

Modify `src/app/renderer/bubbleTypes.ts`:

```ts
export type BubbleMode = "transient" | "readable" | "pinned";

export type BubbleMessage = {
  id: string;
  kind: BubbleKind;
  text: string;
  status?: PetStatus;
  createdAt: string;
  autoHideMs: number | null;
  mode: BubbleMode;
  isLongText: boolean;
};

export function isLongChatText(text: string) {
  const compact = text.trim();
  const latinCount = (compact.match(/[A-Za-z0-9]/g) ?? []).length;
  const cjkCount = (compact.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjkCount > 90 || latinCount > 180 || compact.length > 180;
}
```

Update all bubble factory return values with `mode` and `isLongText`:

```ts
export function bubbleFromChat(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return { id: idFor("chat", createdAt), kind: "chat", text, createdAt, autoHideMs: 5000, mode: "transient", isLongText: isLongChatText(text) };
}
```

Use `mode: "transient", isLongText: false` for status and notice, and `mode: "pinned", isLongText: false` for diagnostics.

- [ ] **Step 5: Implement bubble queue**

Create `src/app/renderer/bubbleQueue.ts`:

```ts
import type { BubbleMessage } from "./bubbleTypes";

export type BubbleQueueState = { current: BubbleMessage | null; queue: BubbleMessage[] };

function priority(bubble: BubbleMessage) {
  if (bubble.kind === "chat") return 4;
  if (bubble.kind === "notice" || bubble.kind === "diagnostics") return 3;
  if (bubble.kind === "status") return 2;
  return 1;
}

export function enqueueBubble(state: BubbleQueueState, next: BubbleMessage): BubbleQueueState {
  if (state.current?.mode === "readable" && priority(next) < priority(state.current)) return state;
  if (!state.current) return { current: next, queue: state.queue };
  const queue = [...state.queue, next]
    .sort((a, b) => priority(b) - priority(a) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 5);
  return { current: state.current, queue };
}

export function popNextBubble(state: BubbleQueueState): BubbleQueueState {
  const [current, ...queue] = state.queue;
  return { current: current ?? null, queue };
}

export function makeBubbleReadable(bubble: BubbleMessage): BubbleMessage {
  return { ...bubble, mode: "readable", autoHideMs: null };
}
```

- [ ] **Step 6: Update SpeechBubble props and rendering**

Modify `src/app/renderer/SpeechBubble.tsx`:

```tsx
export type SpeechBubbleProps = {
  message: BubbleMessage | null;
  onOpenReadable?(): void;
  onClose?(): void;
};

export function SpeechBubble({ message, onOpenReadable, onClose }: SpeechBubbleProps) {
  if (!message) return null;
  const canOpen = message.kind === "chat" && message.mode === "transient" && message.isLongText;
  return (
    <section className="speech-bubble" data-kind={message.kind} data-mode={message.mode} aria-live="polite" onClick={canOpen ? onOpenReadable : undefined}>
      {message.mode === "readable" && <button className="speech-bubble-close" type="button" onClick={(event) => { event.stopPropagation(); onClose?.(); }}>×</button>}
      <span className="speech-bubble-text">{message.text}</span>
      {canOpen && <span className="speech-bubble-hint">点开读完</span>}
    </section>
  );
}
```

- [ ] **Step 7: Wire queue in App**

Modify `src/app/renderer/App.tsx` imports:

```ts
import { enqueueBubble, makeBubbleReadable, popNextBubble } from "./bubbleQueue";
```

Replace direct `setBubble(nextBubble)` calls with:

```ts
function pushBubble(next: BubbleMessage | null) {
  if (!next) return;
  setBubbleState((state) => enqueueBubble(state, next));
}
```

Keep this state:

```ts
const [bubbleState, setBubbleState] = useState<{ current: BubbleMessage | null; queue: BubbleMessage[] }>({ current: null, queue: [] });
const bubble = bubbleState.current;
```

Update auto-hide effect:

```ts
useEffect(() => {
  if (!bubble?.autoHideMs) return;
  const bubbleId = bubble.id;
  const timer = window.setTimeout(() => {
    setBubbleState((current) => current.current?.id === bubbleId ? popNextBubble({ current: null, queue: current.queue }) : current);
  }, bubble.autoHideMs);
  return () => window.clearTimeout(timer);
}, [bubble]);
```

Pass handlers to `PetView`:

```tsx
onOpenReadableBubble={() => setBubbleState((state) => state.current ? { ...state, current: makeBubbleReadable(state.current) } : state)}
onCloseBubble={() => setBubbleState((state) => popNextBubble({ current: null, queue: state.queue }))}
```

- [ ] **Step 8: Update PetView props**

Add to `PetViewProps`:

```ts
onOpenReadableBubble(): void;
onCloseBubble(): void;
```

Render:

```tsx
<SpeechBubble message={bubble} onOpenReadable={onOpenReadableBubble} onClose={onCloseBubble} />
```

- [ ] **Step 9: Add reading mode tests**

Append to `tests/app/renderer/App.test.ts`:

```ts
it("keeps long chat readable when the user opens the bubble", async () => {
  vi.useFakeTimers();
  (window as any).clinePet = {
    onPetStatus: vi.fn(),
    onPetPack: vi.fn(),
    getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
    sendChatMessage: vi.fn().mockResolvedValue({ ok: true, text: "这是一段很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长的回复。" })
  };
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);

  await act(async () => { root.render(React.createElement(App)); await Promise.resolve(); });
  await act(async () => { (document.querySelector(".pet-stage") as HTMLElement).dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); });
  const input = document.querySelector('input[name="message"]') as HTMLInputElement;
  const form = document.querySelector(".chat-input") as HTMLFormElement;
  await act(async () => { input.value = "长一点"; input.dispatchEvent(new Event("input", { bubbles: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); });
  await act(async () => { (document.querySelector(".speech-bubble") as HTMLElement).click(); vi.advanceTimersByTime(5000); });

  expect(document.querySelector(".speech-bubble")?.getAttribute("data-mode")).toBe("readable");
});
```

- [ ] **Step 10: Run focused renderer tests**

```powershell
npm test -- tests/app/renderer/bubbleQueue.test.ts tests/app/renderer/bubbleTypes.test.ts tests/app/renderer/SpeechBubble.test.ts tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit Task 5**

```powershell
git add src/app/renderer/bubbleQueue.ts src/app/renderer/bubbleTypes.ts src/app/renderer/SpeechBubble.tsx src/app/renderer/PetView.tsx src/app/renderer/App.tsx tests/app/renderer/bubbleQueue.test.ts tests/app/renderer/bubbleTypes.test.ts tests/app/renderer/SpeechBubble.test.ts tests/app/renderer/App.test.ts
git commit -m "feat: add readable Kaka chat bubbles"
```

## Task 6: Chat History Panel

**Files:**
- Create: `src/app/renderer/chatHistoryTypes.ts`
- Create: `src/app/renderer/ChatHistoryPanel.tsx`
- Modify: `src/app/renderer/App.tsx`
- Modify: `src/app/renderer/PetView.tsx`
- Modify: `src/app/renderer/petStyles.css`
- Test: `tests/app/renderer/ChatHistoryPanel.test.tsx`
- Test: `tests/app/renderer/App.test.ts`
- Test: `tests/app/renderer/petStyles.test.ts`

- [ ] **Step 1: Write failing ChatHistoryPanel test**

Create `tests/app/renderer/ChatHistoryPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatHistoryPanel } from "../../../src/app/renderer/ChatHistoryPanel";

describe("ChatHistoryPanel", () => {
  afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

  it("renders searchable turns and clear action", async () => {
    const onClear = vi.fn();
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(<ChatHistoryPanel open turns={[{
        id: "t1",
        userText: "今天好累",
        assistantText: "先喝口水，我在旁边陪你。",
        createdAt: "2026-06-01T01:00:00.000Z",
        sentiment: "tired",
        memoryIds: []
      }]} pending={false} onClose={() => undefined} onClear={onClear} />);
    });

    expect(document.querySelector(".chat-history-panel")?.textContent).toContain("今天好累");
    const input = document.querySelector('input[name="historySearch"]') as HTMLInputElement;
    await act(async () => { input.value = "喝水"; input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(document.querySelector(".chat-history-panel")?.textContent).toContain("先喝口水");
    await act(async () => { (document.querySelector(".chat-history-clear") as HTMLButtonElement).click(); });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows a calm empty state", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);
    await act(async () => { root.render(<ChatHistoryPanel open turns={[]} pending={false} onClose={() => undefined} onClear={() => undefined} />); });
    expect(document.querySelector(".chat-history-empty")?.textContent).toContain("还没有对话记录");
  });
});
```

- [ ] **Step 2: Run failing panel test**

```powershell
npm test -- tests/app/renderer/ChatHistoryPanel.test.tsx
```

Expected: FAIL because `ChatHistoryPanel.tsx` does not exist.

- [ ] **Step 3: Add renderer chat history types**

Create `src/app/renderer/chatHistoryTypes.ts`:

```ts
export type RendererChatHistoryTurn = {
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: string;
  summary?: string;
  memoryIds: string[];
};
```

- [ ] **Step 4: Implement ChatHistoryPanel**

Create `src/app/renderer/ChatHistoryPanel.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { RendererChatHistoryTurn } from "./chatHistoryTypes";

export type ChatHistoryPanelProps = {
  open: boolean;
  turns: RendererChatHistoryTurn[];
  pending: boolean;
  onClose(): void;
  onClear(): void;
};

export function ChatHistoryPanel({ open, turns, pending, onClose, onClear }: ChatHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return turns;
    return turns.filter((turn) => `${turn.userText} ${turn.assistantText} ${turn.summary ?? ""}`.toLowerCase().includes(needle));
  }, [query, turns]);
  if (!open) return null;
  return (
    <section className="chat-history-panel" aria-label="对话历史">
      <header>
        <strong>对话历史</strong>
        <button type="button" onClick={onClose}>关闭</button>
      </header>
      <input name="historySearch" value={query} onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} placeholder="搜索最近对话..." />
      {filtered.length === 0 ? <p className="chat-history-empty">还没有对话记录，和卡卡说句话吧。</p> : (
        <ol className="chat-history-list">
          {filtered.map((turn) => (
            <li key={turn.id}>
              <time>{new Date(turn.createdAt).toLocaleString()}</time>
              <p><strong>你：</strong>{turn.userText}</p>
              <p><strong>卡卡：</strong>{turn.assistantText}</p>
              <button type="button" onClick={() => navigator.clipboard?.writeText?.(`你：${turn.userText}\n卡卡：${turn.assistantText}`)}>复制</button>
            </li>
          ))}
        </ol>
      )}
      <footer>
        <button className="chat-history-clear" type="button" disabled={pending || turns.length === 0} onClick={onClear}>清空历史</button>
      </footer>
    </section>
  );
}
```

- [ ] **Step 5: Wire panel in App and PetView**

In `App.tsx`, add state and helpers:

```ts
const [historyOpen, setHistoryOpen] = useState(false);
const [historyPending, setHistoryPending] = useState(false);
const [chatHistory, setChatHistory] = useState<RendererChatHistoryTurn[]>([]);

async function refreshChatHistory() {
  setHistoryPending(true);
  const result = await window.clinePet?.getChatHistory?.();
  setHistoryPending(false);
  if (result?.ok) setChatHistory(result.data);
}

async function openChatHistory() {
  setHistoryOpen(true);
  await refreshChatHistory();
}

async function clearChatHistoryFromPanel() {
  setHistoryPending(true);
  const result = await window.clinePet?.clearChatHistory?.();
  setHistoryPending(false);
  if (result?.ok) setChatHistory([]);
}
```

After a successful chat, call:

```ts
void refreshChatHistory();
```

Render panel:

```tsx
<ChatHistoryPanel open={historyOpen} pending={historyPending} turns={chatHistory} onClose={() => setHistoryOpen(false)} onClear={clearChatHistoryFromPanel} />
```

Add `onOpenHistory={openChatHistory}` to `PetView`.

In `PetView.tsx`, add prop and button:

```tsx
<button className="chat-history-trigger" type="button" onClick={onOpenHistory} title="查看对话历史">历史</button>
```

- [ ] **Step 6: Add styles**

Append to `src/app/renderer/petStyles.css`:

```css
.chat-history-trigger {
  position: absolute;
  right: 14px;
  top: 14px;
  z-index: 2;
  border: 0;
  border-radius: 999px;
  padding: 6px 9px;
  cursor: pointer;
  color: #fff;
  background: rgba(15, 23, 42, 0.72);
  -webkit-app-region: no-drag;
}

.chat-history-panel {
  position: absolute;
  inset: 12px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 18px;
  color: #e5e7eb;
  background: rgba(15, 23, 42, 0.95);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.34);
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.chat-history-panel header,
.chat-history-panel footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.chat-history-panel input { border: 0; border-radius: 999px; padding: 7px 10px; outline: 0; }
.chat-history-list { margin: 0; padding: 0; list-style: none; overflow-y: auto; }
.chat-history-list li { padding: 8px 0; border-top: 1px solid rgba(148, 163, 184, 0.25); }
.chat-history-list p { margin: 4px 0; }
.chat-history-list time,
.chat-history-empty { color: #cbd5e1; font-size: 11px; }
.chat-history-panel button { border: 0; border-radius: 999px; padding: 6px 9px; cursor: pointer; }
.chat-history-clear { color: #111827; background: #fbbf24; }
```

- [ ] **Step 7: Run focused panel tests**

```powershell
npm test -- tests/app/renderer/ChatHistoryPanel.test.tsx tests/app/renderer/App.test.ts tests/app/renderer/petStyles.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```powershell
git add src/app/renderer/chatHistoryTypes.ts src/app/renderer/ChatHistoryPanel.tsx src/app/renderer/App.tsx src/app/renderer/PetView.tsx src/app/renderer/petStyles.css tests/app/renderer/ChatHistoryPanel.test.tsx tests/app/renderer/App.test.ts tests/app/renderer/petStyles.test.ts
git commit -m "feat: add Kaka chat history panel"
```

## Task 7: Presence Guards And Documentation

**Files:**
- Modify: `src/app/main/presenceService.ts`
- Test: `tests/app/main/presenceService.test.ts`
- Modify: `docs/development/kaka-development-guide.md`
- Modify: `docs/development/kaka-compact.md`

- [ ] **Step 1: Extend presence tests**

Append to `tests/app/main/presenceService.test.ts`:

```ts
it("stays quiet while the user is reading a chat bubble", () => {
  const pulse = maybeCreatePresencePulse({
    now: "2026-06-01T21:00:00.000Z",
    lastPresenceAt: "2026-06-01T10:00:00.000Z",
    latestVisibleStatus: "idle",
    mood: "lonely",
    userIsReading: true
  });
  expect(pulse).toBeNull();
});

it("can emit a rare work-session care reminder after cooldown", () => {
  const pulse = maybeCreatePresencePulse({
    now: "2026-06-01T21:00:00.000Z",
    lastPresenceAt: "2026-06-01T10:00:00.000Z",
    latestVisibleStatus: "loading",
    mood: "curious",
    longWorkSession: true
  });
  expect(pulse?.message).toContain("喝口水");
});
```

- [ ] **Step 2: Run failing presence test**

```powershell
npm test -- tests/app/main/presenceService.test.ts
```

Expected: FAIL because `userIsReading` and `longWorkSession` inputs are not supported.

- [ ] **Step 3: Implement presence guards**

Modify `src/app/main/presenceService.ts` input type and logic:

```ts
export function maybeCreatePresencePulse(input: {
  now: string;
  lastPresenceAt?: string;
  latestVisibleStatus: PetStatus;
  mood: MoodName;
  userIsReading?: boolean;
  longWorkSession?: boolean;
}): UpdatePetStatusInput | null {
  const nowMs = new Date(input.now).getTime();
  const lastPresenceMs = input.lastPresenceAt ? new Date(input.lastPresenceAt).getTime() : 0;
  const cooldownMs = 4 * 60 * 60 * 1000;
  if (input.userIsReading) return null;
  if (lastPresenceMs && nowMs - lastPresenceMs < cooldownMs) return null;
  if ((input.latestVisibleStatus === "loading" || input.latestVisibleStatus === "thinking") && !input.longWorkSession) return null;
  if (input.longWorkSession) {
    return { status: "message", visibleStatus: "message", baseStatus: "message", overlayStatus: null, task: "", message: "要不要喝口水？我会乖乖等你。", source: "presence", updatedAt: input.now };
  }
  if (input.mood === "lonely") {
    return { status: "message", visibleStatus: "message", baseStatus: "message", overlayStatus: null, task: "", message: "我会安静陪在你旁边。", source: "presence", updatedAt: input.now };
  }
  return null;
}
```

- [ ] **Step 4: Update docs**

In `docs/development/kaka-development-guide.md`, add a Cyber Life v1 section under “聊天、气泡和心情”:

```md
## Cyber Life v1

- 设计文档：`docs/superpowers/specs/2026-06-01-kaka-cyber-life-v1-design.md`。
- 实现计划：`docs/superpowers/plans/2026-06-01-kaka-cyber-life-v1-implementation.md`。
- 新增本地历史文件：`%APPDATA%/cline-desktop-pet/chat-history.jsonl`。
- DeepSeek 记忆提炼只发送聊天文本和紧凑记忆摘要，不自动读取文件、代码、屏幕、终端输出或日志。
- Cyber Life v1 范围：可阅读长回复、历史面板、记忆闭环、关系成长、低频主动陪伴、气泡队列。
```

In `docs/development/kaka-compact.md`, update latest important commits and likely next tasks to mention Cyber Life v1 implementation.

- [ ] **Step 5: Run docs-independent focused tests**

```powershell
npm test -- tests/app/main/presenceService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```powershell
git add src/app/main/presenceService.ts tests/app/main/presenceService.test.ts docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "feat: tune Kaka presence for Cyber Life v1"
```

## Task 8: Full Verification And Push

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run all tests**

```powershell
npm test
```

Expected: all Vitest suites pass. Existing jsdom `act(...)` warnings are acceptable only if the command exits with code 0 and the summary reports all tests passed.

- [ ] **Step 2: Run production build**

```powershell
npm run build
```

Expected: renderer, main, and preload builds complete without TypeScript, Vite, or esbuild errors.

- [ ] **Step 3: Inspect Git state**

```powershell
git status --short --branch
git --no-pager log --oneline -8
```

Expected: branch is ahead of `origin/feat/12-state-local-pet-pack` by the Cyber Life v1 commits; only `.superpowers/` may be untracked.

- [ ] **Step 4: Push feature branch**

```powershell
git push origin feat/12-state-local-pet-pack
```

Expected: push succeeds to `https://github.com/bernis-web/cline-pet.git`.

- [ ] **Step 5: Final status check**

```powershell
git status --short --branch
```

Expected: local branch matches remote; `.superpowers/` remains untracked and uncommitted.

## Plan Coverage Notes

- Conversation reading mode: Task 5.
- Conversation history panel and storage: Tasks 1, 4, and 6.
- DeepSeek memory extraction: Task 2.
- Memory retrieval injected into chat: Task 4.
- Relationship growth and mood: Task 3.
- Low-frequency proactive presence: Task 7.
- Bubble queue: Task 5.
- Docs and roadmap references: Task 7.
- Full verification and push: Task 8.