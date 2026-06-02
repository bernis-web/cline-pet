import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export function createPetWindow() {
  const display = screen.getPrimaryDisplay();
  const width = 360;
  const height = 420;
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
    skipTaskbar: true,
    webPreferences: { preload: join(currentDir, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  win.setAlwaysOnTop(true, "floating");
  win.setSkipTaskbar(true);
  return win;
}