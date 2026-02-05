import { StartupChecker, CheckResult } from "../StartupChecker";

interface MockLSPManager {
  isServerAvailable: jest.Mock<Promise<boolean>>;
  checkForUpdates: jest.Mock<
    Promise<{
      hasUpdate: boolean;
      currentVersion: string | null;
      latestVersion: string;
    }>
  >;
  download: jest.Mock<Promise<void>>;
  start: jest.Mock<Promise<void>>;
  stop: jest.Mock<Promise<void>>;
}

describe("StartupChecker", () => {
  let mockLSPManager: MockLSPManager;
  let mockContext: any;
  let originalGetConfiguration: any;
  let mockShowInformationMessage: jest.Mock;
  let mockWithProgress: jest.Mock;

  beforeEach(() => {
    mockLSPManager = {
      isServerAvailable: jest.fn(),
      checkForUpdates: jest.fn(),
      download: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };

    // Mock ExtensionContext with globalState
    const globalStateStorage = new Map<string, any>();
    mockContext = {
      globalState: {
        get: jest.fn((key: string, defaultValue?: any) => {
          return globalStateStorage.has(key) ? globalStateStorage.get(key) : defaultValue;
        }),
        update: jest.fn((key: string, value: any) => {
          globalStateStorage.set(key, value);
          return Promise.resolve();
        }),
      },
    };

    const vscode = require("vscode");
    originalGetConfiguration = vscode.workspace.getConfiguration;
    mockShowInformationMessage = vscode.window.showInformationMessage;
    mockWithProgress = vscode.window.withProgress;

    jest.clearAllMocks();
  });

  afterEach(() => {
    const vscode = require("vscode");
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  function mockConfiguration(config: Record<string, unknown>) {
    const vscode = require("vscode");
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: (key: string, defaultValue?: unknown) => {
        const fullKey = key;
        if (fullKey in config) {
          return config[fullKey];
        }
        return defaultValue;
      },
    });
  }

  describe("checkOnActivation", () => {
    describe("when check is disabled via settings", () => {
      it("skips check and returns none action", async () => {
        mockConfiguration({ checkForUpdates: false });
        const checker = new StartupChecker(mockLSPManager, mockContext);

        const result = await checker.checkOnActivation();

        expect(result.action).toBe("none");
        expect(mockLSPManager.checkForUpdates).not.toHaveBeenCalled();
      });
    });

    describe("when custom LSP path is configured", () => {
      it("skips check and returns none action", async () => {
        mockConfiguration({
          checkForUpdates: true,
          path: "/custom/path/to/hledger-lsp",
        });
        const checker = new StartupChecker(mockLSPManager, mockContext);

        const result = await checker.checkOnActivation();

        expect(result.action).toBe("none");
        expect(mockLSPManager.checkForUpdates).not.toHaveBeenCalled();
      });
    });

    describe("when LSP is not installed", () => {
      it("returns install action with latest version", async () => {
        mockConfiguration({ checkForUpdates: true, path: "" });
        mockLSPManager.isServerAvailable.mockResolvedValue(false);
        mockLSPManager.checkForUpdates.mockResolvedValue({
          hasUpdate: true,
          currentVersion: null,
          latestVersion: "v0.1.0",
        });

        const checker = new StartupChecker(mockLSPManager, mockContext);

        const result = await checker.checkOnActivation();

        expect(result.action).toBe("install");
        expect(result.latestVersion).toBe("v0.1.0");
        expect(result.currentVersion).toBeNull();
      });
    });

    describe("when LSP is installed and up to date", () => {
      it("returns none action", async () => {
        mockConfiguration({ checkForUpdates: true, path: "" });
        mockLSPManager.isServerAvailable.mockResolvedValue(true);
        mockLSPManager.checkForUpdates.mockResolvedValue({
          hasUpdate: false,
          currentVersion: "v0.1.0",
          latestVersion: "v0.1.0",
        });

        const checker = new StartupChecker(mockLSPManager, mockContext);

        const result = await checker.checkOnActivation();

        expect(result.action).toBe("none");
      });
    });

    describe("when LSP is installed but outdated", () => {
      it("returns update action with versions", async () => {
        mockConfiguration({ checkForUpdates: true, path: "" });
        mockLSPManager.isServerAvailable.mockResolvedValue(true);
        mockLSPManager.checkForUpdates.mockResolvedValue({
          hasUpdate: true,
          currentVersion: "v0.1.0",
          latestVersion: "v0.2.0",
        });

        const checker = new StartupChecker(mockLSPManager, mockContext);

        const result = await checker.checkOnActivation();

        expect(result.action).toBe("update");
        expect(result.currentVersion).toBe("v0.1.0");
        expect(result.latestVersion).toBe("v0.2.0");
      });
    });

    describe("when network error occurs", () => {
      it("returns error action and logs error", async () => {
        mockConfiguration({ checkForUpdates: true, path: "" });
        mockLSPManager.isServerAvailable.mockResolvedValue(false);
        mockLSPManager.checkForUpdates.mockRejectedValue(
          new Error("Network error")
        );

        const checker = new StartupChecker(mockLSPManager, mockContext);

        const result = await checker.checkOnActivation();

        expect(result.action).toBe("error");
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("showInstallNotification", () => {
    it("shows notification with Install and Later buttons", async () => {
      mockShowInformationMessage.mockResolvedValue("Later");
      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.showInstallNotification("v0.1.0");

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        "HLedger Language Server is not installed (latest: v0.1.0)",
        "Install",
        "Later"
      );
    });

    it("returns true when user clicks Install", async () => {
      mockShowInformationMessage.mockResolvedValue("Install");
      const checker = new StartupChecker(mockLSPManager, mockContext);

      const result = await checker.showInstallNotification("v0.1.0");

      expect(result).toBe(true);
    });

    it("returns false when user clicks Later", async () => {
      mockShowInformationMessage.mockResolvedValue("Later");
      const checker = new StartupChecker(mockLSPManager, mockContext);

      const result = await checker.showInstallNotification("v0.1.0");

      expect(result).toBe(false);
    });

    it("returns false when user dismisses notification", async () => {
      mockShowInformationMessage.mockResolvedValue(undefined);
      const checker = new StartupChecker(mockLSPManager, mockContext);

      const result = await checker.showInstallNotification("v0.1.0");

      expect(result).toBe(false);
    });
  });

  describe("showUpdateNotification", () => {
    it("shows notification with current and latest versions", async () => {
      mockShowInformationMessage.mockResolvedValue("Later");
      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.showUpdateNotification("v0.1.0", "v0.2.0");

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        "HLedger Language Server update available: v0.1.0 → v0.2.0",
        "Update",
        "Later"
      );
    });

    it("returns true when user clicks Update", async () => {
      mockShowInformationMessage.mockResolvedValue("Update");
      const checker = new StartupChecker(mockLSPManager, mockContext);

      const result = await checker.showUpdateNotification("v0.1.0", "v0.2.0");

      expect(result).toBe(true);
    });

    it("returns false when user clicks Later", async () => {
      mockShowInformationMessage.mockResolvedValue("Later");
      const checker = new StartupChecker(mockLSPManager, mockContext);

      const result = await checker.showUpdateNotification("v0.1.0", "v0.2.0");

      expect(result).toBe(false);
    });
  });

  describe("performInstall", () => {
    it("downloads and starts the LSP server", async () => {
      mockWithProgress.mockImplementation((_options: any, task: any) =>
        task({ report: jest.fn() })
      );
      mockLSPManager.download.mockResolvedValue(undefined);
      mockLSPManager.start.mockResolvedValue(undefined);

      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.performInstall();

      expect(mockLSPManager.download).toHaveBeenCalled();
      expect(mockLSPManager.start).toHaveBeenCalled();
    });

    it("shows success notification after install", async () => {
      mockWithProgress.mockImplementation((_options: any, task: any) =>
        task({ report: jest.fn() })
      );
      mockLSPManager.download.mockResolvedValue(undefined);
      mockLSPManager.start.mockResolvedValue(undefined);

      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.performInstall();

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("installed successfully")
      );
    });
  });

  describe("performUpdate", () => {
    it("stops, downloads, and starts the LSP server", async () => {
      mockWithProgress.mockImplementation((_options: any, task: any) =>
        task({ report: jest.fn() })
      );
      mockLSPManager.stop.mockResolvedValue(undefined);
      mockLSPManager.download.mockResolvedValue(undefined);
      mockLSPManager.start.mockResolvedValue(undefined);

      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.performUpdate();

      expect(mockLSPManager.stop).toHaveBeenCalled();
      expect(mockLSPManager.download).toHaveBeenCalled();
      expect(mockLSPManager.start).toHaveBeenCalled();
    });

    it("calls stop before download", async () => {
      const callOrder: string[] = [];
      mockWithProgress.mockImplementation((_options: any, task: any) =>
        task({ report: jest.fn() })
      );
      mockLSPManager.stop.mockImplementation(() => {
        callOrder.push("stop");
        return Promise.resolve();
      });
      mockLSPManager.download.mockImplementation(() => {
        callOrder.push("download");
        return Promise.resolve();
      });
      mockLSPManager.start.mockImplementation(() => {
        callOrder.push("start");
        return Promise.resolve();
      });

      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.performUpdate();

      expect(callOrder).toEqual(["stop", "download", "start"]);
    });

    it("shows success notification after update", async () => {
      mockWithProgress.mockImplementation((_options: any, task: any) =>
        task({ report: jest.fn() })
      );
      mockLSPManager.stop.mockResolvedValue(undefined);
      mockLSPManager.download.mockResolvedValue(undefined);
      mockLSPManager.start.mockResolvedValue(undefined);

      const checker = new StartupChecker(mockLSPManager, mockContext);

      await checker.performUpdate();

      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("updated successfully")
      );
    });
  });

  describe("session decline tracking", () => {
    it("does not show notification if update was declined this session", async () => {
      mockConfiguration({ checkForUpdates: true, path: "" });
      mockLSPManager.isServerAvailable.mockResolvedValue(true);
      mockLSPManager.checkForUpdates.mockResolvedValue({
        hasUpdate: true,
        currentVersion: "v0.1.0",
        latestVersion: "v0.2.0",
      });
      mockShowInformationMessage.mockResolvedValue("Later");

      const checker = new StartupChecker(mockLSPManager, mockContext);

      const firstResult = await checker.checkOnActivation();
      expect(firstResult.action).toBe("update");

      await checker.showUpdateNotification("v0.1.0", "v0.2.0");
      checker.markUpdateDeclinedThisSession();

      const secondResult = await checker.checkOnActivation();
      expect(secondResult.action).toBe("none");
    });

    it("resets declined state on new StartupChecker instance", async () => {
      mockConfiguration({ checkForUpdates: true, path: "" });
      mockLSPManager.isServerAvailable.mockResolvedValue(true);
      mockLSPManager.checkForUpdates.mockResolvedValue({
        hasUpdate: true,
        currentVersion: "v0.1.0",
        latestVersion: "v0.2.0",
      });

      const mockContext2: any = {
        globalState: {
          get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          update: jest.fn(() => Promise.resolve()),
        },
      };

      const checker1 = new StartupChecker(mockLSPManager, mockContext);
      checker1.markUpdateDeclinedThisSession();

      const checker2 = new StartupChecker(mockLSPManager, mockContext2);
      const result = await checker2.checkOnActivation();

      expect(result.action).toBe("update");
    });
  });
});
