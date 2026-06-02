import { describe, expect, it } from "vitest";
import { createChatMoodStatus } from "../../../src/app/main/chatMood";

describe("chat mood status", () => {
  it("turns a successful friendly chat into a visible happy pet status", () => {
    const status = createChatMoodStatus({
      now: "2026-05-31T15:30:00.000Z",
      latestVisibleStatus: "idle",
      relationship: {
        familiarity: 5,
        affection: 18,
        engagement: 12,
        trust: 10,
        recentEvents: [],
        updatedAt: "2026-05-31T15:29:00.000Z"
      }
    });

    expect(status).toEqual({
      status: "happy",
      visibleStatus: "happy",
      baseStatus: "happy",
      overlayStatus: null,
      task: "",
      source: "chat",
      updatedAt: "2026-05-31T15:30:00.000Z"
    });
  });

  it("uses focused chat sentiment when creating the visible pet status", () => {
    const status = createChatMoodStatus({
      now: "2026-06-01T12:00:00.000Z",
      latestVisibleStatus: "idle",
      sentiment: "focused",
      memoryHitCount: 1,
      relationship: {
        familiarity: 20,
        affection: 20,
        engagement: 80,
        trust: 20,
        recentEvents: [],
        updatedAt: "2026-06-01T11:59:00.000Z"
      }
    });

    expect(status).toEqual(expect.objectContaining({ status: "thinking", source: "chat" }));
  });
});