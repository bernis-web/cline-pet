# Kaka Cyber Life v1 Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Cyber Life v1 by wiring readable-chat quiet mode and 90-minute long-work presence into the real app, then refresh docs, verify, push, and create a GitHub PR.

**Architecture:** Add a small pure main-process runtime helper for presence state, expose a typed renderer-to-main IPC call for reading activity, report only long chat readable mode from the renderer, and let `main.ts` combine runtime reading/work-session flags with the existing `presenceService`. Keep the existing MCP/Bridge/status pipeline unchanged.

**Tech Stack:** TypeScript, Electron IPC, React hooks, Vitest, jsdom renderer tests, Node/Electron main process, GitHub MCP PR creation.

---

## Current Context

- Worktree: `d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-12-state-local-pet-pack`
- Branch: `feat/12-state-local-pet-pack`
- Approved finish spec: `docs/superpowers/specs/2026-06-01-kaka-cyber-life-v1-finish-design.md`
- Existing v1 implementation is already pushed through commit `415b6eb feat: tune Kaka presence for Cyber Life v1`.
- Finish design commit is `54e456d docs: add kaka cyber life v1 finish design`.
- `git status --short --branch` currently shows only local `.superpowers/` as untracked; do not commit it.
- Use PowerShell command separators (`;`) in this environment. Avoid `&&`.

## Scope Check

This plan covers one finish slice, not Cyber Life v2. It touches three coherent areas that must work together before a PR: presence runtime behavior, renderer/main IPC wiring, and docs/PR closeout. It does not add new UI panels, new assets, memory management UI, or a merge to `main`.

## File Structure

```text
src/app/main/presenceRuntime.ts
  Pure helper for renderer reading activity and continuous loading/thinking work-session timing.

tests/app/main/presenceRuntime.test.ts
  Unit tests for reading activity validation, work-session start/preserve/reset, and 90-minute threshold.

src/app/renderer/petBridge.ts
  Adds typed `presence:set-activity` IPC bridge method.

tests/app/renderer/petBridge.test.ts
  Verifies bridge method invokes the expected IPC channel and payload.

src/app/renderer/App.tsx
  Reports `userIsReading` only when a long chat bubble enters/leaves readable mode.

tests/app/renderer/App.test.ts
  Verifies readable chat bubble open/close sends presence activity updates.

src/app/main/main.ts
  Stores presence runtime state, handles `presence:set-activity`, updates work-session state from `notifyRenderer()`, and passes flags into `maybeCreatePresencePulse()`.

docs/development/kaka-development-guide.md
  Documents final runtime presence wiring and verification output.

docs/development/kaka-compact.md
  Updates latest commits, verification summary, and next-step guidance for Cyber Life v2.
```

## Task 1: Add Pure Presence Runtime Helper

**Files:**
- Create: `src/app/main/presenceRuntime.ts`
- Create: `tests/app/main/presenceRuntime.test.ts`

- [ ] **Step 1: Write the failing presence runtime test**

Create `tests/app/main/presenceRuntime.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import {
  LONG_WORK_SESSION_MS,
  applyPresenceActivityInput,
  hasLongWorkSession,
  updateWorkSession,
  type PresenceRuntimeState
} from "../../../src/app/main/presenceRuntime";

describe("presenceRuntime", () => {
  it("accepts explicit renderer reading activity and rejects malformed payloads", () => {
    const initial: PresenceRuntimeState = { userIsReading: false };

    const enabled = applyPresenceActivityInput(initial, { userIsReading: true });
    expect(enabled.response).toEqual({ ok: true });
    expect(enabled.state.userIsReading).toBe(true);

    const disabled = applyPresenceActivityInput(enabled.state, { userIsReading: false });
    expect(disabled.response).toEqual({ ok: true });
    expect(disabled.state.userIsReading).toBe(false);

    const rejected = applyPresenceActivityInput(disabled.state, { userIsReading: "yes" });
    expect(rejected.response).toEqual({ ok: false, message: "userIsReading must be boolean" });
    expect(rejected.state).toEqual(disabled.state);
  });

  it("tracks continuous loading and thinking as one work session", () => {
    let state: PresenceRuntimeState = { userIsReading: false };

    state = updateWorkSession(state, {
      visibleStatus: "loading",
      now: "2026-06-01T00:00:00.000Z"
    });
    expect(state.workSessionStartedAt).toBe("2026-06-01T00:00:00.000Z");

    state = updateWorkSession(state, {
      visibleStatus: "thinking",
      now: "2026-06-01T00:45:00.000Z"
    });
    expect(state.workSessionStartedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("marks a work session long only after the 90 minute threshold", () => {
    const state: PresenceRuntimeState = {
      userIsReading: false,
      workSessionStartedAt: "2026-06-01T00:00:00.000Z"
    };

    expect(hasLongWorkSession(state, { now: "2026-06-01T01:29:59.000Z" })).toBe(false);
    expect(hasLongWorkSession(state, { now: "2026-06-01T01:30:00.000Z" })).toBe(true);
    expect(LONG_WORK_SESSION_MS).toBe(90 * 60 * 1000);
  });

  it("resets the work session when visible status leaves loading and thinking", () => {
    const state = updateWorkSession({
      userIsReading: false,
      workSessionStartedAt: "2026-06-01T00:00:00.000Z"
    }, {
      visibleStatus: "idle",
      now: "2026-06-01T01:00:00.000Z"
    });

    expect(state).toEqual({ userIsReading: false });
    expect(hasLongWorkSession(state, { now: "2026-06-01T03:00:00.000Z" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/main/presenceRuntime.test.ts
```

