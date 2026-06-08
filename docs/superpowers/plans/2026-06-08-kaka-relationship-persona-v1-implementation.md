# Kaka Relationship Persona v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kaka’s relationship growth feel visible by introducing a stage-based persona layer that changes chat tone, proactive bubble tone, comfort/reminder wording, and lightweight stage copy without changing the underlying relationship scoring model.

**Architecture:** Add one shared `relationshipPersona` profile module keyed by `new/familiar/close/trusted`, then consume it from three places: prompt construction for `chatService`, phrase selection for `playfulPresence` / `presenceService`, and relationship copy generation for overview consumers. Keep the data model stable by reusing the existing relationship stage derivation instead of introducing a new persistence structure.

**Tech Stack:** Electron main process, TypeScript, Vitest, React renderer, local JSON relationship memory, DeepSeek chat prompt composition.

---

## File Structure

- Create `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/relationshipPersona.ts`
  - Centralize stage-based persona rules for chat, proactive bubbles, comfort, reminders, and relationship copy.
- Create `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/relationshipPersona.test.ts`
  - Cover stage-specific differences and trusted-stage boundary rules.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/memory/memoryService.ts`
  - Enrich `relationshipSummary` with the derived stage so chat prompt composition can consume it.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/memoryService.test.ts`
  - Verify the prompt context includes the derived relationship stage.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/chatService.ts`
  - Build the system prompt from the shared persona profile plus current stage metadata.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/chatService.test.ts`
  - Assert stage-persona instructions are injected and privacy boundaries remain present.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/playfulPresence.ts`
  - Route proactive chat / attached / support / idle lines through the shared persona profile.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/playfulPresence.test.ts`
  - Verify different stages yield different wording while respecting the same trigger rules.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/presenceService.ts`
  - Personalize long-work reminder and lonely fallback copy by stage.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/presenceService.test.ts`
  - Assert long-work and loneliness copy changes by stage but keeps the same precedence rules.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/memory/memoryManagementService.ts`
  - Generate warmer stage labels / descriptions from the shared persona profile instead of hardcoded strings.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/memoryManagementService.test.ts`
  - Verify the overview still derives the same stage but returns warmer copy.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/renderer/PrivacyPanel.tsx`
  - Update stage notes so the visible relationship card reflects the new persona framing.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/renderer/PrivacyPanel.test.ts`
  - Verify the refreshed stage notes render and remain non-numeric.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/docs/development/kaka-development-guide.md`
  - Document the new `relationshipPersona.ts` layer and where it plugs into chat/presence/overview copy.
- Modify `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/docs/development/kaka-compact.md`
  - Add the new relationship persona layer to the built-features summary and next steps.

---

### Task 1: Create the shared relationship persona profile module

**Files:**
- Create: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/relationshipPersona.test.ts`
- Create: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/relationshipPersona.ts`

- [ ] **Step 1: Write the failing persona profile tests**

Create `tests/app/main/relationshipPersona.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { getRelationshipPersona } from "../../../src/app/main/relationshipPersona";

describe("relationshipPersona", () => {
  it("returns progressively closer chat guidance across stages", () => {
    expect(getRelationshipPersona("new").chatStyle).toContain("礼貌");
    expect(getRelationshipPersona("familiar").chatStyle).toContain("自然");
    expect(getRelationshipPersona("close").chatStyle).toContain("贴近");
    expect(getRelationshipPersona("trusted").chatStyle).toContain("稳定地主动关心");
  });

  it("keeps trusted stage close but still within privacy boundaries", () => {
    const trusted = getRelationshipPersona("trusted");

    expect(trusted.chatStyle).toContain("最熟络");
    expect(trusted.boundaryRule).toContain("不声称读取用户文件");
    expect(trusted.boundaryRule).toContain("不过度依附");
  });

  it("provides different active bubble tones for new and close stages", () => {
    expect(getRelationshipPersona("new").bubbleTone).not.toBe(getRelationshipPersona("close").bubbleTone);
  });
});
```

- [ ] **Step 2: Run the focused persona test and verify it fails**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-14-playful-presence-v1
npm test -- tests/app/main/relationshipPersona.test.ts
```

