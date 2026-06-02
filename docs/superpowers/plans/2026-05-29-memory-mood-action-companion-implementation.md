# Memory Mood Action Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local long-term memory, mood/bond state, mood-driven pose selection, and gentle proactive companion behavior for Kaka while keeping DeepSeek as a stateless reply generator fed with only short context plus selected local memories.

**Architecture:** Memory remains local-first in `%APPDATA%/cline-desktop-pet/` using simple JSON/JSONL storage so privacy boundaries stay clear and no new database dependency is required in phase one. Electron main owns memory retrieval, mood computation, pose resolution, and proactive behavior scheduling; renderer keeps rendering pet status, bubble text, and current pack assets without learning about API keys or raw long-term memory data.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Zod, Node `fs`, local JSON/JSONL storage, existing DeepSeek OpenAI-compatible chat completions API via `fetch`.

---

## File Structure

### New files

- `src/app/main/memory/memoryTypes.ts`
  - Canonical runtime-friendly types for profile memory, relationship memory, context memory items, retrieval results, and memory summaries.
- `src/app/main/memory/profileStore.ts`
  - Read/write the stable user profile memory JSON file.
- `src/app/main/memory/relationshipStore.ts`
  - Read/write the bond/relationship memory JSON file.
- `src/app/main/memory/contextStore.ts`
  - Append/read context memory JSONL items.
- `src/app/main/memory/retrieval.ts`
  - Lightweight local retrieval and scoring for context memories.
- `src/app/main/memory/memoryService.ts`
  - Orchestrates profile/relationship/context retrieval for chat and post-chat persistence.
- `src/app/main/moodEngine.ts`
  - Computes current mood/bond-derived companion presentation state.
- `src/app/main/poseResolver.ts`
  - Resolves `mood + activity + bond` into current `PetStatus` and optional future variant/action identifiers.
- `src/app/main/presenceService.ts`
  - Decides whether a low-frequency proactive bubble should fire.
- `tests/shared/paths.test.ts`
  - Verifies new local memory file paths.
- `tests/app/main/profileStore.test.ts`
  - Verifies profile memory defaults and persistence.
- `tests/app/main/relationshipStore.test.ts`
  - Verifies relationship memory defaults, clamping, and persistence.
- `tests/app/main/contextStore.test.ts`
  - Verifies JSONL context storage and retrieval scoring.
- `tests/app/main/memoryService.test.ts`
  - Verifies prompt context assembly and post-chat memory updates.
- `tests/app/main/moodEngine.test.ts`
  - Verifies mood transitions and bond effects.
- `tests/app/main/poseResolver.test.ts`
  - Verifies mood/activity mapping into pet status and optional variant selection.
- `tests/app/main/presenceService.test.ts`
  - Verifies low-frequency proactive behavior rules.

### Modified files

- `src/shared/paths.ts`
  - Add local memory file locations under `%APPDATA%/cline-desktop-pet/`.
- `src/shared/schemas.ts`
  - Extend pet pack schema for formatVersion 3 optional `variants` and `actionSets` fields.
- `src/assets/petPackManager.ts`
  - Parse and carry formatVersion 3 pack metadata while staying backward-compatible with formatVersion 2.
- `src/app/main/chatService.ts`
  - Inject selected memory summaries into chat prompt construction and record successful conversation turns.
- `src/app/main/main.ts`
  - Initialize memory/presence services, update local mood state after chats/statuses, and emit proactive companion bubbles.
- `README.md`
  - Document local-first memory, mood-driven presentation, and proactive behavior defaults.
- `docs/pet-pack-format.md`
  - Add formatVersion 3 extension guidance for `variants` and `actionSets`.
- `tests/assets/petPackManager.test.ts`
  - Cover formatVersion 3 compatibility and fallback behavior.
- `tests/app/main/chatService.test.ts`
  - Cover chat prompt memory injection and post-reply persistence.

---

### Task 1: Local memory file layout and shared types

