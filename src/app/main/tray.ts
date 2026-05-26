import { BrowserWindow, Menu, nativeImage, shell, Tray, clipboard } from "electron";
import { getStartOnBoot, setStartOnBoot } from "./startup.js";

export function createTray(options: {
  window: BrowserWindow;
  runDiagnostics(): Promise<string>;
  openLogs(): void;
  openPetPacksFolder(): void;
  refreshPetPacks(): void;
  getPetPacks(): { id: string; name: string }[];
  getSelectedPetPackId(): string;
  selectPetPack(id: string): void;
}) {
  const tray = new Tray(nativeImage.createEmpty());
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Pet（显示桌宠）", click: () => options.window.show() },
    { label: "Hide Pet（隐藏桌宠）", click: () => options.window.hide() },
    { label: "Run Diagnostics（运行诊断）", click: async () => clipboard.writeText(await options.runDiagnostics()) },
    { label: "Open Logs（打开日志）", click: options.openLogs },
    { label: "Select Pet（选择宠物）", submenu: options.getPetPacks().map((pack) => ({ label: pack.name, type: "radio" as const, checked: pack.id === options.getSelectedPetPackId(), click: () => { options.selectPetPack(pack.id); rebuild(); } })) },
    { label: "Open Pet Packs Folder（打开宠物资源包目录）", click: options.openPetPacksFolder },
    { label: "Refresh Pet Packs（刷新宠物资源包）", click: () => { options.refreshPetPacks(); rebuild(); } },
    { label: "Start on Boot（开机自启）", type: "checkbox", checked: getStartOnBoot(), click: (item) => { setStartOnBoot(item.checked); rebuild(); } },
    { type: "separator" },
    { label: "Quit（退出）", role: "quit" }
  ]));
  rebuild();
  tray.setToolTip("Cline Desktop Pet");
  return tray;
}

export function openPath(path: string) {
  shell.openPath(path);
}