Expected: FAIL because `relationshipPersona.ts` does not exist yet.

- [ ] **Step 3: Write the minimal shared persona module**

Create `src/app/main/relationshipPersona.ts` with this content:

```ts
import type { RelationshipStage } from "../renderer/petBridge.js";

export type RelationshipPersona = {
  chatStyle: string;
  bubbleTone: string;
  comfortTone: string;
  reminderTone: string;
  stageDescription: string;
  stageNotes: string[];
  boundaryRule: string;
};

const PERSONAS: Record<RelationshipStage, RelationshipPersona> = {
  new: {
    chatStyle: "礼貌、轻柔、偏克制，不要太快显得很黏。",
    bubbleTone: "轻声陪伴，存在感弱一点。",
    comfortTone: "温柔但保守，先稳稳接住情绪。",
    reminderTone: "提醒轻一点，像刚认识时的小心关心。",
    stageDescription: "卡卡正在慢慢认识你，还在摸索最适合你的陪伴方式。",
    stageNotes: [
      "卡卡现在更像刚认识你时的陪伴者，会先认真听你说。",
      "多聊一些日常和偏好，她会更快记住你的节奏。"
    ],
    boundaryRule: "不声称读取用户文件，不做过度依附表达。"
  },
  familiar: {
    chatStyle: "更自然、更愿意接情绪，但仍然保持分寸。",
    bubbleTone: "可以更自然地主动搭话，但不要太黏。",
    comfortTone: "开始更主动地安慰用户。",
    reminderTone: "提醒像已经熟悉你一些之后的小声关心。",
    stageDescription: "卡卡已经记得一些与你相处的节奏，会更自然地回应你。",
    stageNotes: [
      "卡卡已经对你的聊天习惯有些感觉了，不再只是机械回应。",
      "她会逐渐调整自己的陪伴方式，试着变得更合你的拍子。"
    ],
    boundaryRule: "不声称读取用户文件，不做过度依附表达。"
  },
  close: {
    chatStyle: "更贴近、更熟络，可以带一点点撒娇感，但不要过头。",
    bubbleTone: "主动表达更像熟悉之后的小宠物，会更贴近你。",
    comfortTone: "安慰更柔软，也更像在认真陪你。",
    reminderTone: "提醒可以更像熟人之间自然的关心。",
    stageDescription: "卡卡和你更亲近了，会更自然地回应你的习惯。",
    stageNotes: [
      "卡卡已经开始记住你偏好的相处方式，会更贴近你的节奏回应你。",
      "她正在从“认识你”慢慢变成“懂你一点”。"
    ],
    boundaryRule: "不声称读取用户文件，不做过度依附表达。"
  },
  trusted: {
    chatStyle: "最熟络、最稳定地主动关心你，可以明显更亲近，但仍然克制。",
    bubbleTone: "主动表达最自然，也最像长期陪在你身边的小宠物。",
    comfortTone: "安慰最稳定，会更主动接住情绪。",
    reminderTone: "提醒可以更自然贴近，但不要变成管控或唠叨。",
    stageDescription: "卡卡很信赖你，也会更稳定地陪在旁边。",
    stageNotes: [
      "卡卡已经很信任你，会更自然地接住你的情绪和表达习惯。",
      "她更愿意主动陪你，也会更稳定地延续你们之间的默契。"
    ],
    boundaryRule: "不声称读取用户文件，不过度依附，不做情感绑架式表达。"
  }
};

export function getRelationshipPersona(stage: RelationshipStage): RelationshipPersona {
  return PERSONAS[stage];
}
```

- [ ] **Step 4: Run the focused persona test and verify it passes**

Run:

```powershell
npm test -- tests/app/main/relationshipPersona.test.ts
```

Expected: PASS for `relationshipPersona.test.ts`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/relationshipPersona.test.ts src/app/main/relationshipPersona.ts
git commit -m "feat: add relationship persona profiles"
```

---

### Task 2: Feed the relationship persona into chat prompt construction

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/memoryService.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/memory/memoryService.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/chatService.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/chatService.ts`