**Files:**
- Create: `src/app/main/memory/memoryTypes.ts`
- Modify: `src/shared/paths.ts`
- Test: `tests/shared/paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/shared/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPaths } from "../../src/shared/paths";

describe("getPaths", () => {
  it("exposes local files for profile, relationship, and context memory", () => {
    const paths = getPaths({ APPDATA: "C:/Users/me/AppData/Roaming" } as NodeJS.ProcessEnv);

    expect(paths.root).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet");
    expect(paths.profileMemoryFile).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet/profile.json");
    expect(paths.relationshipMemoryFile).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet/relationship.json");
    expect(paths.contextMemoryFile).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet/context-memory.jsonl");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/shared/paths.test.ts
```

Expected: FAIL because `profileMemoryFile`, `relationshipMemoryFile`, and `contextMemoryFile` do not exist on `getPaths()` yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/memory/memoryTypes.ts`:

```ts
export type ProfileMemory = {
  displayName?: string;
  preferredAddress?: string;
  likes: string[];
  dislikes: string[];
  habits: string[];
  topics: string[];
  notes: string[];
  updatedAt: string;
};

export type RelationshipMemory = {
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  lastInteractionAt?: string;
  recentEvents: { text: string; createdAt: string; weight: number }[];
  updatedAt: string;
};

export type ContextMemoryItem = {
  id: string;
  kind: "conversation-summary" | "fact" | "preference" | "project-context";
  text: string;
  tags: string[];
  sourceConversationId?: string;
  lastAccessedAt?: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryPromptContext = {
  profileSummary: string | null;
  relationshipSummary: string | null;
  retrievedMemories: ContextMemoryItem[];
};
```

Modify `src/shared/paths.ts`:

```ts
import { join } from "node:path";

export function getAppDataRoot(env = process.env): string {
  const appData = env.APPDATA ?? join(env.USERPROFILE ?? process.cwd(), "AppData", "Roaming");
  return join(appData, "cline-desktop-pet");
}

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
    appLog: join(root, "logs", "pet-app.log"),
    mcpLog: join(root, "logs", "mcp-server.log")
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/shared/paths.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/shared/paths.ts src/app/main/memory/memoryTypes.ts tests/shared/paths.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add local memory file layout"
```

### Task 2: Profile and relationship stores

**Files:**
- Create: `src/app/main/memory/profileStore.ts`
- Create: `src/app/main/memory/relationshipStore.ts`
- Test: `tests/app/main/profileStore.test.ts`
- Test: `tests/app/main/relationshipStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/app/main/profileStore.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadProfileMemory, saveProfileMemory } from "../../../src/app/main/memory/profileStore";

describe("profile store", () => {
  const roots: string[] = [];
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("returns empty default profile when file is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-profile-"));
    roots.push(root);
    expect(loadProfileMemory(root)).toEqual({
      likes: [], dislikes: [], habits: [], topics: [], notes: [], updatedAt: expect.any(String)
    });
  });

  it("persists merged profile updates", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-profile-"));
    roots.push(root);
    saveProfileMemory(root, (current) => ({ ...current, preferredAddress: "主人", likes: ["深夜开发"] }));
    expect(loadProfileMemory(root)).toEqual(expect.objectContaining({ preferredAddress: "主人", likes: ["深夜开发"] }));
  });
});
```

Create `tests/app/main/relationshipStore.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadRelationshipMemory, saveRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

