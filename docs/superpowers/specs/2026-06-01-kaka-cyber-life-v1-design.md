# Kaka Cyber Life v1 Design

## Summary

Kaka Cyber Life v1 turns Kaka from a status-reactive desktop pet into a local companion with readable conversations, visible history, memory, relationship growth, and a conservative life rhythm.

This spec covers the current engineering batch:

- Chat bubble reading mode for long replies.
- Conversation history panel.
- Local chat history persistence.
- DeepSeek-assisted memory extraction.
- Memory retrieval injected into future chat prompts.
- Relationship growth after chat and touch interactions.
- Low-frequency proactive presence.
- Bubble queueing so Kaka does not overwrite itself.
- Roadmaps for v2/v3 and the overall Cyber Life direction.

## Goals

1. Let users finish reading long Kaka replies without making every chat bubble linger forever.
2. Let users review recent conversations from inside the pet UI.
3. Give Kaka a working memory loop: remember relevant facts, preferences, project context, and care signals from chat.
4. Make relationship and mood changes feel cumulative rather than one-off.
5. Add gentle proactive behavior while keeping interruption frequency low.
6. Preserve local-first privacy boundaries and make clearing history/memory possible.

## Non-goals

- Reading files, code, terminal output, screen contents, calendars, or browser data automatically.
- Building a full memory management UI in v1 beyond basic history controls and clear actions.
- Creating a complex personality system with multiple named personality stages in v1.
- Shipping new pet image assets in Git.
- Replacing the existing MCP/Bridge status update architecture.

## Current State

Kaka already has a strong base:

- Electron main process, React/Vite renderer, TypeScript, Vitest.
- Twelve pet statuses and legacy status alias mapping.
- MCP server and local HTTP Bridge for Cline status updates.
- DeepSeek chat with local settings.
- Local memory file types: `profile.json`, `relationship.json`, `context-memory.jsonl`.
- Mood modules: `moodEngine`, `chatMood`, `presenceService`, `poseResolver`.
- Renderer bubbles, auto-hide, dragging, double-click chat, right-click settings, long-press head pat.

The gaps are:

- Chat replies only become transient bubbles; there is no durable chat history.
- `createChatReply()` supports `memoryContext` and `onConversationResolved`, but `main.ts` does not wire those into chat.
- `context-memory.jsonl` has storage and retrieval primitives but is not used in the chat flow.
- Relationship memory is mainly updated by head pats, not meaningful chat events.
- Chat mood treats successful chat as positive instead of using sentiment/care signals.
- Presence has only one lonely pulse and no richer time/relationship rhythm.
- Bubbles can overwrite each other instead of queueing.

## User-Approved Direction

The user selected **A + C** for conversation UX:

- **A: Bubble summary + click-to-read.** Short replies still auto-hide after about five seconds. Long replies can be opened into reading mode.
- **C: Independent history panel.** A history entry point opens recent conversations for review, search, copy, and clearing.

The user also selected **DeepSeek-assisted memory extraction** for Cyber Life v1. Kaka may call DeepSeek after chat to summarize and extract memories, as long as the request stays within the privacy boundaries in this spec.

## Architecture

### Data Flow

```text
Renderer ChatInput
  -> IPC chat:send
  -> main.ts chat coordinator
  -> load profile / relationship / context memories
  -> search relevant memories
  -> createChatReply(memoryContext)
  -> append chat-history.jsonl
  -> DeepSeek memory extraction in background
  -> append / update context-memory.jsonl
  -> update relationship.json
  -> notify renderer with reply + mood
  -> renderer bubble queue + history state refresh
```

### New or Extended Files

