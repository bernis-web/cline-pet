import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const instances: any[] = [];
  const BrowserWindow = vi.fn(function BrowserWindow(this: any, options: Record<string, unknown>) {
    this.options = options;
    this.setAlwaysOnTop = vi.fn();
    this.setSkipTaskbar = vi.fn();
    instances.push(this);
    return this;
  });
  return {
    instances,
    BrowserWindow,
    screen: {
      getPrimaryDisplay: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }))
    }
  };
});

vi.mock("electron", () => ({
  BrowserWindow: electronMock.BrowserWindow,
  screen: electronMock.screen
}));

describe("createPetWindow", () => {
  beforeEach(() => {
    electronMock.instances.length = 0;
    electronMock.BrowserWindow.mockClear();
  });

  it("creates a background tray-style pet window with enough room for bubbles", async () => {
    const { createPetWindow } = await import("../../../src/app/main/createPetWindow");

    const win = createPetWindow() as any;

    expect(electronMock.BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 360,
      height: 420,
      skipTaskbar: true,
      transparent: true,
      frame: false
    }));
    expect(win.setSkipTaskbar).toHaveBeenCalledWith(true);
  });
});