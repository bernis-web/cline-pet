# Kaka Cyber Life v2.3 Privacy Panel Design

## Goal

Build a unified local privacy panel for Kaka so users can inspect and control the data Kaka keeps about them from one place. The panel should make memory, `不要再记` rules, chat history, export, and clearing actions understandable without turning the desktop pet window into a heavy settings app.

## Context

Kaka currently has separate renderer surfaces for long-term memory and chat history:

- `MemoryPanel` shows relationship overview and `context-memory.jsonl`, with search, kind filtering, edit, delete, clear, export, and `不要再记`.
- `ChatHistoryPanel` shows recent chat turns from `chat-history.jsonl`, with search, per-turn copy, and clear.
- v2.2 introduced `memory-blocklist.json`, but users do not yet have a way to review or revoke block rules.

The next step should close this control loop before expanding into richer relationship or personality UI.

## User Decisions

- Use the conservative route: privacy/control first, then history-level actions and relationship UI later.
- Build a unified privacy panel rather than only a blocklist manager.
- Use the top-tab layout as the first implementation direction.
- Export by copying JSON to the clipboard. Do not implement real file downloads in this version.
- Every clearing action must require a second confirmation.

## Product Scope

The feature will be called Cyber Life v2.3: unified privacy panel.

The first version contains four tabs:

1. `长期记忆`
   - Shows existing long-term memory list.
   - Keeps search, kind filtering, edit, delete, `不要再记`, and clear actions.
2. `不要再记`
   - Shows rules from `memory-blocklist.json`.
   - Allows deleting one rule or clearing all block rules.
   - Explains that removing a rule only allows future similar memory extraction; it does not restore the memory that was deleted when the rule was created.
3. `聊天历史`
   - Shows existing chat history list.
   - Keeps search, per-turn copy, and clear history.
4. `导出/清除`
   - Shows local data counts and last-known timestamps where available.
   - Copies a unified privacy JSON payload to the clipboard.
   - Provides separated clearing actions for long-term memory, block rules, and chat history.

Out of scope for v2.3:

- Saving exported JSON as a local file.
- History-level `不要再记` actions.
- Relationship/profile editing UI.
- MCP connection diagnostics UI.
- Any automatic reading of files, code, terminal output, logs, browser data, screen contents, or API keys.

## Entry Points

Keep both existing small top buttons for now:

- Clicking `历史` opens the unified privacy panel on the `聊天历史` tab.
- Clicking `记忆` opens the same panel on the `长期记忆` tab.

This preserves the user's current muscle memory while reducing duplicate panel logic. A future version may replace both buttons with one `隐私` entry if the top controls become crowded.

## UI Design

The panel header should read `隐私与记忆` and include a close button. Below the header, use a compact tab row for `长期记忆`, `不要再记`, `聊天历史`, and `导出/清除`.

The visual direction should stay close to the current Kaka panel style:

- Compact controls and readable lists.
- No nested cards.
- No marketing-style hero content.
- Clear destructive-action wording.
- Stable panel dimensions so changing tabs does not cause large layout jumps.

`长期记忆` can reuse most of the existing `MemoryPanel` body. `聊天历史` can reuse most of `ChatHistoryPanel`. The implementation may either rename the component to `PrivacyPanel` or keep internal naming while presenting the UI as privacy-centered; choose the smaller, clearer change during planning.

## Data Model

Add a renderer-facing `PrivacyOverview` shape that combines existing local data:

```ts
type PrivacyOverview = {
  relationship: RendererRelationshipOverview;
  memories: RendererContextMemory[];
  blockRules: RendererMemoryBlockRule[];
  chatHistory: RendererChatHistoryTurn[];
  counts: {
    memories: number;
    blockRules: number;
    chatHistoryTurns: number;
  };
};
```

`RendererMemoryBlockRule` should expose only fields useful for local privacy management:

```ts
type RendererMemoryBlockRule = {
  id: string;
  text: string;
  kind?: RendererContextMemory["kind"];
  sourceMemoryId?: string;
  createdAt: string;
};
```

Do not expose `normalizedText` in the UI payload unless implementation discovers a test or export need for it. It is internal matching metadata, not user-facing content.

## Main Process Architecture

