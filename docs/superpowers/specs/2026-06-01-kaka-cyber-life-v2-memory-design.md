# Kaka Cyber Life v2.1 Memory Management Design

## Summary

Cyber Life v2.1 gives the user direct visibility and control over Kaka's long-term memory and relationship state. v1 made Kaka remember useful facts, preferences, project context, and care signals. v2.1 adds the trust layer: the user can inspect what was remembered, delete individual memories, clear all long-term memories, export the current memory set, and see a simple relationship overview.

## Goals

1. Show Kaka's long-term memories from `context-memory.jsonl` inside the pet UI.
2. Let the user search memories and filter by memory kind.
3. Let the user delete one memory without clearing chat history.
4. Let the user clear all long-term memories without clearing chat history.
5. Let the user export long-term memories as JSON for review or backup.
6. Show the current relationship scores and a simple relationship stage derived from `relationship.json`.
7. Keep privacy boundaries explicit: Kaka only displays local memory files it already owns and never reads external files, screens, terminals, browsers, calendars, or secrets.

## Non-goals

- Editing a memory's text or metadata in v2.1.
- Complex manual memory merge or deduplication UI.
- Cloud sync or account-based storage.
- Export-to-file save dialogs. v2.1 copies exported JSON to the clipboard because that is simpler and more reliable in the small desktop pet window.
- Reworking the full settings experience into a settings center.
- Adding new pet image assets.
- Changing the DeepSeek memory extraction prompt beyond ensuring deleted memories are no longer read from storage.

## Current State

Cyber Life v1 already added the memory loop:

- `src/app/main/memory/contextStore.ts` can read, append, and rewrite context memories.
- `src/app/main/memory/memoryExtractionService.ts` extracts structured memories after chat.
- `src/app/main/memory/memoryDeduplication.ts` avoids duplicate long-term memories.
- `src/app/main/chatCoordinator.ts` reads context memories and injects relevant items into future chat prompts.
- `src/app/main/memory/relationshipStore.ts` reads and writes `relationship.json`.
- `src/app/renderer/ChatHistoryPanel.tsx` demonstrates the existing overlay panel pattern for local data.
- `src/app/renderer/petBridge.ts` already wraps IPC methods for chat history and settings.

The gap is that long-term memory is now active but invisible. Users need a clear, local-first way to see and control what Kaka remembers.

## User-Approved Direction

The user approved the recommended second-stage direction:

> Cyber Life v2.1: memory management UI + relationship overview.

The implementation should follow the existing TDD workflow, use focused files, and keep each task independently testable.

## UX Design

### Entry Point

Add a small `记忆` button next to the existing `历史` button in `PetView.tsx`.

- `历史` continues to open the recent conversation panel backed by `chat-history.jsonl`.
- `记忆` opens the new long-term memory and relationship panel backed by `context-memory.jsonl` and `relationship.json`.

This keeps the distinction clear:

- Chat history = recent raw conversation turns.
- Long-term memory = distilled facts, preferences, project context, and summaries Kaka may use later.

### Memory Panel Layout

Create `src/app/renderer/MemoryPanel.tsx`.

The panel should use the same overlay style pattern as `ChatHistoryPanel` and fit inside the existing 360px by 420px pet shell.

```text
记忆与关系
├─ Header
│  ├─ title: 记忆与关系
│  └─ close button
├─ Relationship overview
│  ├─ stage label: 初识 / 熟悉 / 亲近 / 信赖
│  ├─ stage description
│  └─ four score rows: 熟悉度 / 亲密度 / 互动度 / 信任度
├─ Memory controls
│  ├─ search input
│  ├─ kind filter select
│  ├─ export button
│  └─ clear all button
└─ Memory list
   ├─ kind badge
   ├─ memory text
   ├─ tags, weight, updated time
   └─ delete button
```

### Empty State

When there are no long-term memories:

```text
卡卡还没有长期记忆。和我聊一会儿，我会只记住对你有帮助的事。
```

### Confirmation Text

Single delete:

```text
删除这条长期记忆？之后卡卡不会再用它理解你。
```

Clear all:

```text
清空所有长期记忆？对话历史不会被删除，但卡卡会忘掉已提炼的长期记忆。
```

### Export Behavior

v2.1 export should return a formatted JSON string from the main process and copy it to the clipboard in the renderer.

After success, show a calm notice bubble:

```text
长期记忆 JSON 已复制到剪贴板。
```

If the clipboard API is not available, show:

```text
剪贴板不可用，暂时无法复制长期记忆。
```

## Data Model

