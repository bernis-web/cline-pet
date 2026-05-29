import { describe, expect, it } from "vitest";
import { deriveMoodState } from "../../../src/app/main/moodEngine";

describe("mood engine", () => {
  it("leans happy when affection is high and the last interaction was positive", () => {
    const mood = deriveMoodState({
      now: "2026-05-29T14:00:00.000Z",
      relationship: {
        familiarity: 60,
        affection: 80,
        engagement: 70,
        trust: 75,
        recentEvents: [],
        updatedAt: "2026-05-29T13:50:00.000Z"
      },
      hasRecentChat: true,
      lastChatSentiment: "positive",
      memoryHitCount: 2,
      clineVisibleStatus: "idle"
    });

    expect(mood.name).toBe("happy");
    expect(mood.suggestedStatus).toBe("happy");
  });

  it("leans sleepy late at night when there is no recent interaction", () => {
    const mood = deriveMoodState({
      now: "2026-05-29T23:30:00.000Z",
      relationship: {
        familiarity: 20,
        affection: 20,
        engagement: 15,
        trust: 20,
        recentEvents: [],
        updatedAt: "2026-05-29T20:00:00.000Z"
      },
      hasRecentChat: false,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: "idle"
    });

    expect(mood.name).toBe("sleepy");
    expect(["sleepy", "sleeping"]).toContain(mood.suggestedStatus);
  });
});