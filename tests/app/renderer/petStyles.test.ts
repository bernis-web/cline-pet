import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/app/renderer/petStyles.css"), "utf8");

describe("pet renderer styles", () => {
  it("gives the speech bubble enough bounded space instead of clipping at the window top", () => {
    expect(styles).toContain(".speech-bubble");
    expect(styles).toContain("top: 12px");
    expect(styles).toContain("max-height: 160px");
    expect(styles).toContain("box-sizing: border-box");
  });

  it("keeps the normal chat form compact and temporary", () => {
    expect(styles).toContain("width: calc(100% - 24px)");
    expect(styles).toContain("bottom: 12px");
  });
});