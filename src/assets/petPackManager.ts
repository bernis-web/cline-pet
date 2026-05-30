import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { ERROR_CODES } from "../shared/errors.js";
import { petPackManifestSchema } from "../shared/schemas.js";
import type { PetPackManifest } from "../shared/schemas.js";
import { PET_STATUSES, PET_STATUS_ALIASES, type PetStatus } from "../shared/statuses.js";

export type PetPackVariants = Partial<Record<PetStatus, string[]>>;
export type PetPackActionSets = Record<string, PetStatus[]>;

export type PetPack = {
  dir: string;
  manifest: PetPackManifest;
  stateFiles: Record<PetStatus, string>;
  formatVersion: 1 | 2 | 3;
  hasAllStandardStates: boolean;
  variants?: PetPackVariants;
  actionSets?: PetPackActionSets;
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

function resolveVariants(packDir: string, variants: Partial<Record<PetStatus, string[]>> | undefined) {
  if (!variants) {
    return { ok: true as const, variants: undefined };
  }

  const resolvedVariants: PetPackVariants = {};

  for (const [status, files] of Object.entries(variants) as [PetStatus, string[]][]) {
    const resolvedFiles: string[] = [];
    for (const relativeFile of files) {
      const resolved = resolveStateFile(packDir, `${status} variant`, relativeFile);
      if (!resolved.ok) return resolved;
      resolvedFiles.push(resolved.filePath);
    }
    resolvedVariants[status] = resolvedFiles;
  }

  return { ok: true as const, variants: resolvedVariants };
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

  if (formatVersion === 2 || formatVersion === 3) {
    for (const state of PET_STATUSES) {
      const relativeFile = manifest.states[state];
      const resolved = resolveStateFile(packDir, state, relativeFile);
      if (!resolved.ok) return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: resolved.message };
      stateFiles[state] = resolved.filePath;
    }

    const variants = formatVersion === 3 ? resolveVariants(packDir, manifest.variants) : { ok: true as const, variants: undefined };
    if (!variants.ok) {
      return { ok: false, errorCode: ERROR_CODES.INVALID_PET_PACK, message: variants.message };
    }

    return {
      ok: true,
      pack: {
        dir: packDir,
        manifest,
        stateFiles,
        formatVersion,
        hasAllStandardStates: true,
        ...(variants.variants ? { variants: variants.variants } : {}),
        ...(formatVersion === 3 && manifest.actionSets ? { actionSets: manifest.actionSets } : {})
      }
    };
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
