// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/renderer/App";
import { PET_STATUSES, type PetStatus } from "../../../src/shared/statuses";
import { createRendererPetBridge } from "../../../src/app/renderer/petBridge";

function imageMap(prefix: string) {
  return Object.fromEntries(PET_STATUSES.map((status) => [status, `${prefix}/${status}.png`])) as Record<PetStatus, string>;
}

describe("renderer App", () => {
  afterEach(() => {
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
});