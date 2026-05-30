# 12-State Local Pet Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Cline Desktop Pet from the 6-state MVP to a 12-state local PNG pet pack system with old-state compatibility, MCP/simulator support, diagnostics, docs, and a local `%APPDATA%` installer.

**Architecture:** Keep the existing Electron + React + Vite + MCP + local HTTP Bridge architecture. Add shared status normalization and lightweight state-model helpers first, then let schemas, MCP, bridge, renderer, pet-pack validation, simulator, installer, and docs consume those shared helpers without introducing remote services or committing user PNG assets.

**Tech Stack:** TypeScript, React, Electron, Vite, Vitest, Zod, Node.js filesystem/path APIs, PowerShell, local HTTP bridge on `127.0.0.1`, `%APPDATA%/cline-desktop-pet/pets` pet packs.

---

## Current Context

- Approved spec: `cline-desktop-pet/docs/superpowers/specs/2026-05-27-12-state-local-pet-pack-design.md`.
- Existing repo root for implementation commands: `d:\projects\cline-mcp-workspace\cline-desktop-pet`.
- Existing local design commit: `44876c6 docs: add 12-state local pet pack design`; branch is `main...origin/main [ahead 1]` before this plan.
- Do not commit user PNG files. Runtime assets must be installed to `%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/`.
- This plan intentionally keeps B-stage implementation simple: `head-pat`, `dragging`, `angry`, and `message` can be visible statuses now; real timed overlay behavior can remain a future C1 enhancement.

## File Structure

Modify existing focused modules; do not restructure the app.

```text
cline-desktop-pet/
  src/shared/statuses.ts              # 12-state constants, labels, aliases, normalization, base/overlay classification
  src/shared/schemas.ts               # Zod schemas for status update payloads and v1/v2 pet-pack manifests
  src/bridge/bridgeTypes.ts           # Bridge payload/status-model types exported from schemas/statuses
  src/bridge/bridgeClient.ts          # Keeps validation at client boundary
  src/bridge/bridgeServer.ts          # Normalizes incoming status before renderer handoff
  src/assets/petPackManager.ts        # Validates legacy 6-state packs and formatVersion 2 12-state packs
  src/diagnostics/diagnostics.ts      # Adds current state model and local pack completeness fields
  src/mcp/server.ts                   # Tool schema, normalization response, status check output passthrough
  src/app/main/main.ts                # Maintains latest normalized state, selects pack images with fallbacks
  src/app/main/preload.ts             # Renderer pet-pack payload typing for 12 visible statuses
  src/app/renderer/App.tsx            # Uses visibleStatus and image fallback chain
  src/app/renderer/PetView.tsx        # Displays 12-state Chinese labels
  src/simulator/cycleStates.ts        # Cycles 12 states in spec order
  scripts/install-kaka-pet-pack.ps1   # Copies local PNGs to %APPDATA%, renames by slug, writes v2 manifest
  docs/pet-pack-format.md             # Documents formatVersion 2 and 12-state packs
  docs/cline-global-rule.md           # Updates recommended MCP statuses while noting old aliases
  README.md                           # Adds local Kaka pack install and 12-state verification
  tests/shared/statuses.test.ts       # Shared state helper coverage
  tests/shared/schemas.test.ts        # Payload + manifest schema coverage
  tests/assets/petPackManager.test.ts # v1/v2 pack validation coverage
  tests/bridge/bridgeClient.test.ts   # New status payload boundary coverage
  tests/bridge/bridgeServer.test.ts   # Bridge normalization coverage
  tests/diagnostics/diagnostics.test.ts # State/model diagnostics coverage
  tests/mcp/serverTools.test.ts       # MCP normalization/error response coverage
  tests/simulator/cycleStates.test.ts # 12-state order coverage
```

## Task 1: Shared 12-State Model

**Files:**
- Modify: `src/shared/statuses.ts`
- Modify: `tests/shared/statuses.test.ts`

- [ ] **Step 1: Replace the statuses test with failing 12-state expectations**

Write `tests/shared/statuses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BASE_PET_STATUSES,
  isPetStatus,
  normalizePetStatus,
  OVERLAY_PET_STATUSES,
  PET_STATUS_ALIASES,
  PET_STATUSES,
  PET_VISIBLE_STATUSES,
  statusLayerFor,
  toStatusLabel
} from "../../src/shared/statuses";

describe("pet statuses", () => {
  it("contains the 12 standard visible states in asset order", () => {
    expect(PET_STATUSES).toEqual([
      "idle",
      "happy",
      "sleepy",
      "thinking",
      "angry",
      "not-found",
      "message",
      "sleeping",
      "head-pat",
      "dragging",
      "loading",
      "signal-weak"
    ]);
    expect(PET_VISIBLE_STATUSES).toEqual(PET_STATUSES);
  });

  it("separates base and overlay states", () => {
    expect(BASE_PET_STATUSES).toEqual([
      "idle",
      "happy",
      "sleepy",
      "thinking",
      "not-found",
      "message",
      "sleeping",
      "loading",
      "signal-weak"
    ]);
    expect(OVERLAY_PET_STATUSES).toEqual(["angry", "head-pat", "dragging"]);
    expect(statusLayerFor("loading")).toBe("base");
    expect(statusLayerFor("head-pat")).toBe("overlay");
  });

  it("validates only standard visible status strings", () => {
    expect(isPetStatus("loading")).toBe(true);
    expect(isPetStatus("working")).toBe(false);
    expect(isPetStatus("reading")).toBe(false);
  });

  it("normalizes old six-state aliases", () => {
    expect(PET_STATUS_ALIASES).toEqual({
      idle: "idle",
      thinking: "thinking",
      working: "loading",
      "waiting-approval": "message",
      done: "happy",
      error: "not-found"
    });
    expect(normalizePetStatus("working")).toEqual({ status: "loading", normalizedFrom: "working" });
    expect(normalizePetStatus("loading")).toEqual({ status: "loading" });
    expect(normalizePetStatus("reading")).toBeNull();
  });

  it("returns English plus Chinese labels", () => {
    expect(toStatusLabel("loading")).toBe("loading（加载中）");
    expect(toStatusLabel("signal-weak")).toBe("signal-weak（信号弱）");
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```powershell
cd d:\projects\cline-mcp-workspace\cline-desktop-pet
npm test -- tests/shared/statuses.test.ts
```

Expected: FAIL because `BASE_PET_STATUSES`, `OVERLAY_PET_STATUSES`, `PET_STATUS_ALIASES`, `PET_VISIBLE_STATUSES`, `normalizePetStatus`, and `statusLayerFor` are not implemented yet.

- [ ] **Step 3: Implement shared status helpers**

Replace `src/shared/statuses.ts` with:

```ts
export const PET_STATUSES = [
  "idle",
  "happy",
  "sleepy",
  "thinking",
  "angry",
  "not-found",
  "message",
  "sleeping",
  "head-pat",
  "dragging",
  "loading",
  "signal-weak"
] as const;

