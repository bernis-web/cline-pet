# Kaka Cyber Life v2.4 History Blocklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark a chat-history turn as `不要再记` from the unified privacy panel so future long-term memory extraction skips similar user text without deleting chat history or existing long-term memories.

**Architecture:** Extend the existing privacy management service with one focused mutation that converts a chat-history turn id into a local blocklist rule via the existing blocklist store. Expose one new IPC/renderer bridge method, add one action button in the `聊天历史` tab, and keep confirmation / refresh / notice-bubble behavior in `App.tsx` so `PrivacyPanel` stays presentational.

**Tech Stack:** Electron IPC, React, TypeScript, Vitest, jsdom renderer tests, local JSON/JSONL stores in `%APPDATA%/cline-desktop-pet/`.

---

## File Structure

- Modify `src/app/main/memory/privacyManagementService.ts`
  - Add `blockChatHistoryTurnForUser(root, turnId)`.
  - Broaden the mutation error union for chat-history-specific failures.
- Modify `tests/app/main/privacyManagementService.test.ts`
  - Cover success, duplicate success, invalid id, missing turn, and empty `userText`.
- Modify `src/app/main/main.ts`
  - Register the new `chat-history:block` IPC handler.
- Modify `src/app/renderer/petBridge.ts`
  - Add the `chat-history:block` invoke signature and `blockChatHistoryTurn(id)` bridge method.
- Modify `tests/app/renderer/petBridge.test.ts`
  - Verify the new channel name and payload.
- Modify `src/app/renderer/PrivacyPanel.tsx`
  - Add an `onBlockChatHistoryTurn(id)` prop.
  - Render a `不要再记` button next to `复制` in the history tab.
- Modify `tests/app/renderer/PrivacyPanel.test.ts`
  - Verify the new history callback is fired.
- Modify `src/app/renderer/App.tsx`
  - Add the new window bridge method declaration.
  - Implement confirm → bridge call → refresh → success notice flow.
- Modify `tests/app/renderer/App.test.ts`
  - Verify history-level block action refreshes the privacy overview and surfaces the success notice.
- Modify `src/app/renderer/petStyles.css`
  - Add compact history action-row/button styles.
- Modify `tests/app/renderer/petStyles.test.ts`
  - Assert the new selectors exist.
- Modify `docs/development/kaka-development-guide.md`
  - Add a Cyber Life v2.4 section once implementation is verified.
- Modify `docs/development/kaka-compact.md`
  - Update the built-features summary and likely next tasks after implementation is verified.

---

### Task 1: Add the main-process history-blocklist mutation

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/tests/app/main/privacyManagementService.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/src/app/main/memory/privacyManagementService.ts`

- [ ] **Step 1: Write the failing service tests**

Update the import block in `tests/app/main/privacyManagementService.test.ts`:

```ts
import {
  blockChatHistoryTurnForUser,
  clearMemoryBlockRulesForUser,
  deleteMemoryBlockRuleForUser,
  exportPrivacyDataForUser,
  getPrivacyOverview
} from "../../../src/app/main/memory/privacyManagementService";
```

Replace the current `writeHistory(root)` helper with this pair so later tests can inject custom turns:

```ts
function writeHistoryTurns(root: string, turns: Array<{
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: string;
  memoryIds: string[];
  summary?: string;
}>) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${turns.map((turn) => JSON.stringify(turn)).join("\n")}\n`, "utf8");
}

function writeHistory(root: string) {
  writeHistoryTurns(root, [{
    id: "turn-1",
    userText: "今天好累",
    assistantText: "先喝口水，我在旁边陪你。",
    createdAt: "2026-06-01T04:00:00.000Z",
    sentiment: "tired",
    memoryIds: ["memory-1"]
  }]);
}
```

Append these tests at the end of the `describe("privacyManagementService", ...)` block:

