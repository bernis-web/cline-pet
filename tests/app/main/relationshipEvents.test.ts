import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { applyChatRelationshipEvent } from "../../../src/app/main/memory/relationshipEvents";
import { loadRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

describe("relationshipEvents", () => {
  const roots: string[] = [];

  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "cline-relationship-event-"));
    roots.push(root);
    return root;
  }

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("adds bounded chat growth and records recent event", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T04:00:00.000Z",
      sentiment: "focused",
      relationshipEvent: "work-session"
    });

    expect(updated).toEqual(expect.objectContaining({ familiarity: 1, engagement: 2 }));
    expect(updated.recentEvents[0].text).toContain("一起专注了一会儿");
    expect(loadRelationshipMemory(root).engagement).toBe(2);
  });

  it("uses diminishing returns for repeated same-day chat growth", () => {
    const root = tempRoot();
    applyChatRelationshipEvent(root, { now: "2026-06-01T04:00:00.000Z", sentiment: "focused", relationshipEvent: "work-session" });
    const updated = applyChatRelationshipEvent(root, { now: "2026-06-01T05:00:00.000Z", sentiment: "focused", relationshipEvent: "work-session" });

    expect(updated.engagement).toBeLessThanOrEqual(3);
    expect(updated.recentEvents.filter((event) => event.text.includes("一起专注了一会儿"))).toHaveLength(1);
  });

  it("opens a short playful chat window after a normal chat turn", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T04:00:00.000Z",
      sentiment: "positive",
      relationshipEvent: "chat"
    });

    expect(updated.playfulChatUntil).toBe("2026-06-01T04:15:00.000Z");
  });

  it("does not open a playful chat window for focused work-session turns", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T04:00:00.000Z",
      sentiment: "focused",
      relationshipEvent: "work-session"
    });

    expect(updated.playfulChatUntil).toBeUndefined();
  });

  it("turns stressed chats into a quiet warmth window instead of a happy one", () => {
    const root = tempRoot();
    const updated = applyChatRelationshipEvent(root, {
      now: "2026-06-01T06:00:00.000Z",
      sentiment: "stressed",
      relationshipEvent: "support"
    });

    expect(updated.playfulChatUntil).toBeUndefined();
    expect(updated.recentWarmth).toEqual({
      source: "chat",
      intensity: "normal",
      updatedAt: "2026-06-01T06:00:00.000Z",
      expiresAt: "2026-06-01T06:20:00.000Z"
    });
    expect(loadRelationshipMemory(root).recentWarmth?.source).toBe("chat");
  });
});