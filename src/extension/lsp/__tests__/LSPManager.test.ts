import type { Mock } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { BinaryManager } from "../BinaryManager";
import { LSPManager, LSPStatus } from "../LSPManager";
import * as vscode from "vscode";

vi.mock("undici", () => ({
  fetch: vi.fn(),
  EnvHttpProxyAgent: vi.fn(),
}));

interface UndiciMock {
  fetch: Mock;
  EnvHttpProxyAgent: Mock;
}

const { fetch: mockUndiciFetch, EnvHttpProxyAgent: mockEnvHttpProxyAgent } =
  (await vi.importMock<UndiciMock>("undici")) as UndiciMock;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("LSPManager", () => {
  let tempDir: string;
  let mockContext: any;
  let originalGetConfiguration: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hledger-lsp-test-"));

    mockContext = {
      globalStorageUri: { fsPath: tempDir },
      subscriptions: [],
    };

    originalGetConfiguration = vscode.workspace.getConfiguration;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  describe("initial state", () => {
    it("starts with not_installed status when no binary", () => {
      const manager = new LSPManager(mockContext);

      expect(manager.getStatus()).toBe(LSPStatus.NotInstalled);
    });

    it("does not read proxy configuration while activating", () => {
      vscode.workspace.getConfiguration = vi.fn();

      new LSPManager(mockContext);

      expect(vscode.workspace.getConfiguration).not.toHaveBeenCalledWith("http");
      expect(mockEnvHttpProxyAgent).not.toHaveBeenCalled();
    });
  });

  describe("getStoragePath", () => {
    it("returns path based on context storage", () => {
      const manager = new LSPManager(mockContext);

      expect(manager.getStoragePath()).toBe(tempDir);
    });
  });

  describe("isServerAvailable", () => {
    it("returns false when server not installed", async () => {
      const manager = new LSPManager(mockContext);

      const available = await manager.isServerAvailable();

      expect(available).toBe(false);
    });

    it("returns true when server is installed", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const manager = new LSPManager(mockContext);

      const available = await manager.isServerAvailable();

      expect(available).toBe(true);
    });
  });

  describe("getVersion", () => {
    it("returns null when not installed", async () => {
      const manager = new LSPManager(mockContext);

      const version = await manager.getVersion();

      expect(version).toBeNull();
    });

    it("returns version from version file", async () => {
      fs.writeFileSync(path.join(tempDir, "version.txt"), "v0.1.0");

      const manager = new LSPManager(mockContext);

      const version = await manager.getVersion();

      expect(version).toBe("v0.1.0");
    });
  });

  describe("dispose", () => {
    it("can be disposed safely", () => {
      const manager = new LSPManager(mockContext);

      expect(() => manager.dispose()).not.toThrow();
    });

    it("always disposes the binary manager", () => {
      const dispose = vi.spyOn(BinaryManager.prototype, "dispose");
      const manager = new LSPManager(mockContext);

      manager.dispose();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("rejects a deferred update check after deactivate without proxy resurrection", async () => {
      const version = createDeferred<string | null>();
      const getInstalledVersion = vi
        .spyOn(BinaryManager.prototype, "getInstalledVersion")
        .mockReturnValue(version.promise);

      vscode.workspace.getConfiguration = vi.fn();
      const manager = new LSPManager(mockContext);
      const updateCheck = manager.checkForUpdates();

      manager.dispose();
      version.resolve(null);

      await expect(updateCheck).rejects.toThrow("disposed");
      expect(vscode.workspace.getConfiguration).not.toHaveBeenCalledWith("http");
      expect(mockEnvHttpProxyAgent).not.toHaveBeenCalled();
      expect(mockUndiciFetch).not.toHaveBeenCalled();

      getInstalledVersion.mockRestore();
    });
  });

  describe("getBinaryPath", () => {
    it("returns auto-downloaded path when no custom path set", () => {
      const manager = new LSPManager(mockContext);

      const binaryPath = manager.getBinaryPath();

      expect(binaryPath).toContain(tempDir);
      expect(binaryPath).toMatch(/hledger-lsp(\.exe)?$/);
    });

    it("accepts Windows-style path with backslashes", () => {
      vscode.workspace.getConfiguration = vi.fn().mockReturnValue({
        get: (key: string) => {
          if (key === "path") return "C:\\tools\\hledger-lsp.exe";
          return undefined;
        },
      });

      const manager = new LSPManager(mockContext);

      expect(manager.getBinaryPath()).toBe("C:\\tools\\hledger-lsp.exe");
    });

    it("accepts path with shell metacharacters (no shell is spawned)", () => {
      vscode.workspace.getConfiguration = vi.fn().mockReturnValue({
        get: (key: string) => {
          if (key === "path") return "/path/to/lsp; rm -rf /";
          return undefined;
        },
      });

      const manager = new LSPManager(mockContext);

      expect(manager.getBinaryPath()).toBe("/path/to/lsp; rm -rf /");
    });

    it("returns custom path when valid and set", () => {
      const customPath = "/valid/path/to/hledger-lsp";
      vscode.workspace.getConfiguration = vi.fn().mockReturnValue({
        get: (key: string) => {
          if (key === "path") return customPath;
          return undefined;
        },
      });

      const manager = new LSPManager(mockContext);

      expect(manager.getBinaryPath()).toBe(customPath);
    });
  });

  describe("start", () => {
    it("throws when server not installed and no custom path", async () => {
      const manager = new LSPManager(mockContext);

      await expect(manager.start()).rejects.toThrow(/not installed/);
    });

    it("throws when custom binary not found", async () => {
      vscode.workspace.getConfiguration = vi.fn().mockReturnValue({
        get: (key: string) => {
          if (key === "path") return "/nonexistent/hledger-lsp";
          if (key === "debug") return false;
          return undefined;
        },
      });

      const manager = new LSPManager(mockContext);

      await expect(manager.start()).rejects.toThrow(/not found at/);
    });

    it("starts successfully when binary exists", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const manager = new LSPManager(mockContext);

      await manager.start();

      expect(manager.getStatus()).toBe(LSPStatus.Running);
      expect(manager.getClient()).not.toBeNull();

      manager.dispose();
    });
  });

  describe("stop", () => {
    it("is no-op when not started", async () => {
      const manager = new LSPManager(mockContext);

      await manager.stop();

      expect(manager.getStatus()).toBe(LSPStatus.NotInstalled);
    });

    it("stops running client", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const manager = new LSPManager(mockContext);
      await manager.start();

      await manager.stop();

      expect(manager.getStatus()).toBe(LSPStatus.Stopped);
      expect(manager.getClient()).toBeNull();
    });
  });

  describe("restart", () => {
    it("stops and starts the server", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const manager = new LSPManager(mockContext);
      await manager.start();

      await manager.restart();

      expect(manager.getStatus()).toBe(LSPStatus.Running);

      manager.dispose();
    });
  });

  describe("update", () => {
    it("keeps the running server when verification fails before installation", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const download = vi
        .spyOn(BinaryManager.prototype, "download")
        .mockRejectedValue(new Error("Signature verification failed"));
      const manager = new LSPManager(mockContext);
      await manager.start();
      const runningClient = manager.getClient();

      await expect(manager.update()).rejects.toThrow(
        "Signature verification failed"
      );

      expect(manager.getClient()).toBe(runningClient);
      expect(manager.getStatus()).toBe(LSPStatus.Running);

      download.mockRestore();
      manager.dispose();
    });

    it("stops the running server only after the binary is verified", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const manager = new LSPManager(mockContext);
      await manager.start();
      const runningClient = manager.getClient();
      const download = vi
        .spyOn(BinaryManager.prototype, "download")
        .mockImplementation(async (_onProgress, beforeInstall) => {
          expect(manager.getClient()).toBe(runningClient);
          await beforeInstall?.();
          expect(manager.getClient()).toBeNull();
        });

      await manager.update();

      expect(manager.getStatus()).toBe(LSPStatus.Running);
      expect(manager.getClient()).not.toBe(runningClient);

      download.mockRestore();
      manager.dispose();
    });

    it("restarts the old server when installation fails after it was stopped", async () => {
      const binaryPath = path.join(tempDir, "hledger-lsp");
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const manager = new LSPManager(mockContext);
      await manager.start();
      const download = vi
        .spyOn(BinaryManager.prototype, "download")
        .mockImplementation(async (_onProgress, beforeInstall) => {
          await beforeInstall?.();
          throw new Error("Atomic install failed");
        });

      await expect(manager.update()).rejects.toThrow("Atomic install failed");

      expect(manager.getStatus()).toBe(LSPStatus.Running);
      expect(manager.getClient()).not.toBeNull();

      download.mockRestore();
      manager.dispose();
    });
  });
});
