# Head Pat Mood Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add natural, non-gameified head-pat interaction that gives immediate `head-pat` visual feedback and records only a lightweight local warmth signal for mood context.

**Architecture:** Renderer owns pointer gesture recognition and temporary visual override because it needs instant feedback and already owns drag/double-click/right-click interaction. Electron main owns durable local relationship warmth, IPC validation, and mood/pose recomputation so private state stays local and renderer never edits memory files directly.

**Tech Stack:** Electron IPC, React, TypeScript, Vitest/jsdom, Node `fs`, existing local JSON relationship memory, existing `PetStatus` state assets and pet pack v3 metadata.

---

## Execution Pre-flight

This worktree currently contains uncommitted renderer / DeepSeek / bridge changes that touch files this feature also needs, especially:

- `src/app/renderer/App.tsx`
- `src/app/renderer/PetView.tsx`
- `src/app/renderer/petBridge.ts`
- `src/app/main/main.ts`

Before executing code tasks, run:

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack status --short
```

Default execution should keep working directly on the current dirty tree and must avoid staging unrelated files. Each commit in this plan uses path-specific `git add`; always run `git diff --staged --stat` before committing so unrelated files are not accidentally included. Separate the existing dirty work first only when explicitly instructed by the user.

The visual companion directory `.superpowers/` was generated during design discussion and must not be committed.

---

## File Structure

### New files

- `src/app/main/interaction/headPatService.ts`
  - Validates and records effective head-pat interactions into relationship memory as `lastHeadPatAt` plus short-lived `recentWarmth`.
- `tests/app/main/headPatService.test.ts`
  - Verifies the non-gameified memory update rules and invalid event handling.
- `tests/app/renderer/petBridge.test.ts`
  - Verifies renderer bridge exposes the new `interaction:head-pat` IPC channel.

### Modified files

- `src/app/main/memory/memoryTypes.ts`
  - Add optional `lastHeadPatAt` and `recentWarmth` fields to `RelationshipMemory`.
- `src/app/main/moodEngine.ts`
  - Let active warmth gently soften negative/calm mood decisions without overriding work/sleep states.
- `src/app/main/poseResolver.ts`
  - Add `activity: "patting"` and map it to `head-pat` before mood-based pose resolution.
- `src/app/main/main.ts`
  - Register `interaction:head-pat` IPC handler, record warmth, and push a refreshed mood-driven status after valid interaction.
- `src/app/renderer/petBridge.ts`
  - Add `HeadPatInteractionInput`, `HeadPatInteractionResponse`, and `reportHeadPatInteraction()`.
- `src/app/renderer/App.tsx`
  - Track temporary local `head-pat` display override and call the new bridge method after effective head-pat.
- `src/app/renderer/PetView.tsx`
  - Replace immediate left-drag start with a small pointer-state machine that distinguishes pending / patting / dragging.
- `tests/app/main/moodEngine.test.ts`
  - Cover active and expired warmth behavior.
- `tests/app/main/poseResolver.test.ts`
  - Cover `patting` activity priority.
- `tests/app/renderer/App.test.ts`
  - Cover head-pat gesture, non-head-pat short press, and drag conflict behavior.

---

### Task 1: Relationship warmth memory and recording service

**Files:**
- Modify: `src/app/main/memory/memoryTypes.ts`
- Create: `src/app/main/interaction/headPatService.ts`
- Test: `tests/app/main/headPatService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/app/main/headPatService.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { recordHeadPatInteraction } from "../../../src/app/main/interaction/headPatService";
import { loadRelationshipMemory, saveRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

describe("head pat interaction service", () => {
  const roots: string[] = [];

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("records a lightweight warmth signal without changing relationship scores", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);
    saveRelationshipMemory(root, (current) => ({
      ...current,
      familiarity: 30,
      affection: 40,
      engagement: 50,
      trust: 60
    }));

    const result = recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.200Z",
      durationMs: 1200
    });

    expect(result.ok).toBe(true);
    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({
      familiarity: 30,
      affection: 40,
      engagement: 50,
      trust: 60,
      lastHeadPatAt: "2026-05-30T04:00:01.200Z",
      recentWarmth: {
        source: "head-pat",
        intensity: "soft",
        updatedAt: "2026-05-30T04:00:01.200Z",
        expiresAt: "2026-05-30T04:30:01.200Z"
      }
    }));
  });

  it("ignores interactions that are too short to be intentional", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);

    const result = recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:00.300Z",
      durationMs: 300
    });

    expect(result).toEqual({ ok: false, errorCode: "HEAD_PAT_TOO_SHORT", message: "head pat duration is too short" });
    expect(loadRelationshipMemory(root).lastHeadPatAt).toBeUndefined();
  });

  it("rate-limits recent event text so repeated head pats do not create a game log", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);

    recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });
    recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T05:00:00.000Z",
      endedAt: "2026-05-30T05:00:01.000Z",
      durationMs: 1000
    });

    const relationship = loadRelationshipMemory(root);
    expect(relationship.recentEvents.filter((event) => event.text === "今天被轻轻摸了摸头")).toHaveLength(1);
    expect(relationship.lastHeadPatAt).toBe("2026-05-30T05:00:01.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/headPatService.test.ts
```

Expected: FAIL because `src/app/main/interaction/headPatService.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Modify `src/app/main/memory/memoryTypes.ts` so `RelationshipMemory` includes warmth fields:

```ts
export type RelationshipWarmth = {
  source: "head-pat" | "chat" | "presence";
  intensity: "soft" | "normal";
  updatedAt: string;
  expiresAt: string;
};

export type RelationshipMemory = {
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  lastInteractionAt?: string;
  lastHeadPatAt?: string;
  recentWarmth?: RelationshipWarmth;
  recentEvents: { text: string; createdAt: string; weight: number }[];
  updatedAt: string;
};
```

Create `src/app/main/interaction/headPatService.ts`:

```ts
import { loadRelationshipMemory, saveRelationshipMemory } from "../memory/relationshipStore.js";
import type { RelationshipMemory } from "../memory/memoryTypes.js";

export type HeadPatInteractionInput = {
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
};

export type HeadPatInteractionResult =
  | { ok: true; relationship: RelationshipMemory }
  | { ok: false; errorCode: "HEAD_PAT_TOO_SHORT" | "HEAD_PAT_INVALID"; message: string };

const MIN_EFFECTIVE_HEAD_PAT_MS = 600;
const MAX_REASONABLE_HEAD_PAT_MS = 30_000;
const WARMTH_TTL_MS = 30 * 60 * 1000;
const HEAD_PAT_EVENT_TEXT = "今天被轻轻摸了摸头";

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasHeadPatEventToday(relationship: RelationshipMemory, endedAt: string) {
  const day = endedAt.slice(0, 10);
  return relationship.recentEvents.some((event) => event.text === HEAD_PAT_EVENT_TEXT && event.createdAt.slice(0, 10) === day);
}

export function recordHeadPatInteraction(root: string, input: HeadPatInteractionInput): HeadPatInteractionResult {
  const durationMs = Number(input.durationMs ?? 0);
  if (!Number.isFinite(durationMs) || durationMs < MIN_EFFECTIVE_HEAD_PAT_MS) {
    return { ok: false, errorCode: "HEAD_PAT_TOO_SHORT", message: "head pat duration is too short" };
  }
  if (durationMs > MAX_REASONABLE_HEAD_PAT_MS) {
    return { ok: false, errorCode: "HEAD_PAT_INVALID", message: "head pat duration is invalid" };
  }

  const endedAtDate = parseDate(input.endedAt) ?? new Date();
  const endedAt = endedAtDate.toISOString();
  const expiresAt = new Date(endedAtDate.getTime() + WARMTH_TTL_MS).toISOString();

  const relationship = saveRelationshipMemory(root, (current) => {
    const recentEvents = hasHeadPatEventToday(current, endedAt)
      ? current.recentEvents
      : [{ text: HEAD_PAT_EVENT_TEXT, createdAt: endedAt, weight: 1 }, ...current.recentEvents].slice(0, 20);

    return {
      ...current,
      lastInteractionAt: endedAt,
      lastHeadPatAt: endedAt,
      recentWarmth: {
        source: "head-pat",
        intensity: "soft",
        updatedAt: endedAt,
        expiresAt
      },
      recentEvents
    };
  });

  return { ok: true, relationship };
}

export function hasActiveWarmth(relationship: RelationshipMemory, now: string) {
  if (!relationship.recentWarmth) return false;
  return new Date(relationship.recentWarmth.expiresAt).getTime() > new Date(now).getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/headPatService.test.ts tests/app/main/relationshipStore.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/memory/memoryTypes.ts src/app/main/interaction/headPatService.ts tests/app/main/headPatService.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack diff --staged --stat
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: record gentle head pat warmth"
```

### Task 2: Mood and pose support for patting activity

**Files:**
- Modify: `src/app/main/moodEngine.ts`
- Modify: `src/app/main/poseResolver.ts`
- Test: `tests/app/main/moodEngine.test.ts`
- Test: `tests/app/main/poseResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/app/main/poseResolver.test.ts`:

```ts
  it("prioritizes active patting over mood-driven pose", () => {
    expect(resolveDisplayedPose({ mood: "upset", activity: "patting", bondStage: "new" })).toEqual({ status: "head-pat" });
  });
```

Append to `tests/app/main/moodEngine.test.ts`:

```ts
  it("uses recent warmth as a gentle calming signal without making it a reward", () => {
    const mood = deriveMoodState({
      now: "2026-05-30T04:10:00.000Z",
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        lastHeadPatAt: "2026-05-30T04:00:00.000Z",
        recentWarmth: {
          source: "head-pat",
          intensity: "soft",
          updatedAt: "2026-05-30T04:00:00.000Z",
          expiresAt: "2026-05-30T04:30:00.000Z"
        },
        recentEvents: [],
        updatedAt: "2026-05-30T04:00:00.000Z"
      },
      hasRecentChat: true,
      lastChatSentiment: "negative",
      memoryHitCount: 0,
      clineVisibleStatus: "idle"
    });

    expect(mood).toEqual({ name: "calm", suggestedStatus: "idle" });
  });

  it("ignores expired warmth", () => {
    const mood = deriveMoodState({
      now: "2026-05-30T05:00:00.000Z",
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        recentWarmth: {
          source: "head-pat",
          intensity: "soft",
          updatedAt: "2026-05-30T04:00:00.000Z",
          expiresAt: "2026-05-30T04:30:00.000Z"
        },
        recentEvents: [],
        updatedAt: "2026-05-30T04:00:00.000Z"
      },
      hasRecentChat: true,
      lastChatSentiment: "negative",
      memoryHitCount: 0,
      clineVisibleStatus: "idle"
    });

    expect(mood).toEqual({ name: "upset", suggestedStatus: "angry" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/poseResolver.test.ts tests/app/main/moodEngine.test.ts
```

Expected: FAIL because `activity: "patting"` is not accepted and warmth does not affect mood yet.

- [ ] **Step 3: Write minimal implementation**

Modify `src/app/main/poseResolver.ts`:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { MoodName } from "./moodEngine.js";

export type PoseActivity = "idle" | "chatting" | "thinking" | "loading" | "message" | "dragging" | "patting";

export function resolveDisplayedPose(input: {
  mood: MoodName;
  activity: PoseActivity;
  bondStage: "new" | "familiar" | "close";
}): { status: PetStatus } {
  if (input.activity === "dragging") return { status: "dragging" };
  if (input.activity === "patting") return { status: "head-pat" };
  if (input.activity === "loading") return { status: "loading" };
  if (input.activity === "thinking") return { status: "thinking" };
  if (input.activity === "message") return { status: "message" };
  if (input.mood === "happy") return { status: "happy" };
  if (input.mood === "attached" && input.bondStage === "close") return { status: "head-pat" };
  if (input.mood === "sleepy") return { status: "sleepy" };
  if (input.mood === "upset") return { status: "angry" };
  if (input.mood === "curious") return { status: "thinking" };
  return { status: "idle" };
}
```

Modify `src/app/main/moodEngine.ts`:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";

export type MoodName = "calm" | "happy" | "attached" | "curious" | "sleepy" | "upset" | "lonely";

export type MoodState = {
  name: MoodName;
  suggestedStatus: PetStatus;
};

function hasActiveWarmth(relationship: RelationshipMemory, now: string) {
  if (!relationship.recentWarmth) return false;
  return new Date(relationship.recentWarmth.expiresAt).getTime() > new Date(now).getTime();
}

export function deriveMoodState(input: {
  now: string;
  relationship: RelationshipMemory;
  hasRecentChat: boolean;
  lastChatSentiment: "positive" | "neutral" | "negative";
  memoryHitCount: number;
  clineVisibleStatus: PetStatus;
}): MoodState {
  const hour = new Date(input.now).getUTCHours();
  const activeWarmth = hasActiveWarmth(input.relationship, input.now);

  if (input.clineVisibleStatus === "loading" || input.clineVisibleStatus === "thinking") {
    return { name: "curious", suggestedStatus: input.clineVisibleStatus };
  }

  if (!input.hasRecentChat && (hour >= 23 || hour < 6)) {
    return { name: "sleepy", suggestedStatus: hour >= 23 ? "sleepy" : "sleeping" };
  }

  if (input.lastChatSentiment === "negative") {
    if (activeWarmth) return { name: "calm", suggestedStatus: "idle" };
    return { name: "upset", suggestedStatus: "angry" };
  }

  if (input.lastChatSentiment === "positive" && input.relationship.affection >= 70) {
    return { name: "happy", suggestedStatus: "happy" };
  }

  if (input.memoryHitCount >= 2 && input.relationship.affection >= 50) {
    return { name: "attached", suggestedStatus: "head-pat" };
  }

  return { name: "calm", suggestedStatus: "idle" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/poseResolver.test.ts tests/app/main/moodEngine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/moodEngine.ts src/app/main/poseResolver.ts tests/app/main/moodEngine.test.ts tests/app/main/poseResolver.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack diff --staged --stat
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add patting pose and warmth mood signal"
```

### Task 3: Renderer bridge and head-pat gesture

**Files:**
- Modify: `src/app/renderer/petBridge.ts`
- Modify: `src/app/renderer/App.tsx`
- Modify: `src/app/renderer/PetView.tsx`
- Test: `tests/app/renderer/petBridge.test.ts`
- Test: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Write the failing bridge test**

Create `tests/app/renderer/petBridge.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createRendererPetBridge } from "../../../src/app/renderer/petBridge";

describe("renderer pet bridge", () => {
  it("reports effective head-pat interactions through IPC", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    const bridge = createRendererPetBridge({ on: vi.fn(), invoke } as any);

    await bridge.reportHeadPatInteraction({
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });

    expect(invoke).toHaveBeenCalledWith("interaction:head-pat", {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });
  });
});
```

- [ ] **Step 2: Add failing renderer gesture tests**

Modify `tests/app/renderer/App.test.ts`:

1. Update the import line:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

2. Add timer cleanup inside `describe("renderer App", () => { ... })`:

```ts
  beforeEach(() => {
    vi.useRealTimers();
  });
```

3. Update existing `afterEach`:

```ts
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete (window as any).clinePet;
  });
```

4. Append these tests:

```ts
  it("shows head-pat while the user gently holds the pet and reports the interaction on release", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T04:00:00.000Z"));
    const reportHeadPatInteraction = vi.fn().mockResolvedValue({ ok: true });
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      reportHeadPatInteraction
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    const stage = document.querySelector(".pet-stage") as HTMLElement;
    await act(async () => {
      stage.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 }));
      vi.advanceTimersByTime(450);
    });

    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/head-pat.png");

    await act(async () => {
      vi.advanceTimersByTime(700);
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, screenX: 102, screenY: 100 }));
      await Promise.resolve();
    });

    expect(reportHeadPatInteraction).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 700 }));
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/idle.png");
  });

  it("does not report a short click as a head pat", async () => {
    vi.useFakeTimers();
    const reportHeadPatInteraction = vi.fn();
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      reportHeadPatInteraction
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    const stage = document.querySelector(".pet-stage") as HTMLElement;
    await act(async () => {
      stage.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 }));
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, screenX: 100, screenY: 100 }));
    });

    expect(reportHeadPatInteraction).not.toHaveBeenCalled();
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/idle.png");
  });

  it("treats large movement as dragging instead of head patting", async () => {
    vi.useFakeTimers();
    const movePetWindowBy = vi.fn();
    const reportHeadPatInteraction = vi.fn();
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      movePetWindowBy,
      reportHeadPatInteraction
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    const stage = document.querySelector(".pet-stage") as HTMLElement;
    await act(async () => {
      stage.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 }));
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, screenX: 120, screenY: 110 }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(movePetWindowBy).toHaveBeenCalledWith(20, 10);
    expect(reportHeadPatInteraction).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/petBridge.test.ts tests/app/renderer/App.test.ts
```

Expected: FAIL because the bridge method and head-pat gesture state do not exist yet.

- [ ] **Step 4: Implement bridge method**

Modify `src/app/renderer/petBridge.ts` by adding types after `ChatResponse`:

```ts
export type HeadPatInteractionInput = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type HeadPatInteractionResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };
```

Extend `IpcLike` with:

```ts
  invoke(channel: "interaction:head-pat", payload: HeadPatInteractionInput): Promise<HeadPatInteractionResponse>;
```

Add this method inside `createRendererPetBridge()`:

```ts
    reportHeadPatInteraction(input: HeadPatInteractionInput) {
      return ipc.invoke("interaction:head-pat", input);
    },
```

- [ ] **Step 5: Implement renderer temporary status and gesture state**

Modify `src/app/renderer/App.tsx`:

1. Extend `window.clinePet` type with:

```ts
      reportHeadPatInteraction?(input: { startedAt: string; endedAt: string; durationMs: number }): Promise<{ ok: true } | { ok: false; errorCode: string; message: string }>;
```

2. Add state after `visibleStatus`:

```ts
  const [temporaryStatus, setTemporaryStatus] = useState<PetStatus | null>(null);
```

3. Add handler before `sendChat`:

```ts
  async function reportHeadPatInteraction(input: { startedAt: string; endedAt: string; durationMs: number }) {
    setTemporaryStatus(null);
    try {
      await window.clinePet?.reportHeadPatInteraction?.(input);
    } catch {
      // Head-pat feedback should remain local even if persistence is unavailable.
    }
  }
```

4. Add display status before `return`:

```ts
  const displayStatus = temporaryStatus ?? visibleStatus;
```

5. Change `PetView` props:

```tsx
        status={displayStatus}
        imageSrc={images[displayStatus] ?? defaultImages.idle}
        onHeadPatStart={() => setTemporaryStatus("head-pat")}
        onHeadPatEnd={reportHeadPatInteraction}
        onHeadPatCancel={() => setTemporaryStatus(null)}
```

Modify `src/app/renderer/PetView.tsx`:

1. Add constants and types near the top:

```ts
const HEAD_PAT_DELAY_MS = 400;
const HEAD_PAT_MIN_DURATION_MS = 600;
const DRAG_THRESHOLD_PX = 10;

type HeadPatInteractionInput = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

type PointerState =
  | { kind: "pending"; startX: number; startY: number; lastX: number; lastY: number; pressedAt: number; timer: number }
  | { kind: "patting"; startX: number; startY: number; lastX: number; lastY: number; patStartedAt: number; startedAtIso: string }
  | { kind: "dragging"; lastX: number; lastY: number };
```

2. Update `PetViewProps` with:

```ts
  onHeadPatStart(): void;
  onHeadPatEnd(input: HeadPatInteractionInput): void;
  onHeadPatCancel(): void;
```

3. Replace `const drag = useRef<DragState | null>(null);` with:

```ts
  const pointer = useRef<PointerState | null>(null);
```

4. Add helpers inside the component:

```ts
  function distanceFromStart(state: { startX: number; startY: number }, event: MouseEvent | ReactMouseEvent) {
    return Math.hypot(event.screenX - state.startX, event.screenY - state.startY);
  }

  function clearPendingTimer() {
    const state = pointer.current;
    if (state?.kind === "pending") window.clearTimeout(state.timer);
  }

  function cancelPointerInteraction() {
    clearPendingTimer();
    pointer.current = null;
    onHeadPatCancel();
  }
```

5. Replace the mousemove/mouseup effect with logic that promotes pending to dragging or finishes patting:

```ts
  useEffect(() => {
    function moveWindow(event: MouseEvent) {
      const state = pointer.current;
      if (!state) return;
      if (event.buttons === 0) {
        finishPointerInteraction();
        return;
      }

      if (state.kind === "pending") {
        if (distanceFromStart(state, event) < DRAG_THRESHOLD_PX) return;
        window.clearTimeout(state.timer);
        pointer.current = { kind: "dragging", lastX: state.lastX, lastY: state.lastY };
      }

      const active = pointer.current;
      if (!active) return;
      if (active.kind === "dragging") {
        const dx = event.screenX - active.lastX;
        const dy = event.screenY - active.lastY;
        pointer.current = { kind: "dragging", lastX: event.screenX, lastY: event.screenY };
        if (dx || dy) onMoveWindowBy(dx, dy);
      } else if (active.kind === "patting") {
        pointer.current = { ...active, lastX: event.screenX, lastY: event.screenY };
      }
    }

    function finishPointerInteraction() {
      const state = pointer.current;
      if (!state) return;
      clearPendingTimer();
      pointer.current = null;
      if (state.kind !== "patting") {
        onHeadPatCancel();
        return;
      }

      const endedAt = new Date();
      const durationMs = endedAt.getTime() - state.patStartedAt;
      onHeadPatCancel();
      if (durationMs >= HEAD_PAT_MIN_DURATION_MS) {
        onHeadPatEnd({ startedAt: state.startedAtIso, endedAt: endedAt.toISOString(), durationMs });
      }
    }

    window.addEventListener("mousemove", moveWindow);
    window.addEventListener("mouseup", finishPointerInteraction);
    return () => {
      window.removeEventListener("mousemove", moveWindow);
      window.removeEventListener("mouseup", finishPointerInteraction);
    };
  }, [onHeadPatCancel, onHeadPatEnd, onMoveWindowBy]);
```

6. Replace `startDragging` with:

```ts
  function startPointerInteraction(event: ReactMouseEvent) {
    if (event.button !== 0) return;
    clearPendingTimer();
    const startX = event.screenX;
    const startY = event.screenY;
    const timer = window.setTimeout(() => {
      const state = pointer.current;
      if (!state || state.kind !== "pending") return;
      const now = new Date();
      pointer.current = {
        kind: "patting",
        startX: state.startX,
        startY: state.startY,
        lastX: state.lastX,
        lastY: state.lastY,
        patStartedAt: now.getTime(),
        startedAtIso: now.toISOString()
      };
      onHeadPatStart();
    }, HEAD_PAT_DELAY_MS);

    pointer.current = { kind: "pending", startX, startY, lastX: startX, lastY: startY, pressedAt: Date.now(), timer };
  }
```

7. Change the stage handler:

```tsx
      <section className="pet-stage" onMouseDown={startPointerInteraction} onDoubleClick={onStartChat} onContextMenu={openSettings} title="拖动移动，长按轻摸，双击聊天，右键设置">
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/petBridge.test.ts tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/renderer/petBridge.ts src/app/renderer/App.tsx src/app/renderer/PetView.tsx tests/app/renderer/petBridge.test.ts tests/app/renderer/App.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack diff --staged --stat
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add renderer head pat gesture"
```

### Task 4: Main-process IPC integration

**Files:**
- Modify: `src/app/main/main.ts`
- Test: `tests/app/main/headPatService.test.ts`
- Test: `tests/app/renderer/petBridge.test.ts`

- [ ] **Step 1: Write the integration expectation into existing service tests**

Append this test to `tests/app/main/headPatService.test.ts` to lock the response shape used by main IPC:

```ts
  it("returns a compact success response shape usable by IPC handlers", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);

    const result = recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });

    expect(result).toEqual({
      ok: true,
      relationship: expect.objectContaining({
        lastHeadPatAt: "2026-05-30T04:00:01.000Z",
        recentWarmth: expect.objectContaining({ source: "head-pat", intensity: "soft" })
      })
    });
  });
```

- [ ] **Step 2: Run targeted tests before main edit**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/headPatService.test.ts tests/app/renderer/petBridge.test.ts
```

Expected: PASS. These tests protect the two sides of the IPC contract before wiring `main.ts`.

- [ ] **Step 3: Implement IPC handler**

Modify imports in `src/app/main/main.ts`:

```ts
import { recordHeadPatInteraction, type HeadPatInteractionInput } from "./interaction/headPatService.js";
```

Add this handler after `ipcMain.handle("window:move-by", ...)`:

```ts
  ipcMain.handle("interaction:head-pat", (_event, payload: HeadPatInteractionInput) => {
    const result = recordHeadPatInteraction(appDataBaseDir, payload ?? {});
    if (!result.ok) return result;

    const now = new Date().toISOString();
    const mood = deriveMoodState({
      now,
      relationship: result.relationship,
      hasRecentChat: true,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: latestStatus.visibleStatus
    });

    notifyRenderer(win, {
      status: mood.suggestedStatus,
      visibleStatus: mood.suggestedStatus,
      baseStatus: mood.suggestedStatus,
      overlayStatus: null,
      task: "",
      source: "interaction",
      updatedAt: now
    });

    return { ok: true };
  });
```

- [ ] **Step 4: Run build to verify TypeScript and preload compile**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack run build
```

Expected: PASS. This catches IPC type and Electron main compilation errors.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/headPatService.test.ts tests/app/main/moodEngine.test.ts tests/app/main/poseResolver.test.ts tests/app/renderer/petBridge.test.ts tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/main.ts tests/app/main/headPatService.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack diff --staged --stat
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: wire head pat interaction ipc"
```

### Task 5: Final verification and documentation touch-up

**Files:**
- Modify: `README.md`
- Verify: all changed source and test files

- [ ] **Step 1: Add a short user-facing interaction note to README**

Modify the existing `## 使用方式补充` section in `README.md` so the interaction bullets read exactly:

```md
## 使用方式补充

- 双击卡卡可以打开或关闭聊天输入。
- 聊天输入框留空一段时间会自动关闭，也可以按 Esc 或再次双击卡卡关闭。
- 按住卡卡拖动可以移动桌宠位置。
- 轻轻按住卡卡约半秒且不大幅移动，可以触发摸头反应；摸头不会显示分数或奖励，只会作为本地的短期陪伴感信号。
- 右键卡卡可以打开 DeepSeek 设置。
- Cline 工作状态会以气泡方式提醒，不再常驻底部面板。
- DeepSeek 回复也会通过气泡显示在卡卡附近。
```

- [ ] **Step 2: Run full tests**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test
```

Expected: PASS with all test files passing. React/jsdom may still print existing `act(...)` environment warnings; warnings are acceptable only if Vitest exits successfully.

- [ ] **Step 3: Run full build**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack run build
```

Expected: PASS.

- [ ] **Step 4: Review git status**

Run:

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack status --short
```

Expected: only intentionally retained pre-existing changes remain, plus no `.superpowers/` files staged. If `.superpowers/` appears as untracked, leave it uncommitted.

- [ ] **Step 5: Commit README docs**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add README.md
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack diff --staged --stat
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "docs: describe head pat interaction"
```

---

## Self-Review Notes

- Spec coverage: gesture recognition, immediate `head-pat`, non-gameified warmth memory, mood influence, pose priority, IPC failure tolerance, and tests are covered by Tasks 1-5.
- Placeholder scan: the plan avoids placeholder text and unspecified “add tests” steps; each task includes commands and expected results.
- Type consistency: `HeadPatInteractionInput`, `recentWarmth`, `activity: "patting"`, and `reportHeadPatInteraction()` are introduced before later tasks reference them.