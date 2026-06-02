// @vitest-environment jsdom
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeepSeekSettingsPanel } from "../../../src/app/renderer/DeepSeekSettingsPanel";

function renderPanel(onSave = vi.fn()) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  act(() => {
    root.render(React.createElement(DeepSeekSettingsPanel, {
      open: true,
      pending: false,
      settings: {
        configured: false,
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
        apiKeySource: "missing",
        configPath: "C:/Users/me/AppData/Roaming/cline-desktop-pet/config.json"
      },
      onSave,
      onCancel: vi.fn()
    }));
  });
  return { rootElement, onSave };
}

describe("DeepSeekSettingsPanel", () => {
  it("renders nothing when closed", () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    act(() => {
      root.render(React.createElement(DeepSeekSettingsPanel, { open: false, pending: false, settings: null, onSave: vi.fn(), onCancel: vi.fn() }));
    });

    expect(rootElement.querySelector(".settings-panel")).toBeNull();
  });

  it("submits API key and optional endpoint settings", () => {
    const { rootElement, onSave } = renderPanel();
    const apiKey = rootElement.querySelector('input[name="apiKey"]') as HTMLInputElement;
    const baseUrl = rootElement.querySelector('input[name="baseUrl"]') as HTMLInputElement;
    const model = rootElement.querySelector('input[name="model"]') as HTMLInputElement;
    const form = rootElement.querySelector("form") as HTMLFormElement;

    act(() => {
      apiKey.value = "sk-test";
      baseUrl.value = "https://api.deepseek.com/";
      model.value = "deepseek-chat";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSave).toHaveBeenCalledWith({ apiKey: "sk-test", baseUrl: "https://api.deepseek.com/", model: "deepseek-chat" });
  });

  it("updates visible field values when saved settings load after opening", () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createRoot(rootElement);

    act(() => {
      root.render(React.createElement(DeepSeekSettingsPanel, { open: true, pending: false, settings: null, onSave: vi.fn(), onCancel: vi.fn() }));
    });

    act(() => {
      root.render(React.createElement(DeepSeekSettingsPanel, {
        open: true,
        pending: false,
        settings: {
          configured: true,
          baseUrl: "https://api.deepseek.com",
          model: "DeepSeek V4 Pro",
          apiKeySource: "file",
          configPath: "C:/Users/me/AppData/Roaming/cline-desktop-pet/config.json"
        },
        onSave: vi.fn(),
        onCancel: vi.fn()
      }));
    });

    expect((rootElement.querySelector('input[name="model"]') as HTMLInputElement).value).toBe("DeepSeek V4 Pro");
  });
});