```text
src/app/main/memory/chatHistoryStore.ts
src/app/main/memory/memoryExtractionService.ts
src/app/main/memory/memoryDeduplication.ts
src/app/main/memory/relationshipEvents.ts
src/app/main/chatCoordinator.ts
src/app/renderer/ChatHistoryPanel.tsx
src/app/renderer/chatHistoryTypes.ts
src/app/renderer/bubbleQueue.ts
tests/app/main/memory/chatHistoryStore.test.ts
tests/app/main/memory/memoryExtractionService.test.ts
tests/app/main/chatCoordinator.test.ts
tests/app/renderer/ChatHistoryPanel.test.tsx
tests/app/renderer/bubbleQueue.test.ts
```

Exact filenames may be adjusted during implementation if the existing code suggests a cleaner boundary, but responsibilities should remain separated.

## Conversation Reading UX

### Bubble Modes

`BubbleMessage` should distinguish display mode:

- `transient`: auto-hides after `autoHideMs`.
- `readable`: user has opened it; no auto-hide.
- `pinned`: diagnostic or explicit sticky content.

Short chat replies remain transient. Long replies are transient at first but show an affordance to open reading mode. Reading mode uses the same head-top placement but allows scrolling and provides a close button.

### Long Reply Threshold

Initial threshold:

- More than 90 Chinese characters or 180 Latin characters.
- Or more than 4 rendered lines.

The renderer can make the final open/close decision by text length first. A future layout measurement pass can refine line-based behavior.

### Interaction

- Clicking a chat bubble opens reading mode.
- Reading mode does not auto-hide.
- Escape or close button closes reading mode.
- Sending a new chat closes the previous reading mode unless the user explicitly keeps it pinned in a future version.

## Conversation History

### Storage

Add local file:

```text
%APPDATA%/cline-desktop-pet/chat-history.jsonl
```

Each line is one chat turn:

```ts
type ChatHistoryTurn = {
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";
  summary?: string;
  memoryIds: string[];
};
```

Retention for v1:

- Keep the latest 200 turns by default.
- Keep summaries and extracted memories separately in `context-memory.jsonl`.
- Clearing chat history does not automatically delete long-term memory unless the user chooses a separate clear-memory action.

### Renderer Panel

History panel behavior:

- Open from a small history affordance near chat controls or from the right-click menu.
- Show newest conversations first.
- Include search by user text and assistant text.
- Allow copying a turn.
- Allow clearing local history with confirmation.
- Empty state should be calm and direct.

### IPC

Add IPC operations through `petBridge.ts`:

```ts
getChatHistory(): Promise<ChatHistoryResponse>
clearChatHistory(): Promise<ClearChatHistoryResponse>
```

The initial implementation can refresh history after each successful chat instead of streaming every turn.

## Memory Extraction

### DeepSeek Extraction Request

After a successful chat, Kaka can call DeepSeek in the background. This call should not block displaying the chat reply.

Input may include:

- Current user message.
- Current assistant reply.
- Existing relationship summary.
- Up to three relevant memory summaries.
- Up to five recent chat summaries, if already available.

Input must not include:

- File contents.
- Code contents.
- Screen contents.
- Terminal output.
- Full logs.
- API keys or config secrets.

### Extraction Output

The extraction prompt should require strict JSON:

```ts
type MemoryExtractionResult = {
  shouldRemember: boolean;
  conversationSummary: string | null;
  sentiment: "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";
  facts: string[];
  preferences: string[];
  projectContext: string[];
  careSignals: string[];
  relationshipEvent: "chat" | "support" | "work-session" | "stress" | "none";
};
```

If parsing fails, Kaka should log the failure and continue without updating long-term memory.

### Memory Writes

Map extraction items into `ContextMemoryItem`:

- `facts` -> `kind: "fact"`
- `preferences` -> `kind: "preference"`
- `projectContext` -> `kind: "project-context"`
- `conversationSummary` and `careSignals` -> `kind: "conversation-summary"`

Tags should include stable labels such as `chat`, `deepseek-extracted`, `preference`, `project`, `care`, `sentiment:<value>`.

Weights should be conservative:

- Explicit preferences: 80.
- Project context: 65.
- Care signals: 60.
- Generic summaries: 40.

### Deduplication

Before appending a new context memory, compare normalized text against recent memories:

