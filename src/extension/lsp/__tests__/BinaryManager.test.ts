import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  BinaryManager,
  PlatformInfo,
  ReleaseInfo,
  getPlatformInfo,
  getBinaryName,
} from "../BinaryManager";

describe("getPlatformInfo", () => {
  it("returns darwin-arm64 on macOS ARM", () => {
    const info = getPlatformInfo("darwin", "arm64");

    expect(info.platform).toBe("darwin");
    expect(info.arch).toBe("arm64");
    expect(info.assetSuffix).toBe("darwin_arm64");
  });

  it("returns darwin-amd64 on macOS Intel", () => {
    const info = getPlatformInfo("darwin", "x64");

    expect(info.platform).toBe("darwin");
    expect(info.arch).toBe("amd64");
    expect(info.assetSuffix).toBe("darwin_amd64");
  });

  it("returns linux-amd64 on Linux x64", () => {
    const info = getPlatformInfo("linux", "x64");

    expect(info.platform).toBe("linux");
    expect(info.arch).toBe("amd64");
    expect(info.assetSuffix).toBe("linux_amd64");
  });

  it("returns linux-arm64 on Linux ARM", () => {
    const info = getPlatformInfo("linux", "arm64");

    expect(info.platform).toBe("linux");
    expect(info.arch).toBe("arm64");
    expect(info.assetSuffix).toBe("linux_arm64");
  });

  it("returns windows-amd64 on Windows x64", () => {
    const info = getPlatformInfo("win32", "x64");

    expect(info.platform).toBe("windows");
    expect(info.arch).toBe("amd64");
    expect(info.assetSuffix).toBe("windows_amd64.exe");
  });

  it("throws on unsupported platform", () => {
    expect(() => getPlatformInfo("freebsd", "x64")).toThrow(
      /Unsupported platform/
    );
  });

  it("throws on unsupported architecture", () => {
    expect(() => getPlatformInfo("linux", "ia32")).toThrow(
      /Unsupported architecture/
    );
  });
});

describe("getBinaryName", () => {
  it("returns hledger-lsp on non-Windows", () => {
    expect(getBinaryName("darwin")).toBe("hledger-lsp");
    expect(getBinaryName("linux")).toBe("hledger-lsp");
  });

  it("returns hledger-lsp.exe on Windows", () => {
    expect(getBinaryName("windows")).toBe("hledger-lsp.exe");
  });
});

