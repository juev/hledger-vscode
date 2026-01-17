import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  HLedgerLanguageClient,
  LanguageClientState,
  createServerOptions,
  createClientOptions,
} from "../HLedgerLanguageClient";

describe("createServerOptions", () => {
  let tempDir: string;
  let binaryPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hledger-lsp-test-"));
    binaryPath = path.join(tempDir, "hledger-lsp");
    fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
    fs.chmodSync(binaryPath, 0o755);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates server options with binary path", () => {
    const options = createServerOptions(binaryPath);

    expect(options.command).toBe(binaryPath);
    expect(options.args).toEqual([]);
  });

  it("creates server options with debug arguments", () => {
    const options = createServerOptions(binaryPath, { debug: true });

    expect(options.command).toBe(binaryPath);
    expect(options.args).toContain("--debug");
  });
});

describe("createClientOptions", () => {
  it("creates client options for hledger language", () => {
    const options = createClientOptions();

    expect(options.documentSelector).toEqual([{ language: "hledger" }]);
  });

  it("includes synchronize configuration for hledger", () => {
    const options = createClientOptions();

    expect(options.synchronize?.configurationSection).toBe("hledger");
  });
});

describe("HLedgerLanguageClient", () => {
  let tempDir: string;
  let binaryPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hledger-lsp-test-"));
    binaryPath = path.join(tempDir, "hledger-lsp");
    fs.writeFileSync(binaryPath, "#!/bin/bash\necho test");
    fs.chmodSync(binaryPath, 0o755);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("initial state", () => {
    it("starts in stopped state", () => {
      const client = new HLedgerLanguageClient(binaryPath);

      expect(client.getState()).toBe(LanguageClientState.Stopped);
    });

    it("reports not ready initially", () => {
      const client = new HLedgerLanguageClient(binaryPath);

      expect(client.isReady()).toBe(false);
    });
  });

  describe("getServerPath", () => {
    it("returns the binary path", () => {
      const client = new HLedgerLanguageClient(binaryPath);

      expect(client.getServerPath()).toBe(binaryPath);
    });
  });

  describe("dispose", () => {
    it("can be disposed without starting", () => {
      const client = new HLedgerLanguageClient(binaryPath);

      expect(() => client.dispose()).not.toThrow();
      expect(client.getState()).toBe(LanguageClientState.Stopped);
    });
  });

  describe("start", () => {
    it("transitions from stopped to running", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.start();

      expect(client.getState()).toBe(LanguageClientState.Running);
      expect(client.isReady()).toBe(true);

      client.dispose();
    });

    it("is no-op when already running", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.start();
      await client.start();

      expect(client.getState()).toBe(LanguageClientState.Running);

      client.dispose();
    });

    it("returns internal client after start", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.start();

      expect(client.getClient()).not.toBeNull();

      client.dispose();
    });
  });

  describe("stop", () => {
    it("transitions to stopped state", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.start();
      await client.stop();

      expect(client.getState()).toBe(LanguageClientState.Stopped);
      expect(client.isReady()).toBe(false);
      expect(client.getClient()).toBeNull();
    });

    it("is no-op when not started", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.stop();

      expect(client.getState()).toBe(LanguageClientState.Stopped);
    });
  });

  describe("restart", () => {
    it("stops and starts the client", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.start();
      const firstClient = client.getClient();

      await client.restart();

      expect(client.getState()).toBe(LanguageClientState.Running);
      expect(client.getClient()).not.toBe(firstClient);

      client.dispose();
    });
  });

  describe("isReady", () => {
    it("returns false when stopped", () => {
      const client = new HLedgerLanguageClient(binaryPath);

      expect(client.isReady()).toBe(false);
    });

    it("returns true when running", async () => {
      const client = new HLedgerLanguageClient(binaryPath);

      await client.start();

      expect(client.isReady()).toBe(true);

      client.dispose();
    });
  });
});
