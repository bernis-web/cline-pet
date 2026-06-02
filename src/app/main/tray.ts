import { BrowserWindow, Menu, nativeImage, shell, Tray } from "electron";
import { getStartOnBoot, setStartOnBoot } from "./startup.js";

type PrivacyMenuTab = "memories" | "blocklist" | "history" | "export";

const TRAY_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path fill="#f7d08a" d="M16 24 8 10l16 7h16l16-7-8 14v24c0 4.4-3.6 8-8 8H24c-4.4 0-8-3.6-8-8V24Z"/>
  <circle cx="25" cy="34" r="4" fill="#2f2419"/>
  <circle cx="39" cy="34" r="4" fill="#2f2419"/>
  <path fill="#ff8f6b" d="M32 39c2.7 0 5.3 1 7 3-2 3.3-4.4 5-7 5s-5-1.7-7-5c1.7-2 4.3-3 7-3Z"/>
  <path fill="none" stroke="#2f2419" stroke-linecap="round" stroke-width="3" d="M20 43h-7m31 0h-7M32 46v4"/>
</svg>`;

function createTrayIcon() {
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(TRAY_ICON_SVG).toString("base64")}`)
    .resize({ width: 16, height: 16 });
}

export function createTray(options: {
  window: BrowserWindow;
  runDiagnostics(): Promise<string>;
  showDiagnostics(): Promise<void> | void;
  openPrivacyTab(tab: PrivacyMenuTab): void;
  openLogs(): void;
  openPetPacksFolder(): void;
  refreshPetPacks(): void;
  getPetPacks(): { id: string; name: string }[];
  getSelectedPetPackId(): string;
  selectPetPack(id: string): void;
}) {
  const tray = new Tray(createTrayIcon());
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Pet（显示桌宠）", click: () => options.window.show() },
    { label: "Hide Pet（隐藏桌宠）", click: () => options.window.hide() },
    {
      label: "Privacy & Memory（隐私与记忆）",
      submenu: [
        { label: "Long-term Memories（长期记忆）", click: () => options.openPrivacyTab("memories") },
        { label: "Blocklist（不要再记）", click: () => options.openPrivacyTab("blocklist") },
        { label: "Chat History（聊天历史）", click: () => options.openPrivacyTab("history") },
        { label: "Export & Clear（导出/清除）", click: () => options.openPrivacyTab("export") }
      ]
    },
    { label: "Run Diagnostics（运行诊断）", click: async () => options.showDiagnostics() },
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