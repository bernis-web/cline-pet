# Dialog Bubble and DeepSeek Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-visible bottom status panel with an on-demand speech bubble and add first-pass DeepSeek-powered chat while keeping API keys private in the Electron main process.

**Architecture:** Renderer owns presentation only: pet image, speech bubble, chat input, and lightweight motion classes. Electron main owns configuration, DeepSeek API calls, chat orchestration, and IPC. Existing MCP/Bridge status updates stay privacy-preserving and flow into renderer bubbles through the existing `pet-status` IPC event.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Zod, local `%APPDATA%/cline-desktop-pet/config.json`, DeepSeek OpenAI-compatible chat completions API via `fetch`.

---

## File Structure

### New files

- `src/app/renderer/bubbleTypes.ts`
  - Defines `BubbleMessage`, `BubbleKind`, and helper functions for turning pet status/chat/errors into bubble messages.
- `src/app/renderer/SpeechBubble.tsx`
  - Renders the on-demand speech bubble above/near the pet.
- `src/app/renderer/ChatInput.tsx`
  - Renders the temporary user input box for “talk to Kaka”.
- `src/app/main/config.ts`
  - Reads DeepSeek configuration from environment variables and `%APPDATA%/cline-desktop-pet/config.json`.
- `src/app/main/deepseekClient.ts`
  - Calls the DeepSeek chat completions API and maps failures to safe app errors.
- `src/app/main/chatService.ts`
  - Builds Kaka’s first-phase prompt and calls `deepseekClient`.
- `tests/app/main/config.test.ts`
  - Tests config precedence and missing API key behavior.
- `tests/app/main/deepseekClient.test.ts`
  - Tests DeepSeek success, HTTP errors, timeout, and malformed responses with mocked `fetch`.
- `tests/app/main/chatService.test.ts`
  - Tests prompt construction and error mapping.
- `tests/app/renderer/bubbleTypes.test.ts`
  - Tests bubble creation strategy.
- `tests/app/renderer/SpeechBubble.test.tsx`
  - Tests bubble visibility and content.
- `tests/app/renderer/ChatInput.test.tsx`
  - Tests input submission and empty input behavior.

### Modified files

- `src/app/renderer/App.tsx`
  - Replace fixed task/status state display with bubble state and chat request handling.
- `src/app/renderer/PetView.tsx`
  - Remove fixed bottom panel and compose pet image, `SpeechBubble`, `ChatInput`, and diagnose button.
- `src/app/renderer/petStyles.css`
  - Replace bottom-panel CSS with speech bubble, chat input, and basic motion classes.
- `src/app/main/preload.ts`
  - Expose chat IPC methods through `window.clinePet`.
- `src/app/renderer/petBridge.ts`
  - Extend bridge helper with `sendChatMessage` and `onChatResponse`.
- `src/app/main/main.ts`
  - Register `chat:send` IPC handler and return chat responses/errors to renderer.
- `tests/app/renderer/App.test.ts`
  - Update expectations from fixed panel to speech bubble/chat behavior.
- `README.md`
  - Document DeepSeek config and the new bubble/chat behavior.

---

### Task 1: Bubble Message Model

**Files:**
- Create: `src/app/renderer/bubbleTypes.ts`
- Test: `tests/app/renderer/bubbleTypes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/renderer/bubbleTypes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bubbleFromChat, bubbleFromStatus, shouldShowStatusBubble } from "../../../src/app/renderer/bubbleTypes";

const now = "2026-05-28T00:00:00.000Z";

describe("bubble message strategy", () => {
  it("creates a status bubble from status task text", () => {
    const bubble = bubbleFromStatus({
      status: "thinking",
      visibleStatus: "thinking",
      baseStatus: "thinking",
      overlayStatus: null,
      task: "正在分析项目",
      updatedAt: now
    });

    expect(bubble).toEqual({
      id: expect.stringContaining("status-"),
      kind: "status",
      text: "正在分析项目",
      status: "thinking",
      createdAt: now,
      autoHideMs: 4500
    });
  });

  it("prefers explicit status message over task", () => {
    const bubble = bubbleFromStatus({
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "fallback task",
      message: "需要你确认",
      updatedAt: now
    });

    expect(bubble?.text).toBe("需要你确认");
  });

  it("does not show a status bubble when there is no message or task", () => {
    expect(shouldShowStatusBubble({
      status: "idle",
      visibleStatus: "idle",
      baseStatus: "idle",
      overlayStatus: null,
      updatedAt: now
    })).toBe(false);
  });

  it("creates a chat bubble from assistant text", () => {
    const bubble = bubbleFromChat("你好，我是卡卡。", now);

    expect(bubble).toEqual({
      id: expect.stringContaining("chat-"),
      kind: "chat",
      text: "你好，我是卡卡。",
      createdAt: now,
      autoHideMs: 9000
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/bubbleTypes.test.ts
```

