import { describe, expect, it } from "vitest";
import { buildMemoryPromptContext } from "../../../src/app/main/memory/memoryService";

describe("memoryService", () => {
  it("builds a compact prompt context from profile, relationship, and retrieved memories", () => {
    const context = buildMemoryPromptContext({
      profile: {
        preferredAddress: "主人",
        likes: ["深夜开发"],
        dislikes: [],
        habits: [],
        topics: [],
        notes: [],
        updatedAt: "2026-05-29T00:00:00.000Z"
      },
      relationship: {
        familiarity: 60,
        affection: 70,
        engagement: 55,
        trust: 65,
        recentEvents: [],
        updatedAt: "2026-05-29T00:00:00.000Z"
      },
      memories: [{
        id: "m1",
        kind: "preference",
        text: "用户喜欢卡卡少打扰",
        tags: ["preference"],
        weight: 90,
        createdAt: "2026-05-29T00:00:00.000Z",
        updatedAt: "2026-05-29T00:00:00.000Z"
      }]
    });

    expect(context.profileSummary).toContain("主人");
    expect(context.relationshipSummary).toContain("affection=70");
    expect(context.retrievedMemories).toHaveLength(1);
  });
});