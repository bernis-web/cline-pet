import { describe, expect, it } from "vitest";
import { maybeCreatePresencePulse } from "../../../src/app/main/presenceService";

describe("presence service", () => {
  it("stays quiet during cooldown", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-05-29T20:00:00.000Z",
      lastPresenceAt: "2026-05-29T19:45:00.000Z",
      latestVisibleStatus: "loading",
      mood: "attached"
    });

    expect(pulse).toBeNull();
  });

  it("emits a gentle message after a long quiet period", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-05-29T21:00:00.000Z",
      lastPresenceAt: "2026-05-29T10:00:00.000Z",
      latestVisibleStatus: "idle",
      mood: "lonely"
    });

    expect(pulse).toEqual(expect.objectContaining({ status: "message", message: expect.stringContaining("陪") }));
  });

  it("stays quiet while the user is reading a chat bubble", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T21:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "idle",
      mood: "lonely",
      userIsReading: true
    });

    expect(pulse).toBeNull();
  });

  it("can emit a rare work-session care reminder after cooldown", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T21:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "loading",
      mood: "curious",
      longWorkSession: true
    });

    expect(pulse?.message).toContain("喝口水");
  });

  it("uses a closer long-work reminder when the relationship stage is trusted", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T21:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "loading",
      mood: "curious",
      longWorkSession: true,
      relationship: {
        familiarity: 80,
        affection: 82,
        engagement: 78,
        trust: 80,
        recentEvents: [],
        updatedAt: "2026-06-01T20:50:00.000Z"
      }
    });

    expect(pulse?.message).toContain("先喝口水");
  });

  it("maps a playful chat decision into a presence payload", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T15:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "idle",
      mood: "calm",
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        playfulChatUntil: "2026-06-01T15:15:00.000Z",
        recentEvents: [],
        updatedAt: "2026-06-01T14:50:00.000Z"
      }
    });

    expect(pulse).toEqual(expect.objectContaining({
      status: "happy",
      visibleStatus: "happy",
      source: "presence",
      message: "刚刚和你聊天我很开心，还想继续陪你。"
    }));
  });

  it("keeps the long-work reminder ahead of playful follow-ups", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-06-01T21:00:00.000Z",
      lastPresenceAt: "2026-06-01T10:00:00.000Z",
      latestVisibleStatus: "loading",
      mood: "curious",
      longWorkSession: true,
      relationship: {
        familiarity: 10,
        affection: 10,
        engagement: 10,
        trust: 10,
        playfulChatUntil: "2026-06-01T21:15:00.000Z",
        recentEvents: [],
        updatedAt: "2026-06-01T20:50:00.000Z"
      }
    });

    expect(pulse?.message).toContain("喝口水");
  });
});