import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { startBridgeServer } from "../../bridge/bridgeServer.js";
import { buildDiagnosticsReport, formatDebugReport } from "../../diagnostics/diagnostics.js";
import { discoverPetPacks, PetPack } from "../../assets/petPackManager.js";
import { getPaths } from "../../shared/paths.js";
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import { PET_STATUSES, PetStatus } from "../../shared/statuses.js";
import { createPetWindow } from "./createPetWindow.js";
import { createTray, openPath } from "./tray.js";

const bridgePort = Number(process.env.CLINE_PET_BRIDGE_PORT ?? "37621");
let latestStatus: UpdatePetStatusInput = { status: "idle", task: "", source: "cline", updatedAt: new Date().toISOString() };

function toFileUrl(filePath: string) {
  return pathToFileURL(filePath).toString();
}

function defaultPack(): PetPack {
  const dir = join(process.cwd(), "src/assets/default-pet");
  return {
    dir,
    manifest: { id: "default-pixel-dev", name: "Default Pixel Dev", version: "1.0.0", states: Object.fromEntries(PET_STATUSES.map((s) => [s, `${s}.svg`])) as Record<PetStatus, string> },
    stateFiles: Object.fromEntries(PET_STATUSES.map((s) => [s, join(dir, `${s}.svg`)]))
  };
}

function loadSelectedId(stateFile: string) {
  if (!existsSync(stateFile)) return "default-pixel-dev";
  try { return JSON.parse(readFileSync(stateFile, "utf8")).selectedPetPackId ?? "default-pixel-dev"; } catch { return "default-pixel-dev"; }
}

function saveSelectedId(stateFile: string, selectedPetPackId: string) {
  writeFileSync(stateFile, JSON.stringify({ selectedPetPackId }, null, 2), "utf8");
}

app.whenReady().then(async () => {
  const paths = getPaths();
  mkdirSync(paths.logs, { recursive: true });
  mkdirSync(paths.petPacks, { recursive: true });
  const win = createPetWindow();
  const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? `file://${join(process.cwd(), "dist/app/renderer/index.html")}`;
  let packs = [defaultPack(), ...discoverPetPacks(paths.petPacks)];
  let selectedPetPackId = loadSelectedId(paths.stateFile);
  const selectedPack = () => packs.find((pack) => pack.manifest.id === selectedPetPackId) ?? packs[0];
  const sendSelectedPack = () => win.webContents.send("pet-pack", { id: selectedPack().manifest.id, name: selectedPack().manifest.name, stateImages: Object.fromEntries(PET_STATUSES.map((status) => [status, toFileUrl(selectedPack().stateFiles[status])])) });
  await win.loadURL(rendererUrl);
  win.webContents.once("did-finish-load", sendSelectedPack);

  const diagnostics = () => buildDiagnosticsReport({
    bridgePort,
    selectedPetPackId: selectedPack().manifest.id,
    selectedPetPackValid: selectedPetPackId === selectedPack().manifest.id,
    lastUpdateAt: latestStatus.updatedAt,
    lastError: null,
    logs: { app: paths.appLog, mcp: paths.mcpLog }
  });

  startBridgeServer(bridgePort, {
    onStatus(payload) {
      latestStatus = { ...payload, updatedAt: payload.updatedAt ?? new Date().toISOString() };
      win.webContents.send("pet-status", latestStatus);
    },
    onDiagnostics: diagnostics
  });

  createTray({
    window: win,
    runDiagnostics: async () => formatDebugReport(diagnostics()),
    openLogs: () => openPath(paths.logs),
    openPetPacksFolder: () => openPath(paths.petPacks),
    refreshPetPacks: () => { packs = [defaultPack(), ...discoverPetPacks(paths.petPacks)]; sendSelectedPack(); },
    getPetPacks: () => packs.map((pack) => ({ id: pack.manifest.id, name: pack.manifest.name })),
    getSelectedPetPackId: () => selectedPack().manifest.id,
    selectPetPack: (id) => { selectedPetPackId = id; saveSelectedId(paths.stateFile, id); sendSelectedPack(); }
  });
});

app.on("window-all-closed", () => {
  // Keep the tray app alive until the user selects Quit（退出）.
});