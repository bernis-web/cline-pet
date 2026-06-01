import { describe, expect, it } from "vitest";
import { enqueueBubble } from "../../../src/app/renderer/bubbleQueue";
import type { BubbleMessage } from "../../../src/app/renderer/bubbleTypes";

function bubble(id: string, kind: BubbleMessage["kind"], text = id): BubbleMessage {
  return {
    id,
    kind,
    text,
    createdAt: `2026-06-01T00:00:0${id.length}.000Z`,
    autoHideMs: 5000,
    mode: "transient",
    isLongText: false
  };
}

describe("bubbleQueue", () => {
  it("blocks lower-priority bubbles while a readable chat bubble is active", () => {
    const current = { ...bubble("chat", "chat"), mode: "readable" as const };
    const result = enqueueBubble({ current, queue: [] }, bubble("presence", "status", "喝口水"));
    expect(result).toEqual({ current, queue: [] });
  });

  it("keeps chat ahead of presence and caps the queue", () => {
    let state = { current: bubble("status", "status"), queue: [] as BubbleMessage[] };
    state = enqueueBubble(state, bubble("presence1", "status"));
    state = enqueueBubble(state, bubble("chat1", "chat"));
    expect(state.current?.kind).toBe("chat");
    expect(state.current?.text).toBe("chat1");
    expect(state.queue.length).toBeLessThanOrEqual(5);
  });

  it("replaces the current bubble when a higher-priority bubble arrives", () => {
    const state = enqueueBubble(
      { current: { ...bubble("notice1", "notice", "卡卡正在想..."), autoHideMs: 3000 }, queue: [] },
      bubble("chat2", "chat", "我在这里陪着你。")
    );

    expect(state.current?.kind).toBe("chat");
    expect(state.current?.text).toContain("我在这里陪着你");
    expect(state.queue).toEqual([]);
  });
});