import { describe, expect, it, vi } from "vitest";
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

  it("injects memory summaries into chat messages and records the conversation after a successful reply", async () => {
    const recordTurn = vi.fn().mockResolvedValue(undefined);
    const requester = vi.fn().mockResolvedValue({ ok: true, data: { text: "我记得你说过喜欢安静陪伴。" } });

    const result = await createChatReply({
      text: "你还记得我喜欢什么吗？",
      config,
      memoryContext: {
        profileSummary: "用户偏好被称呼为主人。",
        relationshipSummary: "affection=70 trust=65",
        retrievedMemories: [{
          id: "m1",
          kind: "preference",
          text: "用户喜欢少打扰。",
          tags: ["preference"],
          weight: 90,
          createdAt: "2026-05-29T00:00:00.000Z",
          updatedAt: "2026-05-29T00:00:00.000Z"
        }]
      },
      onConversationResolved: recordTurn,
      requester
    });

    expect(result.ok).toBe(true);
    expect(requester).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system", content: expect.stringContaining("用户偏好被称呼为主人") }),
        expect.objectContaining({ role: "system", content: expect.stringContaining("用户喜欢少打扰") })
      ])
    }));
    expect(recordTurn).toHaveBeenCalledOnce();
  });
});