- [ ] **Step 1: Write the failing memory-context and chat-prompt tests**

Append this test to `tests/app/main/memoryService.test.ts`:

```ts
  it("includes the derived relationship stage inside relationshipSummary", () => {
    const context = buildMemoryPromptContext({
      profile: { likes: [], dislikes: [], habits: [], topics: [], notes: [], updatedAt: "2026-06-01T00:00:00.000Z" },
      relationship: {
        familiarity: 60,
        affection: 60,
        engagement: 60,
        trust: 60,
        recentEvents: [],
        updatedAt: "2026-06-01T00:00:00.000Z"
      },
      memories: []
    });

    expect(context.relationshipSummary).toContain("stage=close");
  });
```

Update the first test in `tests/app/main/chatService.test.ts` so the fake requester asserts the stage-persona instructions exist:

```ts
        expect(messages[0].content).toContain("当前关系阶段");
        expect(messages[0].content).toContain("更贴近");
        expect(messages[0].content).toContain("不声称读取用户文件");
```

Add this new test below the memory-summary test in the same file:

```ts
  it("uses relationship stage information to inject persona-specific prompt guidance", async () => {
    await createChatReply({
      text: "今天有点累。",
      config,
      memoryContext: {
        profileSummary: "preferredAddress=主人",
        relationshipSummary: "stage=trusted familiarity=80 affection=85 engagement=78 trust=82",
        retrievedMemories: []
      },
      requester: async ({ messages }) => {
        expect(messages[0].content).toContain("当前关系阶段：trusted");
        expect(messages[0].content).toContain("最熟络");
        expect(messages[0].content).toContain("不过度依附");
        return { ok: true, data: { text: "先歇一下，我会在这陪你。" } };
      }
    });
  });
```

- [ ] **Step 2: Run the focused chat/memory tests and verify they fail**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-14-playful-presence-v1
npm test -- tests/app/main/memoryService.test.ts tests/app/main/chatService.test.ts
```

Expected: FAIL because `relationshipSummary` does not include stage yet and `chatService` still uses one fixed prompt.

- [ ] **Step 3: Implement stage-aware relationshipSummary and system prompt composition**

Update `src/app/main/memory/memoryService.ts`:

```ts
import { deriveRelationshipOverview } from "./memoryManagementService.js";
import type { ContextMemoryItem, MemoryPromptContext, ProfileMemory, RelationshipMemory } from "./memoryTypes.js";

export function buildMemoryPromptContext(input: {
  profile: ProfileMemory;
  relationship: RelationshipMemory;
  memories: ContextMemoryItem[];
}): MemoryPromptContext {
  const profileSummary = [
    input.profile.preferredAddress && `preferredAddress=${input.profile.preferredAddress}`,
    input.profile.likes.length > 0 && `likes=${input.profile.likes.join("/")}`
  ].filter(Boolean).join("; ") || null;

  const stage = deriveRelationshipOverview(input.relationship).stage;
  const relationshipSummary = `stage=${stage} familiarity=${input.relationship.familiarity} affection=${input.relationship.affection} engagement=${input.relationship.engagement} trust=${input.relationship.trust}`;

  return {
    profileSummary,
    relationshipSummary,
    retrievedMemories: input.memories.slice(0, 3)
  };
}
```

Update `src/app/main/chatService.ts` to derive the current stage and persona instructions from the summary string:

```ts
import { getRelationshipPersona } from "./relationshipPersona.js";

function relationshipStageFromSummary(summary: string | null | undefined) {
  const match = summary?.match(/stage=(new|familiar|close|trusted)/);
  return (match?.[1] as "new" | "familiar" | "close" | "trusted" | undefined) ?? "familiar";
}

