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