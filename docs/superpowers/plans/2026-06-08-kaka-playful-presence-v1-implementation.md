# Kaka Playful Presence v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight playful-presence layer so Kaka feels more alive after chat and head-pat interactions, stays low-noise at night, remains quiet during work, and emits conservative idle check-ins without changing the 12-status asset protocol.

**Architecture:** Persist two short-lived playful windows on `RelationshipMemory`, then consume them in two pure places: `moodEngine.ts` for daytime happy bias and `playfulPresence.ts` for low-frequency idle pulses. Keep orchestration simple by having `presenceService.ts` map playful decisions into `UpdatePetStatusInput` while preserving the existing long-work care reminder and lonely fallback.

**Tech Stack:** Electron main process, TypeScript, Vitest, local JSON relationship store, existing `UpdatePetStatusInput` status pipeline.

---

## File Structure

- Modify `cline-desktop-pet/src/app/main/memory/memoryTypes.ts`
  - Add optional short-lived playful window fields to `RelationshipMemory`.
- Modify `cline-desktop-pet/src/app/main/memory/relationshipEvents.ts`
  - Open a short playful chat window for normal chat turns.
- Modify `cline-desktop-pet/src/app/main/interaction/headPatService.ts`
  - Open a short attached window after a valid head-pat.
- Modify `cline-desktop-pet/tests/app/main/relationshipEvents.test.ts`
  - Cover chat-window creation and focused-work non-creation.
- Modify `cline-desktop-pet/tests/app/main/headPatService.test.ts`
  - Assert `playfulAttachedUntil` is persisted with head-pat success.
- Modify `cline-desktop-pet/tests/app/main/chatCoordinator.test.ts`
  - Assert the real chat flow persists `playfulChatUntil`.
- Modify `cline-desktop-pet/src/app/main/moodEngine.ts`
  - Bias daytime idle mood toward `happy` when a playful window is active, without overriding work or night behavior.
- Modify `cline-desktop-pet/tests/app/main/moodEngine.test.ts`
  - Cover active playful windows, night override, and existing priority order.
- Create `cline-desktop-pet/src/app/main/playfulPresence.ts`
  - Add the pure rule module for low-frequency playful pulses.
- Create `cline-desktop-pet/tests/app/main/playfulPresence.test.ts`
  - Cover chat follow-up, attached follow-up, night quieting, work silence, reading silence, cooldown, and idle check-in.
- Modify `cline-desktop-pet/src/app/main/presenceService.ts`
  - Convert a `PlayfulPresenceDecision` into `UpdatePetStatusInput` while keeping long-work and lonely behavior intact.
- Modify `cline-desktop-pet/tests/app/main/presenceService.test.ts`
  - Verify playful decisions become presence payloads and do not replace the long-work reminder.
- Modify `cline-desktop-pet/src/app/main/main.ts`
  - Load `relationship` once per presence tick and pass it into `maybeCreatePresencePulse()`.
- Modify `cline-desktop-pet/docs/development/kaka-development-guide.md`
  - Document playful windows and the new `playfulPresence.ts` rule path after implementation is verified.
- Modify `cline-desktop-pet/docs/development/kaka-compact.md`
  - Update the “already built” summary and next tasks after implementation is verified.

---

### Task 1: Persist short-lived playful windows in relationship memory

**Files:**
- Modify: `cline-desktop-pet/tests/app/main/relationshipEvents.test.ts`
- Modify: `cline-desktop-pet/tests/app/main/headPatService.test.ts`
- Modify: `cline-desktop-pet/tests/app/main/chatCoordinator.test.ts`
- Modify: `cline-desktop-pet/src/app/main/memory/memoryTypes.ts`
- Modify: `cline-desktop-pet/src/app/main/memory/relationshipEvents.ts`
- Modify: `cline-desktop-pet/src/app/main/interaction/headPatService.ts`

- [ ] **Step 1: Write the failing persistence tests**

Append these tests to `tests/app/main/relationshipEvents.test.ts`:

```ts
  it("opens a short playful chat window after a normal chat turn", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T04:00:00.000Z",
      sentiment: "positive",
      relationshipEvent: "chat"
    });

    expect(updated.playfulChatUntil).toBe("2026-06-01T04:15:00.000Z");
  });

  it("does not open a playful chat window for focused work-session turns", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T04:00:00.000Z",
      sentiment: "focused",
      relationshipEvent: "work-session"
    });

    expect(updated.playfulChatUntil).toBeUndefined();
  });
```

