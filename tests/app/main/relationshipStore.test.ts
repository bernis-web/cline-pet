import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { RelationshipMemory } from "../../../src/app/main/memory/memoryTypes";
import { loadRelationshipMemory, saveRelationshipMemory } from "../../../src/app/main/memory/relationshipStore";

describe("relationship store", () => {
  const roots: string[] = [];

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("returns bounded default relationship values", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-relationship-"));
    roots.push(root);

    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({ familiarity: 0, affection: 0, engagement: 0, trust: 0, recentEvents: [] }));
  });

  it("persists updates and clamps scores into 0-100", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-relationship-"));
    roots.push(root);

    saveRelationshipMemory(root, (current: RelationshipMemory) => ({ ...current, familiarity: 130, affection: -10, engagement: 40, trust: 55 }));

    expect(loadRelationshipMemory(root)).toEqual(expect.objectContaining({ familiarity: 100, affection: 0, engagement: 40, trust: 55 }));
  });
});