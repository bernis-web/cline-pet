import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { appendContextMemory, readContextMemories } from "../../../src/app/main/memory/contextStore";
import { searchContextMemories } from "../../../src/app/main/memory/retrieval";

describe("context memory", () => {
  const roots: string[] = [];

  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("appends JSONL items and reads them back", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-context-"));
    roots.push(root);

    appendContextMemory(root, {
      kind: "preference",
      text: "用户偏爱隐私优先",
      tags: ["privacy"],
      weight: 80
    });

    expect(readContextMemories(root)).toHaveLength(1);
  });

  it("returns the most relevant memories first", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-context-"));
    roots.push(root);

    appendContextMemory(root, {
      kind: "project-context",
      text: "用户正在做桌宠长期记忆模块",
      tags: ["memory", "desktop-pet"],
      weight: 90
    });
    appendContextMemory(root, {
      kind: "fact",
      text: "用户喜欢深夜开发",
      tags: ["habit"],
      weight: 40
    });

    const results = searchContextMemories(readContextMemories(root), "桌宠记忆", 2);

    expect(results[0]?.text).toContain("桌宠长期记忆模块");
  });
});