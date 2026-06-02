import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";
import type { RelationshipMemory } from "./memoryTypes.js";

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function defaultRelationship(): RelationshipMemory {
  return {
    familiarity: 0,
    affection: 0,
    engagement: 0,
    trust: 0,
    recentEvents: [],
    updatedAt: new Date().toISOString()
  };
}

export function loadRelationshipMemory(root: string): RelationshipMemory {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).relationshipMemoryFile;
  if (!existsSync(file)) return defaultRelationship();
  return { ...defaultRelationship(), ...JSON.parse(readFileSync(file, "utf8")) } as RelationshipMemory;
}

export function saveRelationshipMemory(root: string, updater: (current: RelationshipMemory) => RelationshipMemory) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).relationshipMemoryFile;
  const draft = updater(loadRelationshipMemory(root));
  const next: RelationshipMemory = {
    ...draft,
    familiarity: clamp(draft.familiarity),
    affection: clamp(draft.affection),
    engagement: clamp(draft.engagement),
    trust: clamp(draft.trust),
    updatedAt: new Date().toISOString()
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}