// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryPanel } from "../../../src/app/renderer/MemoryPanel";
import type { MemoryOverview } from "../../../src/app/renderer/memoryTypes";

const overview: MemoryOverview = {
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
  memories: [
    {
      id: "m1",
      kind: "preference",
      text: "用户喜欢温柔提醒",
      tags: ["chat", "preference"],
      weight: 80,
      createdAt: "2026-06-01T01:00:00.000Z",
      updatedAt: "2026-06-01T03:00:00.000Z"
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
  ]
};

function renderPanel(props: Partial<React.ComponentProps<typeof MemoryPanel>> = {}) {
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  const callbacks = {
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    onExport: vi.fn()
  };
  act(() => {
    root.render(React.createElement(MemoryPanel, {
      open: true,
      pending: false,
      overview,
      ...callbacks,
      ...props
    }));
  });
  return { rootElement, root, callbacks };
}

describe("MemoryPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders relationship overview and memories", () => {
    const { rootElement } = renderPanel();

    expect(rootElement.querySelector(".memory-panel")?.textContent).toContain("记忆与关系");
    expect(rootElement.textContent).toContain("亲近");
    expect(rootElement.textContent).toContain("熟悉度");
    expect(rootElement.textContent).toContain("用户喜欢温柔提醒");
  });

  it("filters memories by search text and kind", async () => {
    const { rootElement } = renderPanel();
    const search = rootElement.querySelector('input[name="memorySearch"]') as HTMLInputElement;
    const kind = rootElement.querySelector('select[name="memoryKind"]') as HTMLSelectElement;

    await act(async () => {
      search.value = "桌宠";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rootElement.textContent).toContain("项目是卡卡桌宠");
    expect(rootElement.textContent).not.toContain("用户喜欢温柔提醒");

    await act(async () => {
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      kind.value = "preference";
      kind.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(rootElement.textContent).toContain("用户喜欢温柔提醒");
    expect(rootElement.textContent).not.toContain("项目是卡卡桌宠");
  });

  it("fires delete, clear, and export callbacks", async () => {
    const { rootElement, callbacks } = renderPanel();

    await act(async () => {
      (rootElement.querySelector('[data-memory-delete="m1"]') as HTMLButtonElement).click();
      (rootElement.querySelector(".memory-clear") as HTMLButtonElement).click();
      (rootElement.querySelector(".memory-export") as HTMLButtonElement).click();
    });

    expect(callbacks.onDelete).toHaveBeenCalledWith("m1");
    expect(callbacks.onClear).toHaveBeenCalledOnce();
    expect(callbacks.onExport).toHaveBeenCalledOnce();
  });

  it("shows an empty state", () => {
    const { rootElement } = renderPanel({ overview: { ...overview, memories: [] } });

    expect(rootElement.querySelector(".memory-empty")?.textContent).toContain("卡卡还没有长期记忆");
  });

  it("renders nothing while closed", () => {
    const { rootElement } = renderPanel({ open: false });

    expect(rootElement.querySelector(".memory-panel")).toBeNull();
  });
});