Expected: FAIL because `src/app/main/presenceRuntime.ts` does not exist.

- [ ] **Step 3: Implement the presence runtime helper**

Create `src/app/main/presenceRuntime.ts` with this content:

```ts
import type { PetStatus } from "../../shared/statuses.js";

export const LONG_WORK_SESSION_MS = 90 * 60 * 1000;

export type PresenceRuntimeState = {
  userIsReading: boolean;
  workSessionStartedAt?: string;
};

export type PresenceActivityResponse =
  | { ok: true }
  | { ok: false; message: string };

export type PresenceActivityUpdate = {
  state: PresenceRuntimeState;
  response: PresenceActivityResponse;
};

function isWorkSessionStatus(status: PetStatus) {
  return status === "loading" || status === "thinking";
}

function timestampMs(value?: string) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function applyPresenceActivityInput(state: PresenceRuntimeState, input: unknown): PresenceActivityUpdate {
  const userIsReading = (input as { userIsReading?: unknown } | null | undefined)?.userIsReading;
  if (typeof userIsReading !== "boolean") {
    return { state, response: { ok: false, message: "userIsReading must be boolean" } };
  }

  return { state: { ...state, userIsReading }, response: { ok: true } };
}

export function updateWorkSession(state: PresenceRuntimeState, input: { visibleStatus: PetStatus; now: string }): PresenceRuntimeState {
  if (isWorkSessionStatus(input.visibleStatus)) {
    return state.workSessionStartedAt ? state : { ...state, workSessionStartedAt: input.now };
  }

  return { userIsReading: state.userIsReading };
}

export function hasLongWorkSession(state: PresenceRuntimeState, input: { now: string; thresholdMs?: number }) {
  const startedAt = timestampMs(state.workSessionStartedAt);
  const now = timestampMs(input.now);
  const thresholdMs = input.thresholdMs ?? LONG_WORK_SESSION_MS;
  if (startedAt === null || now === null) return false;
  return now - startedAt >= thresholdMs;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/main/presenceRuntime.test.ts
```

Expected: PASS for `tests/app/main/presenceRuntime.test.ts`.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; git add src/app/main/presenceRuntime.ts tests/app/main/presenceRuntime.test.ts; git commit -m "feat: add Kaka presence runtime"
```

Expected: one commit containing only the runtime helper and its test.

## Task 2: Add Presence Activity IPC Bridge Method

**Files:**
- Modify: `src/app/renderer/petBridge.ts`
- Modify: `tests/app/renderer/petBridge.test.ts`

- [ ] **Step 1: Write the failing bridge test**

Append this test inside the existing `describe("renderer pet bridge", () => { ... })` block in `tests/app/renderer/petBridge.test.ts`:

```ts
  it("reports presence reading activity through IPC", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.setPresenceActivity({ userIsReading: true });

    expect(invoke).toHaveBeenCalledWith("presence:set-activity", { userIsReading: true });
  });
```

- [ ] **Step 2: Run the focused failing bridge test**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: FAIL because `setPresenceActivity` is not defined on the renderer bridge.

- [ ] **Step 3: Implement the bridge method and types**

In `src/app/renderer/petBridge.ts`, add these exported types after `ClearChatHistoryResponse`:

```ts
export type PresenceActivityInput = {
  userIsReading?: boolean;
};

