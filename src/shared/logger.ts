import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type LogLevel = "info" | "warn" | "error";

export function writeLog(filePath: string, level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  mkdirSync(dirname(filePath), { recursive: true });
  const safeMeta = JSON.stringify(meta, (_key, value) => typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}...` : value);
  appendFileSync(filePath, `${new Date().toISOString()} ${level.toUpperCase()} ${message} ${safeMeta}\n`, "utf8");
}