import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { getDeepSeekSettings, loadDeepSeekConfig, saveDeepSeekSettings } from "../../../src/app/main/config";

const originalEnv = { ...process.env };

describe("DeepSeek config loader", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses local app settings before environment variables", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    writeFileSync(join(root, "config.json"), JSON.stringify({
      deepseekApiKey: "file-key",
      deepseekBaseUrl: "https://api.deepseek.com",
      deepseekModel: "deepseek-v4-pro"
    }));
    process.env.CLINE_PET_DEEPSEEK_API_KEY = "env-key";
    process.env.CLINE_PET_DEEPSEEK_MODEL = "deepseek-chat";

    const config = loadDeepSeekConfig(root);

    expect(config).toEqual({
      ok: true,
      data: {
        apiKey: "file-key",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-pro"
      }
    });
    rmSync(root, { recursive: true, force: true });
  });

  it("uses environment variables when local app settings are missing", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    process.env.CLINE_PET_DEEPSEEK_API_KEY = "env-key";
    process.env.CLINE_PET_DEEPSEEK_MODEL = "deepseek-chat";

    const config = loadDeepSeekConfig(root);

    expect(config).toEqual({
      ok: true,
      data: {
        apiKey: "env-key",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat"
      }
    });
    rmSync(root, { recursive: true, force: true });
  });

  it("returns a typed error when API key is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    delete process.env.CLINE_PET_DEEPSEEK_API_KEY;

    const config = loadDeepSeekConfig(root);

    expect(config).toEqual({ ok: false, errorCode: "DEEPSEEK_API_KEY_MISSING", message: expect.stringContaining("CLINE_PET_DEEPSEEK_API_KEY") });
    rmSync(root, { recursive: true, force: true });
  });

  it("saves DeepSeek settings to the local config file", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    delete process.env.CLINE_PET_DEEPSEEK_API_KEY;

    const result = saveDeepSeekSettings(root, {
      apiKey: "  sk-local  ",
      baseUrl: "https://api.deepseek.com/",
      model: " deepseek-chat "
    });

    expect(result).toEqual({
      ok: true,
      data: {
        configured: true,
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
        apiKeySource: "file",
        configPath: join(root, "config.json")
      }
    });
    expect(JSON.parse(readFileSync(join(root, "config.json"), "utf8"))).toEqual({
      deepseekApiKey: "sk-local",
      deepseekBaseUrl: "https://api.deepseek.com",
      deepseekModel: "deepseek-chat"
    });
    expect(loadDeepSeekConfig(root)).toEqual({
      ok: true,
      data: { apiKey: "sk-local", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" }
    });
    rmSync(root, { recursive: true, force: true });
  });

  it("returns safe settings without exposing the saved API key", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    process.env.CLINE_PET_DEEPSEEK_API_KEY = "env-secret-key";
    process.env.CLINE_PET_DEEPSEEK_MODEL = "deepseek-chat";
    writeFileSync(join(root, "config.json"), JSON.stringify({ deepseekApiKey: "secret-key", deepseekModel: "deepseek-v4-pro" }));

    const settings = getDeepSeekSettings(root);

    expect(settings).toEqual({
      ok: true,
      data: {
        configured: true,
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
        apiKeySource: "file",
        configPath: join(root, "config.json")
      }
    });
    expect(JSON.stringify(settings)).not.toContain("secret-key");
    expect(JSON.stringify(settings)).not.toContain("env-secret-key");
    rmSync(root, { recursive: true, force: true });
  });
});