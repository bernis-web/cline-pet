import { describe, expect, it } from "vitest";
import { getRelationshipPersona } from "../../../src/app/main/relationshipPersona";

describe("relationshipPersona", () => {
  it("returns progressively closer chat guidance across stages", () => {
    expect(getRelationshipPersona("new").chatStyle).toContain("礼貌");
    expect(getRelationshipPersona("familiar").chatStyle).toContain("自然");
    expect(getRelationshipPersona("close").chatStyle).toContain("贴近");
    expect(getRelationshipPersona("trusted").chatStyle).toContain("稳定地主动关心");
  });

  it("keeps trusted stage close but still within privacy boundaries", () => {
    const trusted = getRelationshipPersona("trusted");

    expect(trusted.chatStyle).toContain("最熟络");
    expect(trusted.boundaryRule).toContain("不声称读取用户文件");
    expect(trusted.boundaryRule).toContain("不过度依附");
  });

  it("provides different active bubble tones for new and close stages", () => {
    expect(getRelationshipPersona("new").bubbleTone).not.toBe(getRelationshipPersona("close").bubbleTone);
  });
});