Expected: FAIL because `src/app/renderer/bubbleTypes.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/renderer/bubbleTypes.ts`:

```ts
import type { PetStatus } from "../../shared/statuses";

export type BubbleKind = "status" | "chat" | "notice" | "diagnostics";

export type StatusBubbleInput = {
  status: PetStatus;
  visibleStatus: PetStatus;
  baseStatus: PetStatus;
  overlayStatus: PetStatus | null;
  task?: string;
  message?: string;
  updatedAt?: string;
};

export type BubbleMessage = {
  id: string;
  kind: BubbleKind;
  text: string;
  status?: PetStatus;
  createdAt: string;
  autoHideMs: number | null;
};

function timestamp(value?: string) {
  return value ?? new Date().toISOString();
}

function idFor(kind: BubbleKind, createdAt: string) {
  return `${kind}-${createdAt}`;
}

export function shouldShowStatusBubble(input: StatusBubbleInput) {
  return Boolean(input.message?.trim() || input.task?.trim());
}

export function bubbleFromStatus(input: StatusBubbleInput): BubbleMessage | null {
  if (!shouldShowStatusBubble(input)) return null;
  const createdAt = timestamp(input.updatedAt);
  return {
    id: idFor("status", createdAt),
    kind: "status",
    text: (input.message?.trim() || input.task?.trim() || "").trim(),
    status: input.visibleStatus ?? input.status,
    createdAt,
    autoHideMs: 4500
  };
}

export function bubbleFromChat(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("chat", createdAt),
    kind: "chat",
    text,
    createdAt,
    autoHideMs: 9000
  };
}

export function bubbleFromNotice(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("notice", createdAt),
    kind: "notice",
    text,
    createdAt,
    autoHideMs: 7000
  };
}

export function bubbleFromDiagnostics(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("diagnostics", createdAt),
    kind: "diagnostics",
    text,
    createdAt,
    autoHideMs: null
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/bubbleTypes.test.ts
```

Expected: PASS, 4 tests passed.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/renderer/bubbleTypes.ts tests/app/renderer/bubbleTypes.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add pet speech bubble model"
```

---

### Task 2: Speech Bubble Component

**Files:**
- Create: `src/app/renderer/SpeechBubble.tsx`
- Modify: `src/app/renderer/petStyles.css`
- Test: `tests/app/renderer/SpeechBubble.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/app/renderer/SpeechBubble.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { SpeechBubble } from "../../../src/app/renderer/SpeechBubble";
import type { BubbleMessage } from "../../../src/app/renderer/bubbleTypes";

function renderBubble(message: BubbleMessage | null) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  act(() => {
    root.render(React.createElement(SpeechBubble, { message }));
  });
  return rootElement;
}

