// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/renderer/App";
import { PET_STATUSES, type PetStatus } from "../../../src/shared/statuses";
import { createRendererPetBridge } from "../../../src/app/renderer/petBridge";

function imageMap(prefix: string) {
  return Object.fromEntries(PET_STATUSES.map((status) => [status, `${prefix}/${status}.png`])) as Record<PetStatus, string>;
}

describe("renderer App", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete (window as any).clinePet;
  });

  it("loads the current pet pack on mount even if the initial IPC event was missed", async () => {
    const getPetPack = vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") });
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getPetPack).toHaveBeenCalledOnce();
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/idle.png");
  });

  it("loads the current pet pack through the bridge exposed by preload", async () => {
    const getPetPack = vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") });
    (window as any).clinePet = createRendererPetBridge({
      on: vi.fn(),
      invoke: getPetPack
    });

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getPetPack).toHaveBeenCalledWith("get-pet-pack");
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/idle.png");
  });

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

  it("auto-hides chat bubbles after about five seconds", async () => {
    vi.useFakeTimers();
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      sendChatMessage: vi.fn().mockResolvedValue({ ok: true, text: "我在这里陪着你。" })
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
      stage.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    const input = document.querySelector('input[name="message"]') as HTMLInputElement;
    const form = document.querySelector(".chat-input") as HTMLFormElement;
    await act(async () => {
      input.value = "陪我一下";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(document.querySelector(".speech-bubble")?.textContent).toContain("我在这里陪着你。");

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(document.querySelector(".speech-bubble")).toBeNull();
  });

  it("opens the chat history panel and loads stored conversations", async () => {
    let privacyOpenHandler: ((payload: { tab: "history" | "memories" | "blocklist" | "export" }) => void) | null = null;
    const getPrivacyOverview = vi.fn().mockResolvedValue({
      ok: true,
      data: {
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
          id: "t1",
          userText: "今天好累",
          assistantText: "先喝口水，我在旁边陪你。",
          createdAt: "2026-06-01T01:00:00.000Z",
          sentiment: "tired",
          memoryIds: []
        }],
        counts: { memories: 0, blockRules: 0, chatHistoryTurns: 1 }
      }
    });
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      onPrivacyOpen: vi.fn((callback) => {
        privacyOpenHandler = callback;
      }),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getPrivacyOverview,
      clearChatHistory: vi.fn().mockResolvedValue({ ok: true })
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    expect(document.querySelector(".chat-history-trigger")).toBeNull();
    expect(document.querySelector(".memory-trigger")).toBeNull();

    await act(async () => {
      privacyOpenHandler?.({ tab: "history" });
      await Promise.resolve();
    });

    expect(getPrivacyOverview).toHaveBeenCalledOnce();
    expect(document.querySelector(".privacy-panel")?.textContent).toContain("隐私与记忆");
    expect(document.querySelector(".privacy-history-section")?.textContent).toContain("今天好累");
  });

  it("blocks a chat-history turn from the privacy panel and refreshes overview", async () => {
    let privacyOpenHandler: ((payload: { tab: "history" | "memories" | "blocklist" | "export" }) => void) | null = null;
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
      onPrivacyOpen: vi.fn((callback) => {
        privacyOpenHandler = callback;
      }),
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
      privacyOpenHandler?.({ tab: "history" });
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

  it("opens memory panel and manages long-term memories", async () => {
    let privacyOpenHandler: ((payload: { tab: "history" | "memories" | "blocklist" | "export" }) => void) | null = null;
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
      memories: [
        {
          id: "m1",
          kind: "preference",
          text: "用户喜欢温柔提醒",
          tags: ["chat"],
          weight: 80,
          createdAt: "2026-06-01T01:00:00.000Z",
          updatedAt: "2026-06-01T01:00:00.000Z"
        },
        {
          id: "m2",
          kind: "project-context",
          text: "项目是卡卡桌宠",
          tags: ["project"],
          weight: 65,
          createdAt: "2026-06-01T01:00:00.000Z",
          updatedAt: "2026-06-01T02:00:00.000Z"
        }
      ],
      blockRules: [],
      chatHistory: [],
      counts: { memories: 2, blockRules: 0, chatHistoryTurns: 0 }
    };
    const afterDeleteOverview = {
      ...initialOverview,
      memories: [initialOverview.memories[1]],
      counts: { memories: 1, blockRules: 0, chatHistoryTurns: 0 }
    };
    const afterClearOverview = {
      ...initialOverview,
      memories: [],
      counts: { memories: 0, blockRules: 0, chatHistoryTurns: 0 }
    };
    const getPrivacyOverview = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: initialOverview })
      .mockResolvedValueOnce({ ok: true, data: afterDeleteOverview })
      .mockResolvedValueOnce({ ok: true, data: afterClearOverview });
    const deleteMemory = vi.fn().mockResolvedValue({ ok: true });
    const clearMemories = vi.fn().mockResolvedValue({ ok: true });
    const exportPrivacyData = vi.fn().mockResolvedValue({ ok: true, data: "{\n  \"count\": 1\n}" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.confirm = vi.fn().mockReturnValue(true);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      onPrivacyOpen: vi.fn((callback) => {
        privacyOpenHandler = callback;
      }),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getPrivacyOverview,
      deleteMemory,
      clearMemories,
      exportPrivacyData
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });
    await act(async () => {
      privacyOpenHandler?.({ tab: "memories" });
      await Promise.resolve();
    });

    expect(getPrivacyOverview).toHaveBeenCalledOnce();
    expect(document.querySelector(".privacy-panel")?.textContent).toContain("隐私与记忆");
    expect(document.querySelector(".privacy-memory-section")?.textContent).toContain("用户喜欢温柔提醒");

    await act(async () => {
      (document.querySelector('[data-memory-delete="m1"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(deleteMemory).toHaveBeenCalledWith("m1");
    expect(document.querySelector(".privacy-memory-section")?.textContent).not.toContain("用户喜欢温柔提醒");

    await act(async () => {
      (document.querySelector('[data-privacy-tab="export"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (document.querySelector(".privacy-export-copy") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(exportPrivacyData).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("{\n  \"count\": 1\n}");

    await act(async () => {
      (document.querySelector(".privacy-clear-memories") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(clearMemories).toHaveBeenCalledOnce();
    expect(document.querySelector(".privacy-export-section")?.textContent).toContain("长期记忆 0");
  });

  it("edits and blocks long-term memories from the memory panel", async () => {
    let privacyOpenHandler: ((payload: { tab: "history" | "memories" | "blocklist" | "export" }) => void) | null = null;
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
      memories: [
        {
          id: "m1",
          kind: "preference",
          text: "用户喜欢很吵的提醒",
          tags: ["chat"],
          weight: 80,
          createdAt: "2026-06-01T01:00:00.000Z",
          updatedAt: "2026-06-01T01:00:00.000Z"
        },
        {
          id: "m2",
          kind: "fact",
          text: "用户不想记住咖啡",
          tags: ["chat"],
          weight: 60,
          createdAt: "2026-06-01T01:00:00.000Z",
          updatedAt: "2026-06-01T02:00:00.000Z"
        }
      ],
      blockRules: [],
      chatHistory: [],
      counts: { memories: 2, blockRules: 0, chatHistoryTurns: 0 }
    };
    const afterUpdateOverview = {
      ...initialOverview,
      memories: [
        { ...initialOverview.memories[0], text: "用户喜欢安静温柔的提醒", updatedAt: "2026-06-01T06:00:00.000Z" },
        initialOverview.memories[1]
      ]
    };
    const afterBlockOverview = {
      ...afterUpdateOverview,
      memories: [afterUpdateOverview.memories[0]],
      counts: { memories: 1, blockRules: 1, chatHistoryTurns: 0 }
    };
    const getPrivacyOverview = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: initialOverview })
      .mockResolvedValueOnce({ ok: true, data: afterUpdateOverview })
      .mockResolvedValueOnce({ ok: true, data: afterBlockOverview });
    const updateMemory = vi.fn().mockResolvedValue({ ok: true, data: afterUpdateOverview.memories[0] });
    const blockMemory = vi.fn().mockResolvedValue({ ok: true, data: { blockedCount: 1 } });
    window.confirm = vi.fn().mockReturnValue(true);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      onPrivacyOpen: vi.fn((callback) => {
        privacyOpenHandler = callback;
      }),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getPrivacyOverview,
      updateMemory,
      blockMemory
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });
    await act(async () => {
      privacyOpenHandler?.({ tab: "memories" });
      await Promise.resolve();
    });

    await act(async () => {
      (document.querySelector('[data-memory-edit="m1"]') as HTMLButtonElement).click();
    });
    const editor = document.querySelector('textarea[name="memoryEditText"]') as HTMLTextAreaElement;
    await act(async () => {
      editor.value = "用户喜欢安静温柔的提醒";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      (document.querySelector(".memory-edit-save") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(updateMemory).toHaveBeenCalledWith("m1", "用户喜欢安静温柔的提醒");
    expect(document.querySelector(".privacy-panel")?.textContent).toContain("用户喜欢安静温柔的提醒");
    expect(document.querySelector(".speech-bubble")?.textContent).toContain("我记住修正啦");

    await act(async () => {
      (document.querySelector('[data-memory-block="m2"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(blockMemory).toHaveBeenCalledWith("m2");
    expect(document.querySelector(".privacy-panel")?.textContent).not.toContain("用户不想记住咖啡");
    expect(document.querySelector(".speech-bubble")?.textContent).toContain("好，我以后不会再记类似内容");
  });

  it("manages blocklist rules and unified privacy export from the privacy panel", async () => {
    let privacyOpenHandler: ((payload: { tab: "history" | "memories" | "blocklist" | "export" }) => void) | null = null;
    const getPrivacyOverview = vi.fn().mockResolvedValue({
      ok: true,
      data: {
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
        blockRules: [{
          id: "rule-1",
          text: "不要记住咖啡",
          kind: "preference",
          sourceMemoryId: "old-memory",
          createdAt: "2026-06-01T02:00:00.000Z"
        }],
        chatHistory: [],
        counts: { memories: 0, blockRules: 1, chatHistoryTurns: 0 }
      }
    });
    const deleteMemoryBlockRule = vi.fn().mockResolvedValue({ ok: true });
    const clearMemoryBlockRules = vi.fn().mockResolvedValue({ ok: true });
    const exportPrivacyData = vi.fn().mockResolvedValue({ ok: true, data: "{\n  \"counts\": {\n    \"blockRules\": 1\n  }\n}" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.confirm = vi.fn().mockReturnValue(true);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      onPrivacyOpen: vi.fn((callback) => {
        privacyOpenHandler = callback;
      }),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getPrivacyOverview,
      deleteMemoryBlockRule,
      clearMemoryBlockRules,
      exportPrivacyData
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });
    await act(async () => {
      privacyOpenHandler?.({ tab: "memories" });
      await Promise.resolve();
    });
    await act(async () => {
      (document.querySelector('[data-privacy-tab="blocklist"]') as HTMLButtonElement).click();
    });

    expect(document.querySelector(".privacy-blocklist-section")?.textContent).toContain("不要记住咖啡");

    await act(async () => {
      (document.querySelector('[data-block-rule-delete="rule-1"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(deleteMemoryBlockRule).toHaveBeenCalledWith("rule-1");

    await act(async () => {
      (document.querySelector(".block-rules-clear") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(clearMemoryBlockRules).toHaveBeenCalledOnce();

    await act(async () => {
      (document.querySelector('[data-privacy-tab="export"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (document.querySelector(".privacy-export-copy") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(exportPrivacyData).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("{\n  \"counts\": {\n    \"blockRules\": 1\n  }\n}");
  });

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

  it("keeps the pet image interactive so double-click opens chat", async () => {
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") })
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const stage = document.querySelector(".pet-stage") as HTMLElement;
    expect(stage.className).not.toContain("drag-region");

    await act(async () => {
      stage.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(document.querySelector(".chat-input")).not.toBeNull();
  });

  it("opens DeepSeek settings from right-click without main-surface buttons", async () => {
    const saveDeepSeekSettings = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        configured: true,
        baseUrl: "https://api.deepseek.com",
        model: "DeepSeek V4 Pro",
        apiKeySource: "file",
        configPath: "C:/Users/me/AppData/Roaming/cline-desktop-pet/config.json"
      }
    });
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      getDeepSeekSettings: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          configured: false,
          baseUrl: "https://api.deepseek.com",
          model: "DeepSeek V4 Pro",
          apiKeySource: "missing",
          configPath: "C:/Users/me/AppData/Roaming/cline-desktop-pet/config.json"
        }
      }),
      saveDeepSeekSettings
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    expect(document.querySelector(".diagnose-button")).toBeNull();
    expect(document.querySelector(".settings-button")).toBeNull();
    expect(document.querySelector(".chat-history-trigger")).toBeNull();
    expect(document.querySelector(".memory-trigger")).toBeNull();

    await act(async () => {
      (document.querySelector(".pet-stage") as HTMLElement).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const apiKey = document.querySelector('input[name="apiKey"]') as HTMLInputElement;
    const model = document.querySelector('input[name="model"]') as HTMLInputElement;
    const form = document.querySelector(".settings-panel form") as HTMLFormElement;

    expect(model.value).toBe("DeepSeek V4 Pro");

    await act(async () => {
      apiKey.value = "sk-test";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(saveDeepSeekSettings).toHaveBeenCalledWith({ apiKey: "sk-test", baseUrl: "https://api.deepseek.com", model: "DeepSeek V4 Pro" });
    expect(document.querySelector(".speech-bubble")?.textContent).toContain("DeepSeek 已保存");
  });

  it("shows a diagnostics panel when the main process requests visible diagnostics", async () => {
    let diagnosticsHandler: ((payload: { text: string }) => void) | null = null;
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      onDiagnostics: vi.fn((callback) => {
        diagnosticsHandler = callback;
      }),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") })
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
      await Promise.resolve();
    });

    await act(async () => {
      diagnosticsHandler?.({ text: "Bridge: ok\nWindow: visible" });
      await Promise.resolve();
    });

    expect(document.querySelector(".diagnostics")?.textContent).toContain("Bridge: ok");
    expect(document.querySelector(".diagnostics")?.textContent).toContain("Window: visible");
  });

  it("uses pet dragging gestures to move the frameless window", async () => {
    const movePetWindowBy = vi.fn();
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({ stateImages: imageMap("file:///kaka") }),
      movePetWindowBy
    };

    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const stage = document.querySelector(".pet-stage") as HTMLElement;
    await act(async () => {
      stage.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, screenX: 100, screenY: 100 }));
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, screenX: 112, screenY: 106 }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(movePetWindowBy).toHaveBeenCalledWith(12, 6);
  });

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
      vi.advanceTimersByTime(650);
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, screenX: 102, screenY: 100 }));
      await Promise.resolve();
    });

    expect(reportHeadPatInteraction).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 700 }));
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/idle.png");
  });

  it("switches from patting to dragging when movement becomes large after patting starts", async () => {
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
      vi.advanceTimersByTime(450);
    });

    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/head-pat.png");

    await act(async () => {
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, buttons: 1, screenX: 130, screenY: 122 }));
    });

    expect(movePetWindowBy).toHaveBeenCalledWith(30, 22);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/dragging.png");

    await act(async () => {
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(reportHeadPatInteraction).not.toHaveBeenCalled();
    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/idle.png");
  });

  it("uses head-pat variants from the current pack when available", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    (window as any).clinePet = {
      onPetStatus: vi.fn(),
      onPetPack: vi.fn(),
      getPetPack: vi.fn().mockResolvedValue({
        stateImages: imageMap("file:///kaka"),
        variants: {
          "head-pat": ["file:///kaka/head-pat-soft.png", "file:///kaka/head-pat-warm.png"]
        }
      }),
      reportHeadPatInteraction: vi.fn().mockResolvedValue({ ok: true })
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

    expect(document.querySelector("img")?.getAttribute("src")).toBe("file:///kaka/head-pat-warm.png");
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
});