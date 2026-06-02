import { describe, expect, it } from "vitest";
import { getPaths } from "../../src/shared/paths";

function unixify(value: string) {
  return value.replaceAll("\\", "/");
}

describe("getPaths", () => {
  it("exposes local files for profile, relationship, and context memory", () => {
    const paths = getPaths({ APPDATA: "C:/Users/me/AppData/Roaming" } as NodeJS.ProcessEnv);

    expect(unixify(paths.root)).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet");
    expect(unixify(paths.profileMemoryFile)).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet/profile.json");
    expect(unixify(paths.relationshipMemoryFile)).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet/relationship.json");
    expect(unixify(paths.contextMemoryFile)).toBe("C:/Users/me/AppData/Roaming/cline-desktop-pet/context-memory.jsonl");
  });
});