export type PresenceActivityResponse =
  | { ok: true }
  | { ok: false; message: string };
```

Extend `IpcLike` with this invoke signature:

```ts
  invoke(channel: "presence:set-activity", payload: PresenceActivityInput): Promise<PresenceActivityResponse>;
```

Add this method inside the object returned by `createRendererPetBridge()` after `clearChatHistory()`:

```ts
    setPresenceActivity(input: PresenceActivityInput) {
      return ipc.invoke("presence:set-activity", input);
    },
```

- [ ] **Step 4: Run the focused bridge test to verify it passes**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/renderer/petBridge.test.ts
```

Expected: PASS for `tests/app/renderer/petBridge.test.ts`.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; git add src/app/renderer/petBridge.ts tests/app/renderer/petBridge.test.ts; git commit -m "feat: add presence activity bridge"
```

Expected: one commit containing only the bridge method and bridge test.

## Task 3: Report Readable Chat Bubble Activity From Renderer

**Files:**
- Modify: `src/app/renderer/App.tsx`
- Modify: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Write the failing renderer activity test**

Add this test to `tests/app/renderer/App.test.ts` after the existing history panel test and before the motion-class test:

```ts
  it("reports reading activity while a long chat bubble is open in readable mode", async () => {
    const longReply = "卡卡会慢慢说清楚，也会等你读完这一段，不会在你认真阅读的时候突然插话。".repeat(8);
    const setPresenceActivity = vi.fn().mockResolvedValue({ ok: true });
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      sendChatMessage: vi.fn().mockResolvedValue({ ok: true, text: longReply }),
      getChatHistory: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      setPresenceActivity
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    await act(async () => {
      (document.querySelector(".pet-stage") as HTMLElement).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    const input = document.querySelector('input[name="message"]') as HTMLInputElement;
    const form = document.querySelector(".chat-input") as HTMLFormElement;
    await act(async () => {
      input.value = "慢慢告诉我";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(document.querySelector(".speech-bubble")?.textContent).toContain("点开读完");

    await act(async () => {
      (document.querySelector(".speech-bubble") as HTMLElement).click();
      await Promise.resolve();
    });

    expect(setPresenceActivity).toHaveBeenCalledWith({ userIsReading: true });

    await act(async () => {
      (document.querySelector(".speech-bubble-close") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(setPresenceActivity).toHaveBeenLastCalledWith({ userIsReading: false });
  });
```

- [ ] **Step 2: Run the focused failing renderer test**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/renderer/App.test.ts
```

Expected: FAIL because `App.tsx` does not call `setPresenceActivity()` when readable mode opens or closes.

- [ ] **Step 3: Implement best-effort reading activity reporting**

In `src/app/renderer/App.tsx`, change the React import to include `useRef`:

```ts
import { useEffect, useRef, useState } from "react";
```

Add the optional bridge method to the `Window.clinePet` declaration after `clearChatHistory?()`:

```ts
      setPresenceActivity?(input: { userIsReading?: boolean }): Promise<{ ok: true } | { ok: false; message: string }>;
```

Add a ref near the other state declarations:

```ts
  const lastPresenceReading = useRef(false);
```

Add this effect before the existing auto-hide `useEffect` or immediately after it:

```ts
  useEffect(() => {
    const userIsReading = bubble?.kind === "chat" && bubble.mode === "readable";
    if (lastPresenceReading.current === userIsReading) return;
    lastPresenceReading.current = userIsReading;

    try {
      const result = window.clinePet?.setPresenceActivity?.({ userIsReading });
      Promise.resolve(result).catch(() => undefined);
    } catch {
      // Presence reporting is best-effort; reading UI should never break if IPC is unavailable.
    }
  }, [bubble?.id, bubble?.kind, bubble?.mode]);
```

- [ ] **Step 4: Run focused renderer and bridge tests**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/renderer/App.test.ts tests/app/renderer/petBridge.test.ts
```

Expected: PASS. Existing jsdom `act(...)` warnings are acceptable only if Vitest exits 0.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; git add src/app/renderer/App.tsx tests/app/renderer/App.test.ts; git commit -m "feat: report Kaka readable chat activity"
```

Expected: one commit containing renderer activity reporting and its test.

## Task 4: Wire Presence Runtime Into Electron Main

**Files:**
- Modify: `src/app/main/main.ts`
- Uses: `src/app/main/presenceRuntime.ts`
- Tests: `tests/app/main/presenceRuntime.test.ts`, `tests/app/main/presenceService.test.ts`

- [ ] **Step 1: Run focused main presence tests before wiring**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/main/presenceRuntime.test.ts tests/app/main/presenceService.test.ts
```

Expected: PASS. This confirms the pure runtime and existing presence service behavior before integration.

- [ ] **Step 2: Import presence runtime helpers in main**

In `src/app/main/main.ts`, add this import after the existing `presenceService` import:

```ts
import { applyPresenceActivityInput, hasLongWorkSession, updateWorkSession, type PresenceRuntimeState } from "./presenceRuntime.js";
```

Add this module-level state after the existing `latestStatus` declaration:

```ts
let presenceRuntime: PresenceRuntimeState = { userIsReading: false };
```

- [ ] **Step 3: Update work-session state from `notifyRenderer()`**

Change `notifyRenderer()` in `src/app/main/main.ts` to update the runtime after `latestStatus` is normalized:

```ts
function notifyRenderer(win: Electron.BrowserWindow, payload: UpdatePetStatusInput) {
  latestStatus = { ...payload, updatedAt: payload.updatedAt ?? new Date().toISOString() };
  presenceRuntime = updateWorkSession(presenceRuntime, {
    visibleStatus: latestStatus.visibleStatus ?? latestStatus.status,
    now: latestStatus.updatedAt ?? new Date().toISOString()
  });
  win.webContents.send("pet-status", latestStatus);
}
```

- [ ] **Step 4: Register the renderer reading activity IPC handler**

In `src/app/main/main.ts`, add this handler after the `window:move-by` IPC handler and before interaction/chat handlers:

```ts
  ipcMain.handle("presence:set-activity", (_event, payload: unknown) => {
    const update = applyPresenceActivityInput(presenceRuntime, payload);
    presenceRuntime = update.state;
    return update.response;
  });
```

- [ ] **Step 5: Pass runtime flags into the presence interval**

In the `maybeCreatePresencePulse()` call inside the `presenceInterval`, replace the current input object with this version:

```ts
    const pulse = maybeCreatePresencePulse({
      now,
      lastPresenceAt,
      latestVisibleStatus: latestStatus.visibleStatus,
      mood: mood.name,
      userIsReading: presenceRuntime.userIsReading,
      longWorkSession: hasLongWorkSession(presenceRuntime, { now })
    });
```

- [ ] **Step 6: Run focused main tests and main build**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test -- tests/app/main/presenceRuntime.test.ts tests/app/main/presenceService.test.ts; npm run build:main
```

Expected: tests PASS and `npm run build:main` completes without TypeScript errors.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; git add src/app/main/main.ts; git commit -m "feat: wire Kaka presence runtime"
```

Expected: one commit containing only main-process runtime wiring.

## Task 5: Refresh Development Docs With Final v1 Behavior and Verification

**Files:**
- Modify: `docs/development/kaka-development-guide.md`
- Modify: `docs/development/kaka-compact.md`

- [ ] **Step 1: Run full verification and capture exact summary**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test; npm run build
```

Expected: `npm test` exits 0 and `npm run build` completes `build:renderer`, `build:main`, and `build:preload`. Copy the final Vitest summary lines and build success evidence for the docs.

- [ ] **Step 2: Update the Cyber Life v1 section in the development guide**

In `docs/development/kaka-development-guide.md`, replace the existing presence bullet in the Cyber Life v1 section with these bullets:

```md
  - `presenceService` 现在已经接入运行时：长回复进入 readable 模式时 renderer 通过 `presence:set-activity` 告诉 main，main 会把 `userIsReading` 传给 presence，避免用户读长回复时被主动气泡打断。
  - main 进程会记录连续 `loading` / `thinking` 工作段；超过 90 分钟才允许低频“喝口水”提醒，并且仍受 presence cooldown 限制。
```

In the `最近一次完整验证（2026-06-01）` block, replace the old counts with the exact final counts from Step 1 and keep this build wording if the build succeeded:

```text
Test Files  <exact passed file count from npm test>
Tests       <exact passed test count from npm test>
npm run build: renderer/main/preload passed
```

- [ ] **Step 3: Update the compact with latest commits and next steps**

In `docs/development/kaka-compact.md`, update `## Latest important commit` so the newest entries include these commit subjects in newest-first order after they exist locally:

```md
- `<hash> feat: wire Kaka presence runtime`
- `<hash> feat: report Kaka readable chat activity`
- `<hash> feat: add presence activity bridge`
- `<hash> feat: add Kaka presence runtime`
- `54e456d docs: add kaka cyber life v1 finish design`
```

In `## What is already built`, add this bullet after the renderer capabilities bullet:

```md
- Presence runtime now receives readable long-chat activity from the renderer and treats continuous `loading` / `thinking` over 90 minutes as a long-work care opportunity.
```

In the verification block, replace the old counts with the exact final counts from Step 1:

```text
Test Files <exact passed file count from npm test>
Tests <exact passed test count from npm test>
Build renderer/main/preload passed
```

Replace `## Likely next tasks` with:

```md
## Likely next tasks

1. Review and merge the Cyber Life v1 PR after GitHub checks/review.
2. Start Cyber Life v2 design: richer mood transitions, user-visible memory controls, and relationship/profile UI.
3. Improve MCP connection UX: clearer diagnostics, setup guidance, and stale-connection recovery hints.
4. Add export/clear controls for memory files beyond raw chat history.
5. Consider richer proactive rhythms after v1 proves stable.
```

- [ ] **Step 4: Commit Task 5**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; git add docs/development/kaka-development-guide.md docs/development/kaka-compact.md; git commit -m "docs: update Kaka Cyber Life v1 finish notes"
```

Expected: one docs commit. If docs changed because verification counts were corrected after a rerun, include those corrected counts in this same commit before committing.

## Task 6: Final Verification, Push, and GitHub PR

**Files:**
- No code files expected unless verification reveals an issue.
- Uses GitHub repo: owner `bernis-web`, repo `cline-pet`.

- [ ] **Step 1: Invoke verification discipline before final claims**

Before saying the branch is complete, use the `verification-before-completion` skill. The verification evidence must come from commands run in this task, not from memory.

- [ ] **Step 2: Run final verification**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; npm test; npm run build; git status --short --branch
```

Expected:

- `npm test` exits 0.
- `npm run build` exits 0.
- `git status --short --branch` shows branch `feat/12-state-local-pet-pack` and no tracked-file changes. Untracked `.superpowers/` may remain and must not be committed.

- [ ] **Step 3: Push the feature branch**

Run:

```powershell
Set-Location 'd:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack'; git push origin feat/12-state-local-pet-pack
```

Expected: push succeeds and remote branch updates.

- [ ] **Step 4: Check for an existing PR**

Use GitHub MCP `list_pull_requests` with:

```json
{
  "owner": "bernis-web",
  "repo": "cline-pet",
  "state": "open",
  "head": "bernis-web:feat/12-state-local-pet-pack",
  "base": "main"
}
```

Expected: if an open PR already exists, reuse it and add a comment instead of creating a duplicate.

- [ ] **Step 5: Create the GitHub PR if none exists**

Use GitHub MCP `create_pull_request` with:

```json
{
  "owner": "bernis-web",
  "repo": "cline-pet",
  "base": "main",
  "head": "feat/12-state-local-pet-pack",
  "title": "Cyber Life v1 for Kaka desktop pet",
  "body": "## Summary\n- Adds readable long chat bubbles, local chat history, DeepSeek memory extraction, memory-aware chat coordination, and chat-driven relationship growth.\n- Wires Cyber Life v1 presence finish: readable long replies suppress proactive presence, and continuous loading/thinking over 90 minutes can trigger rare care reminders.\n- Updates Kaka development docs and compact for the next Cyber Life v2 phase.\n\n## Verification\n- npm test\n- npm run build\n\n## Notes\n- `.superpowers/`, local app data, logs, user PNG assets, and API keys are intentionally not committed.\n- Existing jsdom act(...) warnings are known; verification is based on Vitest exit code and pass summary."
}
```

Expected: PR is created successfully and the URL is available for the final report.

- [ ] **Step 6: Final report to user**

Report in Chinese:

- Final commits created in this finish pass.
- Verification evidence from the final run.
- Push status.
- PR URL or existing PR number.
- Recommended Cyber Life v2 starting point.

## Plan Self-Review

- Spec coverage: reading quiet mode is covered by Tasks 2-4; 90-minute work-session timing by Tasks 1 and 4; docs and PR closeout by Tasks 5-6.
- Placeholder scan: dynamic future values are limited to real verification counts, commit hashes created during execution, and PR URL produced by GitHub; each step explains how to obtain them.
- Type consistency: bridge type names, IPC channel `presence:set-activity`, runtime field `userIsReading`, and `workSessionStartedAt` match across tests, renderer, bridge, and main.