Update the first success assertion in `tests/app/main/headPatService.test.ts` so it also expects the attached window:

```ts
    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({
      familiarity: 30,
      affection: 40,
      engagement: 50,
      trust: 60,
      lastHeadPatAt: "2026-05-30T04:00:01.200Z",
      playfulAttachedUntil: "2026-05-30T04:30:01.200Z",
      recentWarmth: {
        source: "head-pat",
        intensity: "soft",
        updatedAt: "2026-05-30T04:00:01.200Z",
        expiresAt: "2026-05-30T04:30:01.200Z"
      }
    }));
```

Update `tests/app/main/chatCoordinator.test.ts` to import `loadRelationshipMemory` and assert the real chat flow persists the window:

```ts
import { loadRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";
```

```ts
    expect(loadRelationshipMemory(root).playfulChatUntil).toBe("2026-06-01T04:15:00.000Z");
```

- [ ] **Step 2: Run the focused persistence tests and verify they fail**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet
npm test -- tests/app/main/relationshipEvents.test.ts tests/app/main/headPatService.test.ts tests/app/main/chatCoordinator.test.ts
```

Expected: FAIL because `RelationshipMemory` does not expose `playfulChatUntil` / `playfulAttachedUntil`, and the writers do not persist them yet.

- [ ] **Step 3: Implement the short-lived relationship windows**

Update `src/app/main/memory/memoryTypes.ts` so `RelationshipMemory` includes the new optional timestamps:

```ts
export type RelationshipMemory = {
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  lastInteractionAt?: string;
  lastHeadPatAt?: string;
  recentWarmth?: RelationshipWarmth;
  playfulChatUntil?: string;
  playfulAttachedUntil?: string;
  recentEvents: { text: string; createdAt: string; weight: number }[];
  updatedAt: string;
};
```

Update `src/app/main/memory/relationshipEvents.ts` to open a short chat window only for normal chat turns:

```ts
const PLAYFUL_CHAT_WINDOW_MS = 15 * 60 * 1000;