function buildSystemPrompt(relationshipSummary?: string | null) {
  const stage = relationshipStageFromSummary(relationshipSummary);
  const persona = getRelationshipPersona(stage);
  return [
    "你是卡卡，一个运行在用户电脑本地的桌面电子宠物。",
    "你要更关心用户一点，语气温柔、可爱但不过分卖萌；回答保持简短、具体、有陪伴感，可以轻轻鼓励用户、提醒休息和喝水。",
    `当前关系阶段：${stage}。`,
    `当前阶段的聊天风格：${persona.chatStyle}`,
    `当前阶段的边界要求：${persona.boundaryRule}`,
    "尊重隐私边界：不要声称你能读取用户代码、文件、屏幕或隐私信息，除非用户主动提供。"
  ].join("");
}

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
  if (input.memoryContext?.profileSummary) {
    memoryMessages.push({ role: "system", content: `用户档案：${input.memoryContext.profileSummary}` });
  }
  if (input.memoryContext?.relationshipSummary) {
    memoryMessages.push({ role: "system", content: `关系状态：${input.memoryContext.relationshipSummary}` });
  }
  for (const memory of input.memoryContext?.retrievedMemories ?? []) {
    memoryMessages.push({ role: "system", content: `相关记忆：${memory.text}` });
  }

  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.memoryContext?.relationshipSummary)
    },
    ...memoryMessages,
    { role: "user", content: text }
  ];

  const requester = input.requester ?? requestDeepSeekChat;
  const result = await requester({ config: input.config, messages, timeoutMs: 30000 });
  if (result.ok) {
    await input.onConversationResolved?.({ userText: text, assistantText: result.data.text });
  }
  return result;
}
```

- [ ] **Step 4: Run the focused chat/memory tests and verify they pass**

Run:

```powershell
npm test -- tests/app/main/memoryService.test.ts tests/app/main/chatService.test.ts
```

Expected: PASS, with `relationshipSummary` including `stage=` and the system prompt containing stage-specific persona guidance plus the existing privacy boundary.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/memoryService.test.ts src/app/main/memory/memoryService.ts tests/app/main/chatService.test.ts src/app/main/chatService.ts
git commit -m "feat: add stage-aware chat persona prompts"
```

---

### Task 3: Route proactive bubbles and reminders through relationship persona

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/playfulPresence.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/playfulPresence.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/presenceService.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/presenceService.ts`

- [ ] **Step 1: Write the failing proactive-text tests**

Update `tests/app/main/playfulPresence.test.ts` so different stages assert different wording. Replace the first, second, fourth, and sixth test expectations with these:

```ts
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, familiarity: 15, affection: 15, engagement: 15, trust: 15, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "happy",
      message: "刚刚和你聊天我很开心，还想继续陪你。"
    });

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, familiarity: 70, affection: 72, engagement: 68, trust: 70, playfulAttachedUntil: "2026-06-01T15:30:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "要不要再摸摸我呀？我会更乖一点陪着你。"
    });

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: {
        ...relationship,
        familiarity: 78,
        affection: 80,
        engagement: 76,
        trust: 79,
        recentWarmth: {
          source: "chat",
          intensity: "normal",
          updatedAt: "2026-06-01T14:55:00.000Z",
          expiresAt: "2026-06-01T15:20:00.000Z"
        }
      },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "如果你还想说，我会继续安静陪着你。"
    });

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, familiarity: 55, affection: 55, engagement: 55, trust: 55, lastInteractionAt: "2026-06-01T08:00:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "我在这里等你，想理我了就叫我。"
    });
```

Append this test to `tests/app/main/presenceService.test.ts`:

```ts
  it("uses a closer long-work reminder when the relationship stage is trusted", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T21:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "loading",
      mood: "curious",
      longWorkSession: true,
      relationship: {
        familiarity: 80,
        affection: 82,
        engagement: 78,
        trust: 80,
        recentEvents: [],
        updatedAt: "2026-06-01T20:50:00.000Z"
      }
    });

    expect(pulse?.message).toContain("先喝口水");
  });
```

- [ ] **Step 2: Run the focused proactive-text tests and verify they fail**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-14-playful-presence-v1
npm test -- tests/app/main/playfulPresence.test.ts tests/app/main/presenceService.test.ts
```

