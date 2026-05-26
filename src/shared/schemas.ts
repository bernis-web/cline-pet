import { z } from "zod";
import { PET_STATUSES } from "./statuses.js";

export const petStatusSchema = z.enum(PET_STATUSES);

export const updatePetStatusSchema = z.object({
  status: petStatusSchema,
  task: z.string().trim().max(120).default(""),
  message: z.string().trim().max(160).optional(),
  source: z.string().trim().max(40).default("cline"),
  updatedAt: z.string().datetime().optional()
});

export type UpdatePetStatusInput = z.infer<typeof updatePetStatusSchema>;

export const petPackManifestSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1),
  version: z.string().trim().min(1).default("1.0.0"),
  author: z.string().trim().optional(),
  description: z.string().trim().optional(),
  states: z.object({
    idle: z.string().trim().min(1),
    thinking: z.string().trim().min(1),
    working: z.string().trim().min(1),
    "waiting-approval": z.string().trim().min(1),
    done: z.string().trim().min(1),
    error: z.string().trim().min(1)
  }).passthrough()
}).passthrough();

export type PetPackManifest = z.infer<typeof petPackManifestSchema>;