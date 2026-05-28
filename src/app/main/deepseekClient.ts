import type { DeepSeekConfig } from "./config.js";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekChatResult =
  | { ok: true; data: { text: string } }
  | { ok: false; errorCode: "DEEPSEEK_HTTP_ERROR" | "DEEPSEEK_NETWORK_ERROR" | "DEEPSEEK_BAD_RESPONSE"; message: string };

export async function requestDeepSeekChat(input: {
  config: DeepSeekConfig;
  messages: DeepSeekMessage[];
  timeoutMs: number;
}): Promise<DeepSeekChatResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(`${input.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.config.apiKey}`
      },
      body: JSON.stringify({ model: input.config.model, messages: input.messages }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, errorCode: "DEEPSEEK_HTTP_ERROR", message: `DeepSeek request failed with HTTP ${response.status}.` };
    }

    const json = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, errorCode: "DEEPSEEK_BAD_RESPONSE", message: "DeepSeek returned an empty response." };
    }

    return { ok: true, data: { text } };
  } catch {
    return { ok: false, errorCode: "DEEPSEEK_NETWORK_ERROR", message: "Unable to reach DeepSeek." };
  } finally {
    clearTimeout(timeout);
  }
}