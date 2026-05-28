import type { DeepSeekConfig } from "./config.js";
import { requestDeepSeekChat, type DeepSeekChatResult, type DeepSeekMessage } from "./deepseekClient.js";

export type ChatReplyResult = DeepSeekChatResult | { ok: false; errorCode: "CHAT_EMPTY_MESSAGE"; message: string };

export async function createChatReply(input: {
  text: string;
  config: DeepSeekConfig;
  requester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}): Promise<ChatReplyResult> {
  const text = input.text.trim();
  if (!text) return { ok: false, errorCode: "CHAT_EMPTY_MESSAGE", message: "你还没说话。" };

  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: "你是卡卡，一个运行在用户电脑本地的桌面电子宠物。回答要简短、温和、有一点陪伴感。不要声称你能读取用户代码或文件，除非用户主动提供。"
    },
    { role: "user", content: text }
  ];

  const requester = input.requester ?? requestDeepSeekChat;
  return requester({ config: input.config, messages, timeoutMs: 30000 });
}