function shouldOpenPlayfulChatWindow(input: {
  sentiment: MemoryExtractionSentiment;
  relationshipEvent: RelationshipEventKind;
}) {
  return input.relationshipEvent === "chat" && input.sentiment !== "focused";
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
    const playfulChatUntil = shouldOpenPlayfulChatWindow(input)
      ? new Date(new Date(input.now).getTime() + PLAYFUL_CHAT_WINDOW_MS).toISOString()
      : current.playfulChatUntil;

    return {
      ...current,
      familiarity: current.familiarity + normalChat,
      affection: current.affection + (supportive ? 1 : 0),
      engagement: current.engagement + (work ? 2 : normalChat),
      trust: current.trust + (supportive ? 1 : 0),
      lastInteractionAt: input.now,
      playfulChatUntil,
      recentEvents
    };
  });
}
```

Update `src/app/main/interaction/headPatService.ts` so a valid head-pat also opens the attached window:

```ts
const PLAYFUL_ATTACHED_WINDOW_MS = 30 * 60 * 1000;

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
  const playfulAttachedUntil = new Date(endedAtDate.getTime() + PLAYFUL_ATTACHED_WINDOW_MS).toISOString();

  const relationship = saveRelationshipMemory(root, (current) => {
    const recentEvents = hasHeadPatEventToday(current, endedAt)
      ? current.recentEvents
      : [{ text: HEAD_PAT_EVENT_TEXT, createdAt: endedAt, weight: 1 }, ...current.recentEvents].slice(0, 20);

    return {
      ...current,
      lastInteractionAt: endedAt,
      lastHeadPatAt: endedAt,
      playfulAttachedUntil,
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
```

- [ ] **Step 4: Run the focused persistence tests and verify they pass**

Run:

```powershell
npm test -- tests/app/main/relationshipEvents.test.ts tests/app/main/headPatService.test.ts tests/app/main/chatCoordinator.test.ts
```

Expected: PASS for all three files, with the chat flow persisting `playfulChatUntil` and the head-pat flow persisting `playfulAttachedUntil`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/relationshipEvents.test.ts tests/app/main/headPatService.test.ts tests/app/main/chatCoordinator.test.ts src/app/main/memory/memoryTypes.ts src/app/main/memory/relationshipEvents.ts src/app/main/interaction/headPatService.ts
git commit -m "feat: persist playful relationship windows"
```

---

### Task 2: Teach the mood engine to respect active playful windows

**Files:**
- Modify: `cline-desktop-pet/tests/app/main/moodEngine.test.ts`
- Modify: `cline-desktop-pet/src/app/main/moodEngine.ts`

- [ ] **Step 1: Write the failing mood tests**

Append these tests to `tests/app/main/moodEngine.test.ts`:

```ts
  it("leans happy during an active attached window when the user is idle in daytime", () => {
    const mood = deriveMoodState({
      now: "2026-06-01T15:00:00.000Z",
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        playfulAttachedUntil: "2026-06-01T15:30:00.000Z",
        recentEvents: [],
        updatedAt: "2026-06-01T14:55:00.000Z"
      },
      hasRecentChat: false,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: "idle"
    });

    expect(mood).toEqual({ name: "happy", suggestedStatus: "happy" });
  });

  it("keeps night-time sleepy behavior even if a playful chat window is active", () => {
    const mood = deriveMoodState({
      now: "2026-05-29T23:30:00.000Z",
      relationship: {
        familiarity: 20,
        affection: 20,
        engagement: 15,
        trust: 20,
        playfulChatUntil: "2026-05-29T23:45:00.000Z",
        recentEvents: [],
        updatedAt: "2026-05-29T23:00:00.000Z"
      },
      hasRecentChat: false,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: "idle"
    });

    expect(mood.name).toBe("sleepy");
  });
```

- [ ] **Step 2: Run the focused mood test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet
npm test -- tests/app/main/moodEngine.test.ts
```

Expected: FAIL because active playful windows do not influence `deriveMoodState()` yet.

- [ ] **Step 3: Implement the playful-window mood bias**

Update `src/app/main/moodEngine.ts` with a reusable active-window helper and a late-daytime happy bias:

```ts
function hasActivePlayfulWindow(until: string | undefined, now: string) {
  if (!until) return false;
  return new Date(until).getTime() > new Date(now).getTime();
}

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
  const activePlayfulChat = hasActivePlayfulWindow(input.relationship.playfulChatUntil, input.now);
  const activePlayfulAttached = hasActivePlayfulWindow(input.relationship.playfulAttachedUntil, input.now);

  if (input.clineVisibleStatus === "loading" || input.clineVisibleStatus === "thinking") {
    return { name: "curious", suggestedStatus: input.clineVisibleStatus };
  }

  if (input.lastChatSentiment === "stressed") {
    return { name: "calm", suggestedStatus: "idle" };
  }

  if (input.lastChatSentiment === "focused" && input.hasRecentChat) {
    return { name: "curious", suggestedStatus: "thinking" };
  }

  if (!input.hasRecentChat && (hour >= 23 || hour < 6)) {
    return { name: "sleepy", suggestedStatus: hour >= 23 ? "sleepy" : "sleeping" };
  }

  if (input.lastChatSentiment === "negative") {
    if (activeWarmth) {
      return { name: "calm", suggestedStatus: "idle" };
    }
    return { name: "upset", suggestedStatus: "angry" };
  }

  if (input.lastChatSentiment === "positive" && input.hasRecentChat) {
    return { name: "happy", suggestedStatus: "happy" };
  }

  if (input.lastChatSentiment === "tired") {
    return { name: "sleepy", suggestedStatus: "sleepy" };
  }

  if (activePlayfulChat || activePlayfulAttached) {
    return { name: "happy", suggestedStatus: "happy" };
  }

  if (input.memoryHitCount >= 2 && input.relationship.affection >= 50) {
    return { name: "attached", suggestedStatus: "head-pat" };
  }

  return { name: "calm", suggestedStatus: "idle" };
}
```

- [ ] **Step 4: Run the focused mood test and verify it passes**

Run:

```powershell
npm test -- tests/app/main/moodEngine.test.ts
```

Expected: PASS, with work and night precedence preserved while daytime idle windows bias toward `happy`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/moodEngine.test.ts src/app/main/moodEngine.ts
git commit -m "feat: bias mood from playful windows"
```

---

### Task 3: Add the pure playful presence rule module

**Files:**
- Create: `cline-desktop-pet/tests/app/main/playfulPresence.test.ts`
- Create: `cline-desktop-pet/src/app/main/playfulPresence.ts`

- [ ] **Step 1: Write the failing playful-presence tests**

Create `tests/app/main/playfulPresence.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { decidePlayfulPresence } from "../../../src/app/main/playfulPresence";

const relationship = {
  familiarity: 10,
  affection: 10,
  engagement: 10,
  trust: 10,
  recentEvents: [],
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("playfulPresence", () => {
  it("prefers a happy follow-up after a recent chat window", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "happy",
      message: "刚刚和你聊天我很开心，还想继续陪你。"
    });
  });

  it("prefers a clingy follow-up after a recent head-pat window", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulAttachedUntil: "2026-06-01T15:30:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "要不要再摸摸我呀？我会乖一点。"
    });
  });

  it("uses a sleepy line at night instead of a lively one", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T23:30:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T23:45:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "sleepy",
      message: "我还在喔，晚一点要不要一起休息？"
    });
  });

  it("stays quiet while reading, busy, or inside cooldown", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle",
      userIsReading: true
    })).toBeNull();

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "loading"
    })).toBeNull();

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      lastPresenceAt: "2026-06-01T14:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle"
    })).toBeNull();
  });

  it("can emit a low-frequency idle check-in after long inactivity", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, lastInteractionAt: "2026-06-01T08:00:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "我在这里等你，想理我了就叫我。"
    });
  });
});
```

- [ ] **Step 2: Run the new rule test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet
npm test -- tests/app/main/playfulPresence.test.ts
```

Expected: FAIL because `src/app/main/playfulPresence.ts` does not exist yet.

- [ ] **Step 3: Implement the pure rule module**

Create `src/app/main/playfulPresence.ts` with this content:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";

export type PlayfulPresenceDecision = {
  status: Extract<PetStatus, "happy" | "message" | "sleepy">;
  message: string;
};

const PRESENCE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const IDLE_CHECKIN_MS = 6 * 60 * 60 * 1000;

function timestampMs(value?: string) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hasActiveWindow(until: string | undefined, now: string) {
  const untilMs = timestampMs(until);
  const nowMs = timestampMs(now);
  if (untilMs === null || nowMs === null) return false;
  return untilMs > nowMs;
}

function isNightHour(now: string) {
  const hour = new Date(now).getUTCHours();
  return hour >= 23 || hour < 6;
}

function isBusyStatus(status: PetStatus) {
  return status === "loading" || status === "thinking" || status === "message";
}

function inCooldown(lastPresenceAt: string | undefined, now: string) {
  const lastMs = timestampMs(lastPresenceAt);
  const nowMs = timestampMs(now);
  if (lastMs === null || nowMs === null) return false;
  return nowMs - lastMs < PRESENCE_COOLDOWN_MS;
}

function hasBeenIdleLongEnough(lastInteractionAt: string | undefined, now: string) {
  const lastMs = timestampMs(lastInteractionAt);
  const nowMs = timestampMs(now);
  if (lastMs === null || nowMs === null) return false;
  return nowMs - lastMs >= IDLE_CHECKIN_MS;
}

export function decidePlayfulPresence(input: {
  now: string;
  relationship: RelationshipMemory;
  latestVisibleStatus: PetStatus;
  userIsReading?: boolean;
  longWorkSession?: boolean;
  lastPresenceAt?: string;
}): PlayfulPresenceDecision | null {
  if (input.userIsReading || input.longWorkSession) {
    return null;
  }

  if (isBusyStatus(input.latestVisibleStatus)) {
    return null;
  }

  if (inCooldown(input.lastPresenceAt, input.now)) {
    return null;
  }

  const activeChat = hasActiveWindow(input.relationship.playfulChatUntil, input.now);
  const activeAttached = hasActiveWindow(input.relationship.playfulAttachedUntil, input.now);

  if (isNightHour(input.now)) {
    if (activeChat || activeAttached) {
      return { status: "sleepy", message: "我还在喔，晚一点要不要一起休息？" };
    }
    return null;
  }

  if (activeAttached) {
    return { status: "message", message: "要不要再摸摸我呀？我会乖一点。" };
  }

  if (activeChat) {
    return { status: "happy", message: "刚刚和你聊天我很开心，还想继续陪你。" };
  }

  if (hasBeenIdleLongEnough(input.relationship.lastInteractionAt, input.now)) {
    return { status: "message", message: "我在这里等你，想理我了就叫我。" };
  }

  return null;
}
```

- [ ] **Step 4: Run the new rule test and verify it passes**

Run:

```powershell
npm test -- tests/app/main/playfulPresence.test.ts
```

Expected: PASS for `playfulPresence.test.ts`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/playfulPresence.test.ts src/app/main/playfulPresence.ts
git commit -m "feat: add playful presence rules"
```

---

### Task 4: Integrate playful presence into the existing presence pipeline

**Files:**
- Modify: `cline-desktop-pet/tests/app/main/presenceService.test.ts`
- Modify: `cline-desktop-pet/src/app/main/presenceService.ts`
- Modify: `cline-desktop-pet/src/app/main/main.ts`

- [ ] **Step 1: Write the failing presence integration tests**

Append these tests to `tests/app/main/presenceService.test.ts`:

```ts
  it("maps a playful chat decision into a presence payload", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T15:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "idle",
      mood: "calm",
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        playfulChatUntil: "2026-06-01T15:15:00.000Z",
        recentEvents: [],
        updatedAt: "2026-06-01T14:50:00.000Z"
      }
    });

    expect(pulse).toEqual(expect.objectContaining({
      status: "happy",
      visibleStatus: "happy",
      source: "presence",
      message: "刚刚和你聊天我很开心，还想继续陪你。"
    }));
  });

  it("keeps the long-work reminder ahead of playful follow-ups", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T21:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "loading",
      mood: "curious",
      longWorkSession: true,
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        playfulChatUntil: "2026-06-01T21:15:00.000Z",
        recentEvents: [],
        updatedAt: "2026-06-01T20:50:00.000Z"
      }
    });

    expect(pulse?.message).toContain("喝口水");
  });