describe("SpeechBubble", () => {
  it("renders nothing without a message", () => {
    const rootElement = renderBubble(null);

    expect(rootElement.querySelector(".speech-bubble")).toBeNull();
  });

  it("renders message text and kind", () => {
    const rootElement = renderBubble({
      id: "chat-1",
      kind: "chat",
      text: "你好，我是卡卡。",
      createdAt: "2026-05-28T00:00:00.000Z",
      autoHideMs: 9000
    });

    expect(rootElement.querySelector(".speech-bubble")?.textContent).toContain("你好，我是卡卡。");
    expect(rootElement.querySelector(".speech-bubble")?.getAttribute("data-kind")).toBe("chat");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/SpeechBubble.test.tsx
```

Expected: FAIL because `SpeechBubble.tsx` does not exist.

- [ ] **Step 3: Implement component**

Create `src/app/renderer/SpeechBubble.tsx`:

```tsx
import type { BubbleMessage } from "./bubbleTypes";

export type SpeechBubbleProps = {
  message: BubbleMessage | null;
};

export function SpeechBubble({ message }: SpeechBubbleProps) {
  if (!message) return null;

  return (
    <section className="speech-bubble" data-kind={message.kind} aria-live="polite">
      <span className="speech-bubble-text">{message.text}</span>
    </section>
  );
}
```

Modify `src/app/renderer/petStyles.css` by replacing the single-line CSS with formatted CSS:

```css
html,
body,
#root {
  margin: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  font-family: system-ui, sans-serif;
}

.pet-shell {
  width: 300px;
  height: 260px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.drag-region {
  -webkit-app-region: drag;
}

.pet-stage {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  padding-bottom: 18px;
}

.pet-image {
  width: 150px;
  height: 150px;
  image-rendering: pixelated;
  object-fit: contain;
  filter: drop-shadow(0 16px 24px rgba(0, 0, 0, 0.35));
}

.speech-bubble {
  position: absolute;
  left: 50%;
  bottom: 178px;
  max-width: 250px;
  transform: translateX(-50%);
  padding: 10px 14px;
  border-radius: 18px;
  color: #111827;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(251, 191, 36, 0.75);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.22);
  font-size: 13px;
  line-height: 1.4;
  animation: bubble-pop 160ms ease-out;
  -webkit-app-region: no-drag;
}

.speech-bubble::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 14px;
  height: 14px;
  transform: translateX(-50%) rotate(45deg);
  background: rgba(255, 255, 255, 0.94);
  border-right: 1px solid rgba(251, 191, 36, 0.75);
  border-bottom: 1px solid rgba(251, 191, 36, 0.75);
}

.speech-bubble[data-kind="notice"] {
  border-color: rgba(248, 113, 113, 0.8);
}

.speech-bubble[data-kind="chat"] {
  border-color: rgba(96, 165, 250, 0.8);
}

.speech-bubble-text {
  position: relative;
  z-index: 1;
}

.diagnose-button {
  position: absolute;
  right: 16px;
  bottom: 12px;
  border: 0;
  border-radius: 999px;
  padding: 5px 8px;
  color: #111827;
  background: rgba(251, 191, 36, 0.92);
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.diagnostics {
  position: absolute;
  inset: 12px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.92);
  color: #e5e7eb;
  font-size: 11px;
}

.diagnostics button {
  float: right;
}

.diagnostics pre {
  white-space: pre-wrap;
}

@keyframes bubble-pop {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/SpeechBubble.test.tsx
```

Expected: PASS, 2 tests passed.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/renderer/SpeechBubble.tsx src/app/renderer/petStyles.css tests/app/renderer/SpeechBubble.test.tsx
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add on-demand speech bubble"
```

---

### Task 3: Replace Fixed Bottom Panel in PetView

**Files:**
- Modify: `src/app/renderer/PetView.tsx`
- Modify: `src/app/renderer/App.tsx`
- Modify: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Write the failing tests**

Update `tests/app/renderer/App.test.ts` by adding this test inside `describe("renderer App", ...)`:

```tsx
it("shows status task text in a speech bubble instead of a fixed bottom panel", async () => {
  let statusHandler: ((payload: any) => void) | null = null;
  (window as any).clinePet = {
    onPetStatus: vi.fn((callback) => {
      statusHandler = callback;
    }),
    onPetPack: vi.fn(),
    getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") })
  };

  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);

  await act(async () => {
    root.render(React.createElement(App));
  });

  await act(async () => {
    statusHandler?.({
      status: "thinking",
      visibleStatus: "thinking",
      baseStatus: "thinking",
      overlayStatus: null,
      task: "正在分析项目",
      updatedAt: "2026-05-28T00:00:00.000Z"
    });
  });

  expect(document.querySelector(".speech-bubble")?.textContent).toContain("正在分析项目");
  expect(document.querySelector(".bubble-panel")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/App.test.ts
```

Expected: FAIL because `.bubble-panel` still exists and speech bubble is not connected to `App`.

- [ ] **Step 3: Update PetView props and markup**

Replace `src/app/renderer/PetView.tsx` with:

```tsx
import { PetStatus, toStatusLabel } from "../../shared/statuses";
import type { BubbleMessage } from "./bubbleTypes";
import { SpeechBubble } from "./SpeechBubble";

export type PetViewProps = {
  status: PetStatus;
  imageSrc: string;
  bubble: BubbleMessage | null;
  onDiagnose(): void;
  onStartChat(): void;
};

export function PetView({ status, imageSrc, bubble, onDiagnose, onStartChat }: PetViewProps) {
  return (
    <main className="pet-shell">
      <SpeechBubble message={bubble} />
      <section className="drag-region pet-stage" onDoubleClick={onStartChat}>
        <img className="pet-image" src={imageSrc} alt={toStatusLabel(status)} draggable={false} />
      </section>
      <button className="diagnose-button" type="button" onClick={onDiagnose} aria-label="诊断">
        诊断
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Update App to create status bubbles**

Modify `src/app/renderer/App.tsx` imports:

```ts
import { useEffect, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { PetView } from "./PetView";
import { bubbleFromDiagnostics, bubbleFromStatus, type BubbleMessage } from "./bubbleTypes";
```

Replace task/updatedAt state with bubble state:

```ts
const [bubble, setBubble] = useState<BubbleMessage | null>(null);
```

In `onPetStatus`, replace task/updatedAt updates with:

```ts
const nextBubble = bubbleFromStatus(payload);
if (nextBubble) setBubble(nextBubble);
```

Update return:

```tsx
return (
  <>
    <PetView
      status={visibleStatus}
      imageSrc={images[visibleStatus] ?? defaultImages.idle}
      bubble={bubble}
      onStartChat={() => setBubble({
        id: `notice-${Date.now()}`,
        kind: "notice",
        text: "聊天输入会在下一步接入。",
        createdAt: new Date().toISOString(),
        autoHideMs: 3000
      })}
      onDiagnose={() => {
        const text = `status=${status}\nvisibleStatus=${visibleStatus}`;
        setDiagnostics(text);
        setBubble(bubbleFromDiagnostics("诊断信息已打开。"));
      }}
    />
    <DiagnosticsPanel text={diagnostics} onClose={() => setDiagnostics("")} />
  </>
);
```

Remove unused `task` and `updatedAt` state.

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/renderer/App.tsx src/app/renderer/PetView.tsx tests/app/renderer/App.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: show cline status in speech bubble"
```

---

### Task 4: DeepSeek Configuration Loader

**Files:**
- Create: `src/app/main/config.ts`
- Test: `tests/app/main/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/main/config.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadDeepSeekConfig } from "../../../src/app/main/config";

const originalEnv = { ...process.env };

describe("DeepSeek config loader", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads API key from environment before config file", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    writeFileSync(join(root, "config.json"), JSON.stringify({ deepseekApiKey: "file-key" }));
    process.env.CLINE_PET_DEEPSEEK_API_KEY = "env-key";

    const config = loadDeepSeekConfig(root);

    expect(config).toEqual({
      ok: true,
      data: {
        apiKey: "env-key",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat"
      }
    });
    rmSync(root, { recursive: true, force: true });
  });

  it("returns a typed error when API key is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    delete process.env.CLINE_PET_DEEPSEEK_API_KEY;

    const config = loadDeepSeekConfig(root);

    expect(config).toEqual({ ok: false, errorCode: "DEEPSEEK_API_KEY_MISSING", message: expect.stringContaining("CLINE_PET_DEEPSEEK_API_KEY") });
    rmSync(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/config.test.ts
```

Expected: FAIL because `config.ts` does not exist.

- [ ] **Step 3: Implement config loader**

Create `src/app/main/config.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type DeepSeekConfigResult =
  | { ok: true; data: DeepSeekConfig }
  | { ok: false; errorCode: "DEEPSEEK_API_KEY_MISSING" | "DEEPSEEK_CONFIG_INVALID"; message: string };

type ConfigFile = {
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  deepseekModel?: string;
};

function readConfigFile(configRoot: string): ConfigFile {
  const configPath = join(configRoot, "config.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")) as ConfigFile;
  } catch {
    return {};
  }
}

export function loadDeepSeekConfig(configRoot: string): DeepSeekConfigResult {
  const file = readConfigFile(configRoot);
  const apiKey = process.env.CLINE_PET_DEEPSEEK_API_KEY || file.deepseekApiKey;
  const baseUrl = process.env.CLINE_PET_DEEPSEEK_BASE_URL || file.deepseekBaseUrl || "https://api.deepseek.com";
  const model = process.env.CLINE_PET_DEEPSEEK_MODEL || file.deepseekModel || "deepseek-chat";

  if (!apiKey?.trim()) {
    return {
      ok: false,
      errorCode: "DEEPSEEK_API_KEY_MISSING",
      message: "DeepSeek API key is missing. Set CLINE_PET_DEEPSEEK_API_KEY or %APPDATA%/cline-desktop-pet/config.json."
    };
  }

  return { ok: true, data: { apiKey: apiKey.trim(), baseUrl: baseUrl.replace(/\/$/, ""), model } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/config.ts tests/app/main/config.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add deepseek config loader"
```

---

### Task 5: DeepSeek Client

**Files:**
- Create: `src/app/main/deepseekClient.ts`
- Test: `tests/app/main/deepseekClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/main/deepseekClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDeepSeekChat } from "../../../src/app/main/deepseekClient";

const originalFetch = globalThis.fetch;

describe("DeepSeek client", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns assistant text from DeepSeek response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "你好，我是卡卡。" } }] })
    } as any);

    const result = await requestDeepSeekChat({
      config: { apiKey: "key", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
      messages: [{ role: "user", content: "你好" }],
      timeoutMs: 1000
    });

    expect(result).toEqual({ ok: true, data: { text: "你好，我是卡卡。" } });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("maps HTTP errors to safe errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" } as any);

    const result = await requestDeepSeekChat({
      config: { apiKey: "bad", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
      messages: [{ role: "user", content: "你好" }],
      timeoutMs: 1000
    });

    expect(result).toEqual({ ok: false, errorCode: "DEEPSEEK_HTTP_ERROR", message: "DeepSeek request failed with HTTP 401." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/deepseekClient.test.ts
```

Expected: FAIL because `deepseekClient.ts` does not exist.

- [ ] **Step 3: Implement client**

Create `src/app/main/deepseekClient.ts`:

```ts
import type { DeepSeekConfig } from "./config.js";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekChatResult =
  | { ok: true; data: { text: string } }
  | { ok: false; errorCode: "DEEPSEEK_HTTP_ERROR" | "DEEPSEEK_NETWORK_ERROR" | "DEEPSEEK_BAD_RESPONSE"; message: string };

export async function requestDeepSeekChat(input: {
  config: DeepSeekConfig;
  messages: DeepSeekMessage[];
  timeoutMs: number;
}): Promise<DeepSeekChatResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(`${input.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.config.apiKey}`
      },
      body: JSON.stringify({ model: input.config.model, messages: input.messages }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, errorCode: "DEEPSEEK_HTTP_ERROR", message: `DeepSeek request failed with HTTP ${response.status}.` };
    }

    const json = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, errorCode: "DEEPSEEK_BAD_RESPONSE", message: "DeepSeek returned an empty response." };
    }

    return { ok: true, data: { text } };
  } catch {
    return { ok: false, errorCode: "DEEPSEEK_NETWORK_ERROR", message: "Unable to reach DeepSeek." };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/deepseekClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/deepseekClient.ts tests/app/main/deepseekClient.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add deepseek chat client"
```

---

### Task 6: Chat Service and IPC

**Files:**
- Create: `src/app/main/chatService.ts`
- Modify: `src/app/main/main.ts`
- Modify: `src/app/main/preload.ts`
- Modify: `src/app/renderer/petBridge.ts`
- Test: `tests/app/main/chatService.test.ts`

- [ ] **Step 1: Write the failing service test**

Create `tests/app/main/chatService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createChatReply } from "../../../src/app/main/chatService";

const config = { apiKey: "key", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };

describe("chat service", () => {
  it("sends Kaka system prompt and user message", async () => {
    const result = await createChatReply({
      text: "你是谁？",
      config,
      requester: async ({ messages }) => {
        expect(messages[0]).toEqual({
          role: "system",
          content: expect.stringContaining("卡卡")
        });
        expect(messages[1]).toEqual({ role: "user", content: "你是谁？" });
        return { ok: true, data: { text: "我是卡卡。" } };
      }
    });

    expect(result).toEqual({ ok: true, data: { text: "我是卡卡。" } });
  });

  it("rejects empty chat messages", async () => {
    const result = await createChatReply({ text: "   ", config });

    expect(result).toEqual({ ok: false, errorCode: "CHAT_EMPTY_MESSAGE", message: "你还没说话。" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/chatService.test.ts
```

Expected: FAIL because `chatService.ts` does not exist.

- [ ] **Step 3: Implement chat service**

Create `src/app/main/chatService.ts`:

```ts
import type { DeepSeekConfig } from "./config.js";
import { requestDeepSeekChat, type DeepSeekChatResult, type DeepSeekMessage } from "./deepseekClient.js";

export type ChatReplyResult = DeepSeekChatResult | { ok: false; errorCode: "CHAT_EMPTY_MESSAGE"; message: string };

export async function createChatReply(input: {
  text: string;
  config: DeepSeekConfig;
  requester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}): Promise<ChatReplyResult> {
  const text = input.text.trim();
  if (!text) return { ok: false, errorCode: "CHAT_EMPTY_MESSAGE", message: "你还没说话。" };

  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: "你是卡卡，一个运行在用户电脑本地的桌面电子宠物。回答要简短、温和、有一点陪伴感。不要声称你能读取用户代码或文件，除非用户主动提供。"
    },
    { role: "user", content: text }
  ];

  const requester = input.requester ?? requestDeepSeekChat;
  return requester({ config: input.config, messages, timeoutMs: 30000 });
}
```

- [ ] **Step 4: Extend renderer bridge types**

Modify `src/app/renderer/petBridge.ts`:

```ts
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";

export type RendererPetPack = {
  id: string;
  name: string;
  stateImages: Record<PetStatus, string>;
};

export type ChatResponse =
  | { ok: true; text: string }
  | { ok: false; errorCode: string; message: string };

export type IpcLike = {
  on(channel: "pet-status", callback: (event: unknown, payload: UpdatePetStatusInput) => void): void;
  on(channel: "pet-pack", callback: (event: unknown, payload: RendererPetPack) => void): void;
  on(channel: "chat:response", callback: (event: unknown, payload: ChatResponse) => void): void;
  invoke(channel: "get-pet-pack"): Promise<RendererPetPack>;
  invoke(channel: "chat:send", payload: { text: string }): Promise<ChatResponse>;
};

export function createRendererPetBridge(ipc: IpcLike) {
  return {
    onPetStatus(callback: (payload: UpdatePetStatusInput) => void) {
      ipc.on("pet-status", (_event, payload) => callback(payload));
    },
    onPetPack(callback: (payload: RendererPetPack) => void) {
      ipc.on("pet-pack", (_event, payload) => callback(payload));
    },
    getPetPack() {
      return ipc.invoke("get-pet-pack");
    },
    sendChatMessage(text: string) {
      return ipc.invoke("chat:send", { text });
    },
    onChatResponse(callback: (payload: ChatResponse) => void) {
      ipc.on("chat:response", (_event, payload) => callback(payload));
    }
  };
}
```

- [ ] **Step 5: Add main process IPC handler**

Modify `src/app/main/main.ts` imports:

```ts
import { createChatReply } from "./chatService.js";
import { loadDeepSeekConfig } from "./config.js";
```

After `ipcMain.handle("get-pet-pack", ...)`, add:

```ts
ipcMain.handle("chat:send", async (_event, payload: { text?: string }) => {
  const config = loadDeepSeekConfig(paths.root);
  if (!config.ok) return { ok: false, errorCode: config.errorCode, message: config.message };

  const result = await createChatReply({ text: payload.text ?? "", config: config.data });
  if (!result.ok) return { ok: false, errorCode: result.errorCode, message: result.message };
  return { ok: true, text: result.data.text };
});
```

If `paths.root` does not exist in `getPaths()`, inspect `src/shared/paths.ts` and use the app config root path that contains `config.json`. If the field name is absent, add it to `getPaths()` in a separate small test-first task before this step.

- [ ] **Step 6: Run service tests and build**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/main/chatService.test.ts
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack run build
```

Expected: both pass.

- [ ] **Step 7: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/main/chatService.ts src/app/main/main.ts src/app/main/preload.ts src/app/renderer/petBridge.ts tests/app/main/chatService.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add chat service ipc"
```

---

### Task 7: Chat Input UI

**Files:**
- Create: `src/app/renderer/ChatInput.tsx`
- Modify: `src/app/renderer/App.tsx`
- Modify: `src/app/renderer/PetView.tsx`
- Modify: `src/app/renderer/petStyles.css`
- Test: `tests/app/renderer/ChatInput.test.tsx`
- Test: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Write failing ChatInput tests**

Create `tests/app/renderer/ChatInput.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "../../../src/app/renderer/ChatInput";

function renderChatInput(onSubmit = vi.fn()) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  act(() => {
    root.render(React.createElement(ChatInput, { open: true, pending: false, onSubmit, onCancel: vi.fn() }));
  });
  return { rootElement, onSubmit };
}

describe("ChatInput", () => {
  it("submits non-empty text", () => {
    const { rootElement, onSubmit } = renderChatInput();
    const input = rootElement.querySelector("input") as HTMLInputElement;
    const form = rootElement.querySelector("form") as HTMLFormElement;

    act(() => {
      input.value = "你好";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith("你好");
  });

  it("does not submit empty text", () => {
    const { rootElement, onSubmit } = renderChatInput();
    const form = rootElement.querySelector("form") as HTMLFormElement;

    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/ChatInput.test.tsx
```

Expected: FAIL because `ChatInput.tsx` does not exist.

- [ ] **Step 3: Implement ChatInput**

Create `src/app/renderer/ChatInput.tsx`:

```tsx
import { FormEvent, useState } from "react";

export type ChatInputProps = {
  open: boolean;
  pending: boolean;
  onSubmit(text: string): void;
  onCancel(): void;
};

export function ChatInput({ open, pending, onSubmit, onCancel }: ChatInputProps) {
  const [text, setText] = useState("");
  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form className="chat-input" onSubmit={submit}>
      <input
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        placeholder="和卡卡说话..."
        disabled={pending}
      />
      <button type="submit" disabled={pending}>发送</button>
      <button type="button" onClick={onCancel} disabled={pending}>取消</button>
    </form>
  );
}
```

- [ ] **Step 4: Wire chat into App and PetView**

Update `PetViewProps` to include:

```ts
chatOpen: boolean;
chatPending: boolean;
onChatSubmit(text: string): void;
onChatCancel(): void;
```

Render below pet stage:

```tsx
<ChatInput open={chatOpen} pending={chatPending} onSubmit={onChatSubmit} onCancel={onChatCancel} />
```

Update `App.tsx`:

```ts
const [chatOpen, setChatOpen] = useState(false);
const [chatPending, setChatPending] = useState(false);

async function sendChat(text: string) {
  setChatPending(true);
  setBubble({ id: `notice-${Date.now()}`, kind: "notice", text: "卡卡正在想...", createdAt: new Date().toISOString(), autoHideMs: 3000 });
  const result = await window.clinePet?.sendChatMessage?.(text);
  setChatPending(false);
  if (!result) {
    setBubble(bubbleFromNotice("聊天通道还没有准备好。"));
    return;
  }
  if (result.ok) {
    setBubble(bubbleFromChat(result.text));
    setChatOpen(false);
  } else {
    setBubble(bubbleFromNotice(result.message));
  }
}
```

Pass props to `PetView`:

```tsx
chatOpen={chatOpen}
chatPending={chatPending}
onStartChat={() => setChatOpen(true)}
onChatSubmit={sendChat}
onChatCancel={() => setChatOpen(false)}
```

Update global `Window.clinePet` type in `App.tsx` with:

```ts
sendChatMessage?(text: string): Promise<{ ok: true; text: string } | { ok: false; errorCode: string; message: string }>;
onChatResponse?(callback: (payload: { ok: true; text: string } | { ok: false; errorCode: string; message: string }) => void): void;
```

- [ ] **Step 5: Add chat input CSS**

Append to `src/app/renderer/petStyles.css`:

```css
.chat-input {
  position: absolute;
  left: 50%;
  bottom: 12px;
  display: flex;
  gap: 4px;
  width: 270px;
  transform: translateX(-50%);
  padding: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
  -webkit-app-region: no-drag;
}

.chat-input input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.95);
}

.chat-input button {
  border: 0;
  border-radius: 999px;
  padding: 6px 8px;
  cursor: pointer;
  background: #fbbf24;
  color: #111827;
}
```

- [ ] **Step 6: Run renderer tests**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/ChatInput.test.tsx tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/renderer/ChatInput.tsx src/app/renderer/App.tsx src/app/renderer/PetView.tsx src/app/renderer/petStyles.css tests/app/renderer/ChatInput.test.tsx tests/app/renderer/App.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add pet chat input"
```

---

### Task 8: Light Motion Classes

**Files:**
- Modify: `src/app/renderer/PetView.tsx`
- Modify: `src/app/renderer/petStyles.css`
- Test: `tests/app/renderer/App.test.ts`

- [ ] **Step 1: Add failing test for motion class**

Add to `tests/app/renderer/App.test.ts`:

```tsx
it("applies motion class for visible status", async () => {
  let statusHandler: ((payload: any) => void) | null = null;
  (window as any).clinePet = {
    onPetStatus: vi.fn((callback) => {
      statusHandler = callback;
    }),
    onPetPack: vi.fn(),
    getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") })
  };

  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);

  await act(async () => {
    root.render(React.createElement(App));
  });

  await act(async () => {
    statusHandler?.({
      status: "happy",
      visibleStatus: "happy",
      baseStatus: "happy",
      overlayStatus: null,
      task: "完成啦",
      updatedAt: "2026-05-28T00:00:00.000Z"
    });
  });

  expect(document.querySelector("img")?.className).toContain("pet-motion-happy");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/App.test.ts
```

Expected: FAIL because motion class is not applied.

- [ ] **Step 3: Add motion class in PetView**

Modify `PetView.tsx` image class:

```tsx
<img className={`pet-image pet-motion-${status}`} src={imageSrc} alt={toStatusLabel(status)} draggable={false} />
```

- [ ] **Step 4: Add motion CSS**

Append to `src/app/renderer/petStyles.css`:

```css
.pet-motion-idle,
.pet-motion-sleepy,
.pet-motion-sleeping {
  animation: pet-float 2.8s ease-in-out infinite;
}

.pet-motion-thinking {
  animation: pet-pulse 1.6s ease-in-out infinite;
}

.pet-motion-happy,
.pet-motion-head-pat {
  animation: pet-bounce 0.9s ease-in-out infinite;
}

.pet-motion-loading,
.pet-motion-dragging {
  animation: pet-wiggle 0.8s ease-in-out infinite;
}

.pet-motion-not-found,
.pet-motion-signal-weak,
.pet-motion-angry {
  animation: pet-shake 0.55s ease-in-out infinite;
}

@keyframes pet-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes pet-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 16px 24px rgba(0, 0, 0, 0.35)); }
  50% { transform: scale(1.035); filter: drop-shadow(0 16px 28px rgba(96, 165, 250, 0.45)); }
}

@keyframes pet-bounce {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-9px); }
}

@keyframes pet-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}

