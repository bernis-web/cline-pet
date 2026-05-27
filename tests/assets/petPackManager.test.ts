import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPetPacks, validatePetPack } from "../../src/assets/petPackManager";
import { LEGACY_PET_STATUSES, PET_STATUSES } from "../../src/shared/statuses";

function writeLegacyPack(root: string, id: string, missingFile = false) {
  const packDir = join(root, id);
  mkdirSync(packDir, { recursive: true });
  for (const state of LEGACY_PET_STATUSES) {
    if (!(missingFile && state === "error")) writeFileSync(join(packDir, `${state}.svg`), `<svg>${state}</svg>`);
  }
  writeFileSync(join(packDir, "manifest.json"), JSON.stringify({
    id,
    name: "Legacy Pet",
    version: "1.0.0",
    states: Object.fromEntries(LEGACY_PET_STATUSES.map((state) => [state, `${state}.svg`]))
  }, null, 2));
  return packDir;
}

function writeV2Pack(root: string, id: string, missingState?: string) {
  const packDir = join(root, id);
  mkdirSync(packDir, { recursive: true });
  for (const state of PET_STATUSES) {
    if (state !== missingState) writeFileSync(join(packDir, `${state}.png`), `png:${state}`);
  }
  writeFileSync(join(packDir, "manifest.json"), JSON.stringify({
    id,
    name: "Kaka Pet",
    version: "1.0.0",
    formatVersion: 2,
    states: Object.fromEntries(PET_STATUSES.map((state) => [state, `${state}.png`]))
  }, null, 2));
  return packDir;
}

describe("pet pack manager", () => {
  it("validates a complete legacy pack", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-pack-"));
    const packDir = writeLegacyPack(root, "pixel-dev");
    const result = validatePetPack(packDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack.manifest.id).toBe("pixel-dev");
      expect(result.pack.formatVersion).toBe(1);
      expect(result.pack.hasAllStandardStates).toBe(false);
      expect(result.pack.stateFiles.loading).toContain("working.svg");
      expect(result.pack.stateFiles.message).toContain("waiting-approval.svg");
    }
  });

  it("validates a complete v2 12-state pack", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-pack-"));
    const packDir = writeV2Pack(root, "kaka-desktop-pet");
    const result = validatePetPack(packDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack.formatVersion).toBe(2);
      expect(result.pack.hasAllStandardStates).toBe(true);
      expect(Object.keys(result.pack.stateFiles)).toEqual([...PET_STATUSES]);
    }
  });

  it("rejects a v2 pack with a missing state file", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-pack-"));
    const packDir = writeV2Pack(root, "broken-kaka", "signal-weak");
    const result = validatePetPack(packDir);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("state file missing: signal-weak.png");
  });

  it("rejects a pack with a path escaping the pack directory", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-pack-"));
    const packDir = writeV2Pack(root, "escaping-kaka");
    writeFileSync(join(packDir, "manifest.json"), JSON.stringify({
      id: "escaping-kaka",
      name: "Escaping Kaka",
      formatVersion: 2,
      states: { ...Object.fromEntries(PET_STATUSES.map((state) => [state, `${state}.png`])), idle: "../idle.png" }
    }));
    const result = validatePetPack(packDir);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("points outside pack");
  });

  it("discovers only valid packs", () => {
    const root = mkdtempSync(join(tmpdir(), "pet-packs-"));
    writeV2Pack(root, "valid-kaka");
    writeV2Pack(root, "invalid-kaka", "loading");
    const packs = discoverPetPacks(root);
    expect(packs.map((pack) => pack.manifest.id)).toEqual(["valid-kaka"]);
  });
});