Expected: FAIL because the proactive text is still hardcoded and not stage-aware.

- [ ] **Step 3: Implement stage-aware proactive and reminder copy**

Update `src/app/main/playfulPresence.ts` to derive the stage from average relationship score and then select stage-specific text through `getRelationshipPersona(stage)`. Use this shape:

```ts
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";
import { getRelationshipPersona } from "./relationshipPersona.js";

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

function hasActiveWarmth(relationship: RelationshipMemory, now: string) {
  const expiresAt = relationship.recentWarmth?.expiresAt;
  return hasActiveWindow(expiresAt, now);
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

function relationshipStage(relationship: RelationshipMemory) {
  const average = (relationship.familiarity + relationship.affection + relationship.engagement + relationship.trust) / 4;
  if (average >= 70) return "trusted" as const;
  if (average >= 45) return "close" as const;
  if (average >= 20) return "familiar" as const;
  return "new" as const;
}

function messagesForStage(stage: ReturnType<typeof relationshipStage>) {
  if (stage === "trusted") {
    return {
      chatFollow: "刚刚和你聊天我很开心，还想继续陪着你。",
      attachedFollow: "要不要再摸摸我呀？我会更乖一点陪着你。",
      supportFollow: "如果你还想说，我会继续安静陪着你。",
      idleFollow: "我在这边等你，想叫我的时候我就在。",
      nightFollow: "我还在喔，晚一点要不要一起休息？"
    };
  }

  if (stage === "close") {
    return {
      chatFollow: "刚刚和你聊天我很开心，还想继续陪你。",
      attachedFollow: "要不要再摸摸我呀？我会更乖一点陪着你。",
      supportFollow: "如果你还想说，我会安静继续陪你。",
      idleFollow: "我在这里等你，想理我了就叫我。",
      nightFollow: "我还在喔，晚一点要不要一起休息？"
    };
  }

  if (stage === "familiar") {
    return {
      chatFollow: "刚刚和你聊天我很开心，还想继续陪你。",
      attachedFollow: "要不要再摸摸我呀？我会乖一点。",
      supportFollow: "如果你还想说，我会安静继续陪你。",
      idleFollow: "我在这里等你，想理我了就叫我。",
      nightFollow: "我还在喔，晚一点要不要一起休息？"
    };
  }

  return {
    chatFollow: "刚刚和你聊天我很开心，还想继续陪你。",
    attachedFollow: "要不要再摸摸我呀？我会乖一点。",
    supportFollow: "如果你还想说，我会安静继续陪你。",
    idleFollow: "我在这里等你，想理我了就叫我。",
    nightFollow: "我还在喔，晚一点要不要一起休息？"
  };
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

  const stage = relationshipStage(input.relationship);
  const persona = getRelationshipPersona(stage);
  const stageMessages = messagesForStage(stage);
  const activeChat = hasActiveWindow(input.relationship.playfulChatUntil, input.now);
  const activeAttached = hasActiveWindow(input.relationship.playfulAttachedUntil, input.now);
  const activeChatWarmth = input.relationship.recentWarmth?.source === "chat" && hasActiveWarmth(input.relationship, input.now);

  if (isNightHour(input.now)) {
    if (activeChat || activeAttached || activeChatWarmth) {
      return { status: "sleepy", message: stageMessages.nightFollow };
    }
    return null;
  }

  if (activeAttached) {
    return { status: "message", message: `${stageMessages.attachedFollow}` };
  }

  if (activeChatWarmth) {
    return { status: "message", message: `${stageMessages.supportFollow}` };
  }

  if (activeChat) {
    return { status: "happy", message: `${stageMessages.chatFollow}` };
  }

  if (hasBeenIdleLongEnough(input.relationship.lastInteractionAt, input.now)) {
    return { status: "message", message: `${stageMessages.idleFollow}` };
  }

  return null;
}
```

Update `src/app/main/presenceService.ts` to derive the relationship stage and personalize the long-work reminder / lonely fallback:

