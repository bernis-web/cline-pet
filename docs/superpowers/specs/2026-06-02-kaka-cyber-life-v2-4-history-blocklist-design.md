# Kaka Cyber Life v2.4 History Blocklist Design

## Goal

Add a small, local-first privacy control that lets users mark an individual chat-history turn as `不要再记`, so future long-term memory extraction avoids remembering similar user-provided content.

This extends the v2.3 unified privacy panel without broadening into history deletion, profile editing, or richer relationship UI.

## Context

Cyber Life v2.3 added a unified `PrivacyPanel` with four tabs:

- `长期记忆`
- `不要再记`
- `聊天历史`
- `导出/清除`

The `聊天历史` tab currently supports search, copy, and clear-all. The `长期记忆` tab already supports `不要再记` for long-term memory items by deleting the memory and writing a blocklist rule to `memory-blocklist.json`.

The missing privacy loop is history-level blocking: users may see something in chat history that they never want Kaka to turn into future long-term memory, even if it is not currently stored as a long-term memory.

## Chosen Approach

Use the smallest safe design:

- Add `不要再记` on each chat-history turn in the `聊天历史` tab.
- The action writes a blocklist rule based on the user message (`turn.userText`).
- The action does not delete the chat-history turn.
- The action does not delete or edit existing long-term memories.
- The blocklist rule applies only to future memory extraction.

This is intentionally conservative. It gives users a clear prevention control while keeping deletion and blocking as separate privacy actions.

## Alternatives Considered

### Option A: Block only the user text

Use `turn.userText` as the rule text. This keeps the rule focused on what the user disclosed and avoids accidentally blocking Kaka's assistant wording.

This is the recommended option.

### Option B: Block the whole turn

Use both `userText` and `assistantText` as one blocklist rule. This may catch more similar future summaries, but it can over-block because assistant wording may contain generic phrases.

### Option C: Block and delete the history turn

Mark the turn as `不要再记` and delete it from chat history. This is stronger privacy control, but it mixes two user intents and requires a history-delete-by-id mutation that v2.4 does not otherwise need.

## Product Scope

In scope:

- Per-turn `不要再记` button in the `聊天历史` tab.
- Confirmation before writing the blocklist rule.
- A user-readable success notice after the rule is saved.
- Refreshing the privacy overview so the `不要再记` tab/count reflects the new rule.
- A direct main-process service function that creates a blocklist rule from a chat-history turn id.

Out of scope:

- Deleting one chat-history turn.
- Automatically deleting or editing existing long-term memories.
- Blocking based on assistant replies.
- Bulk blocklist actions from search results.
- Relationship/profile editing UI.
- Any automatic reading of files, code, terminal output, logs, browser data, screen contents, or API keys.

## User Experience

In `PrivacyPanel` → `聊天历史`:

- Each history card keeps the existing timestamp, user text, assistant text, and `复制` action.
- Add a second action: `不要再记`.
- Clicking `不要再记` asks for confirmation with scoped wording:
  - `这会让卡卡以后避免把“你说的这句话”整理成长期记忆。不会删除这条聊天历史，也不会删除已有长期记忆。继续吗？`
- On success, show a notice such as:
  - `好，我以后不会把这句话整理成长期记忆。`
- If the rule already exists, treat the action as successful and show the same user-facing notice.

The `不要再记` tab then shows the new rule like other blocklist rules. If source metadata is shown, it may identify the source as a chat-history turn.

## Data Model

Reuse the existing `MemoryBlockRule` shape:

```ts
type MemoryBlockRule = {
  id: string;
  text: string;
  normalizedText: string;
  kind?: ContextMemoryItem["kind"];
  sourceMemoryId?: string;
  createdAt: string;
};
```

For a chat-history rule:

- `text`: `turn.userText.trim()`.
- `kind`: omitted, so it can block any future memory kind with exact normalized matching.
- `sourceMemoryId`: omitted because the source is not a long-term memory id.

Do not add a new persisted field in v2.4. Keeping the existing rule format avoids a migration. The UI can still display the rule text and timestamp, which are sufficient for this version.

## Main Process Architecture

Add a focused function in the privacy or memory management layer:

```ts
blockChatHistoryTurnForUser(root: string, turnId: string): BlockRuleMutationResponse
```

Responsibilities:

1. Validate `turnId` is non-empty.
2. Read chat history from `chatHistoryStore`.
3. Find the turn by id.
4. Use `turn.userText` to append a blocklist rule through `appendMemoryBlockRule()`.
5. Return a success response for both new and duplicate rules.

Failure cases:

- Empty id → `INVALID_CHAT_HISTORY_TURN_ID`.
- Missing turn → `CHAT_HISTORY_TURN_NOT_FOUND`.
- Empty user text after trimming → `EMPTY_CHAT_HISTORY_USER_TEXT`.

The function should not depend on Electron APIs.

## IPC And Renderer Bridge

Add one renderer-facing method:

```ts
blockChatHistoryTurn(turnId: string): Promise<BlockRuleMutationResponse>
```

Suggested IPC channel:

```text
chat-history:block
```

After success, `App.tsx` should refresh `getPrivacyOverview()` so:

- blocklist count updates,
- the new rule appears under `不要再记`,
- the history tab remains on screen.

Existing bridge methods should remain unchanged.

## Renderer Changes

`PrivacyPanel` should accept a callback:

```ts
onBlockChatHistoryTurn(id: string): void;
```

The `聊天历史` tab should render `不要再记` next to `复制` for each turn. The button should be disabled while `pending` is true.

`App.tsx` owns confirmation, bridge call, notice bubble, and refresh, consistent with current memory/blocklist mutation patterns.

## Privacy Boundaries

The action uses only one existing local chat-history turn. It must not read files, logs, terminal output, browser data, screen contents, API keys, or external services.

The action does not send the selected text to DeepSeek. It only writes a local blocklist rule used later by local filtering before future memory writes.

## Error Handling

- Missing bridge method: show `隐私数据通道还没有准备好。`
- Missing turn: show `这条聊天历史已经不存在了。`
- Empty user text: show `这条记录没有可加入不要再记的用户内容。`
- Generic failure: show the returned message when available, otherwise `暂时无法加入不要再记。`

No data should be changed on failed validation.

## Testing Plan

Main process tests:

- Blocking a chat-history turn writes a blocklist rule with `turn.userText`.
- Duplicate blocking returns success without creating duplicate rules.
- Missing turn returns `CHAT_HISTORY_TURN_NOT_FOUND`.
- Empty id returns `INVALID_CHAT_HISTORY_TURN_ID`.
- Blocking history does not delete chat history or existing long-term memories.

Bridge and IPC tests:

- Renderer bridge exposes `blockChatHistoryTurn`.
- IPC handler calls the correct service function and returns its response.

Renderer tests:

- `PrivacyPanel` renders `不要再记` for each chat-history item.
- Clicking the button invokes `onBlockChatHistoryTurn(turn.id)`.
- `App.tsx` confirms the action, calls the bridge, refreshes privacy overview, and shows the success notice.

Style tests:

- Add or reuse selectors for history item actions so copy and block buttons remain compact.

## Success Criteria

- Users can mark a chat-history turn as `不要再记` from the unified privacy panel.
- The rule is stored locally in `memory-blocklist.json` and appears in the blocklist tab after refresh.
- The selected chat-history turn remains in history.
- Existing long-term memories are not modified by this action.
- Future memory extraction respects the new rule through the existing blocklist filter.
- `npm test` and `npm run build` pass.