export const PET_VISIBLE_STATUSES = PET_STATUSES;

export const BASE_PET_STATUSES = [
  "idle",
  "happy",
  "sleepy",
  "thinking",
  "not-found",
  "message",
  "sleeping",
  "loading",
  "signal-weak"
] as const;

export const OVERLAY_PET_STATUSES = ["angry", "head-pat", "dragging"] as const;

export const LEGACY_PET_STATUSES = [
  "idle",
  "thinking",
  "working",
  "waiting-approval",
  "done",
  "error"
] as const;

export type PetStatus = (typeof PET_STATUSES)[number];
export type PetVisibleStatus = PetStatus;
export type PetBaseStatus = (typeof BASE_PET_STATUSES)[number];
export type PetOverlayStatus = (typeof OVERLAY_PET_STATUSES)[number];
export type LegacyPetStatus = (typeof LEGACY_PET_STATUSES)[number];
export type PetStatusInput = PetStatus | LegacyPetStatus;
export type PetStatusLayer = "base" | "overlay";

export const PET_STATUS_ALIASES: Record<LegacyPetStatus, PetStatus> = {
  idle: "idle",
  thinking: "thinking",
  working: "loading",
  "waiting-approval": "message",
  done: "happy",
  error: "not-found"
};

export const STATUS_LABELS: Record<PetStatus, string> = {
  idle: "idle（待机）",
  happy: "happy（开心）",
  sleepy: "sleepy（困困）",
  thinking: "thinking（思考）",
  angry: "angry（炸毛）",
  "not-found": "not-found（装死 404）",
  message: "message（收到消息）",
  sleeping: "sleeping（睡觉）",
  "head-pat": "head-pat（摸头反应）",
  dragging: "dragging（拖拽反应）",
  loading: "loading（加载中）",
  "signal-weak": "signal-weak（信号弱）"
};

export type NormalizedPetStatus = {
  status: PetStatus;
  normalizedFrom?: LegacyPetStatus;
};

export function isPetStatus(value: unknown): value is PetStatus {
  return typeof value === "string" && PET_STATUSES.includes(value as PetStatus);
}

export function isLegacyPetStatus(value: unknown): value is LegacyPetStatus {
  return typeof value === "string" && LEGACY_PET_STATUSES.includes(value as LegacyPetStatus);
}

export function isPetStatusInput(value: unknown): value is PetStatusInput {
  return isPetStatus(value) || isLegacyPetStatus(value);
}

export function normalizePetStatus(value: unknown): NormalizedPetStatus | null {
  if (isPetStatus(value)) return { status: value };
  if (isLegacyPetStatus(value)) return { status: PET_STATUS_ALIASES[value], normalizedFrom: value };
  return null;
}

export function isPetBaseStatus(status: PetStatus): status is PetBaseStatus {
  return BASE_PET_STATUSES.includes(status as PetBaseStatus);
}

export function isPetOverlayStatus(status: PetStatus): status is PetOverlayStatus {
  return OVERLAY_PET_STATUSES.includes(status as PetOverlayStatus);
}

export function statusLayerFor(status: PetStatus): PetStatusLayer {
  return isPetOverlayStatus(status) ? "overlay" : "base";
}

export function toStatusLabel(status: PetStatus): string {
  return STATUS_LABELS[status];
}
```

- [ ] **Step 4: Run status tests**

Run:

```powershell
npm test -- tests/shared/statuses.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit shared status model**

Run:

```powershell
git add src/shared/statuses.ts tests/shared/statuses.test.ts
git commit -m "feat: add 12-state pet status model"
```

## Task 2: Schemas for Normalized Payloads and v2 Manifests

**Files:**
- Modify: `src/shared/schemas.ts`
- Modify: `tests/shared/schemas.test.ts`

- [ ] **Step 1: Replace schema tests with 12-state and v2 manifest coverage**