describe("BinaryManager", () => {
  let tempDir: string;
  let manager: BinaryManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hledger-lsp-test-"));
    manager = new BinaryManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("getBinaryPath", () => {
    it("returns path inside storage directory", () => {
      const binaryPath = manager.getBinaryPath();

      expect(binaryPath).toContain(tempDir);
      expect(binaryPath).toMatch(/hledger-lsp(\.exe)?$/);
    });
  });

  describe("isInstalled", () => {
    it("returns false when binary does not exist", async () => {
      const installed = await manager.isInstalled();

      expect(installed).toBe(false);
    });

    it("returns true when binary exists and is executable", async () => {
      const binaryPath = manager.getBinaryPath();
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const installed = await manager.isInstalled();

      expect(installed).toBe(true);
    });
  });

  describe("getInstalledVersion", () => {
    it("returns null when version file does not exist", async () => {
      const version = await manager.getInstalledVersion();

      expect(version).toBeNull();
    });

    it("returns version from version file", async () => {
      const versionPath = path.join(tempDir, "version.txt");
      fs.writeFileSync(versionPath, "v0.1.0");

      const version = await manager.getInstalledVersion();

      expect(version).toBe("v0.1.0");
    });
  });

  describe("getLatestRelease", () => {
    it("fetches release info from GitHub API", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v0.2.0",
            assets: [
              {
                name: "hledger-lsp_darwin_arm64",
                browser_download_url:
                  "https://github.com/juev/hledger-lsp/releases/download/v0.2.0/hledger-lsp_darwin_arm64",
              },
            ],
          }),
      });

      manager = new BinaryManager(tempDir, mockFetch);
      const release = await manager.getLatestRelease();

      expect(release).toEqual({
        version: "v0.2.0",
        assets: [
          {
            name: "hledger-lsp_darwin_arm64",
            downloadUrl:
              "https://github.com/juev/hledger-lsp/releases/download/v0.2.0/hledger-lsp_darwin_arm64",
          },
        ],
      });
    });

    it("throws when GitHub API returns error", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      manager = new BinaryManager(tempDir, mockFetch);

      await expect(manager.getLatestRelease()).rejects.toThrow(
        /Failed to fetch latest release/
      );
    });
  });

  describe("needsUpdate", () => {
    it("returns true when no version is installed", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v0.1.0",
            assets: [],
          }),
      });

      manager = new BinaryManager(tempDir, mockFetch);
      const needs = await manager.needsUpdate();

      expect(needs).toBe(true);
    });

    it("returns true when installed version is older", async () => {
      const versionPath = path.join(tempDir, "version.txt");
      fs.writeFileSync(versionPath, "v0.1.0");

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v0.2.0",
            assets: [],
          }),
      });

      manager = new BinaryManager(tempDir, mockFetch);
      const needs = await manager.needsUpdate();

      expect(needs).toBe(true);
    });

    it("returns false when installed version is current", async () => {
      const versionPath = path.join(tempDir, "version.txt");
      fs.writeFileSync(versionPath, "v0.2.0");

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v0.2.0",
            assets: [],
          }),
      });

      manager = new BinaryManager(tempDir, mockFetch);
      const needs = await manager.needsUpdate();

      expect(needs).toBe(false);
    });
  });

  describe("download", () => {
    it("downloads binary and saves version", async () => {
      const binaryContent = Buffer.from("fake binary content");
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("api.github.com")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                tag_name: "v0.1.0",
                assets: [
                  {
                    name: `hledger-lsp_${getPlatformInfo(os.platform(), os.arch()).assetSuffix}`,
                    browser_download_url: "https://example.com/binary",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(binaryContent.buffer),
        });
      });

      manager = new BinaryManager(tempDir, mockFetch);
      await manager.download();

      expect(await manager.isInstalled()).toBe(true);
      expect(await manager.getInstalledVersion()).toBe("v0.1.0");
    });

    it("throws when no matching asset found", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tag_name: "v0.1.0",
            assets: [
              {
                name: "hledger-lsp-unknown-platform",
                browser_download_url: "https://example.com/binary",
              },
            ],
          }),
      });

      manager = new BinaryManager(tempDir, mockFetch);

      await expect(manager.download()).rejects.toThrow(
        /No binary found for platform/
      );
    });

    it("throws when download fails", async () => {
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("api.github.com")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                tag_name: "v0.1.0",
                assets: [
                  {
                    name: `hledger-lsp_${getPlatformInfo(os.platform(), os.arch()).assetSuffix}`,
                    browser_download_url: "https://example.com/binary",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });
      });

      manager = new BinaryManager(tempDir, mockFetch);

      await expect(manager.download()).rejects.toThrow(/Failed to download/);
    });
  });

  describe("ensureInstalled", () => {
    it("downloads if not installed", async () => {
      const binaryContent = Buffer.from("fake binary");
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("api.github.com")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                tag_name: "v0.1.0",
                assets: [
                  {
                    name: `hledger-lsp_${getPlatformInfo(os.platform(), os.arch()).assetSuffix}`,
                    browser_download_url: "https://example.com/binary",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(binaryContent.buffer),
        });
      });

      manager = new BinaryManager(tempDir, mockFetch);
      const binaryPath = await manager.ensureInstalled();

      expect(binaryPath).toBe(manager.getBinaryPath());
      expect(await manager.isInstalled()).toBe(true);
    });

    it("returns path if already installed", async () => {
      const binaryPath = manager.getBinaryPath();
      fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
      fs.chmodSync(binaryPath, 0o755);

      const result = await manager.ensureInstalled();

      expect(result).toBe(binaryPath);
    });
  });
});
