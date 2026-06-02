import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const trayInstance = {
    setContextMenu: vi.fn(),
    setToolTip: vi.fn()
  };
  const trayIcon = {
    resize: vi.fn(() => "tray-image")
  };

  return {
    trayInstance,
    trayIcon,
    Tray: vi.fn(() => trayInstance),
    nativeImage: {
      createEmpty: vi.fn(() => "empty-image"),
      createFromDataURL: vi.fn(() => trayIcon)
    },
    Menu: {
      buildFromTemplate: vi.fn((template) => template)
    },
    clipboard: {
      writeText: vi.fn()
    },
    shell: {
      openPath: vi.fn()
    }
  };
});

const startupMock = vi.hoisted(() => ({
  getStartOnBoot: vi.fn(() => false),
  setStartOnBoot: vi.fn()
}));

vi.mock("electron", () => ({
  Tray: electronMock.Tray,
  nativeImage: electronMock.nativeImage,
  Menu: electronMock.Menu,
  clipboard: electronMock.clipboard,
  shell: electronMock.shell
}));

vi.mock("../../../src/app/main/startup", () => startupMock);

describe("tray menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a visible tray icon instead of an empty placeholder", async () => {
    const { createTray } = await import("../../../src/app/main/tray");

    createTray({
      window: { show: vi.fn(), hide: vi.fn() } as any,
      runDiagnostics: vi.fn().mockResolvedValue("diagnostics text"),
      showDiagnostics: vi.fn().mockResolvedValue(undefined),
      openPrivacyTab: vi.fn(),
      openLogs: vi.fn(),
      openPetPacksFolder: vi.fn(),
      refreshPetPacks: vi.fn(),
      getPetPacks: vi.fn(() => []),
      getSelectedPetPackId: vi.fn(() => "default"),
      selectPetPack: vi.fn()
    } as any);

    expect(electronMock.nativeImage.createFromDataURL).toHaveBeenCalledOnce();
    expect(electronMock.trayIcon.resize).toHaveBeenCalledWith({ width: 16, height: 16 });
    expect(electronMock.nativeImage.createEmpty).not.toHaveBeenCalled();
    expect(electronMock.Tray).toHaveBeenCalledWith("tray-image");
  });

  it("opens privacy tabs from the tray menu and runs visible diagnostics", async () => {
    const { createTray } = await import("../../../src/app/main/tray");
    const showDiagnostics = vi.fn().mockResolvedValue(undefined);
    const openPrivacyTab = vi.fn();

    createTray({
      window: { show: vi.fn(), hide: vi.fn() } as any,
      runDiagnostics: vi.fn().mockResolvedValue("diagnostics text"),
      showDiagnostics,
      openPrivacyTab,
      openLogs: vi.fn(),
      openPetPacksFolder: vi.fn(),
      refreshPetPacks: vi.fn(),
      getPetPacks: vi.fn(() => []),
      getSelectedPetPackId: vi.fn(() => "default"),
      selectPetPack: vi.fn()
    } as any);

    const template = electronMock.Menu.buildFromTemplate.mock.calls[0]?.[0] as any[];
    const privacyMenu = template.find((item) => item.label === "Privacy & Memory（隐私与记忆）");
    expect(privacyMenu).toBeTruthy();

    privacyMenu.submenu[0].click();
    privacyMenu.submenu[2].click();

    expect(openPrivacyTab).toHaveBeenNthCalledWith(1, "memories");
    expect(openPrivacyTab).toHaveBeenNthCalledWith(2, "history");

    const diagnosticsItem = template.find((item) => item.label === "Run Diagnostics（运行诊断）");
    await diagnosticsItem.click();

    expect(showDiagnostics).toHaveBeenCalledOnce();
  });
});