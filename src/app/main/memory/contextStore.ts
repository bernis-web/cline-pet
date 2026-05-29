import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";
import type { ContextMemoryItem } from "./memoryTypes.js";

type NewContextMemory = Omit<ContextMemoryItem, "id" | "createdAt" | "updatedAt">;

export function readContextMemories(root: string): ContextMemoryItem[] {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ContextMemoryItem);
}

export function appendContextMemory(root: string, input: NewContextMemory): ContextMemoryItem {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).contextMemoryFile;
  const now = new Date().toISOString();
  const item: ContextMemoryItem = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input
  };

  mkdirSync(dirname(file), { recursive: true });
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const prefix = current.length > 0 ? "\n" : "";
  writeFileSync(file, `${current}${prefix}${JSON.stringify(item)}`, "utf8");
  return item;
}