Write `tests/shared/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../src/shared/errors";
import { petPackManifestSchema, updatePetStatusSchema } from "../../src/shared/schemas";

const v2States = {
  idle: "idle.png",
  happy: "happy.png",
  sleepy: "sleepy.png",
  thinking: "thinking.png",
  angry: "angry.png",
  "not-found": "not-found.png",
  message: "message.png",
  sleeping: "sleeping.png",
  "head-pat": "head-pat.png",
  dragging: "dragging.png",
  loading: "loading.png",
  "signal-weak": "signal-weak.png"
};

describe("schemas", () => {
  it("normalizes a standard 12-state status update", () => {
    const result = updatePetStatusSchema.parse({
      status: "loading",
      task: "Implementing 12 states",
      message: "Updating the pet.",
      source: "cline"
    });
    expect(result.status).toBe("loading");
    expect(result.visibleStatus).toBe("loading");
    expect(result.baseStatus).toBe("loading");
    expect(result.overlayStatus).toBeNull();
    expect(result.normalizedFrom).toBeUndefined();
  });

  it("accepts old status aliases and records normalizedFrom", () => {
    const result = updatePetStatusSchema.parse({ status: "working", task: "test" });
    expect(result.status).toBe("loading");
    expect(result.normalizedFrom).toBe("working");
  });

  it("supports explicit overlay updates", () => {
    const result = updatePetStatusSchema.parse({ status: "head-pat", layer: "overlay", durationMs: 1200 });
    expect(result.status).toBe("head-pat");
    expect(result.visibleStatus).toBe("head-pat");
    expect(result.baseStatus).toBe("idle");
    expect(result.overlayStatus).toBe("head-pat");
    expect(result.durationMs).toBe(1200);
  });

  it("rejects an invalid status update", () => {
    expect(() => updatePetStatusSchema.parse({ status: "reading" })).toThrow();
  });

  it("validates a legacy six-state pet pack manifest", () => {
    const manifest = petPackManifestSchema.parse({
      id: "cyber-cat",
      name: "Cyber Cat",
      version: "1.0.0",
      states: {
        idle: "idle.gif",
        thinking: "thinking.gif",
        working: "working.gif",
        "waiting-approval": "waiting-approval.gif",
        done: "done.gif",
        error: "error.gif"
      }
    });
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.id).toBe("cyber-cat");
  });

  it("validates a formatVersion 2 12-state pet pack manifest", () => {
    const manifest = petPackManifestSchema.parse({
      id: "kaka-desktop-pet",
      name: "卡卡桌宠小人",
      version: "1.0.0",
      formatVersion: 2,
      states: v2States,
      metadata: { source: "local-user-assets", assetType: "transparent-png", recommendedSize: 1024 }
    });
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.states.loading).toBe("loading.png");
  });

  it("rejects a v2 manifest missing a 12-state key", () => {
    const { loading: _loading, ...missingLoading } = v2States;
    expect(() => petPackManifestSchema.parse({
      id: "broken-kaka",
      name: "Broken Kaka",
      formatVersion: 2,
      states: missingLoading
    })).toThrow();
  });

  it("includes INVALID_PET_PACK", () => {
    expect(ERROR_CODES.INVALID_PET_PACK).toBe("INVALID_PET_PACK");
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```powershell
npm test -- tests/shared/schemas.test.ts
```

Expected: FAIL because schemas do not normalize aliases, do not expose `visibleStatus/baseStatus/overlayStatus`, and do not support `formatVersion: 2`.

- [ ] **Step 3: Implement schema transforms**

Replace `src/shared/schemas.ts` with:

```ts
import { z } from "zod";
import {
  LEGACY_PET_STATUSES,
  PET_STATUSES,
  normalizePetStatus,
  statusLayerFor
} from "./statuses.js";

const statusInputSchema = z.union([z.enum(PET_STATUSES), z.enum(LEGACY_PET_STATUSES)]);
const layerSchema = z.enum(["base", "overlay"]);

export const petStatusSchema = z.enum(PET_STATUSES);
export const petStatusInputSchema = statusInputSchema;

export const updatePetStatusSchema = z.object({
  status: statusInputSchema,
  layer: layerSchema.optional(),
  durationMs: z.number().int().positive().max(60_000).optional(),
  task: z.string().trim().max(120).default(""),
  message: z.string().trim().max(160).optional(),
  source: z.string().trim().max(40).default("cline"),
  updatedAt: z.string().datetime().optional()
}).transform((input) => {
  const normalized = normalizePetStatus(input.status);
  if (!normalized) throw new Error(`Invalid pet status: ${input.status}`);
  const inferredLayer = input.layer ?? statusLayerFor(normalized.status);
  const baseStatus = inferredLayer === "base" ? normalized.status : "idle";
  const overlayStatus = inferredLayer === "overlay" ? normalized.status : null;
  return {
    ...input,
    status: normalized.status,
    visibleStatus: overlayStatus ?? baseStatus,
    baseStatus,
    overlayStatus,
    normalizedFrom: normalized.normalizedFrom
  };
});

export type UpdatePetStatusInput = z.infer<typeof updatePetStatusSchema>;

const legacyStatesSchema = z.object({
  idle: z.string().trim().min(1),
  thinking: z.string().trim().min(1),
  working: z.string().trim().min(1),
  "waiting-approval": z.string().trim().min(1),
  done: z.string().trim().min(1),
  error: z.string().trim().min(1)
}).passthrough();

const v2StatesSchema = z.object({
  idle: z.string().trim().min(1),
  happy: z.string().trim().min(1),
  sleepy: z.string().trim().min(1),
  thinking: z.string().trim().min(1),
  angry: z.string().trim().min(1),
  "not-found": z.string().trim().min(1),
  message: z.string().trim().min(1),
  sleeping: z.string().trim().min(1),
  "head-pat": z.string().trim().min(1),
  dragging: z.string().trim().min(1),
  loading: z.string().trim().min(1),
  "signal-weak": z.string().trim().min(1)
}).passthrough();

const manifestBaseSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1),
  version: z.string().trim().min(1).default("1.0.0"),
  author: z.string().trim().optional(),
  description: z.string().trim().optional(),
  metadata: z.record(z.unknown()).optional()
}).passthrough();

export const petPackManifestSchema = z.union([
  manifestBaseSchema.extend({
    formatVersion: z.literal(2),
    states: v2StatesSchema
  }),
  manifestBaseSchema.extend({
    formatVersion: z.literal(1).default(1),
    states: legacyStatesSchema
  })
]);

export type PetPackManifest = z.infer<typeof petPackManifestSchema>;
```

- [ ] **Step 4: Run schema tests**

Run:

```powershell
npm test -- tests/shared/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit schemas**

Run:

```powershell
git add src/shared/schemas.ts tests/shared/schemas.test.ts
git commit -m "feat: normalize pet status schemas"
```

## Task 3: Pet Pack Manager Supports v1 Fallback and v2 12-State Packs

**Files:**
- Modify: `src/assets/petPackManager.ts`
- Modify: `tests/assets/petPackManager.test.ts`

- [ ] **Step 1: Replace pet-pack manager tests**

Write `tests/assets/petPackManager.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the focused failing test**

Run:

```powershell
npm test -- tests/assets/petPackManager.test.ts
```

Expected: FAIL because pack metadata and legacy-to-12 fallback mapping are not implemented.

- [ ] **Step 3: Implement pack validation and fallback state files**

Replace `src/assets/petPackManager.ts` with:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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
  return relativePath === "" || (!relativePath.startsWith("..") && !resolve(relativePath).startsWith(resolve(relativePath).root));
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

  const parsed = petPackManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf8")));
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
```

