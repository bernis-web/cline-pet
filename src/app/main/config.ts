import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type DeepSeekConfigResult =
  | { ok: true; data: DeepSeekConfig }
  | { ok: false; errorCode: "DEEPSEEK_API_KEY_MISSING" | "DEEPSEEK_CONFIG_INVALID"; message: string };

type ConfigFile = {
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  deepseekModel?: string;
};

function readConfigFile(configRoot: string): ConfigFile {
  const configPath = join(configRoot, "config.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")) as ConfigFile;
  } catch {
    return {};
  }
}

export function loadDeepSeekConfig(configRoot: string): DeepSeekConfigResult {
  const file = readConfigFile(configRoot);
  const apiKey = process.env.CLINE_PET_DEEPSEEK_API_KEY || file.deepseekApiKey;
  const baseUrl = process.env.CLINE_PET_DEEPSEEK_BASE_URL || file.deepseekBaseUrl || "https://api.deepseek.com";
  const model = process.env.CLINE_PET_DEEPSEEK_MODEL || file.deepseekModel || "deepseek-chat";

  if (!apiKey?.trim()) {
    return {
      ok: false,
      errorCode: "DEEPSEEK_API_KEY_MISSING",
      message: "DeepSeek API key is missing. Set CLINE_PET_DEEPSEEK_API_KEY or %APPDATA%/cline-desktop-pet/config.json."
    };
  }

  return { ok: true, data: { apiKey: apiKey.trim(), baseUrl: baseUrl.replace(/\/$/, ""), model } };
}