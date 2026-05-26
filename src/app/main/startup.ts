import { app } from "electron";

export function setStartOnBoot(enabled: boolean) {
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
}

export function getStartOnBoot() {
  return app.getLoginItemSettings().openAtLogin;
}