import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { ERROR_CODES } from "../shared/errors.js";
import { petPackManifestSchema } from "../shared/schemas.js";
import type { PetPackManifest } from "../shared/schemas.js";
import { PET_STATUSES, PET_STATUS_ALIASES, type PetStatus } from "../shared/statuses.js";

export type PetPack = {
  dir: string;
  manifest: PetPackManifest;
  stateFiles: Record<PetStatus, string>;
  formatVersion: 1 | 2;
  hasAllStandardStates: boolean;
};

export type PetPackValidationResult =
  | { ok: true; pack: PetPack }
  | { ok: false; errorCode: typeof ERROR_CODES.INVALID_PET_PACK; message: string };

function isInsideDir(parentDir: string, childPath: string) {
  const relativePath = relative(resolve(parentDir), resolve(childPath));
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function resolveStateFile(packDir: string, state: string, relativeFile: string) {
  const filePath = resolve(packDir, relativeFile);
  if (!isInsideDir(packDir, filePath)) {
    return { ok: false as const, message: `state ${state} points outside pack` };
  }
  if (!existsSync(filePath)) {
    return { ok: false as const, message: `state file missing: ${relativeFile}` };
  }
  return { ok: true as const, filePath };
}

export function validatePetPack(packDir: string): PetPackValidationResult {
  const manifestPath = join(packDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: "manifest.json is missing" };
  }

  const manifestText = readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = petPackManifestSchema.safeParse(JSON.parse(manifestText));
  if (!parsed.success) {
    return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: parsed.error.message };
  }

  const manifest = parsed.data;
  const formatVersion = manifest.formatVersion;
  const stateFiles = {} as Record<PetStatus, string>;

  if (formatVersion === 2) {
    for (const state of PET_STATUSES) {
      const relativeFile = manifest.states[state];
      const resolved = resolveStateFile(packDir, state, relativeFile);
      if (!resolved.ok) return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: resolved.message };
      stateFiles[state] = resolved.filePath;
    }
    return { ok: true, pack: { dir: packDir, manifest, stateFiles, formatVersion, hasAllStandardStates: true } };
  }

  for (const state of Object.keys(PET_STATUS_ALIASES) as (keyof typeof PET_STATUS_ALIASES)[]) {
    const relativeFile = manifest.states[state];
    const resolved = resolveStateFile(packDir, state, relativeFile);
    if (!resolved.ok) return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: resolved.message };
    stateFiles[PET_STATUS_ALIASES[state]] = resolved.filePath;
  }
  stateFiles.sleepy = stateFiles.idle;
  stateFiles.angry = stateFiles["not-found"];
  stateFiles.sleeping = stateFiles.idle;
  stateFiles["head-pat"] = stateFiles.happy;
  stateFiles.dragging = stateFiles.loading;
  stateFiles["signal-weak"] = stateFiles["not-found"];

  return { ok: true, pack: { dir: packDir, manifest, stateFiles, formatVersion, hasAllStandardStates: false } };
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