```

- [ ] **Step 2: Run the focused presence integration test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet
npm test -- tests/app/main/presenceService.test.ts
```

Expected: FAIL because `maybeCreatePresencePulse()` does not consume `relationship` or `decidePlayfulPresence()` yet.

- [ ] **Step 3: Wire the playful rule into presenceService and main.ts**

Update `src/app/main/presenceService.ts` to accept `relationship` and map a playful decision into an `UpdatePetStatusInput` before the lonely fallback:

```ts
import type { RelationshipMemory } from "./memory/memoryTypes.js";
import { decidePlayfulPresence } from "./playfulPresence.js";

export function maybeCreatePresencePulse(input: {
  now: string;
  lastPresenceAt?: string;
  latestVisibleStatus: PetStatus;
  mood: MoodName;
  relationship?: RelationshipMemory;
  userIsReading?: boolean;
  longWorkSession?: boolean;
}): UpdatePetStatusInput | null {
  const nowMs = new Date(input.now).getTime();
  const lastPresenceMs = input.lastPresenceAt ? new Date(input.lastPresenceAt).getTime() : 0;
  const cooldownMs = 4 * 60 * 60 * 1000;

  if (input.userIsReading) {
    return null;
  }

  if (input.longWorkSession) {
    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: "要不要喝口水？我会乖乖等你。",
      source: "presence",
      updatedAt: input.now
    };
  }

  if (input.relationship) {
    const playful = decidePlayfulPresence({
      now: input.now,
      relationship: input.relationship,
      latestVisibleStatus: input.latestVisibleStatus,
      userIsReading: input.userIsReading,
      longWorkSession: input.longWorkSession,
      lastPresenceAt: input.lastPresenceAt
    });

    if (playful) {
      return {
        status: playful.status,
        visibleStatus: playful.status,
        baseStatus: playful.status,
        overlayStatus: null,
        task: "",
        message: playful.message,
        source: "presence",
        updatedAt: input.now
      };
    }
  }

  if ((input.latestVisibleStatus === "loading" || input.latestVisibleStatus === "thinking") && !input.longWorkSession) {
    return null;
  }

  if (lastPresenceMs && nowMs - lastPresenceMs < cooldownMs) {
    return null;
  }

  if (input.mood === "lonely") {
    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: "我会安静陪在你旁边。",
      source: "presence",
      updatedAt: input.now
    };
  }

  return null;
}
```

