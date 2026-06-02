# Kaka Cyber Life v2.2 Memory Correction Design

## Summary

Cyber Life v2.2 closes the trust loop opened by v2.1 memory management. v2.1 lets the user see, delete, clear, and export Kaka's long-term memories. v2.2 lets the user correct a remembered item and mark a remembered item as `不要再记`, so Kaka does not quietly recreate the same memory after the next DeepSeek extraction pass.

The recommended scope is intentionally small: enhance the existing `记忆` panel and memory service rather than building a full settings center. The feature remains local-first and only touches Kaka-owned memory files.

## Goals

1. Let the user edit the text of one long-term memory from the `记忆` panel.
2. Let the user mark one long-term memory as `不要再记` from the `记忆` panel.
3. Persist `不要再记` rules locally so automatic memory extraction can filter similar future candidates.
4. Keep existing v2.1 actions working: view, search, filter, delete, clear, export, and relationship overview.
5. Make all failures gentle: no renderer crash, no broken panel state, and a calm notice bubble when something cannot be saved.
6. Preserve privacy boundaries: no external files, screens, terminal output, logs, API keys, or chat history are exported or inspected by this feature.

## Non-goals

- A full memory/settings center.
- Editing memory `kind`, `tags`, `weight`, `id`, `createdAt`, or relationship scores.
- Complex manual memory merge or conflict-resolution UI.
- Bulk `不要再记` from the chat history panel.
- Automatic scanning of historical chats to infer blocked topics.
- Cloud sync, accounts, telemetry, or remote storage.
- Deleting raw chat history when a memory is edited, deleted, or blocked.

## Current State

The feature builds on the existing v2.1 implementation:

- `src/app/main/memory/memoryManagementService.ts` reads relationship state and long-term memories, deletes one memory, clears all memories, and exports memory JSON.
- `src/app/main/memory/contextStore.ts` reads and rewrites `context-memory.jsonl`.
- `src/app/main/memory/memoryExtractionService.ts` turns DeepSeek extraction output into `ContextMemoryItem` candidates and merges them into `context-memory.jsonl`.
- `src/app/main/memory/memoryDeduplication.ts` already exposes `normalizeMemoryText()` and `mergeContextMemory()`.
- `src/app/renderer/MemoryPanel.tsx` renders the v2.1 memory and relationship panel.
- `src/app/renderer/App.tsx` owns the memory panel state and friendly notice bubbles.
- `src/app/renderer/petBridge.ts` wraps the memory IPC channels.

The gap is not visibility anymore. The user can now see memories, but cannot correct a wrong memory or prevent an unwanted memory from being remembered again.

## User-Approved Direction

The user approved the recommended v2.2 direction:

> Memory panel correction + `不要再记`.

The chosen approach is the lightweight trust loop:

- Add `编辑` and `不要再记` actions to each memory item in `MemoryPanel`.
- Edit only the memory text.
- `不要再记` removes the visible memory and writes a local block rule.
- Future automatic extraction filters blocked/similar candidates before writing to `context-memory.jsonl`.

## UX Design

### Memory Item Actions

Each memory list item keeps the v2.1 layout and gains two actions near the existing `删除` button:

```text
[编辑] [不要再记] [删除]
```

Button semantics:

- `编辑`: opens an inline text edit state for the memory.
- `不要再记`: asks for confirmation, deletes this memory, and creates a block rule.
- `删除`: keeps the v2.1 behavior; it only deletes this memory and does not create a block rule.

This distinction should stay visible in labels and confirmation copy:

- Delete means "remove this current memory".
- Block means "remove this current memory and avoid remembering similar content again".

### Editing Flow

Editing should be inline inside the existing panel rather than opening a second modal. This keeps the small 360px by 420px shell manageable.

Flow:

1. User clicks `编辑`.
2. The memory text changes into a textarea with `保存` and `取消`.
3. Empty or whitespace-only text cannot be saved.
4. User clicks `保存`.
5. Renderer asks for confirmation:

```text
保存这条长期记忆的修改？
```

6. Main process updates only `text` and `updatedAt`.
7. Renderer refreshes the memory item and shows:

```text
我记住修正啦。
```

The service keeps `id`, `kind`, `tags`, `weight`, `createdAt`, and optional source metadata unchanged.

### Do-not-remember Flow

Flow:

1. User clicks `不要再记`.
2. Renderer asks for confirmation:

```text
删除这条长期记忆，并让卡卡以后不要再记类似内容？
```

3. Main process reads the memory, creates a block rule from its text and kind, removes the memory from `context-memory.jsonl`, and writes the block rule.
4. Renderer removes the item from the panel and shows:

```text
好，我以后不会再记类似内容。
```

If the memory was already removed, the action returns the existing not-found style error and the renderer shows a notice bubble.

### Export Behavior

The existing v2.1 export continues to export long-term memories as JSON. v2.2 should include block rule metadata in the export without exposing local file paths.

Suggested shape:

```json
{
  "exportedAt": "2026-06-01T00:00:00.000Z",
  "count": 2,
  "blockedCount": 1,
  "memories": [],
  "blockedMemories": []
}
```

`blockedMemories` should contain only the rule fields listed in this spec. It must not include paths, API keys, config values, logs, chat history, or source prompts.

## Data Model

### New Local File

Add a Kaka-owned local file:

```text
%APPDATA%/cline-desktop-pet/memory-blocklist.json
```

The file stores an array of block rules:

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

Rules are created only from user action in v2.2. Missing file means an empty rule list.

### Path Definition

Extend `src/shared/paths.ts` with:

```ts
memoryBlocklistFile
```

The path should follow the same root resolution pattern as `contextMemoryFile` and `chatHistoryFile`.

### Store Boundary

Create a focused store file:

```text
src/app/main/memory/memoryBlocklistStore.ts
```

Responsibilities:

- `readMemoryBlockRules(root)` returns `MemoryBlockRule[]` and tolerates a missing file.
- `writeMemoryBlockRules(root, rules)` rewrites the JSON file.
- `appendMemoryBlockRule(root, ruleInput)` adds or updates a rule by normalized text and kind to avoid duplicates.

The store should not read or write `context-memory.jsonl` directly; mutation orchestration belongs in `memoryManagementService.ts`.

## Matching And Filtering

### Normalization

Use the existing `normalizeMemoryText(text)` from `memoryDeduplication.ts` to compute `normalizedText`.

### Similarity

Add an exported deterministic helper that can be shared by deduplication and block filtering, for example:

```ts
export function memoryTextOverlapScore(a: string, b: string): number
```

The helper can use the same token-overlap behavior currently internal to `memoryDeduplication.ts`.

### Block Matching Rules

A candidate memory is blocked when:

1. Its normalized text exactly matches a rule's `normalizedText`; or
2. The rule and candidate have the same `kind`, and their text overlap score is at least `0.75`.

Exact normalized matches ignore kind because the user clearly asked not to remember that content. Similar matches require the same kind to avoid over-blocking unrelated memories.

### Extraction Integration

`src/app/main/memory/memoryExtractionService.ts` should filter candidates after `toItems()` and before `mergeContextMemory()`.

Current flow:

```text
DeepSeek response -> parse -> toItems -> merge -> write context memories
```

v2.2 flow:

```text
DeepSeek response -> parse -> toItems -> filter blocked candidates -> merge -> write context memories
```

If all candidates are blocked, the service still returns `ok: true` with the parsed extraction result and an empty `memoryIds` list. Chat should not fail because a memory was filtered.

## Main Process Design

Extend `src/app/main/memory/memoryManagementService.ts` with:

```ts
export function updateContextMemoryForUser(
  root: string,
  input: { id: string; text: string; now?: string }
): UpdateMemoryResponse

export function blockContextMemoryForUser(
  root: string,
  input: { id: string; now?: string }
): BlockMemoryResponse
```

Response shapes:

```ts
type UpdateMemoryResponse =
  | { ok: true; data: RendererContextMemory }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "INVALID_MEMORY_TEXT" | "MEMORY_NOT_FOUND"; message: string };

type BlockMemoryResponse =
  | { ok: true; data: { blockedCount: number } }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "MEMORY_NOT_FOUND"; message: string };
```

Validation:

- Empty id returns `INVALID_MEMORY_ID`.
- Empty edited text returns `INVALID_MEMORY_TEXT` with message `记忆内容不能为空。`.
- Unknown id returns `MEMORY_NOT_FOUND` with message `这条记忆已经不存在了。`.

Mutation semantics:

- Edit rewrites only `context-memory.jsonl`.
- Block rewrites `context-memory.jsonl` and `memory-blocklist.json`.
- Delete keeps v2.1 semantics and does not write a block rule.
- Clear all long-term memories keeps v2.1 semantics and does not clear block rules.

Keeping block rules after clear is intentional: if the user said "do not remember this", clearing visible memories should not undo that privacy preference.

## IPC Design

Add handlers in `src/app/main/main.ts`:

```text
memory:update
memory:block
```

Payloads:

```ts
memory:update -> { id?: string; text?: string }
memory:block -> { id?: string }
```

Handlers should normalize missing optional fields to empty strings before calling the service so service validation remains the single source of truth.

