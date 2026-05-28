import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadDeepSeekConfig } from "../../../src/app/main/config";

const originalEnv = { ...process.env };

describe("DeepSeek config loader", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads API key from environment before config file", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-config-"));
    writeFileSync(join(root, "config.json"), JSON.stringify({ deepseekApiKey: "file-key" }));
    process.env.CLINE_PET_DEEPSEEK_API_KEY = "env-key";

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
});