```ts
  it("blocks a chat-history turn by user text without deleting history or existing memories", () => {
    const root = makeRoot();
    roots.push(root);
    writeMemories(root, [memory({ id: "memory-1", kind: "fact", text: "保留记忆" })]);
    writeHistory(root);

    expect(blockChatHistoryTurnForUser(root, "turn-1")).toEqual({ ok: true });

    expect(readMemoryBlockRules(root)).toEqual([
      expect.objectContaining({ text: "今天好累" })
    ]);
    expect(readChatHistory(root).map((turn) => turn.id)).toEqual(["turn-1"]);
    expect(readContextMemories(root).map((item) => item.id)).toEqual(["memory-1"]);
  });

  it("treats duplicate history blocking as success without creating duplicate rules", () => {
    const root = makeRoot();
    roots.push(root);
    writeHistory(root);
    writeMemoryBlockRules(root, [{
      id: "rule-1",
      text: "今天好累",
      normalizedText: "今天好累",
      createdAt: "2026-06-01T05:00:00.000Z"
    }]);

    expect(blockChatHistoryTurnForUser(root, "turn-1")).toEqual({ ok: true });
    expect(readMemoryBlockRules(root)).toHaveLength(1);
  });

  it("reports invalid id, missing turn, and empty history user text clearly", () => {
    const root = makeRoot();
    roots.push(root);
    writeHistoryTurns(root, [{
      id: "turn-empty",
      userText: "   ",
      assistantText: "我听着呢。",
      createdAt: "2026-06-01T06:00:00.000Z",
      sentiment: "neutral",
      memoryIds: []
    }]);

    expect(blockChatHistoryTurnForUser(root, "  ")).toEqual({
      ok: false,
      errorCode: "INVALID_CHAT_HISTORY_TURN_ID",
      message: "聊天历史 id 无效。"
    });
    expect(blockChatHistoryTurnForUser(root, "missing")).toEqual({
      ok: false,
      errorCode: "CHAT_HISTORY_TURN_NOT_FOUND",
      message: "这条聊天历史已经不存在了。"
    });
    expect(blockChatHistoryTurnForUser(root, "turn-empty")).toEqual({
      ok: false,
      errorCode: "EMPTY_CHAT_HISTORY_USER_TEXT",
      message: "这条记录没有可加入不要再记的用户内容。"
    });
  });
```

- [ ] **Step 2: Run the focused service test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-13-history-blocklist
npm test -- tests/app/main/privacyManagementService.test.ts
```

Expected: FAIL because `blockChatHistoryTurnForUser` does not exist yet.

- [ ] **Step 3: Implement the service mutation**

Update the import line in `src/app/main/memory/privacyManagementService.ts`:

```ts
import { appendMemoryBlockRule, clearMemoryBlockRules, deleteMemoryBlockRule, readMemoryBlockRules } from "./memoryBlocklistStore.js";
```

Expand the error union and add the new function below `clearMemoryBlockRulesForUser()`:

```ts
export type BlockRuleMutationResponse =
  | { ok: true }
  | {
      ok: false;
      errorCode:
        | "INVALID_BLOCK_RULE_ID"
        | "BLOCK_RULE_NOT_FOUND"
        | "INVALID_CHAT_HISTORY_TURN_ID"
        | "CHAT_HISTORY_TURN_NOT_FOUND"
        | "EMPTY_CHAT_HISTORY_USER_TEXT";
      message: string;
    };

export function blockChatHistoryTurnForUser(root: string, turnId: string): BlockRuleMutationResponse {
  const normalizedId = turnId.trim();
  if (!normalizedId) {
    return { ok: false, errorCode: "INVALID_CHAT_HISTORY_TURN_ID", message: "聊天历史 id 无效。" };
  }

  const turn = readChatHistory(root).find((item) => item.id === normalizedId);
  if (!turn) {
    return { ok: false, errorCode: "CHAT_HISTORY_TURN_NOT_FOUND", message: "这条聊天历史已经不存在了。" };
  }

  const text = turn.userText.trim();
  if (!text) {
    return { ok: false, errorCode: "EMPTY_CHAT_HISTORY_USER_TEXT", message: "这条记录没有可加入不要再记的用户内容。" };
  }

  appendMemoryBlockRule(root, { text });
  return { ok: true };
}
```

- [ ] **Step 4: Run the focused service test and verify it passes**

Run:

```powershell
npm test -- tests/app/main/privacyManagementService.test.ts
```

Expected: PASS for `privacyManagementService.test.ts`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/privacyManagementService.test.ts src/app/main/memory/privacyManagementService.ts
git commit -m "feat: block chat history through privacy service"
```

---