- [ ] **Step 4: Run pet-pack tests**

Run:

```powershell
npm test -- tests/assets/petPackManager.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit pet-pack manager**

Run:

```powershell
git add src/assets/petPackManager.ts tests/assets/petPackManager.test.ts
git commit -m "feat: support 12-state pet packs"
```

## Task 4: Bridge and MCP Normalize Status Updates

**Files:**
- Modify: `src/bridge/bridgeTypes.ts`
- Modify: `src/bridge/bridgeClient.ts`
- Modify: `src/bridge/bridgeServer.ts`
- Modify: `src/mcp/server.ts`
- Modify: `tests/bridge/bridgeClient.test.ts`
- Modify: `tests/bridge/bridgeServer.test.ts`
- Modify: `tests/mcp/serverTools.test.ts`

- [ ] **Step 1: Update bridge and MCP tests first**

Write `tests/bridge/bridgeClient.test.ts`:

```ts
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { sendStatusToBridge } from "../../src/bridge/bridgeClient";

let server: ReturnType<typeof createServer> | undefined;

afterEach(() => server?.close());

async function listen(serverToStart: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => serverToStart.listen(0, "127.0.0.1", resolve));
  const address = serverToStart.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  return address.port;
}

describe("bridge client", () => {
  it("sends normalized status to a local bridge", async () => {
    server = createServer(async (req, res) => {
      expect(req.url).toBe("/status");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      expect(body.status).toBe("loading");
      expect(body.normalizedFrom).toBe("working");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    const port = await listen(server);
    const result = await sendStatusToBridge({ port, timeoutMs: 500 }, { status: "working", task: "test" });
    expect(result.ok).toBe(true);
  });

  it("returns PET_APP_UNREACHABLE for closed port", async () => {
    const result = await sendStatusToBridge({ port: 9, timeoutMs: 100 }, { status: "loading", task: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("PET_APP_UNREACHABLE");
  });
});
```

Add this test to `tests/bridge/bridgeServer.test.ts` inside the existing `describe` block:

```ts
  it("normalizes legacy status payloads before invoking onStatus", async () => {
    const onStatus = vi.fn();
    server = startBridgeServer(0, {
      onStatus,
      onDiagnostics: () => ({ ok: true })
    });
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done", task: "complete" })
    });

    expect(response.status).toBe(200);
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      status: "happy",
      visibleStatus: "happy",
      baseStatus: "happy",
      overlayStatus: null,
      normalizedFrom: "done"
    }));
  });
```

Write `tests/mcp/serverTools.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { handleUpdatePetStatus, updatePetStatusInputSchema } from "../../src/mcp/server";

describe("mcp tool handlers", () => {
  it("rejects invalid status", async () => {
    const result = await handleUpdatePetStatus({ status: "reading" }, async () => ({ ok: true, data: { delivered: true } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("INVALID_STATUS");
  });

  it("sends normalized legacy status through injected bridge sender", async () => {
    const result = await handleUpdatePetStatus({ status: "working", task: "test" }, async (payload) => {
      expect(payload.status).toBe("loading");
      expect(payload.normalizedFrom).toBe("working");
      return { ok: true, data: { delivered: true } };
    });
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        delivered: true,
        status: "loading",
        visibleStatus: "loading",
        baseStatus: "loading",
        overlayStatus: null,
        normalizedFrom: "working"
      })
    });
  });

  it("publishes a 12-state tool input schema", () => {
    expect(updatePetStatusInputSchema.properties.status.enum).toContain("signal-weak");
    expect(updatePetStatusInputSchema.properties.status.enum).toContain("working");
    expect(updatePetStatusInputSchema.properties.layer.enum).toEqual(["base", "overlay"]);
  });
});
```

- [ ] **Step 2: Run focused failing tests**

Run:

```powershell
npm test -- tests/bridge/bridgeClient.test.ts tests/bridge/bridgeServer.test.ts tests/mcp/serverTools.test.ts
```

Expected: FAIL because MCP output does not include normalized state fields and the exported MCP schema is missing.

- [ ] **Step 3: Update bridge types and client/server validation**

Replace `src/bridge/bridgeTypes.ts` with:

```ts
import type { UpdatePetStatusInput } from "../shared/schemas.js";

export type BridgeConfig = {
  host?: "127.0.0.1";
  port: number;
  timeoutMs: number;
};

export type BridgeStatusPayload = UpdatePetStatusInput;
```

In `src/bridge/bridgeClient.ts`, keep the existing structure but ensure the request body sends `parsed.data` from the transformed schema:

```ts
body: JSON.stringify(parsed.data),
```

In `src/bridge/bridgeServer.ts`, keep `handlers.onStatus(parsed.data);` so renderer receives normalized payloads from the transformed schema.

- [ ] **Step 4: Update MCP server handler and tool schema**

Replace `src/mcp/server.ts` with:

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { sendStatusToBridge } from "../bridge/bridgeClient.js";
import { ERROR_CODES, fail, ok } from "../shared/errors.js";
import type { ToolResult } from "../shared/errors.js";
import { updatePetStatusSchema } from "../shared/schemas.js";
import { LEGACY_PET_STATUSES, PET_STATUSES } from "../shared/statuses.js";

const bridgePort = Number(process.env.CLINE_PET_BRIDGE_PORT ?? "37621");

export const updatePetStatusInputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: [...PET_STATUSES, ...LEGACY_PET_STATUSES] },
    layer: { type: "string", enum: ["base", "overlay"] },
    durationMs: { type: "number" },
    task: { type: "string" },
    message: { type: "string" },
    source: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["status"]
} as const;

export async function handleUpdatePetStatus(
  input: unknown,
  sender = (payload: any) => sendStatusToBridge({ port: bridgePort, timeoutMs: 1200 }, payload)
): Promise<ToolResult<{ delivered: boolean; status: string; visibleStatus: string; baseStatus: string; overlayStatus: string | null; updatedAt: string; normalizedFrom?: string }>> {
  const parsed = updatePetStatusSchema.safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_STATUS, parsed.error.message);
  const payload = { ...parsed.data, updatedAt: parsed.data.updatedAt ?? new Date().toISOString() };
  const delivered = await sender(payload);
  if (!delivered.ok) return delivered;
  return ok({
    delivered: delivered.data.delivered,
    status: payload.status,
    visibleStatus: payload.visibleStatus,
    baseStatus: payload.baseStatus,
    overlayStatus: payload.overlayStatus,
    updatedAt: payload.updatedAt,
    ...(payload.normalizedFrom ? { normalizedFrom: payload.normalizedFrom } : {})
  });
}

export async function startMcpServer() {
  const server = new Server({ name: "cline-desktop-pet", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "update_pet_status",
        description: "Update the Cline desktop pet status.",
        inputSchema: updatePetStatusInputSchema
      },
      {
        name: "pet_status_check",
        description: "Check Cline desktop pet diagnostics.",
        inputSchema: { type: "object", properties: {} }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "update_pet_status") {
      const result = await handleUpdatePetStatus(request.params.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (request.params.name === "pet_status_check") {
      const response = await fetch(`http://127.0.0.1:${bridgePort}/diagnostics`).catch(() => null);
      const text = response ? await response.text() : JSON.stringify({ ok: false, errorCode: "PET_APP_UNREACHABLE" });
      return { content: [{ type: "text", text }] };
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run bridge and MCP tests**

