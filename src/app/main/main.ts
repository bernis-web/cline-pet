import { app, ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { startBridgeServer } from "../../bridge/bridgeServer.js";
import { buildDiagnosticsReport, formatDebugReport } from "../../diagnostics/diagnostics.js";
import { discoverPetPacks, PetPack } from "../../assets/petPackManager.js";
import { getPaths } from "../../shared/paths.js";
import { writeLog } from "../../shared/logger.js";
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import { PET_STATUSES, type PetStatus } from "../../shared/statuses.js";
import { createPetWindow } from "./createPetWindow.js";
import { chooseInitialPetPackId, DEFAULT_PET_PACK_ID } from "./petSelection.js";
import { createTray, openPath } from "./tray.js";

const bridgePort = Number(process.env.CLINE_PET_BRIDGE_PORT ?? "37621");
let latestStatus: UpdatePetStatusInput = {
  status: "idle",
  visibleStatus: "idle",
  baseStatus: "idle",
  overlayStatus: null,
  task: "",
  source: "cline",
  updatedAt: new Date().toISOString()
};

function toFileUrl(filePath: string) {
  return pathToFileURL(filePath).toString();
}

function defaultPack(): PetPack {
  const dir = join(process.cwd(), "src/assets/default-pet");
  const legacyDefaultFiles: Record<PetStatus, string> = {
    idle: "idle.svg",
    happy: "done.svg",
    sleepy: "idle.svg",
    thinking: "thinking.svg",
    angry: "error.svg",
    "not-found": "error.svg",
    message: "waiting-approval.svg",
    sleeping: "idle.svg",
    "head-pat": "done.svg",
    dragging: "working.svg",
    loading: "working.svg",
    "signal-weak": "error.svg"
  };
  return {
    dir,
    manifest: { id: "default-pixel-dev", name: "Default Pixel Dev", version: "1.0.0", formatVersion: 1, states: {
      idle: "idle.svg",
      thinking: "thinking.svg",
      working: "working.svg",
      "waiting-approval": "waiting-approval.svg",
      done: "done.svg",
      error: "error.svg"
    } },
    stateFiles: Object.fromEntries(PET_STATUSES.map((s) => [s, join(dir, legacyDefaultFiles[s])])) as Record<PetStatus, string>,
    formatVersion: 1,
    hasAllStandardStates: false
  };
}

function loadSelectedId(stateFile: string) {
  if (!existsSync(stateFile)) return null;
  try { return JSON.parse(readFileSync(stateFile, "utf8")).selectedPetPackId ?? null; } catch { return null; }
}

function saveSelectedId(stateFile: string, selectedPetPackId: string) {
  writeFileSync(stateFile, JSON.stringify({ selectedPetPackId }, null, 2), "utf8");
}

function showPetWindow(win: Electron.BrowserWindow) {
  const bounds = win.getBounds();
  writeLog(getPaths().appLog, "info", "show pet window", { visible: win.isVisible(), bounds });
  if (win.isMinimized()) win.restore();
  win.setAlwaysOnTop(true, "floating");
  win.showInactive();
  win.moveTop();
}

app.whenReady().then(async () => {
  const paths = getPaths();
  mkdirSync(paths.logs, { recursive: true });
  mkdirSync(paths.petPacks, { recursive: true });
  writeLog(paths.appLog, "info", "app ready", { bridgePort, cwd: process.cwd() });
  const win = createPetWindow();
  win.on("show", () => writeLog(paths.appLog, "info", "window show", { bounds: win.getBounds() }));
  win.on("hide", () => writeLog(paths.appLog, "info", "window hide", { bounds: win.getBounds() }));
  win.on("closed", () => writeLog(paths.appLog, "info", "window closed"));
  const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? `file://${join(process.cwd(), "dist/app/renderer/index.html")}`;
  let packs = [defaultPack(), ...discoverPetPacks(paths.petPacks)];
  let selectedPetPackId = chooseInitialPetPackId(loadSelectedId(paths.stateFile), packs.map((pack) => pack.manifest.id));
  const selectedPack = () => packs.find((pack) => pack.manifest.id === selectedPetPackId) ?? packs[0];
  const currentPetPackPayload = () => ({ id: selectedPack().manifest.id, name: selectedPack().manifest.name, stateImages: Object.fromEntries(PET_STATUSES.map((status) => [status, toFileUrl(selectedPack().stateFiles[status])])) });
  const sendSelectedPack = () => win.webContents.send("pet-pack", currentPetPackPayload());
  ipcMain.handle("get-pet-pack", () => currentPetPackPayload());
  await win.loadURL(rendererUrl);
  sendSelectedPack();
  showPetWindow(win);

  const localKakaPetPackPath = join(paths.petPacks, "kaka-desktop-pet");
  const diagnostics = () => buildDiagnosticsReport({
    bridgePort,
    selectedPetPackId: selectedPack().manifest.id,
    selectedPetPackValid: selectedPetPackId === selectedPack().manifest.id,
    selectedPetPackHasAllStandardStates: selectedPack().hasAllStandardStates,
    localKakaPetPackPath,
    localKakaPetPackInstalled: existsSync(localKakaPetPackPath),
    currentState: latestStatus,
    lastUpdateAt: latestStatus.updatedAt,
    lastError: null,
    logs: { app: paths.appLog, mcp: paths.mcpLog }
  });

  startBridgeServer(bridgePort, {
    onStatus(payload) {
      latestStatus = { ...payload, updatedAt: payload.updatedAt ?? new Date().toISOString() };
      win.webContents.send("pet-status", latestStatus);
    },
    onDiagnostics: diagnostics,
    onShow: () => showPetWindow(win),
    onQuit: () => app.quit()
  });

  createTray({
    window: win,
    runDiagnostics: async () => formatDebugReport(diagnostics()),
    openLogs: () => openPath(paths.logs),
    openPetPacksFolder: () => openPath(paths.petPacks),
    refreshPetPacks: () => { packs = [defaultPack(), ...discoverPetPacks(paths.petPacks)]; selectedPetPackId = chooseInitialPetPackId(selectedPetPackId === DEFAULT_PET_PACK_ID ? null : selectedPetPackId, packs.map((pack) => pack.manifest.id)); sendSelectedPack(); },
    getPetPacks: () => packs.map((pack) => ({ id: pack.manifest.id, name: pack.manifest.name })),
    getSelectedPetPackId: () => selectedPack().manifest.id,
    selectPetPack: (id) => { selectedPetPackId = id; saveSelectedId(paths.stateFile, id); sendSelectedPack(); }
  });
});

app.on("window-all-closed", () => {
  // Keep the tray app alive until the user selects Quit（退出）.
});