### Task 2: Wire the IPC channel and renderer bridge

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/src/app/main/main.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/src/app/renderer/petBridge.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/tests/app/renderer/petBridge.test.ts`

- [ ] **Step 1: Write the failing bridge test**

Update the last test in `tests/app/renderer/petBridge.test.ts` to call the new method:

```ts
  it("manages unified privacy data through IPC", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { counts: { memories: 0, blockRules: 0, chatHistoryTurns: 0 }, memories: [], blockRules: [], chatHistory: [] } })
      .mockResolvedValueOnce({ ok: true, data: "{}" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.getPrivacyOverview();
    await bridge.exportPrivacyData();
    await bridge.deleteMemoryBlockRule("rule-1");
    await bridge.clearMemoryBlockRules();
    await bridge.blockChatHistoryTurn("turn-1");

    expect(invoke).toHaveBeenNthCalledWith(1, "privacy:get-overview");
    expect(invoke).toHaveBeenNthCalledWith(2, "privacy:export");
    expect(invoke).toHaveBeenNthCalledWith(3, "memory-blocklist:delete", { id: "rule-1" });
    expect(invoke).toHaveBeenNthCalledWith(4, "memory-blocklist:clear");
    expect(invoke).toHaveBeenNthCalledWith(5, "chat-history:block", { id: "turn-1" });
  });
```

- [ ] **Step 2: Run the focused bridge test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-13-history-blocklist
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: FAIL because `blockChatHistoryTurn()` is missing.

- [ ] **Step 3: Implement the new IPC surface**

In `src/app/renderer/petBridge.ts`, add the invoke signature and bridge method:

```ts
  invoke(channel: "chat-history:block", payload: { id: string }): Promise<BlockRuleMutationResponse>;
```

```ts
    blockChatHistoryTurn(id: string) {
      return ipc.invoke("chat-history:block", { id });
    },
```

In `src/app/main/main.ts`, extend the privacy service import:

```ts
import {
  blockChatHistoryTurnForUser,
  clearMemoryBlockRulesForUser,
  deleteMemoryBlockRuleForUser,
  exportPrivacyDataForUser,
  getPrivacyOverview
} from "./memory/privacyManagementService.js";
```

Register the new handler near the other privacy/history handlers:

```ts
  ipcMain.handle("chat-history:block", (_event, payload: { id?: string }) =>
    blockChatHistoryTurnForUser(appDataBaseDir, payload?.id ?? "")
  );
```

- [ ] **Step 4: Run the focused bridge test and verify it passes**

Run:

```powershell
npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: PASS for `petBridge.test.ts`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/app/main/main.ts src/app/renderer/petBridge.ts tests/app/renderer/petBridge.test.ts
git commit -m "feat: expose chat history blocklist bridge"
```

---

### Task 3: Add the history-tab action to `PrivacyPanel`

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/src/app/renderer/PrivacyPanel.tsx`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/tests/app/renderer/PrivacyPanel.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/src/app/renderer/petStyles.css`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/tests/app/renderer/petStyles.test.ts`

- [ ] **Step 1: Write the failing component and style tests**

Update the callback list inside `renderPanel()` in `tests/app/renderer/PrivacyPanel.test.ts`:

```ts
  const callbacks = {
    onClose: vi.fn(),
    onDeleteMemory: vi.fn(),
    onClearMemories: vi.fn(),
    onExportPrivacyData: vi.fn(),
    onUpdateMemory: vi.fn(),
    onBlockMemory: vi.fn(),
    onDeleteBlockRule: vi.fn(),
    onClearBlockRules: vi.fn(),
    onClearChatHistory: vi.fn(),
    onBlockChatHistoryTurn: vi.fn()
  };
```

Replace the history test with this version:

```ts
  it("supports chat history search, copy, block, and clear", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { rootElement, callbacks } = renderPanel("history");

    const search = rootElement.querySelector('input[name="historySearch"]') as HTMLInputElement;
    await act(async () => {
      search.value = "喝口水";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      (rootElement.querySelector(".chat-history-copy") as HTMLButtonElement).click();
      (rootElement.querySelector(".chat-history-block") as HTMLButtonElement).click();
      (rootElement.querySelector(".chat-history-clear") as HTMLButtonElement).click();
    });

    expect(rootElement.querySelector(".privacy-history-section")?.textContent).toContain("先喝口水");
    expect(writeText).toHaveBeenCalledWith("你：今天好累\n卡卡：先喝口水，我在旁边陪你。");
    expect(callbacks.onBlockChatHistoryTurn).toHaveBeenCalledWith("turn-1");
    expect(callbacks.onClearChatHistory).toHaveBeenCalledOnce();
  });
```

Update `tests/app/renderer/petStyles.test.ts` by extending the privacy-style assertion:

```ts
  it("includes unified privacy panel styles for tabs, blocklist, history, and export actions", () => {
    expect(styles).toContain(".privacy-panel");
    expect(styles).toContain(".privacy-tabs");
    expect(styles).toContain(".privacy-tab-active");
    expect(styles).toContain(".privacy-body");
    expect(styles).toContain(".privacy-data-list");
    expect(styles).toContain(".privacy-blocklist-section");
    expect(styles).toContain(".block-rule-list");
    expect(styles).toContain(".block-rules-clear");
    expect(styles).toContain(".privacy-history-section");
    expect(styles).toContain(".chat-history-actions");
    expect(styles).toContain(".chat-history-copy");
    expect(styles).toContain(".chat-history-block");
    expect(styles).toContain(".privacy-export-section");
    expect(styles).toContain(".privacy-export-copy");
    expect(styles).toContain(".privacy-clear-actions");
  });
```

- [ ] **Step 2: Run the focused component/style tests and verify they fail**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-13-history-blocklist
npm test -- tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/petStyles.test.ts
```

Expected: FAIL because `onBlockChatHistoryTurn` and the new selectors do not exist yet.

- [ ] **Step 3: Implement the history-tab button and styles**

In `src/app/renderer/PrivacyPanel.tsx`, extend the props:

```ts
  onClearChatHistory(): void;
  onBlockChatHistoryTurn(id: string): void;
```

Update the destructuring signature:

```ts
  onDeleteBlockRule,
  onClearBlockRules,
  onClearChatHistory,
  onBlockChatHistoryTurn
}: PrivacyPanelProps) {
```

Replace the history action button block with:

```tsx
                    <div className="chat-history-actions">
                      <button
                        className="chat-history-copy"
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText?.(`你：${turn.userText}\n卡卡：${turn.assistantText}`);
                        }}
                      >
                        复制
                      </button>
                      <button
                        className="chat-history-block"
                        type="button"
                        disabled={pending}
                        onClick={() => onBlockChatHistoryTurn(turn.id)}
                      >
                        不要再记
                      </button>
                    </div>
```

In `src/app/renderer/petStyles.css`, add these selectors near the existing history styles:

```css
.chat-history-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chat-history-block {
  border: 1px solid rgba(255, 185, 120, 0.45);
  color: #ffd7ad;
  background: rgba(255, 185, 120, 0.16);
}
```

- [ ] **Step 4: Run the focused component/style tests and verify they pass**

Run:

```powershell
npm test -- tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/petStyles.test.ts
```

Expected: PASS for both files.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/app/renderer/PrivacyPanel.tsx src/app/renderer/petStyles.css tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/petStyles.test.ts
git commit -m "feat: add history block action to privacy panel"
```

---

### Task 4: Integrate the new action in `App.tsx`

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/src/app/renderer/App.tsx`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/tests/app/renderer/App.test.ts`

- [ ] **Step 1: Write the failing integration test**

Add this test after `it("opens the chat history panel and loads stored conversations", ...)` in `tests/app/renderer/App.test.ts`:

```ts
  it("blocks a chat-history turn from the privacy panel and refreshes overview", async () => {
    const initialOverview = {
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
      blockRules: [],
      chatHistory: [{
        id: "turn-1",
        userText: "今天好累",
        assistantText: "先喝口水，我在旁边陪你。",
        createdAt: "2026-06-01T01:00:00.000Z",
        sentiment: "tired",
        memoryIds: []
      }],
      counts: { memories: 0, blockRules: 0, chatHistoryTurns: 1 }
    };
    const refreshedOverview = {
      ...initialOverview,
      blockRules: [{
        id: "rule-1",
        text: "今天好累",
        createdAt: "2026-06-01T02:00:00.000Z"
      }],
      counts: { memories: 0, blockRules: 1, chatHistoryTurns: 1 }
    };
    const getPrivacyOverview = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: initialOverview })
      .mockResolvedValueOnce({ ok: true, data: refreshedOverview });
    const blockChatHistoryTurn = vi.fn().mockResolvedValue({ ok: true });
    window.confirm = vi.fn().mockReturnValue(true);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getPrivacyOverview,
      blockChatHistoryTurn
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    await act(async () => {
      (document.querySelector(".chat-history-trigger") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    await act(async () => {
      (document.querySelector(".chat-history-block") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(blockChatHistoryTurn).toHaveBeenCalledWith("turn-1");
    expect(getPrivacyOverview).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".speech-bubble")?.textContent).toContain("好，我以后不会把这句话整理成长期记忆");

    await act(async () => {
      (document.querySelector('[data-privacy-tab="blocklist"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(document.querySelector(".privacy-blocklist-section")?.textContent).toContain("今天好累");
  });
```

