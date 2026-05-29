import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { ProfileMemory } from "../../../src/app/main/memory/memoryTypes";
import { loadProfileMemory, saveProfileMemory } from "../../../src/app/main/memory/profileStore";

describe("profile store", () => {
  const roots: string[] = [];

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("returns empty default profile when file is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-profile-"));
    roots.push(root);

    expect(loadProfileMemory(root)).toEqual({
      likes: [],
      dislikes: [],
      habits: [],
      topics: [],
      notes: [],
      updatedAt: expect.any(String)
    });
  });

  it("persists merged profile updates", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-profile-"));
    roots.push(root);

    saveProfileMemory(root, (current: ProfileMemory) => ({ ...current, preferredAddress: "主人", likes: ["深夜开发"] }));

    expect(loadProfileMemory(root)).toEqual(expect.objectContaining({ preferredAddress: "主人", likes: ["深夜开发"] }));
  });
});