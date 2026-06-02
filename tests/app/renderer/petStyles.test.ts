import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/app/renderer/petStyles.css"), "utf8");

describe("pet renderer styles", () => {
  it("places the speech bubble near Kaka's head instead of pinning it to the window top", () => {
    expect(styles).toContain(".speech-bubble");
    expect(styles).not.toContain("top: 12px");
    expect(styles).toContain("bottom: 238px");
    expect(styles).toContain("z-index: 2");
    expect(styles).toContain("max-height: 132px");
    expect(styles).toContain("box-sizing: border-box");
  });

  it("keeps the normal chat form compact and temporary", () => {
    expect(styles).toContain("width: calc(100% - 24px)");
    expect(styles).toContain("bottom: 12px");
  });

  it("removes history and memory triggers from the main surface while keeping overlay panel styles", () => {
    expect(styles).not.toContain(".chat-history-trigger");
    expect(styles).not.toContain(".memory-trigger");
    expect(styles).toContain(".chat-history-panel");
    expect(styles).toContain("inset: 12px");
  });

  it("includes relationship overview, memory list, and correction styles", () => {
    expect(styles).toContain(".memory-panel");
    expect(styles).toContain(".relationship-card");
    expect(styles).toContain(".relationship-notes");
    expect(styles).toContain(".memory-list");
    expect(styles).toContain(".memory-delete");
    expect(styles).toContain(".memory-edit");
    expect(styles).toContain(".memory-block");
    expect(styles).toContain(".memory-editor");
    expect(styles).toContain(".memory-editor-actions");
  });

  it("includes unified privacy panel styles for tabs, blocklist, history, and export actions", () => {
    expect(styles).toContain(".privacy-panel");
    expect(styles).toContain(".privacy-tabs");
    expect(styles).toContain(".privacy-tab-active");
    expect(styles).toContain(".privacy-body");
    expect(styles).toContain(".privacy-data-list");
    expect(styles).toContain(".privacy-blocklist-section");
    expect(styles).toContain(".block-rule-list");
    expect(styles).toContain(".block-rules-clear");
    expect(styles).toContain(".privacy-history-section");
    expect(styles).toContain(".chat-history-actions");
    expect(styles).toContain(".chat-history-copy");
    expect(styles).toContain(".chat-history-block");
    expect(styles).toContain(".privacy-export-section");
    expect(styles).toContain(".privacy-export-copy");
    expect(styles).toContain(".privacy-clear-actions");
  });
});