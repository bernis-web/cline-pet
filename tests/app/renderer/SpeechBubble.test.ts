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