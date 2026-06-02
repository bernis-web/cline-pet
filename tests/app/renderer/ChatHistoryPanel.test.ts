// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatHistoryPanel } from "../../../src/app/renderer/ChatHistoryPanel";

describe("ChatHistoryPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders searchable turns and clear action", async () => {
    const onClear = vi.fn();
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(ChatHistoryPanel, {
        open: true,
        turns: [{
          id: "t1",
          userText: "今天好累",
          assistantText: "先喝口水，我在旁边陪你。",
          createdAt: "2026-06-01T01:00:00.000Z",
          sentiment: "tired",
          memoryIds: []
        }],
        pending: false,
        onClose: () => undefined,
        onClear
      }));
    });

    expect(rootElement.querySelector(".chat-history-panel")?.textContent).toContain("今天好累");
    const input = rootElement.querySelector('input[name="historySearch"]') as HTMLInputElement;
    await act(async () => {
      input.value = "喝口水";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rootElement.querySelector(".chat-history-panel")?.textContent).toContain("先喝口水");
    await act(async () => {
      (rootElement.querySelector(".chat-history-clear") as HTMLButtonElement).click();
    });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows a calm empty state", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);
    await act(async () => {
      root.render(React.createElement(ChatHistoryPanel, {
        open: true,
        turns: [],
        pending: false,
        onClose: () => undefined,
        onClear: () => undefined
      }));
    });
    expect(rootElement.querySelector(".chat-history-empty")?.textContent).toContain("还没有对话记录");
  });
});