Renderer-facing types should be declared in `src/app/renderer/petBridge.ts` and re-exported from `src/app/renderer/memoryTypes.ts` for component tests.

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
```

The main process can return existing `ContextMemoryItem` fields directly after sorting and mapping. It should not expose file paths or local config paths through this memory panel API.

## Relationship Stage Rules

Derive a simple stage from the average of four relationship scores:

```ts
const score = (familiarity + affection + engagement + trust) / 4;
```

Rules:

- `< 20`: `new`, label `初识`, description `卡卡正在慢慢认识你。`
- `20-44`: `familiar`, label `熟悉`, description `卡卡已经记得一些与你相处的节奏。`
- `45-69`: `close`, label `亲近`, description `卡卡和你更亲近了，会更自然地回应你的习惯。`
- `>= 70`: `trusted`, label `信赖`, description `卡卡很信赖你，也会更稳定地陪在旁边。`

This is intentionally lightweight. It makes relationship growth visible without creating a complex personality system in v2.1.

## Main Process Design

Create `src/app/main/memory/memoryManagementService.ts`.

Responsibilities:

- `deriveRelationshipOverview(relationship)` maps `RelationshipMemory` to renderer-safe overview data.
- `getMemoryOverview(root)` reads relationship and context memories and returns sorted renderer-safe data.
- `deleteContextMemory(root, id)` removes one memory by id and returns `{ ok: true }` or a not-found error.
- `clearContextMemories(root)` writes an empty `context-memory.jsonl` file.
- `exportContextMemories(root)` returns formatted JSON containing export metadata and the current memory list.

Sorting:

- Sort memories by `updatedAt` descending.
- If `updatedAt` is missing or invalid in a future migration, fall back to string comparison with empty string last.

Delete semantics:

- Deleting or clearing long-term memories only rewrites `context-memory.jsonl`.
- It must not modify `chat-history.jsonl`, `profile.json`, `relationship.json`, or DeepSeek settings.

## IPC Design

Add handlers in `src/app/main/main.ts`:

```text
memory:get-overview
memory:delete
memory:clear
memory:export
```

Responses:

```ts
type MemoryOverviewResponse =
  | { ok: true; data: MemoryOverview }
  | { ok: false; errorCode: string; message: string };

type DeleteMemoryResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

type ClearMemoriesResponse = DeleteMemoryResponse;

type ExportMemoriesResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };
```

`memory:delete` validates that `id` is a non-empty string. Invalid ids return:

```ts
{ ok: false, errorCode: "INVALID_MEMORY_ID", message: "记忆 id 无效。" }
```

Unknown ids return:

```ts
{ ok: false, errorCode: "MEMORY_NOT_FOUND", message: "这条记忆已经不存在了。" }
```

## Renderer Bridge Design

Extend `src/app/renderer/petBridge.ts`:

```ts
getMemoryOverview(): Promise<MemoryOverviewResponse>
deleteMemory(id: string): Promise<DeleteMemoryResponse>
clearMemories(): Promise<ClearMemoriesResponse>
exportMemories(): Promise<ExportMemoriesResponse>
```

These methods mirror the current chat history bridge pattern and call the new IPC channels directly.

## App Integration

Extend `src/app/renderer/App.tsx` with:

- `memoryOpen`
- `memoryPending`
- `memoryOverview`
- `refreshMemoryOverview()`
- `openMemoryPanel()`
- `deleteMemoryFromPanel(id)`
- `clearMemoriesFromPanel()`
- `exportMemoriesFromPanel()`

Successful delete and clear should update local panel state without requiring app restart. Successful export should copy JSON to the clipboard and show a notice bubble.

## Styling

Extend `src/app/renderer/petStyles.css` with:

- `.memory-trigger`
- `.memory-panel`
- `.relationship-card`
- `.relationship-score`
- `.memory-controls`
- `.memory-list`
- `.memory-kind`
- `.memory-delete`
- `.memory-empty`

The panel should match the dark translucent overlay style already used by chat history and settings.

## Error Handling

- Missing `context-memory.jsonl` returns an empty memory list.
- Missing `relationship.json` returns the default relationship overview through `loadRelationshipMemory()`.
- Invalid delete id returns an error response and displays a notice bubble.
- Unknown delete id returns an error response and displays a notice bubble.
- Clipboard export failure displays a notice bubble and does not crash the panel.
- All renderer IPC calls are best-effort: if a method is missing, display a friendly notice instead of throwing.

## Testing Strategy

Use TDD for each task.

Main tests:

- `tests/app/main/memoryManagementService.test.ts`
  - relationship stage derivation
  - overview reads relationship and sorted memories
  - delete removes one memory
  - delete unknown id returns not-found
  - clear empties context memories
  - export returns formatted JSON

Renderer tests:

- `tests/app/renderer/petBridge.test.ts`
  - new bridge methods call expected IPC channels
- `tests/app/renderer/MemoryPanel.test.ts`
  - relationship overview renders
  - memory list renders
  - search filters by text and tags
  - kind filter works
  - delete/export/clear callbacks fire
  - empty state renders
- `tests/app/renderer/App.test.ts`
  - clicking `记忆` loads and opens the panel
  - delete/clear/export flows call bridge methods and update UI or bubble
- `tests/app/renderer/petStyles.test.ts`
  - required CSS selectors exist

Full verification:

```powershell
npm test
npm run build
git status --short --branch
```

## Privacy and Safety

- The feature only reads Kaka-owned local memory files.
- The export contains only existing long-term memory items and export metadata.
- The feature never exports DeepSeek API keys, settings files, logs, app paths, screenshots, terminal output, browser data, or chat history.
- Clearing long-term memory does not clear raw chat history; the two remain separate user actions.

## Future Work

After v2.1, likely next steps are:

- Edit memory text.
- Mark a memory as `不要再记` from chat/history UI.
- Memory confidence/recency display.
- Relationship profile page with recent positive events.
- Export-to-file through an Electron save dialog.
- A larger settings center that unifies chat history, memory, relationship, pet packs, DeepSeek, and diagnostics.
