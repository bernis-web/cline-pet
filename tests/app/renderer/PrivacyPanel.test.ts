// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyPanel } from "../../../src/app/renderer/PrivacyPanel";
import type { PrivacyOverview, PrivacyTab } from "../../../src/app/renderer/privacyTypes";

const overview: PrivacyOverview = {
  relationship: {
    stage: "close",
    stageLabel: "亲近",
    stageDescription: "卡卡和你更亲近了，会更自然地回应你的习惯。",
    familiarity: 50,
    affection: 60,
    engagement: 70,
    trust: 80,
    updatedAt: "2026-06-01T04:00:00.000Z"
  },
  memories: [{
    id: "m1",
    kind: "preference",
    text: "用户喜欢温柔提醒",
    tags: ["chat"],
    weight: 80,
    createdAt: "2026-06-01T01:00:00.000Z",
    updatedAt: "2026-06-01T03:00:00.000Z"
  }],
  blockRules: [{
    id: "rule-1",
    text: "不要记住咖啡",
    kind: "preference",
    sourceMemoryId: "old-memory",
    createdAt: "2026-06-01T02:00:00.000Z"
  }],
  chatHistory: [{
    id: "turn-1",
    userText: "今天好累",
    assistantText: "先喝口水，我在旁边陪你。",
    createdAt: "2026-06-01T04:00:00.000Z",
    sentiment: "tired",
    memoryIds: ["m1"]
  }],
  counts: { memories: 1, blockRules: 1, chatHistoryTurns: 1 }
};

function renderPanel(initialTab: PrivacyTab = "memories", props: Partial<React.ComponentProps<typeof PrivacyPanel>> = {}) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  const callbacks = {
    onClose: vi.fn(),
    onDeleteMemory: vi.fn(),
    onClearMemories: vi.fn(),
    onExportPrivacyData: vi.fn(),
    onUpdateMemory: vi.fn(),
    onBlockMemory: vi.fn(),
    onDeleteBlockRule: vi.fn(),
    onClearBlockRules: vi.fn(),
    onClearChatHistory: vi.fn()
  };
  act(() => {
    root.render(React.createElement(PrivacyPanel, {
      open: true,
      pending: false,
      overview,
      initialTab,
      ...callbacks,
      ...props
    }));
  });
  return { rootElement, root, callbacks };
}

describe("PrivacyPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders the unified privacy shell and tab buttons", () => {
    const { rootElement } = renderPanel();

    expect(rootElement.querySelector(".privacy-panel")?.textContent).toContain("隐私与记忆");
    expect(rootElement.querySelector('[data-privacy-tab="memories"]')?.textContent).toContain("长期记忆");
    expect(rootElement.querySelector('[data-privacy-tab="blocklist"]')?.textContent).toContain("不要再记");
    expect(rootElement.querySelector('[data-privacy-tab="history"]')?.textContent).toContain("聊天历史");
    expect(rootElement.querySelector('[data-privacy-tab="export"]')?.textContent).toContain("导出/清除");
  });

  it("opens on the requested initial tab", () => {
    const { rootElement } = renderPanel("history");

    expect(rootElement.querySelector(".privacy-history-section")?.textContent).toContain("今天好累");
    expect(rootElement.querySelector(".privacy-memory-section")).toBeNull();
  });

  it("switches tabs and shows blocklist rules", async () => {
    const { rootElement } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-privacy-tab="blocklist"]') as HTMLButtonElement).click();
    });

    expect(rootElement.querySelector(".privacy-blocklist-section")?.textContent).toContain("不要记住咖啡");
    expect(rootElement.querySelector(".privacy-blocklist-section")?.textContent).not.toContain("normalizedText");
  });

  it("fires memory callbacks from the memory tab", async () => {
    const { rootElement, callbacks } = renderPanel("memories");

    await act(async () => {
      (rootElement.querySelector('[data-memory-edit="m1"]') as HTMLButtonElement).click();
    });
    const editor = rootElement.querySelector('textarea[name="memoryEditText"]') as HTMLTextAreaElement;
    await act(async () => {
      editor.value = "用户喜欢安静温柔的提醒";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      (rootElement.querySelector(".memory-edit-save") as HTMLButtonElement).click();
      (rootElement.querySelector('[data-memory-block="m1"]') as HTMLButtonElement).click();
      (rootElement.querySelector('[data-memory-delete="m1"]') as HTMLButtonElement).click();
    });

    expect(callbacks.onUpdateMemory).toHaveBeenCalledWith("m1", "用户喜欢安静温柔的提醒");
    expect(callbacks.onBlockMemory).toHaveBeenCalledWith("m1");
    expect(callbacks.onDeleteMemory).toHaveBeenCalledWith("m1");
  });

  it("fires blocklist delete and clear callbacks", async () => {
    const { rootElement, callbacks } = renderPanel("blocklist");

    await act(async () => {
      (rootElement.querySelector('[data-block-rule-delete="rule-1"]') as HTMLButtonElement).click();
      (rootElement.querySelector(".block-rules-clear") as HTMLButtonElement).click();
    });

    expect(callbacks.onDeleteBlockRule).toHaveBeenCalledWith("rule-1");
    expect(callbacks.onClearBlockRules).toHaveBeenCalledOnce();
  });

  it("supports chat history search, copy, and clear", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { rootElement, callbacks } = renderPanel("history");

    const search = rootElement.querySelector('input[name="historySearch"]') as HTMLInputElement;
    await act(async () => {
      search.value = "喝口水";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      (rootElement.querySelector(".chat-history-copy") as HTMLButtonElement).click();
      (rootElement.querySelector(".chat-history-clear") as HTMLButtonElement).click();
    });

    expect(rootElement.querySelector(".privacy-history-section")?.textContent).toContain("先喝口水");
    expect(writeText).toHaveBeenCalledWith("你：今天好累\n卡卡：先喝口水，我在旁边陪你。");
    expect(callbacks.onClearChatHistory).toHaveBeenCalledOnce();
  });

  it("shows export and separated clear actions", async () => {
    const { rootElement, callbacks } = renderPanel("export");

    expect(rootElement.querySelector(".privacy-export-section")?.textContent).toContain("长期记忆 1");
    expect(rootElement.querySelector(".privacy-export-section")?.textContent).toContain("不要再记 1");
    expect(rootElement.querySelector(".privacy-export-section")?.textContent).toContain("聊天历史 1");

    await act(async () => {
      (rootElement.querySelector(".privacy-export-copy") as HTMLButtonElement).click();
      (rootElement.querySelector(".privacy-clear-memories") as HTMLButtonElement).click();
      (rootElement.querySelector(".privacy-clear-block-rules") as HTMLButtonElement).click();
      (rootElement.querySelector(".privacy-clear-history") as HTMLButtonElement).click();
    });

    expect(callbacks.onExportPrivacyData).toHaveBeenCalledOnce();
    expect(callbacks.onClearMemories).toHaveBeenCalledOnce();
    expect(callbacks.onClearBlockRules).toHaveBeenCalledOnce();
    expect(callbacks.onClearChatHistory).toHaveBeenCalledOnce();
  });

  it("renders nothing while closed", () => {
    const { rootElement } = renderPanel("memories", { open: false });

    expect(rootElement.querySelector(".privacy-panel")).toBeNull();
  });
});