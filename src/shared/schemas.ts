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
    ...(normalized.normalizedFrom ? { normalizedFrom: normalized.normalizedFrom } : {})
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
  metadata: z.record(z.string(), z.unknown()).optional()
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
