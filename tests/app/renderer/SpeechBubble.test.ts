// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { SpeechBubble } from "../../../src/app/renderer/SpeechBubble";
import type { BubbleMessage } from "../../../src/app/renderer/bubbleTypes";

function renderBubble(message: BubbleMessage | null, props: { onOpenReadable?(): void; onClose?(): void } = {}) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  act(() => {
    root.render(React.createElement(SpeechBubble, { message, ...props }));
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
      autoHideMs: 9000,
      mode: "transient",
      isLongText: false
    });

    expect(rootElement.querySelector(".speech-bubble")?.textContent).toContain("你好，我是卡卡。");
    expect(rootElement.querySelector(".speech-bubble")?.getAttribute("data-kind")).toBe("chat");
  });

  it("opens long transient chat bubbles into readable mode on click and renders a close button in readable mode", () => {
    const onOpenReadable = vi.fn();
    const onClose = vi.fn();
    const rootElement = renderBubble({
      id: "chat-2",
      kind: "chat",
      text: "这是一段很长很长很长很长很长很长很长很长很长很长很长的回复。",
      createdAt: "2026-06-01T00:00:00.000Z",
      autoHideMs: 5000,
      mode: "transient",
      isLongText: true
    }, { onOpenReadable, onClose });

    act(() => {
      (rootElement.querySelector(".speech-bubble") as HTMLElement).click();
    });
    expect(onOpenReadable).toHaveBeenCalledOnce();

    const readableRoot = renderBubble({
      id: "chat-3",
      kind: "chat",
      text: "继续读。",
      createdAt: "2026-06-01T00:00:01.000Z",
      autoHideMs: null,
      mode: "readable",
      isLongText: true
    }, { onClose });

    act(() => {
      (readableRoot.querySelector(".speech-bubble-close") as HTMLButtonElement).click();
    });
    expect(readableRoot.querySelector(".speech-bubble")?.getAttribute("data-mode")).toBe("readable");
    expect(onClose).toHaveBeenCalledOnce();
  });
});