import { describe, expect, it } from "vitest";
import { createChatReply } from "../../../src/app/main/chatService";

const config = { apiKey: "key", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };

describe("chat service", () => {
  it("sends Kaka system prompt and user message", async () => {
    const result = await createChatReply({
      text: "你是谁？",
      config,
      requester: async ({ messages }) => {
        expect(messages[0]).toEqual({
          role: "system",
          content: expect.stringContaining("卡卡")
        });
        expect(messages[1]).toEqual({ role: "user", content: "你是谁？" });
        return { ok: true, data: { text: "我是卡卡。" } };
      }
    });

    expect(result).toEqual({ ok: true, data: { text: "我是卡卡。" } });
  });

  it("rejects empty chat messages", async () => {
    const result = await createChatReply({ text: "   ", config });

    expect(result).toEqual({ ok: false, errorCode: "CHAT_EMPTY_MESSAGE", message: "你还没说话。" });
  });
});