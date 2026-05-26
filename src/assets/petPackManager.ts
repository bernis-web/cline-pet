import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ERROR_CODES } from "../shared/errors.js";
import { petPackManifestSchema } from "../shared/schemas.js";
import type { PetPackManifest } from "../shared/schemas.js";

export type PetPack = {
  dir: string;
  manifest: PetPackManifest;
  stateFiles: Record<string, string>;
};

export type PetPackValidationResult =
  | { ok: true; pack: PetPack }
  | { ok: false; errorCode: typeof ERROR_CODES.INVALID_PET_PACK; message: string };

export function validatePetPack(packDir: string): PetPackValidationResult {
  const manifestPath = join(packDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: "manifest.json is missing" };
  }

  const parsed = petPackManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf8")));
  if (!parsed.success) {
    return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: parsed.error.message };
  }

  const stateFiles: Record<string, string> = {};
  for (const [state, relativeFile] of Object.entries(parsed.data.states) as [string, string][]) {
    const filePath = resolve(packDir, relativeFile);
    if (!filePath.startsWith(resolve(packDir))) {
      return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: `state ${state} points outside pack` };
    }
    if (!existsSync(filePath)) {
      return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: `state file missing: ${relativeFile}` };
    }
    stateFiles[state] = filePath;
  }

  return { ok: true, pack: { dir: packDir, manifest: parsed.data, stateFiles } };
}

export function discoverPetPacks(rootDir: string): PetPack[] {
  if (!existsSync(rootDir)) return [];
  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => validatePetPack(join(rootDir, entry.name)))
    .filter((result): result is { ok: true; pack: PetPack } => result.ok)
    .map((result) => result.pack)
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}