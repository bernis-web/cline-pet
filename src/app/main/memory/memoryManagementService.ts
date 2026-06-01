import { readContextMemories, writeContextMemories } from "./contextStore.js";
import { loadRelationshipMemory } from "./relationshipStore.js";
import type { ContextMemoryItem, RelationshipMemory } from "./memoryTypes.js";

export type RelationshipStage = "new" | "familiar" | "close" | "trusted";

export type RendererRelationshipOverview = {
  stage: RelationshipStage;
  stageLabel: string;
  stageDescription: string;
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  updatedAt: string;
};

export type RendererContextMemory = Pick<ContextMemoryItem, "id" | "kind" | "text" | "tags" | "weight" | "createdAt" | "updatedAt">;

export type MemoryOverview = {
  relationship: RendererRelationshipOverview;
  memories: RendererContextMemory[];
};

export type MemoryMutationResponse =
  | { ok: true }
  | { ok: false; errorCode: "INVALID_MEMORY_ID" | "MEMORY_NOT_FOUND"; message: string };

export type ExportMemoriesServiceResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function deriveRelationshipOverview(relationship: RelationshipMemory): RendererRelationshipOverview {
  const familiarity = clampScore(relationship.familiarity);
  const affection = clampScore(relationship.affection);
  const engagement = clampScore(relationship.engagement);
  const trust = clampScore(relationship.trust);
  const average = (familiarity + affection + engagement + trust) / 4;

  if (average >= 70) {
    return { stage: "trusted", stageLabel: "信赖", stageDescription: "卡卡很信赖你，也会更稳定地陪在旁边。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  if (average >= 45) {
    return { stage: "close", stageLabel: "亲近", stageDescription: "卡卡和你更亲近了，会更自然地回应你的习惯。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  if (average >= 20) {
    return { stage: "familiar", stageLabel: "熟悉", stageDescription: "卡卡已经记得一些与你相处的节奏。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
  }
  return { stage: "new", stageLabel: "初识", stageDescription: "卡卡正在慢慢认识你。", familiarity, affection, engagement, trust, updatedAt: relationship.updatedAt };
}

function toRendererMemory(item: ContextMemoryItem): RendererContextMemory {
  return {
    id: item.id,
    kind: item.kind,
    text: item.text,
    tags: item.tags,
    weight: item.weight,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function byUpdatedAtDesc(left: RendererContextMemory, right: RendererContextMemory) {
  return (right.updatedAt || "").localeCompare(left.updatedAt || "");
}

export function getMemoryOverview(root: string): MemoryOverview {
  return {
    relationship: deriveRelationshipOverview(loadRelationshipMemory(root)),
    memories: readContextMemories(root).map(toRendererMemory).sort(byUpdatedAtDesc)
  };
}

export function deleteContextMemoryForUser(root: string, id: string): MemoryMutationResponse {
  const normalizedId = id.trim();
  if (!normalizedId) return { ok: false, errorCode: "INVALID_MEMORY_ID", message: "记忆 id 无效。" };

  const memories = readContextMemories(root);
  const next = memories.filter((item) => item.id !== normalizedId);
  if (next.length === memories.length) return { ok: false, errorCode: "MEMORY_NOT_FOUND", message: "这条记忆已经不存在了。" };

  writeContextMemories(root, next);
  return { ok: true };
}

export function clearContextMemoriesForUser(root: string): MemoryMutationResponse {
  writeContextMemories(root, []);
  return { ok: true };
}

export function exportContextMemoriesForUser(root: string, now = new Date().toISOString()): ExportMemoriesServiceResponse {
  const memories = readContextMemories(root).map(toRendererMemory).sort(byUpdatedAtDesc);
  return {
    ok: true,
    data: JSON.stringify({ exportedAt: now, count: memories.length, memories }, null, 2)
  };
}