Run:

```powershell
npm test -- tests/bridge/bridgeClient.test.ts tests/bridge/bridgeServer.test.ts tests/mcp/serverTools.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit bridge and MCP normalization**

Run:

```powershell
git add src/bridge/bridgeTypes.ts src/bridge/bridgeClient.ts src/bridge/bridgeServer.ts src/mcp/server.ts tests/bridge/bridgeClient.test.ts tests/bridge/bridgeServer.test.ts tests/mcp/serverTools.test.ts
git commit -m "feat: normalize pet status over bridge and mcp"
```

## Task 5: Main Process, Renderer, Diagnostics, and Simulator Consume 12 States

**Files:**
- Modify: `src/diagnostics/diagnostics.ts`
- Modify: `tests/diagnostics/diagnostics.test.ts`
- Modify: `src/app/main/main.ts`
- Modify: `src/app/main/preload.ts`
- Modify: `src/app/renderer/App.tsx`
- Modify: `src/app/renderer/PetView.tsx`
- Modify: `src/simulator/cycleStates.ts`
- Create: `tests/simulator/cycleStates.test.ts`

- [ ] **Step 1: Add diagnostics and simulator tests**

Replace `tests/diagnostics/diagnostics.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { buildDiagnosticsReport, formatDebugReport } from "../../src/diagnostics/diagnostics";

describe("diagnostics", () => {
  it("builds a report with state model, pet pack, and log info", () => {
    const report = buildDiagnosticsReport({
      bridgePort: 37621,
      selectedPetPackId: "kaka-desktop-pet",
      selectedPetPackValid: true,
      selectedPetPackHasAllStandardStates: true,
      localKakaPetPackPath: "C:/Users/example/AppData/Roaming/cline-desktop-pet/pets/kaka-desktop-pet",
      localKakaPetPackInstalled: true,
      currentState: {
        status: "loading",
        visibleStatus: "loading",
        baseStatus: "loading",
        overlayStatus: null,
        task: "test",
        source: "cline"
      },
      logs: { app: "app.log", mcp: "mcp.log" }
    });
    expect(report.selectedPetPackId).toBe("kaka-desktop-pet");
    expect(report.selectedPetPackHasAllStandardStates).toBe(true);
    expect(report.currentState.visibleStatus).toBe("loading");
    expect(report.localKakaPetPackInstalled).toBe(true);
  });

  it("formats a copyable debug report", () => {
    const text = formatDebugReport({ selectedPetPackId: "default-pixel-dev" });
    expect(text).toContain("Cline Desktop Pet Debug Report");
    expect(text).toContain("default-pixel-dev");
  });
});
```

Create `tests/simulator/cycleStates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SIMULATOR_STATUSES } from "../../src/simulator/cycleStates";

describe("cycle state simulator", () => {
  it("cycles the 12 states in spec order", () => {
    expect(SIMULATOR_STATUSES).toEqual([
      "idle",
      "happy",
      "sleepy",
      "thinking",
      "angry",
      "not-found",
      "message",
      "sleeping",
      "head-pat",
      "dragging",
      "loading",
      "signal-weak"
    ]);
  });
});
```

- [ ] **Step 2: Run focused failing tests**

Run:

```powershell
npm test -- tests/diagnostics/diagnostics.test.ts tests/simulator/cycleStates.test.ts
```

Expected: FAIL because diagnostics fields and exported simulator statuses are not implemented.

- [ ] **Step 3: Update diagnostics**

Replace `src/diagnostics/diagnostics.ts` with:

```ts
import { existsSync } from "node:fs";
import type { UpdatePetStatusInput } from "../shared/schemas.js";

export type DiagnosticsInput = {
  bridgePort: number;
  selectedPetPackId: string;
  selectedPetPackValid: boolean;
  selectedPetPackHasAllStandardStates?: boolean;
  localKakaPetPackPath?: string;
  localKakaPetPackInstalled?: boolean;
  currentState?: UpdatePetStatusInput;
  lastUpdateAt?: string;
  lastError?: string | null;
  logs: { app: string; mcp: string };
};

export function buildDiagnosticsReport(input: DiagnosticsInput) {
  return {
    ok: input.selectedPetPackValid && Boolean(input.bridgePort),
    appReachable: true,
    bridgeReachable: Boolean(input.bridgePort),
    mcpReachable: true,
    selectedPetPackId: input.selectedPetPackId,
    selectedPetPackValid: input.selectedPetPackValid,
    selectedPetPackHasAllStandardStates: input.selectedPetPackHasAllStandardStates ?? false,
    localKakaPetPackPath: input.localKakaPetPackPath ?? null,
    localKakaPetPackInstalled: input.localKakaPetPackInstalled ?? false,
    currentState: input.currentState ?? null,
    lastUpdateAt: input.lastUpdateAt ?? input.currentState?.updatedAt ?? null,
    lastError: input.lastError ?? null,
    logs: input.logs,
    logFilesExist: {
      app: existsSync(input.logs.app),
      mcp: existsSync(input.logs.mcp)
    }
  };
}

