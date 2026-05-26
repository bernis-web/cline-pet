import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPetPacks, validatePetPack } from "../../src/assets/petPackManager";

function writePack(root: string, id: string, missingFile = false) {
  const packDir = join(root, id);
  mkdirSync(packDir, { recursive: true });
  const states = ["idle", "thinking", "working", "waiting-approval", "done", "error"];
  for (const state of states) {
    if (!(missingFile && state === "error")) writeFileSync(join(packDir, `${state}.svg`), `<svg>${state}</svg>`);
  }
  writeFileSync(join(packDir, "manifest.json"), JSON.stringify({
    id,
    name: "Test Pet",
    version: "1.0.0",
    states: Object.fromEntries(states.map((state) => [state, `${state}.svg`]))
  }, null, 2));
  return packDir;
}

describe("pet pack manager", () => {
  it("validates a complete pack", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-pack-"));
    const packDir = writePack(root, "pixel-dev");
    const result = validatePetPack(packDir);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pack.manifest.id).toBe("pixel-dev");
  });

  it("rejects a pack with missing animation file", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-pack-"));
    const packDir = writePack(root, "broken-dev", true);
    const result = validatePetPack(packDir);
    expect(result.ok).toBe(false);
  });

  it("discovers only valid packs", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-packs-"));
    writePack(root, "valid-dev");
    writePack(root, "invalid-dev", true);
    const packs = discoverPetPacks(root);
    expect(packs.map((pack) => pack.manifest.id)).toEqual(["valid-dev"]);
  });
});