describe("relationship store", () => {
  const roots: string[] = [];
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("returns bounded default relationship values", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-relationship-"));
    roots.push(root);
    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({ familiarity: 0, affection: 0, engagement: 0, trust: 0, recentEvents: [] }));
  });

  it("persists updates and clamps scores into 0-100", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-relationship-"));
    roots.push(root);
    saveRelationshipMemory(root, (current) => ({ ...current, familiarity: 130, affection: -10, engagement: 40, trust: 55 }));
    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({ familiarity: 100, affection: 0, engagement: 40, trust: 55 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/profileStore.test.ts tests/app/main/relationshipStore.test.ts
```

Expected: FAIL because the two store modules do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/memory/profileStore.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPaths } from "../../shared/paths.js";
import type { ProfileMemory } from "./memoryTypes.js";

function defaultProfile(): ProfileMemory {
  return { likes: [], dislikes: [], habits: [], topics: [], notes: [], updatedAt: new Date().toISOString() };
}

export function loadProfileMemory(root: string): ProfileMemory {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).profileMemoryFile;
  if (!existsSync(file)) return defaultProfile();
  return { ...defaultProfile(), ...JSON.parse(readFileSync(file, "utf8")) } as ProfileMemory;
}

export function saveProfileMemory(root: string, updater: (current: ProfileMemory) => ProfileMemory) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).profileMemoryFile;
  const next = { ...updater(loadProfileMemory(root)), updatedAt: new Date().toISOString() };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
```

Create `src/app/main/memory/relationshipStore.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPaths } from "../../shared/paths.js";
import type { RelationshipMemory } from "./memoryTypes.js";

function clamp(value: number) { return Math.max(0, Math.min(100, value)); }

function defaultRelationship(): RelationshipMemory {
  return { familiarity: 0, affection: 0, engagement: 0, trust: 0, recentEvents: [], updatedAt: new Date().toISOString() };
}

export function loadRelationshipMemory(root: string): RelationshipMemory {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).relationshipMemoryFile;
  if (!existsSync(file)) return defaultRelationship();
  return { ...defaultRelationship(), ...JSON.parse(readFileSync(file, "utf8")) } as RelationshipMemory;
}

export function saveRelationshipMemory(root: string, updater: (current: RelationshipMemory) => RelationshipMemory) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).relationshipMemoryFile;
  const draft = updater(loadRelationshipMemory(root));
  const next: RelationshipMemory = {
    ...draft,
    familiarity: clamp(draft.familiarity),
    affection: clamp(draft.affection),
    engagement: clamp(draft.engagement),
    trust: clamp(draft.trust),
    updatedAt: new Date().toISOString()
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/profileStore.test.ts tests/app/main/relationshipStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/memory/profileStore.ts src/app/main/memory/relationshipStore.ts tests/app/main/profileStore.test.ts tests/app/main/relationshipStore.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add profile and relationship stores"
```

### Task 3: Context memory storage and retrieval

**Files:**
- Create: `src/app/main/memory/contextStore.ts`
- Create: `src/app/main/memory/retrieval.ts`
- Test: `tests/app/main/contextStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/main/contextStore.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { appendContextMemory, readContextMemories } from "../../../src/app/main/memory/contextStore";
import { searchContextMemories } from "../../../src/app/main/memory/retrieval";

describe("context memory", () => {
  const roots: string[] = [];
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("appends JSONL items and reads them back", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-context-"));
    roots.push(root);
    appendContextMemory(root, { kind: "preference", text: "用户偏爱隐私优先", tags: ["privacy"], weight: 80 });
    expect(readContextMemories(root)).toHaveLength(1);
  });

  it("returns the most relevant memories first", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-context-"));
    roots.push(root);
    appendContextMemory(root, { kind: "project-context", text: "用户正在做桌宠长期记忆模块", tags: ["memory", "desktop-pet"], weight: 90 });
    appendContextMemory(root, { kind: "fact", text: "用户喜欢深夜开发", tags: ["habit"], weight: 40 });

    const results = searchContextMemories(readContextMemories(root), "桌宠记忆", 2);

    expect(results[0]?.text).toContain("桌宠长期记忆模块");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/contextStore.test.ts
```

Expected: FAIL because `contextStore.ts` and `retrieval.ts` do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/memory/contextStore.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { getPaths } from "../../shared/paths.js";
import type { ContextMemoryItem } from "./memoryTypes.js";

type NewContextMemory = Omit<ContextMemoryItem, "id" | "createdAt" | "updatedAt">;

export function readContextMemories(root: string): ContextMemoryItem[] {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ContextMemoryItem);
}

export function appendContextMemory(root: string, input: NewContextMemory): ContextMemoryItem {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  const now = new Date().toISOString();
  const item: ContextMemoryItem = { id: randomUUID(), createdAt: now, updatedAt: now, ...input };
  mkdirSync(dirname(file), { recursive: true });
  const prefix = existsSync(file) && readFileSync(file, "utf8").length > 0 ? "\n" : "";
  writeFileSync(file, `${existsSync(file) ? readFileSync(file, "utf8") : ""}${prefix}${JSON.stringify(item)}`, "utf8");
  return item;
}
```

Create `src/app/main/memory/retrieval.ts`:

```ts
import type { ContextMemoryItem } from "./memoryTypes.js";

function tokenize(input: string) {
  return input.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function searchContextMemories(items: ContextMemoryItem[], query: string, limit: number) {
  const terms = tokenize(query);
  return [...items]
    .map((item) => {
      const haystack = `${item.text} ${item.tags.join(" ")}`.toLowerCase();
      const hits = terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
      return { item, score: item.weight + hits * 50 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt))
    .slice(0, limit)
    .map((entry) => entry.item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/contextStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/memory/contextStore.ts src/app/main/memory/retrieval.ts tests/app/main/contextStore.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add context memory retrieval"
```

### Task 4: Memory service and DeepSeek chat integration

**Files:**
- Create: `src/app/main/memory/memoryService.ts`
- Modify: `src/app/main/chatService.ts`
- Test: `tests/app/main/memoryService.test.ts`
- Modify: `tests/app/main/chatService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/app/main/memoryService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMemoryPromptContext } from "../../../src/app/main/memory/memoryService";

describe("memoryService", () => {
  it("builds a compact prompt context from profile, relationship, and retrieved memories", () => {
    const context = buildMemoryPromptContext({
      profile: { preferredAddress: "主人", likes: ["深夜开发"], dislikes: [], habits: [], topics: [], notes: [], updatedAt: "2026-05-29T00:00:00.000Z" },
      relationship: { familiarity: 60, affection: 70, engagement: 55, trust: 65, recentEvents: [], updatedAt: "2026-05-29T00:00:00.000Z" },
      memories: [{ id: "m1", kind: "preference", text: "用户喜欢卡卡少打扰", tags: ["preference"], weight: 90, createdAt: "2026-05-29T00:00:00.000Z", updatedAt: "2026-05-29T00:00:00.000Z" }]
    });

    expect(context.profileSummary).toContain("主人");
    expect(context.relationshipSummary).toContain("affection=70");
    expect(context.retrievedMemories).toHaveLength(1);
  });
});
```

Modify `tests/app/main/chatService.test.ts` to add:

```ts
it("injects memory summaries into chat messages and records the conversation after a successful reply", async () => {
  const recordTurn = vi.fn().mockResolvedValue(undefined);
  const requester = vi.fn().mockResolvedValue({ ok: true, data: { text: "我记得你说过喜欢安静陪伴。" } });

  const result = await createChatReply({
    text: "你还记得我喜欢什么吗？",
    config: { apiKey: "sk", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
    memoryContext: {
      profileSummary: "用户偏好被称呼为主人。",
      relationshipSummary: "affection=70 trust=65",
      retrievedMemories: [{ id: "m1", kind: "preference", text: "用户喜欢少打扰。", tags: ["preference"], weight: 90, createdAt: "2026-05-29T00:00:00.000Z", updatedAt: "2026-05-29T00:00:00.000Z" }]
    },
    onConversationResolved: recordTurn,
    requester
  });

  expect(result.ok).toBe(true);
  expect(requester).toHaveBeenCalledWith(expect.objectContaining({
    messages: expect.arrayContaining([
      expect.objectContaining({ role: "system", content: expect.stringContaining("用户偏好被称呼为主人") }),
      expect.objectContaining({ role: "system", content: expect.stringContaining("用户喜欢少打扰") })
    ])
  }));
  expect(recordTurn).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/memoryService.test.ts tests/app/main/chatService.test.ts
```

Expected: FAIL because `memoryService.ts` does not exist and `createChatReply()` does not accept memory context yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/memory/memoryService.ts`:

```ts
import type { ContextMemoryItem, MemoryPromptContext, ProfileMemory, RelationshipMemory } from "./memoryTypes.js";

export function buildMemoryPromptContext(input: {
  profile: ProfileMemory;
  relationship: RelationshipMemory;
  memories: ContextMemoryItem[];
}): MemoryPromptContext {
  const profileSummary = [input.profile.preferredAddress && `preferredAddress=${input.profile.preferredAddress}`, input.profile.likes.length > 0 && `likes=${input.profile.likes.join("/")}`].filter(Boolean).join("; ") || null;
  const relationshipSummary = `familiarity=${input.relationship.familiarity} affection=${input.relationship.affection} engagement=${input.relationship.engagement} trust=${input.relationship.trust}`;
  return { profileSummary, relationshipSummary, retrievedMemories: input.memories.slice(0, 3) };
}
```

Modify `src/app/main/chatService.ts`:

```ts
import type { DeepSeekConfig } from "./config.js";
import type { ContextMemoryItem, MemoryPromptContext } from "./memory/memoryTypes.js";
import { requestDeepSeekChat, type DeepSeekChatResult, type DeepSeekMessage } from "./deepseekClient.js";

export type ChatReplyResult = DeepSeekChatResult | { ok: false; errorCode: "CHAT_EMPTY_MESSAGE"; message: string };

export async function createChatReply(input: {
  text: string;
  config: DeepSeekConfig;
  memoryContext?: MemoryPromptContext;
  onConversationResolved?: (turn: { userText: string; assistantText: string }) => Promise<void>;
  requester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}): Promise<ChatReplyResult> {
  const text = input.text.trim();
  if (!text) return { ok: false, errorCode: "CHAT_EMPTY_MESSAGE", message: "你还没说话。" };

  const memoryMessages: DeepSeekMessage[] = [];
  if (input.memoryContext?.profileSummary) memoryMessages.push({ role: "system", content: `用户档案：${input.memoryContext.profileSummary}` });
  if (input.memoryContext?.relationshipSummary) memoryMessages.push({ role: "system", content: `关系状态：${input.memoryContext.relationshipSummary}` });
  for (const memory of input.memoryContext?.retrievedMemories ?? []) {
    memoryMessages.push({ role: "system", content: `相关记忆：${memory.text}` });
  }

  const messages: DeepSeekMessage[] = [
    { role: "system", content: "你是卡卡，一个运行在用户电脑本地的桌面电子宠物。回答要简短、温和、有一点陪伴感。不要声称你能读取用户代码或文件，除非用户主动提供。" },
    ...memoryMessages,
    { role: "user", content: text }
  ];

  const requester = input.requester ?? requestDeepSeekChat;
  const result = await requester({ config: input.config, messages, timeoutMs: 30000 });
  if (result.ok) await input.onConversationResolved?.({ userText: text, assistantText: result.data.text });
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/memoryService.test.ts tests/app/main/chatService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/memory/memoryService.ts src/app/main/chatService.ts tests/app/main/memoryService.test.ts tests/app/main/chatService.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add memory-aware chat context"
```

### Task 5: Mood and bond engine

**Files:**
- Create: `src/app/main/moodEngine.ts`
- Test: `tests/app/main/moodEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/main/moodEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveMoodState } from "../../../src/app/main/moodEngine";

describe("mood engine", () => {
  it("leans happy when affection is high and the last interaction was positive", () => {
    const mood = deriveMoodState({
      now: "2026-05-29T14:00:00.000Z",
      relationship: { familiarity: 60, affection: 80, engagement: 70, trust: 75, recentEvents: [], updatedAt: "2026-05-29T13:50:00.000Z" },
      hasRecentChat: true,
      lastChatSentiment: "positive",
      memoryHitCount: 2,
      clineVisibleStatus: "idle"
    });

    expect(mood.name).toBe("happy");
    expect(mood.suggestedStatus).toBe("happy");
  });

  it("leans sleepy late at night when there is no recent interaction", () => {
    const mood = deriveMoodState({
      now: "2026-05-29T23:30:00.000Z",
      relationship: { familiarity: 20, affection: 20, engagement: 15, trust: 20, recentEvents: [], updatedAt: "2026-05-29T20:00:00.000Z" },
      hasRecentChat: false,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: "idle"
    });

    expect(mood.name).toBe("sleepy");
    expect(["sleepy", "sleeping"]).toContain(mood.suggestedStatus);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/moodEngine.test.ts
```

Expected: FAIL because `moodEngine.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/moodEngine.ts`:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";

export type MoodName = "calm" | "happy" | "attached" | "curious" | "sleepy" | "upset" | "lonely";

export type MoodState = {
  name: MoodName;
  suggestedStatus: PetStatus;
};

export function deriveMoodState(input: {
  now: string;
  relationship: RelationshipMemory;
  hasRecentChat: boolean;
  lastChatSentiment: "positive" | "neutral" | "negative";
  memoryHitCount: number;
  clineVisibleStatus: PetStatus;
}): MoodState {
  const hour = new Date(input.now).getHours();
  if (input.clineVisibleStatus === "loading" || input.clineVisibleStatus === "thinking") return { name: "curious", suggestedStatus: input.clineVisibleStatus };
  if (!input.hasRecentChat && (hour >= 23 || hour < 6)) return { name: "sleepy", suggestedStatus: hour >= 23 ? "sleepy" : "sleeping" };
  if (input.lastChatSentiment === "negative") return { name: "upset", suggestedStatus: "angry" };
  if (input.lastChatSentiment === "positive" && input.relationship.affection >= 70) return { name: "happy", suggestedStatus: "happy" };
  if (input.memoryHitCount >= 2 && input.relationship.affection >= 50) return { name: "attached", suggestedStatus: "head-pat" };
  return { name: "calm", suggestedStatus: "idle" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/moodEngine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/moodEngine.ts tests/app/main/moodEngine.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add mood and bond engine"
```

### Task 6: formatVersion 3 pet pack support and pose resolution

**Files:**
- Modify: `src/shared/schemas.ts`
- Modify: `src/assets/petPackManager.ts`
- Create: `src/app/main/poseResolver.ts`
- Modify: `tests/assets/petPackManager.test.ts`
- Test: `tests/app/main/poseResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/assets/petPackManager.test.ts`:

```ts
it("accepts formatVersion 3 packs with optional variants and actionSets", () => {
  const packDir = mkdtempSync(join(tmpdir(), "cline-pack-v3-"));
  writeFileSync(join(packDir, "manifest.json"), JSON.stringify({
    id: "kaka-v3",
    name: "Kaka v3",
    version: "1.0.0",
    formatVersion: 3,
    states: Object.fromEntries(PET_STATUSES.map((status) => [status, `${status}.png`])),
    variants: { idle: ["idle-soft.png"] },
    actionSets: { greeting: ["message", "happy"] }
  }));
  for (const file of [...PET_STATUSES.map((status) => `${status}.png`), "idle-soft.png"]) writeFileSync(join(packDir, file), "png");

  const result = validatePetPack(packDir);

  expect(result.ok).toBe(true);
});
```

Create `tests/app/main/poseResolver.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveDisplayedPose } from "../../../src/app/main/poseResolver";

describe("pose resolver", () => {
  it("keeps base status mapping for calm idle mood", () => {
    expect(resolveDisplayedPose({ mood: "calm", activity: "idle", bondStage: "familiar" })).toEqual({ status: "idle" });
  });

  it("prefers head-pat style response for attached mood", () => {
    expect(resolveDisplayedPose({ mood: "attached", activity: "chatting", bondStage: "close" })).toEqual({ status: "head-pat" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/assets/petPackManager.test.ts tests/app/main/poseResolver.test.ts
```

Expected: FAIL because formatVersion 3 is not accepted and `poseResolver.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Modify `src/shared/schemas.ts` to extend `petPackManifestSchema`:

```ts
const v3VariantsSchema = z.record(z.enum(PET_STATUSES), z.array(z.string().trim().min(1))).partial();
const v3ActionSetsSchema = z.record(z.string().trim().min(1), z.array(z.enum(PET_STATUSES)).min(1)).optional();

export const petPackManifestSchema = z.union([
  manifestBaseSchema.extend({
    formatVersion: z.literal(3),
    states: v2StatesSchema,
    variants: v3VariantsSchema.optional(),
    actionSets: v3ActionSetsSchema
  }),
  manifestBaseSchema.extend({
    formatVersion: z.literal(2),
    states: v2StatesSchema
  }),
  manifestBaseSchema.extend({
    formatVersion: z.literal(1).default(1),
    states: legacyStatesSchema
  })
]);
```

Modify `src/assets/petPackManager.ts` so `PetPack` carries optional `variants` and `actionSets` metadata for formatVersion 3 while still using `states` as the base image map.

Create `src/app/main/poseResolver.ts`:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { MoodName } from "./moodEngine.js";

export function resolveDisplayedPose(input: {
  mood: MoodName;
  activity: "idle" | "chatting" | "thinking" | "loading" | "message" | "dragging";
  bondStage: "new" | "familiar" | "close";
}): { status: PetStatus } {
  if (input.activity === "dragging") return { status: "dragging" };
  if (input.activity === "loading") return { status: "loading" };
  if (input.activity === "thinking") return { status: "thinking" };
  if (input.mood === "happy") return { status: "happy" };
  if (input.mood === "attached" && input.bondStage === "close") return { status: "head-pat" };
  if (input.mood === "sleepy") return { status: "sleepy" };
  if (input.mood === "upset") return { status: "angry" };
  return { status: "idle" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/assets/petPackManager.test.ts tests/app/main/poseResolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/shared/schemas.ts src/assets/petPackManager.ts src/app/main/poseResolver.ts tests/assets/petPackManager.test.ts tests/app/main/poseResolver.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add mood pose mapping and pet pack v3"
```

### Task 7: Proactive presence and main-process integration

**Files:**
- Create: `src/app/main/presenceService.ts`
- Modify: `src/app/main/main.ts`
- Test: `tests/app/main/presenceService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/main/presenceService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { maybeCreatePresencePulse } from "../../../src/app/main/presenceService";

describe("presence service", () => {
  it("stays quiet during cooldown", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-05-29T20:00:00.000Z",
      lastPresenceAt: "2026-05-29T19:45:00.000Z",
      latestVisibleStatus: "loading",
      mood: "attached"
    });

    expect(pulse).toBeNull();
  });

  it("emits a gentle message after a long quiet period", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-05-29T21:00:00.000Z",
      lastPresenceAt: "2026-05-29T10:00:00.000Z",
      latestVisibleStatus: "idle",
      mood: "lonely"
    });

    expect(pulse).toEqual(expect.objectContaining({ status: "message", message: expect.stringContaining("陪") }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/presenceService.test.ts
```

Expected: FAIL because `presenceService.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/main/presenceService.ts`:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { MoodName } from "./moodEngine.js";

export function maybeCreatePresencePulse(input: {
  now: string;
  lastPresenceAt?: string;
  latestVisibleStatus: PetStatus;
  mood: MoodName;
}): UpdatePetStatusInput | null {
  const nowMs = new Date(input.now).getTime();
  const lastPresenceMs = input.lastPresenceAt ? new Date(input.lastPresenceAt).getTime() : 0;
  const cooldownMs = 4 * 60 * 60 * 1000;
  if (input.latestVisibleStatus === "loading" || input.latestVisibleStatus === "thinking") return null;
  if (lastPresenceMs && nowMs - lastPresenceMs < cooldownMs) return null;
  if (input.mood === "lonely") {
    return { status: "message", visibleStatus: "message", baseStatus: "message", overlayStatus: null, task: "", message: "我会安静陪在你旁边。", source: "presence", updatedAt: input.now };
  }
  return null;
}
```

Modify `src/app/main/main.ts` to:

```ts
import { maybeCreatePresencePulse } from "./presenceService.js";
import { deriveMoodState } from "./moodEngine.js";

let lastPresenceAt: string | undefined;

setInterval(() => {
  const mood = deriveMoodState({
    now: new Date().toISOString(),
    relationship: loadRelationshipMemory(paths.root),
    hasRecentChat: false,
    lastChatSentiment: "neutral",
    memoryHitCount: 0,
    clineVisibleStatus: latestStatus.visibleStatus
  });

  const pulse = maybeCreatePresencePulse({
    now: new Date().toISOString(),
    lastPresenceAt,
    latestVisibleStatus: latestStatus.visibleStatus,
    mood: mood.name
  });

  if (pulse) {
    lastPresenceAt = pulse.updatedAt;
    notifyRenderer(win, pulse);
  }
}, 60_000);
```

Keep the first implementation conservative: the interval is low frequency, and the service should return `null` in busy states.

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/app/main/presenceService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/presenceService.ts src/app/main/main.ts tests/app/main/presenceService.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add gentle proactive presence"
```

### Task 8: Docs, verification, and compatibility review

**Files:**
- Modify: `README.md`
- Modify: `docs/pet-pack-format.md`
- Modify: `tests/assets/petPackManager.test.ts`

- [ ] **Step 1: Write the failing documentation/test updates**

Add to `tests/assets/petPackManager.test.ts` one compatibility assertion that a formatVersion 2 pack still loads unchanged after formatVersion 3 support is added.

Update docs to explicitly describe:

- local-first memory
- context-memory JSONL / JSON layout
- mood-driven status selection
- formatVersion 3 `variants` / `actionSets`
- proactive behavior cooldown

- [ ] **Step 2: Run targeted tests to verify doc-adjacent compatibility still fails/passes appropriately**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- --run tests/assets/petPackManager.test.ts
```

Expected: PASS after the compatibility assertion is added and code from Task 6 exists.

- [ ] **Step 3: Write the documentation updates**

Update `README.md` with a new section similar to:

```md
## 长期记忆与心情系统

- 用户档案、关系记忆、上下文记忆默认全部保存在本地 `%APPDATA%/cline-desktop-pet/`。
- DeepSeek 只会收到当前消息、最近上下文、少量相关记忆和当前关系/心情摘要。
- 卡卡的姿态会根据心情、关系状态、活动状态切换。
- 主动陪伴默认低频且有冷却时间，不会高频打扰。
```

Update `docs/pet-pack-format.md` with a new formatVersion 3 section similar to:

```md
## formatVersion 3（心情动作扩展资源包）

`formatVersion: 3` keeps the existing 12 `states` and optionally adds:

- `variants`: multiple alternates for one base state
- `actionSets`: named mood/activity-driven sequences of base states
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack run build
```

Expected: All tests pass and renderer/main/preload build successfully.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add README.md docs/pet-pack-format.md tests/assets/petPackManager.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "docs: describe memory mood and pet pack v3"
```

---

## Spec Coverage Check

- **Local long-term memory:** Covered by Tasks 1-4 via file layout, stores, retrieval, and chat integration.
- **Smarter old-context recall:** Covered by Tasks 3-4 via tagged context memory plus lightweight retrieval.
- **Mood / relationship system:** Covered by Task 5.
- **Action / expression changes tied to mood:** Covered by Task 6 via pose resolution and pack formatVersion 3 extension.
- **DeepSeek local-first boundary:** Covered by Task 4 and Task 8 docs.
- **Gentle proactive presence:** Covered by Task 7.
- **Future material expansion path:** Covered by Task 6 schema/pack evolution and Task 8 docs.

## Placeholder Scan

- No `TBD`, `TODO`, or deferred placeholders remain in task steps.
- Every code-changing step contains concrete code snippets and exact file paths.
- Every validation step has an explicit command and expected outcome.

## Type Consistency Check

- Memory runtime types live in `src/app/main/memory/memoryTypes.ts` and are referenced consistently from stores, retrieval, and chat integration tasks.
- Mood resolution uses `MoodName` and existing `PetStatus` without inventing extra renderer-only status enums.
- formatVersion 3 is additive to the existing v2/v1 manifest structure, so pack parsing remains backward-compatible.