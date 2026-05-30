// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "../../../src/app/renderer/ChatInput";

function renderChatInput(onSubmit = vi.fn(), onCancel = vi.fn()) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  act(() => {
    root.render(React.createElement(ChatInput, { open: true, pending: false, onSubmit, onCancel }));
  });
  return { rootElement, onSubmit, onCancel };
}

describe("ChatInput", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

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

  it("auto-cancels when opened and left empty", () => {
    vi.useFakeTimers();
    const { onCancel } = renderChatInput();

    act(() => {
      vi.advanceTimersByTime(12000);
    });

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancels when Escape is pressed", () => {
    const { rootElement, onCancel } = renderChatInput();
    const input = rootElement.querySelector("input") as HTMLInputElement;

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledOnce();
  });
});