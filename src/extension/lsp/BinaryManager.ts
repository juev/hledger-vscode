import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const GITHUB_REPO = "juev/hledger-lsp";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const MAX_BINARY_SIZE = 50 * 1024 * 1024;
const MIN_BINARY_SIZE = 1024;

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

interface GitHubReleaseResponse {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

function isValidGitHubRelease(data: unknown): data is GitHubReleaseResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.tag_name !== "string" || !obj.tag_name) {
    return false;
  }
  if (!Array.isArray(obj.assets)) {
    return false;
  }
  return obj.assets.every(
    (asset) =>
      typeof asset === "object" &&
      asset !== null &&
      typeof (asset as Record<string, unknown>).name === "string" &&
      typeof (asset as Record<string, unknown>).browser_download_url ===
        "string"
  );
}

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
  const assetSuffix = `${normalizedPlatform}_${normalizedArch}${isWindows ? ".exe" : ""}`;

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

  constructor(storageDir: string, fetchFn?: FetchFn, platformInfo?: PlatformInfo) {
    this.storageDir = storageDir;
    this.fetchFn = fetchFn ?? fetch;
    this.platformInfo = platformInfo ?? getPlatformInfo(os.platform(), os.arch());
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

    const data = await response.json();

    if (!isValidGitHubRelease(data)) {
      throw new Error("Invalid GitHub release response format");
    }

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

  private async downloadChecksums(
    release: ReleaseInfo
  ): Promise<Map<string, string>> {
    const checksumAsset = release.assets.find((a) => a.name === "checksums.txt");
    if (!checksumAsset) {
      throw new Error(
        "No checksums.txt found in release - cannot verify binary integrity"
      );
    }

    const response = await this.fetchFn(checksumAsset.downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download checksums: ${response.status} ${response.statusText}`
      );
    }

    const text = await response.text();
    const checksums = new Map<string, string>();

    for (const line of text.split("\n")) {
      const match = /^([a-f0-9]{64})\s{2}(.+)$/.exec(line.trim());
      if (match && match[1] && match[2]) {
        checksums.set(match[2], match[1]);
      }
    }

    return checksums;
  }

  private verifyChecksum(buffer: ArrayBuffer, expectedHash: string): boolean {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256");
    hash.update(Buffer.from(buffer));
    return hash.digest("hex") === expectedHash.toLowerCase();
  }

  async download(onProgress?: (percent: number) => void): Promise<void> {
    onProgress?.(10);
    const release = await this.getLatestRelease();

    onProgress?.(30);
    const checksums = await this.downloadChecksums(release);

    const expectedAssetName = `hledger-lsp_${this.platformInfo.assetSuffix}`;
    const asset = release.assets.find((a) => a.name === expectedAssetName);

    if (!asset) {
      throw new Error(
        `No binary found for platform: ${this.platformInfo.platform}-${this.platformInfo.arch}`
      );
    }

    const expectedChecksum = checksums.get(expectedAssetName);
    if (!expectedChecksum) {
      throw new Error(`No checksum found for ${expectedAssetName}`);
    }

    onProgress?.(60);
    const response = await this.fetchFn(asset.downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download binary: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_BINARY_SIZE) {
      throw new Error(
        `Binary size ${buffer.byteLength} exceeds maximum allowed size ${MAX_BINARY_SIZE}`
      );
    }

    if (buffer.byteLength < MIN_BINARY_SIZE) {
      throw new Error(
        `Binary size ${buffer.byteLength} is below minimum required size ${MIN_BINARY_SIZE}`
      );
    }

    onProgress?.(80);
    if (!this.verifyChecksum(buffer, expectedChecksum)) {
      throw new Error("Checksum verification failed - binary may be corrupted");
    }

    const binaryPath = this.getBinaryPath();
    const tempPath = `${binaryPath}.tmp.${Date.now()}`;

    try {
      await fs.promises.mkdir(path.dirname(binaryPath), { recursive: true });
      await fs.promises.writeFile(tempPath, Buffer.from(buffer));
      await fs.promises.chmod(tempPath, 0o755);
      await fs.promises.rename(tempPath, binaryPath);
      await fs.promises.writeFile(this.getVersionPath(), release.version);
    } catch (error) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }

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
