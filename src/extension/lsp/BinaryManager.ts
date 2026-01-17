import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const GITHUB_REPO = "juev/hledger-lsp";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface PlatformInfo {
  platform: "darwin" | "linux" | "windows";
  arch: "amd64" | "arm64";
  assetSuffix: string;
}

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
}

export interface ReleaseInfo {
  version: string;
  assets: ReleaseAsset[];
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export function getPlatformInfo(
  platform: string,
  arch: string
): PlatformInfo {
  let normalizedPlatform: PlatformInfo["platform"];
  let normalizedArch: PlatformInfo["arch"];

  switch (platform) {
    case "darwin":
      normalizedPlatform = "darwin";
      break;
    case "linux":
      normalizedPlatform = "linux";
      break;
    case "win32":
      normalizedPlatform = "windows";
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  switch (arch) {
    case "x64":
      normalizedArch = "amd64";
      break;
    case "arm64":
      normalizedArch = "arm64";
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  const isWindows = normalizedPlatform === "windows";
  const assetSuffix = `${normalizedPlatform}-${normalizedArch}${isWindows ? ".exe" : ""}`;

  return {
    platform: normalizedPlatform,
    arch: normalizedArch,
    assetSuffix,
  };
}

export function getBinaryName(platform: string): string {
  return platform === "windows" ? "hledger-lsp.exe" : "hledger-lsp";
}

export class BinaryManager {
  private readonly storageDir: string;
  private readonly fetchFn: FetchFn;
  private readonly platformInfo: PlatformInfo;

  constructor(storageDir: string, fetchFn?: FetchFn) {
    this.storageDir = storageDir;
    this.fetchFn = fetchFn ?? fetch;
    this.platformInfo = getPlatformInfo(os.platform(), os.arch());
  }

  getBinaryPath(): string {
    const binaryName = getBinaryName(this.platformInfo.platform);
    return path.join(this.storageDir, binaryName);
  }

  private getVersionPath(): string {
    return path.join(this.storageDir, "version.txt");
  }

  async isInstalled(): Promise<boolean> {
    const binaryPath = this.getBinaryPath();
    try {
      await fs.promises.access(binaryPath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getInstalledVersion(): Promise<string | null> {
    try {
      const version = await fs.promises.readFile(this.getVersionPath(), "utf-8");
      return version.trim();
    } catch {
      return null;
    }
  }

  async getLatestRelease(): Promise<ReleaseInfo> {
    const response = await this.fetchFn(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "hledger-vscode",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch latest release: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      tag_name: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    return {
      version: data.tag_name,
      assets: data.assets.map((asset) => ({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
      })),
    };
  }

  async needsUpdate(): Promise<boolean> {
    const installedVersion = await this.getInstalledVersion();
    if (installedVersion === null) {
      return true;
    }

    const latestRelease = await this.getLatestRelease();
    return installedVersion !== latestRelease.version;
  }

  async download(onProgress?: (percent: number) => void): Promise<void> {
    const release = await this.getLatestRelease();

    const expectedAssetName = `hledger-lsp-${this.platformInfo.assetSuffix}`;
    const asset = release.assets.find((a) => a.name === expectedAssetName);

    if (!asset) {
      throw new Error(
        `No binary found for platform: ${this.platformInfo.platform}-${this.platformInfo.arch}`
      );
    }

    const response = await this.fetchFn(asset.downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download binary: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    const binaryPath = this.getBinaryPath();

    await fs.promises.mkdir(path.dirname(binaryPath), { recursive: true });
    await fs.promises.writeFile(binaryPath, Buffer.from(buffer));
    await fs.promises.chmod(binaryPath, 0o755);
    await fs.promises.writeFile(this.getVersionPath(), release.version);

    onProgress?.(100);
  }

  async ensureInstalled(): Promise<string> {
    const binaryPath = this.getBinaryPath();

    if (await this.isInstalled()) {
      return binaryPath;
    }

    await this.download();
    return binaryPath;
  }
}
