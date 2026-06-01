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
});