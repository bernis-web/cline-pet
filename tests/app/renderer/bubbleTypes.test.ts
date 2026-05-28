import { describe, expect, it } from "vitest";
import { bubbleFromChat, bubbleFromStatus, shouldShowStatusBubble } from "../../../src/app/renderer/bubbleTypes";

const now = "2026-05-28T00:00:00.000Z";

describe("bubble message strategy", () => {
  it("creates a status bubble from status task text", () => {
    const bubble = bubbleFromStatus({
      status: "thinking",
      visibleStatus: "thinking",
      baseStatus: "thinking",
      overlayStatus: null,
      task: "正在分析项目",
      updatedAt: now
    });

    expect(bubble).toEqual({
      id: expect.stringContaining("status-"),
      kind: "status",
      text: "正在分析项目",
      status: "thinking",
      createdAt: now,
      autoHideMs: 4500
    });
  });

  it("prefers explicit status message over task", () => {
    const bubble = bubbleFromStatus({
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "fallback task",
      message: "需要你确认",
      updatedAt: now
    });

    expect(bubble?.text).toBe("需要你确认");
  });

  it("does not show a status bubble when there is no message or task", () => {
    expect(shouldShowStatusBubble({
      status: "idle",
      visibleStatus: "idle",
      baseStatus: "idle",
      overlayStatus: null,
      updatedAt: now
    })).toBe(false);
  });

  it("creates a chat bubble from assistant text", () => {
    const bubble = bubbleFromChat("你好，我是卡卡。", now);

    expect(bubble).toEqual({
      id: expect.stringContaining("chat-"),
      kind: "chat",
      text: "你好，我是卡卡。",
      createdAt: now,
      autoHideMs: 9000
    });
  });
});