```ts
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";
import type { MoodName } from "./moodEngine.js";
import { decidePlayfulPresence } from "./playfulPresence.js";
import { getRelationshipPersona } from "./relationshipPersona.js";

function relationshipStage(relationship: RelationshipMemory | undefined) {
  if (!relationship) return "new" as const;
  const average = (relationship.familiarity + relationship.affection + relationship.engagement + relationship.trust) / 4;
  if (average >= 70) return "trusted" as const;
  if (average >= 45) return "close" as const;
  if (average >= 20) return "familiar" as const;
  return "new" as const;
}

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

  const stage = relationshipStage(input.relationship);
  const persona = getRelationshipPersona(stage);

  if (input.longWorkSession) {
    const longWorkMessage = stage === "trusted"
      ? "先喝口水，我会继续在这陪你。"
      : stage === "close"
        ? "先喝口水吧，我会在旁边等你。"
        : "要不要喝口水？我会乖乖等你。";

    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: longWorkMessage,
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
    const lonelyMessage = stage === "trusted"
      ? "我会在这安静陪着你，想说话就叫我。"
      : stage === "close"
        ? "我会安静陪在你旁边。"
        : "我会安静陪在你旁边。";

    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: lonelyMessage,
      source: "presence",
      updatedAt: input.now
    };
  }

  return null;
}
```

- [ ] **Step 4: Run the focused proactive-text tests and verify they pass**

Run:

```powershell
npm test -- tests/app/main/playfulPresence.test.ts tests/app/main/presenceService.test.ts
```

Expected: PASS, with stage-specific proactive/comfort/reminder copy.

- [ ] **Step 5: Commit**

Run:

```powershell
git add tests/app/main/playfulPresence.test.ts src/app/main/playfulPresence.ts tests/app/main/presenceService.test.ts src/app/main/presenceService.ts
git commit -m "feat: personalize presence by relationship stage"
```

---

### Task 4: Refresh visible relationship copy and verify the whole slice

**Files:**
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/main/memory/memoryManagementService.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/main/memoryManagementService.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/src/app/renderer/PrivacyPanel.tsx`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/tests/app/renderer/PrivacyPanel.test.ts`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/docs/development/kaka-development-guide.md`
- Modify: `cline-desktop-pet/.worktrees/feat-14-playful-presence-v1/docs/development/kaka-compact.md`

- [ ] **Step 1: Write the failing relationship-copy tests**

Update the expectations in `tests/app/main/memoryManagementService.test.ts`:

```ts
    expect(overview.relationship.stageLabel).toBe("亲近");
    expect(overview.relationship.stageDescription).toContain("更自然地贴近你");
```

Update the relationship-note assertions in `tests/app/renderer/PrivacyPanel.test.ts`:

```ts
    expect(relationshipCard?.textContent).toContain("亲近");
    expect(relationshipCard?.textContent).toContain("更自然地贴近你");