@keyframes pet-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test -- tests/app/renderer/App.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add src/app/renderer/PetView.tsx src/app/renderer/petStyles.css tests/app/renderer/App.test.ts
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "feat: add lightweight pet motion"
```

---

### Task 9: README and Manual DeepSeek Config Instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add README section**

Add this section to `README.md`:

```md
## DeepSeek 聊天配置

桌宠支持通过你自己的 DeepSeek API key 和卡卡聊天。API key 只保存在本机，不会提交到仓库，也不会通过 MCP/Bridge 发送。

推荐创建本地配置文件：

```text
%APPDATA%/cline-desktop-pet/config.json
```

示例：

```json
{
  "deepseekApiKey": "你的 DeepSeek API key",
  "deepseekBaseUrl": "https://api.deepseek.com",
  "deepseekModel": "deepseek-chat"
}
```

也可以使用环境变量：

```powershell
setx CLINE_PET_DEEPSEEK_API_KEY "你的 DeepSeek API key"
setx CLINE_PET_DEEPSEEK_BASE_URL "https://api.deepseek.com"
setx CLINE_PET_DEEPSEEK_MODEL "deepseek-chat"
```

重启桌宠后生效。
```

Also add a short note under the usage section:

```md
- 双击/点击卡卡可以打开临时聊天输入框。
- Cline 工作状态会以气泡方式提醒，不再常驻底部面板。
```

- [ ] **Step 2: Verify README does not include real secrets**

Run:

```powershell
Select-String -Path d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack\README.md -Pattern 'sk-|api_key|真实|Bearer'
```

Expected: no real API key appears. Placeholder text is acceptable.

- [ ] **Step 3: Commit**

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack add README.md
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack commit -m "docs: document deepseek chat setup"
```