export function formatDebugReport(report: Record<string, unknown>): string {
  return `Cline Desktop Pet Debug Report\n${JSON.stringify(report, null, 2)}`;
}
```

- [ ] **Step 4: Update simulator export and main loop guard**

Replace `src/simulator/cycleStates.ts` with:

```ts
import { PET_STATUSES } from "../shared/statuses.js";

export const SIMULATOR_STATUSES = [...PET_STATUSES];

export async function runCycleStates() {
  const port = Number(process.env.CLINE_PET_BRIDGE_PORT ?? "37621");
  for (const status of SIMULATOR_STATUSES) {
    const payload = { status, task: `Simulating ${status}`, message: `Pet state: ${status}`, source: "simulator", updatedAt: new Date().toISOString() };
    const response = await fetch(`http://127.0.0.1:${port}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    console.log(status, response.status, await response.text());
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCycleStates();
}
```

- [ ] **Step 5: Update main process and renderer to use visibleStatus**

In `src/app/main/main.ts`, update imports and default/latest state:

```ts
import { PET_STATUSES, type PetStatus } from "../../shared/statuses.js";
```

Keep `latestStatus` typed as `UpdatePetStatusInput`, initialized with normalized fields:

```ts
let latestStatus: UpdatePetStatusInput = {
  status: "idle",
  visibleStatus: "idle",
  baseStatus: "idle",
  overlayStatus: null,
  task: "",
  source: "cline",
  updatedAt: new Date().toISOString()
};
```

Update `defaultPack()` so `stateFiles` covers all 12 states using existing legacy SVG fallbacks:

```ts
const legacyDefaultFiles: Record<PetStatus, string> = {
  idle: "idle.svg",
  happy: "done.svg",
  sleepy: "idle.svg",
  thinking: "thinking.svg",
  angry: "error.svg",
  "not-found": "error.svg",
  message: "waiting-approval.svg",
  sleeping: "idle.svg",
  "head-pat": "done.svg",
  dragging: "working.svg",
  loading: "working.svg",
  "signal-weak": "error.svg"
};
```

Then return:

```ts
return {
  dir,
  manifest: { id: "default-pixel-dev", name: "Default Pixel Dev", version: "1.0.0", formatVersion: 1, states: {
    idle: "idle.svg",
    thinking: "thinking.svg",
    working: "working.svg",
    "waiting-approval": "waiting-approval.svg",
    done: "done.svg",
    error: "error.svg"
  } },
  stateFiles: Object.fromEntries(PET_STATUSES.map((s) => [s, join(dir, legacyDefaultFiles[s])])) as Record<PetStatus, string>,
  formatVersion: 1,
  hasAllStandardStates: false
};
```

Update diagnostics call:

```ts
const localKakaPetPackPath = join(paths.petPacks, "kaka-desktop-pet");
const diagnostics = () => buildDiagnosticsReport({
  bridgePort,
  selectedPetPackId: selectedPack().manifest.id,
  selectedPetPackValid: selectedPetPackId === selectedPack().manifest.id,
  selectedPetPackHasAllStandardStates: selectedPack().hasAllStandardStates,
  localKakaPetPackPath,
  localKakaPetPackInstalled: existsSync(localKakaPetPackPath),
  currentState: latestStatus,
  lastUpdateAt: latestStatus.updatedAt,
  lastError: null,
  logs: { app: paths.appLog, mcp: paths.mcpLog }
});
```

In `src/app/main/preload.ts`, ensure `RendererPetPack.stateImages` remains `Record<PetStatus, string>` from the new 12-state `PetStatus`.

Replace `src/app/renderer/App.tsx` with a version that uses `visibleStatus`:

```tsx
import { useEffect, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { PetView } from "./PetView";
import idleImage from "../../assets/default-pet/idle.svg";
import thinkingImage from "../../assets/default-pet/thinking.svg";
import workingImage from "../../assets/default-pet/working.svg";
import waitingApprovalImage from "../../assets/default-pet/waiting-approval.svg";
import doneImage from "../../assets/default-pet/done.svg";
import errorImage from "../../assets/default-pet/error.svg";

declare global {
  interface Window {
    clinePet?: {
      onPetStatus(callback: (payload: { status: PetStatus; visibleStatus: PetStatus; baseStatus: PetStatus; overlayStatus: PetStatus | null; task?: string; updatedAt?: string; normalizedFrom?: string }) => void): void;
      onPetPack(callback: (payload: { stateImages: Record<PetStatus, string> }) => void): void;
    };
  }
}

const defaultImages: Record<PetStatus, string> = {
  idle: idleImage,
  happy: doneImage,
  sleepy: idleImage,
  thinking: thinkingImage,
  angry: errorImage,
  "not-found": errorImage,
  message: waitingApprovalImage,
  sleeping: idleImage,
  "head-pat": doneImage,
  dragging: workingImage,
  loading: workingImage,
  "signal-weak": errorImage
};

export function App() {
  const [status, setStatus] = useState<PetStatus>("idle");
  const [visibleStatus, setVisibleStatus] = useState<PetStatus>("idle");
  const [task, setTask] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [diagnostics, setDiagnostics] = useState("");
  const [images, setImages] = useState(defaultImages);
  useEffect(() => {
    window.clinePet?.onPetStatus((payload) => {
      setStatus(payload.status);
      setVisibleStatus(payload.visibleStatus ?? payload.status);
      setTask(payload.task ?? "");
      setUpdatedAt(payload.updatedAt ?? "");
    });
    window.clinePet?.onPetPack((payload) => setImages({ ...defaultImages, ...payload.stateImages }));
  }, []);
  return <><PetView status={visibleStatus} task={task} updatedAt={updatedAt} imageSrc={images[visibleStatus] ?? defaultImages.idle} onDiagnose={() => setDiagnostics(`status=${status}\nvisibleStatus=${visibleStatus}\ntask=${task}\nupdatedAt=${updatedAt}`)}/><DiagnosticsPanel text={diagnostics} onClose={() => setDiagnostics("")}/></>;
}
```

Keep `src/app/renderer/PetView.tsx` simple and typed to the new `PetStatus`; no behavioral change is required beyond the new labels already provided by `toStatusLabel`.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm test -- tests/diagnostics/diagnostics.test.ts tests/simulator/cycleStates.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run build to catch renderer/main typing issues**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit app consumption of 12-state model**

Run:

```powershell
git add src/diagnostics/diagnostics.ts tests/diagnostics/diagnostics.test.ts src/app/main/main.ts src/app/main/preload.ts src/app/renderer/App.tsx src/app/renderer/PetView.tsx src/simulator/cycleStates.ts tests/simulator/cycleStates.test.ts
git commit -m "feat: render and diagnose 12-state pet model"
```

## Task 6: Local Kaka Pet Pack Installer

**Files:**
- Create: `scripts/install-kaka-pet-pack.ps1`

- [ ] **Step 1: Create the PowerShell installer script**

Create `scripts/install-kaka-pet-pack.ps1`:

```powershell
param(
  [string]$SourceDir = 'E:\xwechat_files\wxid_2gvkgptwgs8b22_6b72\msg\file\2026-05\桌宠小人(1)\桌宠小人',
  [string]$TargetRoot = (Join-Path $env:APPDATA 'cline-desktop-pet\pets')
)

$ErrorActionPreference = 'Stop'

$packId = 'kaka-desktop-pet'
$targetDir = Join-Path $TargetRoot $packId

$files = @(
  @{ Source = '01_待机_1024透明PNG_v2.png'; Target = 'idle.png' },
  @{ Source = '02_开心_1024透明PNG_v1.png'; Target = 'happy.png' },
  @{ Source = '03_困困_1024透明PNG_v1.png'; Target = 'sleepy.png' },
  @{ Source = '04_思考_1024透明PNG_v3.png'; Target = 'thinking.png' },
  @{ Source = '05_炸毛_1024透明PNG_v1.png'; Target = 'angry.png' },
  @{ Source = '06_装死404_1024透明PNG_v1.png'; Target = 'not-found.png' },
  @{ Source = '07_收到消息_1024透明PNG_v1.png'; Target = 'message.png' },
  @{ Source = '08_睡觉_1024透明PNG_v1.png'; Target = 'sleeping.png' },
  @{ Source = '09_摸头反应_1024透明PNG_v1.png'; Target = 'head-pat.png' },
  @{ Source = '10_拖拽反应_1024透明PNG_v1.png'; Target = 'dragging.png' },
  @{ Source = '11_加载中_1024透明PNG_v1.png'; Target = 'loading.png' },
  @{ Source = '12_信号弱_1024透明PNG_v1.png'; Target = 'signal-weak.png' }
)

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Source directory does not exist: $SourceDir"
}

$missing = @()
foreach ($file in $files) {
  $sourcePath = Join-Path $SourceDir $file.Source
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    $missing += $file.Source
  }
}

if ($missing.Count -gt 0) {
  throw "Missing source PNG files: $($missing -join ', ')"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $SourceDir $file.Source) -Destination (Join-Path $targetDir $file.Target) -Force
}

$manifest = [ordered]@{
  id = $packId
  name = '卡卡桌宠小人'
  version = '1.0.0'
  author = 'local'
  description = '用户本机安装的 12 状态透明 PNG 桌宠小人。'
  formatVersion = 2
  states = [ordered]@{
    idle = 'idle.png'
    happy = 'happy.png'
    sleepy = 'sleepy.png'
    thinking = 'thinking.png'
    angry = 'angry.png'
    'not-found' = 'not-found.png'
    message = 'message.png'
    sleeping = 'sleeping.png'
    'head-pat' = 'head-pat.png'
    dragging = 'dragging.png'
    loading = 'loading.png'
    'signal-weak' = 'signal-weak.png'
  }
  metadata = [ordered]@{
    source = 'local-user-assets'
    assetType = 'transparent-png'
    recommendedSize = 1024
  }
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $targetDir 'manifest.json') -Encoding UTF8

Write-Host "Installed Kaka pet pack to: $targetDir"
Write-Host 'PNG assets were copied to APPDATA only and were not written into the repository.'
```

- [ ] **Step 2: Run PowerShell parser validation**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile('scripts/install-kaka-pet-pack.ps1', [ref]$null, [ref]$null); 'parser-ok'"
```

Expected: prints `parser-ok`.

- [ ] **Step 3: Commit installer**

Run:

```powershell
git add scripts/install-kaka-pet-pack.ps1
git commit -m "feat: add local kaka pet pack installer"
```

## Task 7: User Documentation for 12 States and Local Assets

**Files:**
- Modify: `README.md`
- Modify: `docs/pet-pack-format.md`
- Modify: `docs/cline-global-rule.md`

- [ ] **Step 1: Update `docs/pet-pack-format.md`**

Replace the file with:

```md
# Pet Pack Format（宠物资源包格式）

Put local pet packs under `%APPDATA%/cline-desktop-pet/pets/<pet-id>/`.

## formatVersion 2（12 状态资源包）

`formatVersion: 2` packs provide all 12 standard states:

- `idle`（待机）
- `happy`（开心）
- `sleepy`（困困）
- `thinking`（思考）
- `angry`（炸毛）
- `not-found`（装死 404）
- `message`（收到消息）
- `sleeping`（睡觉）
- `head-pat`（摸头反应）
- `dragging`（拖拽反应）
- `loading`（加载中）
- `signal-weak`（信号弱）

Example manifest:

```json
{
  "id": "kaka-desktop-pet",
  "name": "卡卡桌宠小人",
  "version": "1.0.0",
  "formatVersion": 2,
  "states": {
    "idle": "idle.png",
    "happy": "happy.png",
    "sleepy": "sleepy.png",
    "thinking": "thinking.png",
    "angry": "angry.png",
    "not-found": "not-found.png",
    "message": "message.png",
    "sleeping": "sleeping.png",
    "head-pat": "head-pat.png",
    "dragging": "dragging.png",
    "loading": "loading.png",
    "signal-weak": "signal-weak.png"
  }
}
```

## Legacy formatVersion 1（旧 6 状态资源包）

Existing packs without `formatVersion` are treated as legacy six-state packs:

- `idle`
- `thinking`
- `working`
- `waiting-approval`
- `done`
- `error`

The app maps legacy states to the new 12-state model so old packs can still be used as fallback resources.

If a pack is invalid, the app reports `INVALID_PET_PACK（宠物资源包无效）` and falls back to the bundled default pet.
```

- [ ] **Step 2: Update `docs/cline-global-rule.md`**

Replace the file with:

```md
# Cline Desktop Pet Status Rule

When the `cline-desktop-pet` MCP tools are available, update the desktop pet at major task transitions:

- Use `update_pet_status` with `thinking（思考）` when planning or analyzing.
- Use `update_pet_status` with `loading（加载中）` while reading, editing, running commands, building, or testing.
- Use `update_pet_status` with `message（收到消息）` before waiting for user approval/input.
- Use `update_pet_status` with `happy（开心）` after successful completion.
- Use `update_pet_status` with `not-found（装死 404）` when an unexpected failure occurs.
- Use `update_pet_status` with `signal-weak（信号弱）` when the app or bridge appears stale/unreachable.
- Use concise task summaries only. Do not send source code, file contents, full prompts, or long terminal output.

Legacy aliases remain accepted for compatibility:

- `working` -> `loading`
- `waiting-approval` -> `message`
- `done` -> `happy`
- `error` -> `not-found`
```

- [ ] **Step 3: Update `README.md` with 12-state install instructions**

Edit the existing README sections so they say:

```md
- 12 个状态：idle、happy、sleepy、thinking、angry、not-found、message、sleeping、head-pat、dragging、loading、signal-weak
```

Add a section after “更换像素宠物形象”:

```md
## 安装卡卡 12 状态本地 PNG 宠物包

用户 PNG 素材不会提交到 GitHub。运行安装脚本会把素材复制到：

```text
%APPDATA%/cline-desktop-pet/pets/kaka-desktop-pet/
```

运行：

```powershell
./scripts/install-kaka-pet-pack.ps1
```

如果素材目录不在默认位置，可以传入源目录：

```powershell
./scripts/install-kaka-pet-pack.ps1 -SourceDir "E:\path\to\桌宠小人"
```

安装完成后，在托盘菜单点击：

```text
Refresh Pet Packs（刷新宠物资源包）
Select Pet（选择宠物） -> 卡卡桌宠小人
```
```

Update “模拟状态变化” to say the simulator sends 12 states.

- [ ] **Step 4: Scan docs for old phrasing**

Run:

```powershell
Select-String -Path README.md,docs/pet-pack-format.md,docs/cline-global-rule.md -Pattern '6 个状态|six state|six-state|working（工作中）|waiting-approval（等待批准）|done（完成）|error（错误）'
```

Expected: no matches, except deliberate legacy compatibility mentions containing `six-state` or old aliases in `docs/pet-pack-format.md` and `docs/cline-global-rule.md`.

- [ ] **Step 5: Commit docs**

Run:

```powershell
git add README.md docs/pet-pack-format.md docs/cline-global-rule.md
git commit -m "docs: document 12-state local pet packs"
```

## Task 8: Full Verification and Privacy Check

**Files:**
- No intended source changes unless verification exposes a bug.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: renderer and main builds pass.

- [ ] **Step 3: Check for accidental PNG commits**

Run:

```powershell
git status --short
git ls-files | Select-String -Pattern '\.png$'
```

Expected: no repository-tracked user PNG assets. Existing files under `playwright-output/` are outside the app and must not be added by this implementation.

- [ ] **Step 4: Check whitespace errors**

Run:

```powershell
git diff --check HEAD~8..HEAD
```

Expected: no output.

- [ ] **Step 5: Optional local installer smoke test when source PNG directory exists**

Run only on the user machine with the source directory present:

```powershell
./scripts/install-kaka-pet-pack.ps1
Test-Path "$env:APPDATA\cline-desktop-pet\pets\kaka-desktop-pet\manifest.json"
Get-ChildItem "$env:APPDATA\cline-desktop-pet\pets\kaka-desktop-pet" -Filter *.png | Measure-Object
```

Expected: `Test-Path` prints `True`; PNG count is `12`.

- [ ] **Step 6: Final commit if verification required fixes**

If Step 1 or Step 2 exposed bugs and you changed files, run:

```powershell
git status --short
git add src/shared/statuses.ts src/shared/schemas.ts src/assets/petPackManager.ts src/bridge/bridgeTypes.ts src/bridge/bridgeClient.ts src/bridge/bridgeServer.ts src/diagnostics/diagnostics.ts src/mcp/server.ts src/app/main/main.ts src/app/main/preload.ts src/app/renderer/App.tsx src/app/renderer/PetView.tsx src/simulator/cycleStates.ts scripts/install-kaka-pet-pack.ps1 README.md docs/pet-pack-format.md docs/cline-global-rule.md tests/shared/statuses.test.ts tests/shared/schemas.test.ts tests/assets/petPackManager.test.ts tests/bridge/bridgeClient.test.ts tests/bridge/bridgeServer.test.ts tests/diagnostics/diagnostics.test.ts tests/mcp/serverTools.test.ts tests/simulator/cycleStates.test.ts
git commit -m "fix: stabilize 12-state pet pack implementation"
```

If no files changed, skip this commit.

## Self-Review Checklist

- Spec coverage: Tasks 1-2 cover 12 statuses, aliases, state layers, MCP payload schema, and v2 manifests. Task 3 covers pet-pack validation and fallback. Task 4 covers MCP/Bridge normalization. Task 5 covers main process, renderer, diagnostics, and simulator. Task 6 covers `%APPDATA%` local installation. Task 7 covers README and docs. Task 8 covers tests, build, whitespace, and privacy.
- Placeholder scan: The plan contains no unresolved implementation placeholders; every code-changing step includes concrete file content or exact snippets, commands, and expected results.
- Type consistency: `PetStatus` is the 12-state visible status union. `UpdatePetStatusInput` is the normalized transformed schema output. `visibleStatus`, `baseStatus`, `overlayStatus`, and `normalizedFrom` names are consistent across schemas, MCP, Bridge, main, renderer, and diagnostics.