```

Replace the `close` notes expectation block by updating the static `overview` fixture in that same file:

```ts
  relationship: {
    stage: "close",
    stageLabel: "亲近",
    stageDescription: "卡卡和你更亲近了，会更自然地贴近你的节奏回应你。",
```

- [ ] **Step 2: Run the focused relationship-copy tests and verify they fail**

Run:

```powershell
cd d:/projects/cline-mcp-workspace/cline-desktop-pet/.worktrees/feat-14-playful-presence-v1
npm test -- tests/app/main/memoryManagementService.test.ts tests/app/renderer/PrivacyPanel.test.ts
```

Expected: FAIL because the relationship copy is still the previous wording.

- [ ] **Step 3: Implement warmer stage descriptions and stage notes**

Update `src/app/main/memory/memoryManagementService.ts` so `deriveRelationshipOverview()` returns these descriptions:

```ts
  if (average >= 70) {
    return { stage: "trusted", stageLabel: "信赖", stageDescription: "卡卡很信赖你，会更稳定地主动关心你。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  if (average >= 45) {
    return { stage: "close", stageLabel: "亲近", stageDescription: "卡卡和你更亲近了，会更自然地贴近你的节奏回应你。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  if (average >= 20) {
    return { stage: "familiar", stageLabel: "熟悉", stageDescription: "卡卡已经开始熟悉你的节奏，会更自然地接你的情绪。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }

  return { stage: "new", stageLabel: "初识", stageDescription: "卡卡正在慢慢认识你，还比较克制地陪在你旁边。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
```

Update `src/app/renderer/PrivacyPanel.tsx` so `relationshipNotes()` returns this warmer copy:

```ts
function relationshipNotes(stage: PrivacyOverview["relationship"]["stage"]) {
  if (stage === "trusted") {
    return [
      "卡卡已经很信任你，会更自然地接住你的情绪和表达习惯。",
      "她更愿意主动陪你，也会更稳定地延续你们之间的默契。"
    ];
  }

  if (stage === "close") {
    return [
      "卡卡已经开始记住你偏好的相处方式，会更贴近你的节奏回应你。",
      "她正在从“认识你”慢慢变成“懂你一点”。"
    ];
  }

  if (stage === "familiar") {
    return [
      "卡卡已经对你的聊天习惯有些感觉了，不再只是机械回应。",
      "她会逐渐调整自己的陪伴方式，试着变得更合你的拍子。"
    ];
  }

  return [
    "卡卡正在慢慢认识你，还在摸索最适合你的陪伴方式。",
    "多聊一些日常和偏好，她就会更快记住你的节奏。"
  ];
}
```

Append this summary to `docs/development/kaka-development-guide.md` under the chat/bubble/mood section:

```md
- `relationshipPersona.ts` 统一定义 `new/familiar/close/trusted` 四个阶段的人格 profile，供聊天 prompt、主动气泡、安慰和提醒共用。
- `memoryService.ts` 现在会把 `stage=<...>` 编进 `relationshipSummary`，供 chat prompt 构造读取。
- `chatService.ts` 不再只用一条固定 system prompt，而是把“当前关系阶段 + 阶段人格边界”一起注入。
```

Update `docs/development/kaka-compact.md` under “What is already built” with:

```md
- Relationship Persona v1: `new/familiar/close/trusted` now change Kaka’s chat tone, proactive bubble tone, comfort lines, reminder wording, and relationship copy while keeping the existing relationship scoring model.
```

Replace the first likely-next-task bullet with:

```md
1. Continue from Relationship Persona v1 into a deeper chat-personality upgrade with richer address styles and memory-aware phrasing.
```

- [ ] **Step 4: Run the focused relationship-copy tests and verify they pass**

Run:

```powershell
npm test -- tests/app/main/memoryManagementService.test.ts tests/app/renderer/PrivacyPanel.test.ts
```

Expected: PASS with warmer stage copy still rendering without raw score labels.

- [ ] **Step 5: Run the targeted regression suite and full verification**

Run:

```powershell
npm test -- tests/app/main/relationshipPersona.test.ts tests/app/main/memoryService.test.ts tests/app/main/chatService.test.ts tests/app/main/playfulPresence.test.ts tests/app/main/presenceService.test.ts tests/app/main/memoryManagementService.test.ts tests/app/renderer/PrivacyPanel.test.ts
npm test
npm run build
```

Expected: targeted tests pass, then full Vitest and build succeed.

- [ ] **Step 6: Commit**

Run:

```powershell
git add tests/app/main/memoryManagementService.test.ts src/app/main/memory/memoryManagementService.ts tests/app/renderer/PrivacyPanel.test.ts src/app/renderer/PrivacyPanel.tsx docs/development/kaka-development-guide.md docs/development/kaka-compact.md
git commit -m "feat: surface relationship persona growth"
```

---

## Coverage Self-Check

- Four-stage persona progression: covered by Task 1 profile module.
- Chat tone changes by stage: covered by Task 2 memory summary and prompt injection.
- Proactive bubbles / comfort / reminders change by stage: covered by Task 3.
- Light UI reinforcement through warmer stage copy: covered by Task 4.
- No scoring-model rewrite and no game UI: enforced by File Structure and task boundaries.