---

### Task 10: Final Verification

**Files:**
- No source files changed unless verification reveals a defect.

- [ ] **Step 1: Run full tests**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack test
```

Expected: all test files pass.

- [ ] **Step 2: Run full build**

Run:

```powershell
npm --prefix d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack run build
```

Expected: renderer, main, and preload builds pass.

- [ ] **Step 3: Check no PNG assets were committed**

Run:

```powershell
$pngs = git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack ls-files '*.png'
if ($pngs) { $pngs } else { 'TRACKED_PNG_COUNT=0' }
```

Expected: `TRACKED_PNG_COUNT=0`.

- [ ] **Step 4: Check working tree**

Run:

```powershell
git -C d:\projects\cline-mcp-workspace\cline-desktop-pet\.worktrees\feat-12-state-local-pet-pack status --short --branch
```

Expected: clean except for any pre-existing uncommitted work the user explicitly asked to keep.

- [ ] **Step 5: Report result**

Report:

- Test result.
- Build result.
- Latest commit SHA.
- Whether any worktree changes remain.
- Whether any PNG files are tracked.



---

## Plan Self-Review Notes

- Spec coverage: the plan maps the approved design to bubble UI (Tasks 1-3), DeepSeek config/client/chat IPC (Tasks 4-7), lightweight motion (Task 8), docs (Task 9), and final verification (Task 10).
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: `BubbleMessage`, `ChatResponse`, `DeepSeekConfig`, `requestDeepSeekChat`, and `createChatReply` names are defined before later tasks use them.
- Known prerequisite: this worktree currently contains earlier uncommitted Windows preload/MCP fixes. Before executing this plan, either commit those fixes separately or preserve them intentionally so plan commits remain understandable.
