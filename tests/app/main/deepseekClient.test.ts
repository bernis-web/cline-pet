import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDeepSeekChat } from "../../../src/app/main/deepseekClient";

const originalFetch = globalThis.fetch;

describe("DeepSeek client", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns assistant text from DeepSeek response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "你好，我是卡卡。" } }] })
    } as any);

    const result = await requestDeepSeekChat({
      config: { apiKey: "key", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
      messages: [{ role: "user", content: "你好" }],
      timeoutMs: 1000
    });

    expect(result).toEqual({ ok: true, data: { text: "你好，我是卡卡。" } });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("maps HTTP errors to safe errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" } as any);

    const result = await requestDeepSeekChat({
      config: { apiKey: "bad", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
      messages: [{ role: "user", content: "你好" }],
      timeoutMs: 1000
    });

    expect(result).toEqual({ ok: false, errorCode: "DEEPSEEK_HTTP_ERROR", message: "DeepSeek request failed with HTTP 401." });
  });
});