- Lowercase.
- Trim whitespace.
- Collapse punctuation and spacing.
- Treat exact normalized text as duplicate.
- For near duplicates, update weight and `updatedAt` instead of appending if a simple overlap score is high enough.

v1 can use deterministic text similarity. Embeddings are not needed.

## Prompt Memory Injection

Before chat reply generation:

1. Load `profile.json`.
2. Load `relationship.json`.
3. Read `context-memory.jsonl`.
4. Use `searchContextMemories(items, userText, 3)`.
5. Build `MemoryPromptContext` with `buildMemoryPromptContext()`.
6. Pass `memoryContext` into `createChatReply()`.

The prompt should continue to respect the existing privacy rule: Kaka must not claim it can see files, code, screen, or private information unless the user provides it in chat.

## Relationship Growth

Chat should slowly update relationship memory:

- Any non-empty successful chat increases familiarity a little.
- Supportive or emotionally vulnerable chats increase trust and affection a little.
- Work-session/project-context chats increase engagement.
- Negative or stressed sentiment should not punish the user; it should create a care signal and maybe make Kaka gentler.
- Repeated interactions in one day should have diminishing returns.

Suggested increments for v1:

- Normal chat: familiarity +1, engagement +1.
- Support/care signal: trust +1, affection +1.
- Project/work context: engagement +2.
- Head pat remains warmth-focused and should not inflate numbers rapidly.

Relationship updates should append compact recent events, capped at 20 events.

## Mood And Presence

### Mood

Extend mood input with extraction sentiment and recent relationship events.

Possible v1 mapping:

- `focused` + active Cline work -> `curious` / `thinking`.
- `tired` or late night -> `sleepy`.
- `stressed` -> `calm` with supportive message, not `angry`.
- Positive/supportive interaction -> `happy`.
- High affection + repeated memory hits -> `attached`.

### Presence Rhythm

Presence should remain low frequency.

Rules:

- Do not show proactive messages while user is reading a chat bubble.
- Do not interrupt `loading` or `thinking` statuses except with a rare supportive work-session message after a long cooldown.
- Default cooldown: 4 hours.
- Deep-night sleepy messages: at most once per night.
- Care reminder after long work session: at most once per 2 hours.

Examples:

- "我在旁边陪你，慢慢来。"
- "要不要喝口水？我会乖乖等你。"
- "已经很晚啦，卡卡有点困，但还在。"

## Bubble Queue

The renderer should replace the single `bubble` slot with a tiny queue manager.

Priority:

1. User chat reply / readable bubble.
2. Error or settings notice.
3. Cline status update.
4. Presence message.

Rules:

- A readable bubble blocks lower-priority bubbles.
- Presence messages are dropped if a chat bubble is active.
- Status updates can coalesce by status/task within a short window.
- Queue size should be small, e.g. 5 items.

## Privacy And Controls

Local files:

```text
%APPDATA%/cline-desktop-pet/config.json
%APPDATA%/cline-desktop-pet/state.json
%APPDATA%/cline-desktop-pet/profile.json
%APPDATA%/cline-desktop-pet/relationship.json
%APPDATA%/cline-desktop-pet/context-memory.jsonl
%APPDATA%/cline-desktop-pet/chat-history.jsonl
```

Controls in v1:

- Clear chat history.
- Document the local memory file paths clearly.
- Full long-term memory management and relationship reset UI belongs to v2, not this v1 batch.
- Memory extraction failures should not expose raw prompts in UI.

DeepSeek privacy boundary:

- Only chat text and compact memory summaries are sent.
- Kaka never automatically reads local files, code, screen, terminal output, logs, API keys, or config secrets.
- Kaka should phrase memory use modestly, e.g. "我记得你之前提过..." only when memory came from chat.

## Testing Strategy

Use TDD for implementation.

Core tests:

- Chat history store appends, reads newest first, caps retention, clears safely, tolerates malformed lines.
- Memory extraction service parses valid JSON, rejects malformed output, maps extracted items to context memories, and deduplicates.
- Chat coordinator injects relevant memories into `createChatReply()` and persists successful turns.
- Relationship updates are bounded and use diminishing returns.
- Bubble queue respects priority and does not overwrite readable chat bubbles.
- Chat history panel renders empty state, loaded turns, search, copy action, and clear confirmation.
- Reading mode disables auto-hide for opened chat bubbles.
- Full `npm test` and `npm run build` pass before completion.

## Cyber Life v1 Roadmap: This Engineering Batch

1. **Design and plan**
   - Write this spec.
   - Write an implementation plan after user review.

2. **Conversation persistence**
   - Add `chat-history.jsonl` path.
   - Add chat history store.
   - Add IPC and renderer bridge methods.

3. **Readable chat UX**
   - Add readable bubble mode.
   - Add history panel.
   - Add tests for auto-hide, reading mode, and history panel.

4. **Memory loop**
   - Wire profile/relationship/context memory loading into chat.
   - Search relevant memories and inject prompt context.
   - Add DeepSeek extraction service.
   - Persist extracted memories with deduplication.

5. **Relationship and mood**
   - Update relationship after chat.
   - Use sentiment/care signals for mood.
   - Keep stressed/tired user states supportive rather than punitive.

6. **Presence and bubble queue**
   - Add a small bubble queue.
   - Expand presence rules conservatively.
   - Ensure reading mode is not interrupted.

7. **Docs and verification**
   - Update development guide and compact.
   - Run targeted tests, full tests, and build.
   - Commit and push.

## Later Roadmap: v2/v3

### v2: Memory Management And Visible Growth

- Memory management UI: browse memories, delete one memory, pause memory, mark "do not remember".
- Relationship profile: show broad stage labels, not raw scores by default.
- Mood calendar or small recent mood log.
- User-controlled proactive frequency.
- Better chat sentiment classification and multi-turn summarization.
- Separate "work companion" mode for focused Cline sessions.
- Tray actions for reset history, reset memory, export local data.

### v3: Richer Cyber Life Behavior

- More expressive action sets and pet animation variants.
- Multi-stage bond/personality evolution.
- Daily recap generated from local summaries.
- Memory conflict handling, e.g. preference changed from old to new.
- User-authored Kaka rules and personal boundaries.
- Optional local-only model path for memory extraction if available.
- More robust scheduler for quiet hours, reminders, and presence.

## Total Roadmap

### Phase 0: Status Desktop Pet

- Shows Cline status.
- Has local pet pack and MCP/Bridge diagnostics.
- Done in the current branch baseline.

### Phase 1: Conversational Pet

- DeepSeek chat.
- Warm prompt.
- Chat mood reaction.
- Mostly done before this spec.

### Phase 2: Cyber Life v1

- Readable conversations.
- Conversation history.
- Working memory loop.
- Relationship growth.
- Low-frequency presence.
- Bubble queue.
- This spec defines Phase 2.

### Phase 3: Visible Companion Growth

- Memory controls.
- Growth/profile UI.
- Mood timeline.
- User-tunable initiative.
- More expressive actions.

### Phase 4: Long-Term Local Companion

- Stable personal boundaries.
- Better long-term memory hygiene.
- Optional local model support.
- More nuanced routines while staying local-first and user-controlled.

## Success Criteria

- Long Kaka replies can be read completely without leaving bubbles permanently visible.
- Recent chat history can be opened, searched, copied, and cleared.
- Chat history and memory files are stored locally under `%APPDATA%/cline-desktop-pet/`.
- Future chat responses can use relevant extracted memories.
- DeepSeek extraction runs after chat without blocking the visible reply.
- Extraction failure does not break chat.
- Relationship and mood update after chat in bounded, test-covered ways.
- Presence feels gentle and does not interrupt active reading or frequent work statuses.
- Tests and build pass.
- Docs include current feature details plus v2/v3 and total roadmap.