## Renderer Bridge Design

Extend `src/app/renderer/petBridge.ts` with:

```ts
updateMemory(id: string, text: string): Promise<UpdateMemoryResponse>
blockMemory(id: string): Promise<BlockMemoryResponse>
```

Also extend the `Window.clinePet` declaration in `src/app/renderer/App.tsx` with optional versions of these methods.

## Renderer Design

### MemoryPanel Props

Extend `MemoryPanelProps`:

```ts
onUpdate(id: string, text: string): void;
onBlock(id: string): void;
```

The panel should keep edit draft state locally:

- `editingId`
- `editingText`

When `pending` is true, action buttons and save controls should be disabled.

### App Handlers

Extend `src/app/renderer/App.tsx` with:

- `updateMemoryFromPanel(id, text)`
- `blockMemoryFromPanel(id)`

Behavior:

- Missing bridge method shows `记忆通道还没有准备好。`.
- Successful edit replaces that item in `memoryOverview.memories`.
- Successful block removes that item from `memoryOverview.memories`.
- Service errors show the returned message as a notice bubble.

### Styling

Extend `src/app/renderer/petStyles.css` with selectors for the inline editor and block action, such as:

```text
.memory-edit
.memory-block
.memory-editor
.memory-editor-actions
```

The editor should match the current dark translucent memory panel style and stay usable inside the existing small window.

## Error Handling

- Missing `memory-blocklist.json` returns an empty rule list.
- Malformed `memory-blocklist.json` should be treated as empty for the user-facing flow and covered by tests if the existing store pattern supports tolerance.
- Empty edited text returns a friendly validation error.
- Unknown memory id returns the existing not-found message.
- IPC method missing in the renderer shows `记忆通道还没有准备好。`.
- Clipboard export failures remain handled as in v2.1.
- Filtering blocked candidates never fails chat; it only reduces what is stored.

## Privacy And Safety

- v2.2 only reads Kaka-owned local memory files.
- Block rules are created from user-visible memory text, not from hidden prompts or external context.
- The feature never reads files, code, screenshots, terminals, browsers, calendars, logs, API keys, DeepSeek config, or chat history.
- Edit, delete, block, and clear operations do not modify `chat-history.jsonl`.
- Export includes only long-term memories, block rule metadata, counts, and timestamps.

## Testing Strategy

Use TDD for implementation.

Main tests:

- `tests/app/main/memoryBlocklistStore.test.ts`
  - missing file returns empty rules
  - writing and reading rules round-trips
  - duplicate normalized text and kind does not create duplicate rules
- `tests/app/main/memoryManagementService.test.ts`
  - edit updates `text` and `updatedAt` only
  - edit rejects empty text
  - edit unknown id returns not-found
  - block removes a memory and writes a block rule
  - delete does not write a block rule
  - clear memories does not clear block rules
  - export includes blocked count and blocked memory metadata
- `tests/app/main/memoryExtractionService.test.ts`
  - blocked exact normalized candidate is not stored
  - blocked similar same-kind candidate is not stored
  - different-kind similar candidate is not over-blocked
  - all-blocked extraction still returns `ok: true` with empty `memoryIds`

Renderer tests:

- `tests/app/renderer/petBridge.test.ts`
  - `updateMemory()` invokes `memory:update`
  - `blockMemory()` invokes `memory:block`
- `tests/app/renderer/MemoryPanel.test.ts`
  - edit controls render and call `onUpdate`
  - cancel edit restores the original display
  - empty edit cannot be submitted
  - `不要再记` calls `onBlock`
- `tests/app/renderer/App.test.ts`
  - successful edit updates the visible memory text
  - successful block removes the visible memory
  - missing bridge methods show a friendly notice
- `tests/app/renderer/petStyles.test.ts`
  - required editor and block selectors exist

Full verification:

```powershell
npm test
npm run build
git status --short --branch
```

## Success Criteria

- User can correct a long-term memory from the `记忆` panel.
- User can mark a long-term memory as `不要再记` from the `记忆` panel.
- A blocked memory is removed from visible long-term memories.
- Similar future extraction candidates are filtered before writing to `context-memory.jsonl`.
- Existing v2.1 memory panel features continue to work.
- No operation touches raw chat history, DeepSeek config, API keys, logs, or external files.
- Targeted tests, full tests, and build pass before implementation is called complete.

## Future Work

- Show and manage block rules in a larger privacy/settings panel.
- Add `不要再记` directly from chat history turns.
- Allow editing kind/tags/weight when there is a larger memory editor.
- Add a relationship/profile page that summarizes recent positive events and stable preferences.
- Add user-tunable memory extraction frequency.