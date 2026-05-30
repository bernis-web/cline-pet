import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { recordHeadPatInteraction } from "../../../src/app/main/interaction/headPatService";
import { loadRelationshipMemory, saveRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

describe("head pat interaction service", () => {
  const roots: string[] = [];

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("records a lightweight warmth signal without changing relationship scores", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);
    saveRelationshipMemory(root, (current) => ({
      ...current,
      familiarity: 30,
      affection: 40,
      engagement: 50,
      trust: 60
    }));

    const result = recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.200Z",
      durationMs: 1200
    });

    expect(result.ok).toBe(true);
    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({
      familiarity: 30,
      affection: 40,
      engagement: 50,
      trust: 60,
      lastHeadPatAt: "2026-05-30T04:00:01.200Z",
      recentWarmth: {
        source: "head-pat",
        intensity: "soft",
        updatedAt: "2026-05-30T04:00:01.200Z",
        expiresAt: "2026-05-30T04:30:01.200Z"
      }
    }));
  });

  it("ignores interactions that are too short to be intentional", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);

    const result = recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:00.300Z",
      durationMs: 300
    });

    expect(result).toEqual({ ok: false, errorCode: "HEAD_PAT_TOO_SHORT", message: "head pat duration is too short" });
    expect(loadRelationshipMemory(root).lastHeadPatAt).toBeUndefined();
  });

  it("rate-limits recent event text so repeated head pats do not create a game log", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-head-pat-"));
    roots.push(root);

    recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T04:00:00.000Z",
      endedAt: "2026-05-30T04:00:01.000Z",
      durationMs: 1000
    });
    recordHeadPatInteraction(root, {
      startedAt: "2026-05-30T05:00:00.000Z",
      endedAt: "2026-05-30T05:00:01.000Z",
      durationMs: 1000
    });

    const relationship = loadRelationshipMemory(root);
    expect(relationship.recentEvents.filter((event) => event.text === "今天被轻轻摸了摸头")).toHaveLength(1);
    expect(relationship.lastHeadPatAt).toBe("2026-05-30T05:00:01.000Z");
  });
});