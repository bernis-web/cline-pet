import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";
import { memoryTextOverlapScore, normalizeMemoryText } from "./memoryDeduplication.js";
import type { ContextMemoryItem, MemoryBlockRule } from "./memoryTypes.js";

export type MemoryBlockRuleInput = {
  text: string;
  kind?: ContextMemoryItem["kind"];
  sourceMemoryId?: string;
  now?: string;
};

function isMemoryKind(value: unknown): value is ContextMemoryItem["kind"] {
  return ["conversation-summary", "fact", "preference", "project-context"].includes(String(value));
}

function isRule(value: unknown): value is MemoryBlockRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<MemoryBlockRule>;
  return typeof rule.id === "string"
    && typeof rule.text === "string"
    && typeof rule.normalizedText === "string"
    && typeof rule.createdAt === "string"
    && (rule.kind === undefined || isMemoryKind(rule.kind))
    && (rule.sourceMemoryId === undefined || typeof rule.sourceMemoryId === "string");
}

export function readMemoryBlockRules(root: string): MemoryBlockRule[] {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).memoryBlocklistFile;
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRule) : [];
  } catch {
    return [];
  }
}

export function writeMemoryBlockRules(root: string, rules: MemoryBlockRule[]) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).memoryBlocklistFile;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(rules, null, 2)}\n`, "utf8");
}

export function createMemoryBlockRule(input: MemoryBlockRuleInput): MemoryBlockRule {
  const text = input.text.trim();
  return {
    id: randomUUID(),
    text,
    normalizedText: normalizeMemoryText(text),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.sourceMemoryId ? { sourceMemoryId: input.sourceMemoryId } : {}),
    createdAt: input.now ?? new Date().toISOString()
  };
}

export function appendMemoryBlockRule(root: string, input: MemoryBlockRuleInput): MemoryBlockRule {
  const nextRule = createMemoryBlockRule(input);
  const rules = readMemoryBlockRules(root);
  const duplicate = rules.find((rule) => rule.normalizedText === nextRule.normalizedText && rule.kind === nextRule.kind);
  if (duplicate) return duplicate;
  writeMemoryBlockRules(root, [nextRule, ...rules]);
  return nextRule;
}

export function deleteMemoryBlockRule(root: string, id: string): boolean {
  const normalizedId = id.trim();
  if (!normalizedId) return false;

  const rules = readMemoryBlockRules(root);
  const next = rules.filter((rule) => rule.id !== normalizedId);
  if (next.length === rules.length) return false;

  writeMemoryBlockRules(root, next);
  return true;
}

export function clearMemoryBlockRules(root: string) {
  writeMemoryBlockRules(root, []);
}

export function isContextMemoryBlocked(candidate: ContextMemoryItem, rules: MemoryBlockRule[]): boolean {
  const normalized = normalizeMemoryText(candidate.text);
  return rules.some((rule) => {
    if (rule.normalizedText === normalized) return true;
    return rule.kind === candidate.kind && memoryTextOverlapScore(rule.text, candidate.text) >= 0.75;
  });
}

export function filterBlockedContextMemoryCandidates(candidates: ContextMemoryItem[], rules: MemoryBlockRule[]): ContextMemoryItem[] {
  if (rules.length === 0) return candidates;
  return candidates.filter((candidate) => !isContextMemoryBlocked(candidate, rules));
}