Update the presence tick in `src/app/main/main.ts` so it loads `relationship` once and passes it into both the mood and presence decisions:

```ts
  const presenceInterval = setInterval(() => {
    const now = new Date().toISOString();
    const relationship = loadRelationshipMemory(appDataBaseDir);
    const mood = deriveMoodState({
      now,
      relationship,
      hasRecentChat: false,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: latestStatus.visibleStatus
    });

    const pulse = maybeCreatePresencePulse({
      now,
      lastPresenceAt,
      latestVisibleStatus: latestStatus.visibleStatus,
      mood: mood.name,
      relationship,
      userIsReading: presenceRuntime.userIsReading,
      longWorkSession: hasLongWorkSession(presenceRuntime, { now })
    });

    if (pulse) {
      lastPresenceAt = pulse.updatedAt;
      notifyRenderer(win, pulse);
    }
  }, 60_000);
```

- [ ] **Step 4: Run the focused presence integration test and verify it passes**

Run:

```powershell
npm test -- tests/app/main/presenceService.test.ts
```

Expected: PASS, with playful follow-ups converted into status payloads and the long-work reminder still winning during focused work.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/presenceService.test.ts src/app/main/presenceService.ts src/app/main/main.ts
git commit -m "feat: wire playful presence into idle pulses"
```

---

### Task 5: Verify the whole feature and update handoff docs

**Files:**
- Modify: `cline-desktop-pet/docs/development/kaka-development-guide.md`
- Modify: `cline-desktop-pet/docs/development/kaka-compact.md`

- [ ] **Step 1: Update the development guide and compact**

Append this summary to the behavior section in `docs/development/kaka-development-guide.md`:

```md
- `RelationshipMemory.playfulChatUntil` 和 `playfulAttachedUntil` 代表短期灵动窗口，不属于长期关系分值。
- `src/app/main/playfulPresence.ts` 负责聊天后开心跟随、摸头后黏人跟随、夜间收敛、工作静默和低频空闲轻气泡。
- `presenceService.ts` 先处理长时间工作提醒，再映射 playful decision，最后才回退到原有 lonely 提示。
```

Update `docs/development/kaka-compact.md` so “What is already built” includes:

```md
- Playful Presence v1: short-lived `playfulChatUntil` / `playfulAttachedUntil` windows now drive a happy daytime mood bias plus low-frequency follow-up bubbles after chat, head-pat, and long idle periods, while keeping night-time and work-session quiet rules intact.
```

Replace the first likely-next-task bullet with:

```md
1. Consider whether Playful Presence v1 should grow into a fuller state machine with more relationship-stage-specific lines.
```

- [ ] **Step 2: Run the targeted regression suite**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet
npm test -- tests/app/main/relationshipEvents.test.ts tests/app/main/headPatService.test.ts tests/app/main/chatCoordinator.test.ts tests/app/main/moodEngine.test.ts tests/app/main/playfulPresence.test.ts tests/app/main/presenceService.test.ts
```

Expected: PASS for all targeted files.

- [ ] **Step 3: Run the full verification suite**

Run:

```powershell
npm test
npm run build
```

Expected: all Vitest files pass and renderer/main/preload builds succeed.

- [ ] **Step 4: Commit the completed feature**

Run:

```powershell
git add docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "feat: add playful presence v1"
```

---

## Coverage Self-Check

- Chat afterglow: covered by Task 1 persistence, Task 2 mood bias, Task 3 pulse rules, and Task 4 presence mapping.
- Head-pat clingy window: covered by Task 1 persistence, Task 2 mood bias, and Task 3 pulse rules.
- Idle low-frequency check-ins: covered by Task 3 pure-rule tests and Task 4 presence mapping.
- Night-time quieting: covered by Task 2 night override and Task 3 sleepy pulse rule.
- Work silence / long-work care: preserved by Task 4 integration tests and existing long-work path.
- No new status protocol / no new persistence store: enforced by File Structure and Tasks 1-4.