Add a lightweight `privacyManagementService` in `src/app/main/memory/` or an adjacent local-data module. It should compose existing stores/services instead of duplicating parsing logic:

- `readContextMemories()` and existing memory management conversion logic.
- `readMemoryBlockRules()` and new delete/clear helpers for blocklist rules.
- `readChatHistory()` and `clearChatHistory()`.
- `loadRelationshipMemory()` and `deriveRelationshipOverview()`.

Responsibilities:

- Build `PrivacyOverview`.
- Build export JSON for the unified privacy panel.
- Delete one block rule.
- Clear all block rules.
- Preserve existing separation between memory, blocklist, and chat history.

The service should be tested directly with temporary roots and should not depend on Electron APIs.

## IPC And Bridge

Add renderer bridge methods and IPC handlers for the unified panel:

- `privacy:get-overview` returns `PrivacyOverviewResponse`.
- `privacy:export` returns a JSON string for clipboard copy.
- `memory-blocklist:delete` deletes one block rule.
- `memory-blocklist:clear` clears all block rules.

Continue reusing existing operations where they already fit:

- `memory:update`
- `memory:delete`
- `memory:block`
- `memory:clear`
- `chat:clear-history`

After any successful mutation, the renderer should refresh or locally update the relevant tab data so counts and lists remain coherent.

## Export Behavior

`privacy:export` should return pretty-printed JSON with:

- `exportedAt`
- `counts`
- `relationship`
- `memories`
- `blockRules`
- `chatHistory`

The renderer copies the returned string with `navigator.clipboard.writeText()`. On success, show a notice such as `隐私数据 JSON 已复制到剪贴板。` On clipboard failure, show `剪贴板不可用，暂时无法复制隐私数据。`

The export must not include local config, API keys, logs, screenshots, files, code, terminal output, or any external data source.

## Destructive Actions

Every destructive action requires confirmation:

- Delete one long-term memory.
- Mark one memory as `不要再记`.
- Delete one block rule.
- Clear all long-term memories.
- Clear all block rules.
- Clear chat history.

Each confirmation should name the exact scope. Required boundaries:

- Clearing long-term memories does not clear chat history.
- Clearing long-term memories does not clear `不要再记` rules.
- Clearing chat history does not clear long-term memories.
- Clearing `不要再记` rules only removes future blocking preferences. It does not restore old deleted memory.

## Error Handling

- If the privacy IPC bridge is unavailable, show a notice such as `隐私数据通道还没有准备好。`
- If a local file is missing, treat it as empty data.
- If a local file is malformed, return a safe empty list for that portion and avoid crashing the panel.
- If a mutation target is missing, return a user-readable `not found` response.
- If clipboard copy fails, keep data unchanged and show the clipboard notice.

## Testing Plan

Follow the existing TDD style.

Main process tests:

- `privacyManagementService` builds overview from relationship, long-term memory, blocklist, and chat history.
- Export JSON contains the expected local privacy data and excludes config/API/log data.
- Deleting one block rule removes only that rule.
- Clearing block rules does not clear long-term memory or chat history.
- Clearing long-term memory and chat history remain independent.

Bridge and IPC tests:

- Renderer bridge exposes `getPrivacyOverview`, `exportPrivacyData`, `deleteMemoryBlockRule`, and `clearMemoryBlockRules`.
- IPC handlers call the correct service functions.

Renderer tests:

- The unified panel renders all four tabs.
- `历史` and `记忆` entry points open the same panel on different initial tabs.
- Long-term memory search, filtering, edit, delete, and `不要再记` still work.
- Blocklist tab shows rules and supports single-rule delete and clear-all with confirmation.
- Chat history tab search, copy, and clear still work.
- Export tab copies JSON to clipboard and handles clipboard failure.
- Clear buttons require confirmation.

Style tests:

- Add selectors for the unified panel, tab row, blocklist controls, and export/clear section.

## Success Criteria

- Users can manage all Kaka local privacy data from one panel.
- Users can review and revoke `不要再记` rules.
- Users can copy one unified privacy JSON payload to the clipboard.
- Destructive actions are clearly scoped and always confirmed.
- Existing memory and history behavior remains available.
- `npm test` and `npm run build` pass.