- [ ] **Step 2: Run the focused renderer tests and verify they fail**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-13-history-blocklist
npm test -- tests/app/main/privacyManagementService.test.ts tests/app/renderer/petBridge.test.ts tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/App.test.ts
```

Expected: FAIL because `App.tsx` does not expose or use `blockChatHistoryTurn` yet.

- [ ] **Step 3: Implement the App integration**

In the `window.clinePet` declaration inside `src/app/renderer/App.tsx`, add:

```ts
      blockChatHistoryTurn?(id: string): Promise<BlockRuleMutationResponse>;
```

Add this function near the other privacy-panel mutations, after `clearChatHistoryFromPanel()` is a sensible location:

```ts
  async function blockChatHistoryTurnFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function"
      ? window.confirm("这会让卡卡以后避免把“你说的这句话”整理成长期记忆。不会删除这条聊天历史，也不会删除已有长期记忆。继续吗？")
      : true;
    if (!confirmed) return;

    setPrivacyPending(true);
    const result = await window.clinePet?.blockChatHistoryTurn?.(id);
    setPrivacyPending(false);

    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }

    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("好，我以后不会把这句话整理成长期记忆。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }
```

Pass the callback into `PrivacyPanel`:

```tsx
        onClearChatHistory={clearChatHistoryFromPanel}
        onBlockChatHistoryTurn={blockChatHistoryTurnFromPanel}
      />
```

- [ ] **Step 4: Run the focused renderer tests and verify they pass**

Run:

```powershell
npm test -- tests/app/main/privacyManagementService.test.ts tests/app/renderer/petBridge.test.ts tests/app/renderer/PrivacyPanel.test.ts tests/app/renderer/App.test.ts
```

Expected: PASS for all four files.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/app/renderer/App.tsx tests/app/renderer/App.test.ts
git commit -m "feat: block chat history from privacy panel"
```

---

### Task 5: Update docs and run full verification

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/docs/development/kaka-development-guide.md`
- Modify: `cline-desktop-pet/.worktrees/feat-13-history-blocklist/docs/development/kaka-compact.md`

- [ ] **Step 1: Update the development guide**

Add a `## Cyber Life v2.4` section to `docs/development/kaka-development-guide.md`:

```md
## Cyber Life v2.4

- 设计文档：`docs/superpowers/specs/2026-06-02-kaka-cyber-life-v2-4-history-blocklist-design.md`。
- `PrivacyPanel` 的 `聊天历史` 每条记录新增 `不要再记`。
- 该动作会把 `turn.userText` 写入 `%APPDATA%/cline-desktop-pet/memory-blocklist.json`，用于阻止未来相似长期记忆提炼。
- 该动作不会删除聊天历史，也不会删除已有长期记忆。
- IPC 新增 `chat-history:block`，renderer bridge 新增 `blockChatHistoryTurn()`。
```

- [ ] **Step 2: Update the compact summary**

In `docs/development/kaka-compact.md`, add this bullet under `## What is already built`:

```md
- Cyber Life v2.4 history blocklist: users can mark a chat-history turn as `不要再记`; Kaka stores the user text as a local blocklist rule for future memory extraction without deleting the history turn or existing long-term memories.
```

Then replace the `Likely next tasks` list with:

```md
1. Consider optional per-turn history deletion as a separate privacy action.
2. Consider richer relationship/profile UI with recent positive events.
3. Improve MCP connection UX: clearer diagnostics, setup guidance, and stale-connection recovery hints.
4. Explore richer proactive rhythms after privacy controls prove stable.
5. Consider eventually removing old standalone `MemoryPanel` / `ChatHistoryPanel` coverage once unified privacy flows fully own the UX.
```

- [ ] **Step 3: Run the full test suite**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-13-history-blocklist
npm test
```

Expected: PASS for the full Vitest suite.

- [ ] **Step 4: Run the production build**

Run:

```powershell
npm run build
```

Expected: PASS for renderer, main, and preload builds.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "docs: update Kaka history blocklist docs"
```

---

## Self-Review Checklist

- Spec coverage: the plan adds the per-turn history block action, local blocklist mutation, IPC/bridge support, UI callback, App refresh/notice behavior, tests, styles, docs, and full verification.
- Placeholder scan completed; no banned placeholder markers or vague implementation steps remain.
- Type consistency: `blockChatHistoryTurnForUser`, `chat-history:block`, `blockChatHistoryTurn(id)`, and `onBlockChatHistoryTurn(id)` use the same naming all the way through.
