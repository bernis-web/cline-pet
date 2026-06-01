import { app, ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { startBridgeServer } from "../../bridge/bridgeServer.js";
import { buildDiagnosticsReport, formatDebugReport } from "../../diagnostics/diagnostics.js";
import { discoverPetPacks, PetPack } from "../../assets/petPackManager.js";
import { getPaths } from "../../shared/paths.js";
import { writeLog } from "../../shared/logger.js";
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import { PET_STATUSES, type PetStatus } from "../../shared/statuses.js";
import { createPetWindow } from "./createPetWindow.js";
import { createChatMoodStatus } from "./chatMood.js";
import { runKakaChatTurn } from "./chatCoordinator.js";
import { createChatReply } from "./chatService.js";
import { getDeepSeekSettings, loadDeepSeekConfig, saveDeepSeekSettings, type DeepSeekSettingsInput } from "./config.js";
import { recordHeadPatInteraction, type HeadPatInteractionInput } from "./interaction/headPatService.js";
import { clearChatHistory, readChatHistory } from "./memory/chatHistoryStore.js";
import {
  blockContextMemoryForUser,
  clearContextMemoriesForUser,
  deleteContextMemoryForUser,
  exportContextMemoriesForUser,
  getMemoryOverview,
  updateContextMemoryForUser
} from "./memory/memoryManagementService.js";
import { loadRelationshipMemory } from "./memory/relationshipStore.js";
import { deriveMoodState } from "./moodEngine.js";
import { chooseInitialPetPackId, DEFAULT_PET_PACK_ID } from "./petSelection.js";
import { maybeCreatePresencePulse } from "./presenceService.js";
import { applyPresenceActivityInput, hasLongWorkSession, updateWorkSession, type PresenceRuntimeState } from "./presenceRuntime.js";
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
let presenceRuntime: PresenceRuntimeState = { userIsReading: false };

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

function notifyRenderer(win: Electron.BrowserWindow, payload: UpdatePetStatusInput) {
  latestStatus = { ...payload, updatedAt: payload.updatedAt ?? new Date().toISOString() };
  presenceRuntime = updateWorkSession(presenceRuntime, {
    visibleStatus: latestStatus.visibleStatus ?? latestStatus.status,
    now: latestStatus.updatedAt ?? new Date().toISOString()
  });
  win.webContents.send("pet-status", latestStatus);
}

app.whenReady().then(async () => {
  const paths = getPaths();
  const appDataBaseDir = dirname(paths.root);
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
  const currentPetPackPayload = () => {
    const pack = selectedPack();
    return {
      id: pack.manifest.id,
      name: pack.manifest.name,
      stateImages: Object.fromEntries(PET_STATUSES.map((status) => [status, toFileUrl(pack.stateFiles[status])])),
      ...(pack.variants ? {
      variants: Object.fromEntries(
        Object.entries(pack.variants).map(([status, files]) => [status, files.map((file) => toFileUrl(file))])
      )
      } : {})
    };
  };
  const sendSelectedPack = () => win.webContents.send("pet-pack", currentPetPackPayload());
  ipcMain.handle("get-pet-pack", () => currentPetPackPayload());
  ipcMain.handle("deepseek:get-settings", () => getDeepSeekSettings(paths.root));
  ipcMain.handle("deepseek:save-settings", (_event, payload: DeepSeekSettingsInput) => saveDeepSeekSettings(paths.root, payload ?? {}));
  ipcMain.handle("window:move-by", (_event, payload: { dx?: number; dy?: number }) => {
    const dx = Number(payload?.dx ?? 0);
    const dy = Number(payload?.dy ?? 0);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { ok: false, message: "invalid delta" };
    const bounds = win.getBounds();
    win.setPosition(Math.round(bounds.x + dx), Math.round(bounds.y + dy), false);
    return { ok: true };
  });
  ipcMain.handle("presence:set-activity", (_event, payload: unknown) => {
    const update = applyPresenceActivityInput(presenceRuntime, payload);
    presenceRuntime = update.state;
    return update.response;
  });
  ipcMain.handle("interaction:head-pat", (_event, payload: HeadPatInteractionInput) => {
    const result = recordHeadPatInteraction(appDataBaseDir, payload ?? {});
    if (!result.ok) return result;

    const now = new Date().toISOString();
    const mood = deriveMoodState({
      now,
      relationship: result.relationship,
      hasRecentChat: true,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: latestStatus.visibleStatus
    });

    notifyRenderer(win, {
      status: mood.suggestedStatus,
      visibleStatus: mood.suggestedStatus,
      baseStatus: mood.suggestedStatus,
      overlayStatus: null,
      task: "",
      source: "interaction",
      updatedAt: now
    });

    return { ok: true };
  });
  ipcMain.handle("chat:send", async (_event, payload: { text?: string }) => {
    const config = loadDeepSeekConfig(paths.root);
    if (!config.ok) return { ok: false, errorCode: config.errorCode, message: config.message };

    const result = await runKakaChatTurn({
      root: appDataBaseDir,
      config: config.data,
      text: payload.text ?? "",
      now: new Date().toISOString(),
      latestVisibleStatus: latestStatus.visibleStatus
    });
    if (!result.ok) return result;
    notifyRenderer(win, result.moodStatus);
    return { ok: true, text: result.text };
  });
  ipcMain.handle("chat:get-history", () => ({ ok: true, data: readChatHistory(appDataBaseDir) }));
  ipcMain.handle("chat:clear-history", () => {
    clearChatHistory(appDataBaseDir);
    return { ok: true };
  });
  ipcMain.handle("memory:get-overview", () => ({ ok: true, data: getMemoryOverview(appDataBaseDir) }));
  ipcMain.handle("memory:delete", (_event, payload: { id?: string }) => deleteContextMemoryForUser(appDataBaseDir, payload?.id ?? ""));
  ipcMain.handle("memory:clear", () => clearContextMemoriesForUser(appDataBaseDir));
  ipcMain.handle("memory:export", () => exportContextMemoriesForUser(appDataBaseDir));
  ipcMain.handle("memory:update", (_event, payload: { id?: string; text?: string }) => updateContextMemoryForUser(appDataBaseDir, { id: payload?.id ?? "", text: payload?.text ?? "" }));
  ipcMain.handle("memory:block", (_event, payload: { id?: string }) => blockContextMemoryForUser(appDataBaseDir, { id: payload?.id ?? "" }));
  await win.loadURL(rendererUrl);
  sendSelectedPack();
  showPetWindow(win);

  let lastPresenceAt: string | undefined;
  const presenceInterval = setInterval(() => {
    const now = new Date().toISOString();
    const mood = deriveMoodState({
      now,
      relationship: loadRelationshipMemory(appDataBaseDir),
      hasRecentChat: false,
      lastChatSentiment: "neutral",
      memoryHitCount: 0,
      clineVisibleStatus: latestStatus.visibleStatus
    });

    const pulse = maybeCreatePresencePulse({
      now,
      lastPresenceAt,
      latestVisibleStatus: latestStatus.visibleStatus,
      mood: mood.name,
      userIsReading: presenceRuntime.userIsReading,
      longWorkSession: hasLongWorkSession(presenceRuntime, { now })
    });

    if (pulse) {
      lastPresenceAt = pulse.updatedAt;
      notifyRenderer(win, pulse);
    }
  }, 60_000);
  presenceInterval.unref?.();

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
      notifyRenderer(win, payload);
    },
    onDiagnostics: diagnostics,
    onShow: () => showPetWindow(win),
    onQuit: () => app.quit(),
    onError(error) {
      writeLog(paths.appLog, "error", "bridge server failed", { code: error.code, message: error.message, bridgePort });
      notifyRenderer(win, {
        status: "signal-weak",
        visibleStatus: "signal-weak",
        baseStatus: "signal-weak",
        overlayStatus: null,
        task: "",
        source: "bridge",
        message: error.code === "EADDRINUSE" ? `端口 ${bridgePort} 已被占用，可能已经有一个卡卡在运行。` : `Bridge 启动失败：${error.message}`,
        updatedAt: new Date().toISOString()
      });
    }
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
