import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
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
  it("creates client options for hledger and hledger-rules languages", () => {
    const options = createClientOptions();

    expect(options.documentSelector).toEqual([
      { language: "hledger" },
      { language: "hledger-rules" },
    ]);
  });

  it("includes synchronize configuration for hledger", () => {
    const options = createClientOptions();

    expect(options.synchronize?.configurationSection).toBe("hledger");
  });

  it("includes initializationOptions with LSP settings", () => {
    const options = createClientOptions();

    expect(options.initializationOptions).toBeDefined();
    expect(options.initializationOptions.features).toBeDefined();
    expect(options.initializationOptions.features.hover).toBe(true);
    expect(options.initializationOptions.completion).toBeDefined();
    expect(options.initializationOptions.diagnostics).toBeDefined();
    expect(options.initializationOptions.formatting).toBeDefined();
    expect(options.initializationOptions.cli).toBeDefined();
    expect(options.initializationOptions.limits).toBeDefined();
  });

  it("includes default LSP settings structure", () => {
    const options = createClientOptions();
    const init = options.initializationOptions;

    expect(init.features.completion).toBe(true);
    expect(init.features.diagnostics).toBe(true);
    expect(init.features.semanticTokens).toBe(true);
    expect(init.features.inlineCompletion).toBe(true);
    expect(init.features.codeLens).toBe(false);
    expect(init.completion.maxResults).toBe(50);
    expect(init.completion.includeNotes).toBe(true);
    expect(init.diagnostics.balanceTolerance).toBe(1e-10);
    expect(init.formatting.amountAlignmentColumn).toBe(0);
    expect(init.formatting.minAlignmentColumn).toBe(0);
    expect(init.formatting.amountAlignmentTarget).toBe("cost");
    expect(init.cli.timeout).toBe(30000);
    expect(init.limits.maxFileSizeBytes).toBe(10485760);
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

  describe("getPayeeAccountHistory", () => {
    it("returns null when client is not ready", async () => {
      const client = new HLedgerLanguageClient(binaryPath);
      // Not started - not ready
      const result = await client.getPayeeAccountHistory("file:///test.journal");
      expect(result).toBeNull();
    });

    it("passes a cancellation token and disposes it after a successful request", async () => {
      const client = new HLedgerLanguageClient(binaryPath);
      await client.start();

      const internalClient = client.getClient();
      const mockResult = {
        payeeAccounts: { "Store": ["Expenses:Food"] },
        pairUsage: { "Store::Expenses:Food": 5 },
      };
      const sendRequestSpy = jest.spyOn(internalClient!, "sendRequest").mockResolvedValue(mockResult);
      const cancelSpy = jest.spyOn(vscode.CancellationTokenSource.prototype, "cancel");
      const disposeSpy = jest.spyOn(vscode.CancellationTokenSource.prototype, "dispose");

      const result = await client.getPayeeAccountHistory("file:///test.journal");
      expect(result).toEqual(mockResult);
      expect(sendRequestSpy).toHaveBeenCalledWith(
        "hledger/payeeAccountHistory",
        { textDocument: { uri: "file:///test.journal" } },
        expect.objectContaining({ isCancellationRequested: false })
      );
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(disposeSpy).toHaveBeenCalledTimes(1);

      client.dispose();
    });

    it("disposes the cancellation token without cancelling when sendRequest rejects", async () => {
      const client = new HLedgerLanguageClient(binaryPath);
      await client.start();

      const internalClient = client.getClient();
      jest.spyOn(internalClient!, "sendRequest").mockRejectedValue(new Error("Network error"));
      const cancelSpy = jest.spyOn(vscode.CancellationTokenSource.prototype, "cancel");
      const disposeSpy = jest.spyOn(vscode.CancellationTokenSource.prototype, "dispose");

      const result = await client.getPayeeAccountHistory("file:///test.journal");
      expect(result).toBeNull();
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(disposeSpy).toHaveBeenCalledTimes(1);

      client.dispose();
    });

    it("cancels at the 5000ms timeout after resolving null and disposes the token", async () => {
      const client = new HLedgerLanguageClient(binaryPath);
      await client.start();

      const internalClient = client.getClient();
      jest.spyOn(internalClient!, "sendRequest").mockImplementation(
        (_method: string, _params: unknown, token?: vscode.CancellationToken) => new Promise((_resolve, reject) => {
          token?.onCancellationRequested(() => reject(new Error("Request cancelled")));
        })
      );

      jest.useFakeTimers();
      const cancelSpy = jest.spyOn(vscode.CancellationTokenSource.prototype, "cancel");
      const disposeSpy = jest.spyOn(vscode.CancellationTokenSource.prototype, "dispose");

      const resultPromise = client.getPayeeAccountHistory("file:///test.journal");

      jest.advanceTimersByTime(4999);
      expect(cancelSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      const result = await resultPromise;
      expect(result).toBeNull();
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(disposeSpy).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
      client.dispose();
    });
  });
});
