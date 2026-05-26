import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

export function createPetWindow() {
  const display = screen.getPrimaryDisplay();
  const width = 300;
  const height = 260;
  const win = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - 32,
    y: display.workArea.y + display.workArea.height - height - 32,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  win.setAlwaysOnTop(true, "floating");
  return win;
}