import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type DeepSeekConfigResult =
  | { ok: true; data: DeepSeekConfig }
  | { ok: false; errorCode: "DEEPSEEK_API_KEY_MISSING" | "DEEPSEEK_CONFIG_INVALID"; message: string };

export type DeepSeekSettings = {
  configured: boolean;
  baseUrl: string;
  model: string;
  apiKeySource: "env" | "file" | "missing";
  configPath: string;
};

export type DeepSeekSettingsInput = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type DeepSeekSettingsResult =
  | { ok: true; data: DeepSeekSettings }
  | { ok: false; errorCode: "DEEPSEEK_API_KEY_MISSING" | "DEEPSEEK_CONFIG_INVALID" | "DEEPSEEK_CONFIG_WRITE_FAILED"; message: string };

type ConfigFile = {
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  deepseekModel?: string;
  [key: string]: unknown;
};

function configPath(configRoot: string) {
  return join(configRoot, "config.json");
}

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
}

function normalizeModel(model?: string) {
  return model?.trim() || "deepseek-chat";
}

function apiKeySource(file: ConfigFile): DeepSeekSettings["apiKeySource"] {
  if (file.deepseekApiKey?.trim()) return "file";
  if (process.env.CLINE_PET_DEEPSEEK_API_KEY?.trim()) return "env";
  return "missing";
}

function readConfigFile(configRoot: string): ConfigFile {
  const filePath = configPath(configRoot);
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")) as ConfigFile;
  } catch {
    return {};
  }
}

export function loadDeepSeekConfig(configRoot: string): DeepSeekConfigResult {
  const file = readConfigFile(configRoot);
  const apiKey = file.deepseekApiKey || process.env.CLINE_PET_DEEPSEEK_API_KEY;
  const baseUrl = normalizeBaseUrl(file.deepseekBaseUrl || process.env.CLINE_PET_DEEPSEEK_BASE_URL);
  const model = normalizeModel(file.deepseekModel || process.env.CLINE_PET_DEEPSEEK_MODEL);

  if (!apiKey?.trim()) {
    return {
      ok: false,
      errorCode: "DEEPSEEK_API_KEY_MISSING",
      message: "DeepSeek API key is missing. Set CLINE_PET_DEEPSEEK_API_KEY or %APPDATA%/cline-desktop-pet/config.json."
    };
  }

  return { ok: true, data: { apiKey: apiKey.trim(), baseUrl, model } };
}

export function getDeepSeekSettings(configRoot: string): DeepSeekSettingsResult {
  const file = readConfigFile(configRoot);
  const source = apiKeySource(file);
  return {
    ok: true,
    data: {
      configured: source !== "missing",
      baseUrl: normalizeBaseUrl(file.deepseekBaseUrl || process.env.CLINE_PET_DEEPSEEK_BASE_URL),
      model: normalizeModel(file.deepseekModel || process.env.CLINE_PET_DEEPSEEK_MODEL),
      apiKeySource: source,
      configPath: configPath(configRoot)
    }
  };
}

export function saveDeepSeekSettings(configRoot: string, input: DeepSeekSettingsInput): DeepSeekSettingsResult {
  const file = readConfigFile(configRoot);
  const nextApiKey = input.apiKey?.trim() || file.deepseekApiKey?.trim() || process.env.CLINE_PET_DEEPSEEK_API_KEY?.trim();
  if (!nextApiKey) {
    return { ok: false, errorCode: "DEEPSEEK_API_KEY_MISSING", message: "请输入 DeepSeek API key。" };
  }

  const nextBaseUrl = normalizeBaseUrl(input.baseUrl || file.deepseekBaseUrl);
  try {
    const parsed = new URL(nextBaseUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("unsupported protocol");
  } catch {
    return { ok: false, errorCode: "DEEPSEEK_CONFIG_INVALID", message: "DeepSeek Base URL 需要是有效的 http(s) 地址。" };
  }

  const nextFile: ConfigFile = {
    ...file,
    deepseekApiKey: nextApiKey,
    deepseekBaseUrl: nextBaseUrl,
    deepseekModel: normalizeModel(input.model || file.deepseekModel)
  };

  try {
    mkdirSync(configRoot, { recursive: true });
    writeFileSync(configPath(configRoot), `${JSON.stringify(nextFile, null, 2)}\n`, "utf8");
  } catch {
    return { ok: false, errorCode: "DEEPSEEK_CONFIG_WRITE_FAILED", message: "DeepSeek 配置保存失败，请检查配置目录权限。" };
  }

  return getDeepSeekSettings(configRoot);
}