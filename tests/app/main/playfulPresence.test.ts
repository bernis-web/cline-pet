import { describe, expect, it } from "vitest";
import { decidePlayfulPresence } from "../../../src/app/main/playfulPresence";

const relationship = {
  familiarity: 10,
  affection: 10,
  engagement: 10,
  trust: 10,
  recentEvents: [],
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("playfulPresence", () => {
  it("prefers a happy follow-up after a recent chat window", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "happy",
      message: "刚刚和你聊天我很开心，还想继续陪你。"
    });
  });

  it("prefers a clingy follow-up after a recent head-pat window", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulAttachedUntil: "2026-06-01T15:30:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "要不要再摸摸我呀？我会乖一点。"
    });
  });

  it("uses a sleepy line at night instead of a lively one", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T23:30:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T23:45:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "sleepy",
      message: "我还在喔，晚一点要不要一起休息？"
    });
  });

  it("uses a quiet supportive line after a stressed chat warmth window", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: {
        ...relationship,
        recentWarmth: {
          source: "chat",
          intensity: "normal",
          updatedAt: "2026-06-01T14:55:00.000Z",
          expiresAt: "2026-06-01T15:20:00.000Z"
        }
      },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "如果你还想说，我会安静继续陪你。"
    });
  });

  it("stays quiet while reading, busy, or inside cooldown", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle",
      userIsReading: true
    })).toBeNull();

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "loading"
    })).toBeNull();

    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      lastPresenceAt: "2026-06-01T14:00:00.000Z",
      relationship: { ...relationship, playfulChatUntil: "2026-06-01T15:15:00.000Z" },
      latestVisibleStatus: "idle"
    })).toBeNull();
  });

  it("can emit a low-frequency idle check-in after long inactivity", () => {
    expect(decidePlayfulPresence({
      now: "2026-06-01T15:00:00.000Z",
      relationship: { ...relationship, lastInteractionAt: "2026-06-01T08:00:00.000Z" },
      latestVisibleStatus: "idle"
    })).toEqual({
      status: "message",
      message: "我在这里等你，想理我了就叫我。"
    });
  });
});