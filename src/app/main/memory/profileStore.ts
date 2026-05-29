import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";
import type { ProfileMemory } from "./memoryTypes.js";

function defaultProfile(): ProfileMemory {
  return {
    likes: [],
    dislikes: [],
    habits: [],
    topics: [],
    notes: [],
    updatedAt: new Date().toISOString()
  };
}

export function loadProfileMemory(root: string): ProfileMemory {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).profileMemoryFile;
  if (!existsSync(file)) return defaultProfile();
  return { ...defaultProfile(), ...JSON.parse(readFileSync(file, "utf8")) } as ProfileMemory;
}

export function saveProfileMemory(root: string, updater: (current: ProfileMemory) => ProfileMemory) {
  const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).profileMemoryFile;
  const next = { ...updater(loadProfileMemory(root)), updatedAt: new Date().toISOString() };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}