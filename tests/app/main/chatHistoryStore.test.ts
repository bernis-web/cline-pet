import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { appendChatHistoryTurn, clearChatHistory, readChatHistory } from "../../../src/app/main/memory/chatHistoryStore";
import { getPaths } from "../../../src/shared/paths";

describe("chatHistoryStore", () => {
  const roots: string[] = [];

  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "cline-chat-history-"));
    roots.push(root);
    return root;
  }

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("adds chat-history.jsonl to shared paths", () => {
    const root = tempRoot();
    expect(getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile).toBe(join(root, "cline-desktop-pet", "chat-history.jsonl"));
  });

  it("appends turns and reads newest first", () => {
    const root = tempRoot();

    const first = appendChatHistoryTurn(root, {
      userText: "今天好累",
      assistantText: "先喝口水，我在旁边陪你。",
      createdAt: "2026-06-01T01:00:00.000Z",
      sentiment: "tired",
      memoryIds: []
    });
    const second = appendChatHistoryTurn(root, {
      userText: "继续做卡卡",
      assistantText: "我们慢慢来，把它做成赛博生命。",
      createdAt: "2026-06-01T02:00:00.000Z",
      sentiment: "focused",
      summary: "用户继续开发卡卡 Cyber Life v1。",
      memoryIds: ["m1"]
    });

    const turns = readChatHistory(root);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toEqual(second);
    expect(turns[1]).toEqual(first);
  });

  it("caps stored turns at the requested retention", () => {
    const root = tempRoot();
    for (let index = 0; index < 5; index += 1) {
      appendChatHistoryTurn(root, {
        userText: `u${index}`,
        assistantText: `a${index}`,
        createdAt: `2026-06-01T00:00:0${index}.000Z`,
        sentiment: "neutral",
        memoryIds: []
      }, { maxTurns: 3 });
    }

    expect(readChatHistory(root).map((turn) => turn.userText)).toEqual(["u4", "u3", "u2"]);
  });

  it("skips malformed JSONL rows and clears history", () => {
    const root = tempRoot();
    const file = getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `not-json\n${JSON.stringify({
      id: "valid",
      userText: "hello",
      assistantText: "hi",
      createdAt: "2026-06-01T00:00:00.000Z",
      sentiment: "positive",
      memoryIds: []
    })}\n`, "utf8");

    expect(readChatHistory(root)).toHaveLength(1);

    clearChatHistory(root);

    expect(readChatHistory(root)).toEqual([]);
  });
});