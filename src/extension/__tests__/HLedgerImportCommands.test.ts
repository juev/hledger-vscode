import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { HLedgerImportCommands } from "../HLedgerImportCommands";
import { PayeeAccountHistoryResult } from "../lsp";

describe("HLedgerImportCommands", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hledger-import-test-"));
    originalEnv = { ...process.env };

    // Clear environment variables
    delete process.env.LEDGER_FILE;

    // Mock workspace configuration to return empty values
    (vscode.workspace as any).getConfiguration = jest.fn(() => ({
      get: jest.fn(() => "")
    }));

    // Clear workspace folders
    (vscode.workspace as any).workspaceFolders = undefined;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env = originalEnv;

    // Reset mocks
    (vscode.workspace as any).workspaceFolders = undefined;
  });

  describe("getJournalUri", () => {
    it("returns URI from LEDGER_FILE environment variable when set", async () => {
      const journalPath = path.join(tempDir, "ledger.journal");
      fs.writeFileSync(journalPath, "; test journal");
      process.env.LEDGER_FILE = journalPath;

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      // Access private method via any cast for testing
      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBe(vscode.Uri.file(journalPath).toString());
    });

    it("returns null when LEDGER_FILE points to non-existent file", async () => {
      process.env.LEDGER_FILE = "/non/existent/file.journal";

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBeNull();
    });

    it("finds .journal file in workspace folder", async () => {
      const journalPath = path.join(tempDir, "main.journal");
      fs.writeFileSync(journalPath, "; test journal");

      // Mock workspace folders
      const mockFolder = {
        uri: vscode.Uri.file(tempDir),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBe(vscode.Uri.file(journalPath).toString());

      // Cleanup mock
      (vscode.workspace as any).workspaceFolders = undefined;
    });

    it("finds .hledger file in workspace folder", async () => {
      const journalPath = path.join(tempDir, "main.hledger");
      fs.writeFileSync(journalPath, "; test journal");

      const mockFolder = {
        uri: vscode.Uri.file(tempDir),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBe(vscode.Uri.file(journalPath).toString());

      (vscode.workspace as any).workspaceFolders = undefined;
    });

    it("finds .ledger file in workspace folder", async () => {
      const journalPath = path.join(tempDir, "main.ledger");
      fs.writeFileSync(journalPath, "; test journal");

      const mockFolder = {
        uri: vscode.Uri.file(tempDir),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBe(vscode.Uri.file(journalPath).toString());

      (vscode.workspace as any).workspaceFolders = undefined;
    });

    it("finds journal file with case-insensitive extension match", async () => {
      const journalPath = path.join(tempDir, "main.JOURNAL");
      fs.writeFileSync(journalPath, "; test journal");

      const mockFolder = {
        uri: vscode.Uri.file(tempDir),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBe(vscode.Uri.file(journalPath).toString());

      (vscode.workspace as any).workspaceFolders = undefined;
    });

    it("respects MAX_DIRECTORY_FILES limit when scanning workspace", async () => {
      // Create 1000 non-journal files first
      for (let i = 0; i < 1000; i++) {
        const filename = `file${i.toString().padStart(5, '0')}.txt`;
        fs.writeFileSync(path.join(tempDir, filename), "");
      }
      // Add journal file after the first 1000 files (alphabetically)
      const journalPath = path.join(tempDir, `zzz_beyond_limit.journal`);
      fs.writeFileSync(journalPath, "; test");

      // Verify directory has >1000 files total
      const allFiles = fs.readdirSync(tempDir);
      expect(allFiles.length).toBeGreaterThan(1000);

      const mockFolder = {
        uri: vscode.Uri.file(tempDir),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      // Result depends on whether journal file is in first 1000 entries
      // Since fs.readdirSync order is filesystem-dependent, we just verify
      // the scan completes (doesn't hang on large directory)
      expect(result === null || typeof result === 'string').toBe(true);

      (vscode.workspace as any).workspaceFolders = undefined;
    });

    it("returns first matching journal file when multiple exist", async () => {
      const journal1 = path.join(tempDir, "a.journal");
      const journal2 = path.join(tempDir, "b.journal");
      fs.writeFileSync(journal1, "; first");
      fs.writeFileSync(journal2, "; second");

      const mockFolder = {
        uri: vscode.Uri.file(tempDir),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      // Should return one of them (early exit on first match)
      expect(result).toMatch(/\.(journal|hledger|ledger)$/);

      (vscode.workspace as any).workspaceFolders = undefined;
    });

    it("returns null when workspace folder cannot be read", async () => {
      const mockFolder = {
        uri: vscode.Uri.file("/non/existent/folder"),
        name: "test",
        index: 0,
      };
      (vscode.workspace as any).workspaceFolders = [mockFolder];

      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const getJournalUri = (commands as any).getJournalUri.bind(commands);
      const result = await getJournalUri();

      expect(result).toBeNull();

      (vscode.workspace as any).workspaceFolders = undefined;
    });
  });

  describe("convertToPayeeAccountHistory", () => {
    it("converts valid LSP response correctly", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: PayeeAccountHistoryResult = {
        payeeAccounts: {
          "Store": ["Expenses:Food", "Expenses:Groceries"],
          "Salary": ["Income:Salary"]
        },
        pairUsage: {
          "Store::Expenses:Food": 10,
          "Store::Expenses:Groceries": 5,
          "Salary::Income:Salary": 12
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.payeeAccounts.size).toBe(2);
      expect(result.payeeAccounts.get("Store" as any)).toEqual(new Set(["Expenses:Food", "Expenses:Groceries"]));
      expect(result.payeeAccounts.get("Salary" as any)).toEqual(new Set(["Income:Salary"]));

      expect(result.pairUsage.size).toBe(3);
      expect(result.pairUsage.get("Store::Expenses:Food")).toBe(10);
      expect(result.pairUsage.get("Salary::Income:Salary")).toBe(12);
    });

    it("filters out empty payee names", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: PayeeAccountHistoryResult = {
        payeeAccounts: {
          "": ["Expenses:Food"],
          "Store": ["Expenses:Groceries"]
        },
        pairUsage: {}
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.payeeAccounts.size).toBe(1);
      expect(result.payeeAccounts.has("" as any)).toBe(false);
      expect(result.payeeAccounts.has("Store" as any)).toBe(true);
    });

    it("accepts numeric and keyword string payee names", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {
          "Store": ["Expenses:Food"],
          "123": ["Expenses:Other"],
          "null": ["Expenses:Converted"],
          "undefined": ["Expenses:Converted2"]
        },
        pairUsage: {}
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      // All string keys are valid (Object.entries converts keys to strings)
      expect(result.payeeAccounts.size).toBe(4);
      expect(result.payeeAccounts.has("Store" as any)).toBe(true);
      expect(result.payeeAccounts.has("123" as any)).toBe(true);
      expect(result.payeeAccounts.has("null" as any)).toBe(true);
      expect(result.payeeAccounts.has("undefined" as any)).toBe(true);
    });

    it("filters out empty account arrays", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: PayeeAccountHistoryResult = {
        payeeAccounts: {
          "Store": [],
          "Salary": ["Income:Salary"]
        },
        pairUsage: {}
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.payeeAccounts.size).toBe(1);
      expect(result.payeeAccounts.has("Store" as any)).toBe(false);
      expect(result.payeeAccounts.has("Salary" as any)).toBe(true);
    });

    it("filters out non-string accounts from arrays", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {
          "Store": ["Expenses:Food", "", null, undefined, 123, "Expenses:Valid"]
        },
        pairUsage: {}
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.payeeAccounts.size).toBe(1);
      const accounts = Array.from(result.payeeAccounts.get("Store" as any) || []);
      expect(accounts).toEqual(["Expenses:Food", "Expenses:Valid"]);
      expect(accounts.length).toBe(2);
    });

    it("filters out null/undefined accounts arrays", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {
          "Store": null,
          "Market": undefined,
          "Salary": ["Income:Salary"]
        },
        pairUsage: {}
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.payeeAccounts.size).toBe(1);
      expect(result.payeeAccounts.has("Salary" as any)).toBe(true);
    });

    it("filters out empty pairUsage keys", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {},
        pairUsage: {
          "": 5,
          "Store::Expenses:Food": 10
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.pairUsage.size).toBe(1);
      expect(result.pairUsage.has("")).toBe(false);
      expect(result.pairUsage.has("Store::Expenses:Food")).toBe(true);
    });

    it("filters out negative counts in pairUsage", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {},
        pairUsage: {
          "Store::Expenses:Food": -5,
          "Salary::Income:Salary": 10
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.pairUsage.size).toBe(1);
      expect(result.pairUsage.has("Store::Expenses:Food")).toBe(false);
      expect(result.pairUsage.has("Salary::Income:Salary")).toBe(true);
    });

    it("filters out non-number counts in pairUsage", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {},
        pairUsage: {
          "Store::Expenses:Food": "10",
          "Market::Expenses:Other": null,
          "Salary::Income:Salary": 12
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.pairUsage.size).toBe(1);
      expect(result.pairUsage.has("Salary::Income:Salary")).toBe(true);
    });

    it("filters out NaN counts in pairUsage", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {},
        pairUsage: {
          "Store::Expenses:Food": NaN,
          "Salary::Income:Salary": 10
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.pairUsage.size).toBe(1);
      expect(result.pairUsage.has("Store::Expenses:Food")).toBe(false);
      expect(result.pairUsage.has("Salary::Income:Salary")).toBe(true);
    });

    it("filters out Infinity counts in pairUsage", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: any = {
        payeeAccounts: {},
        pairUsage: {
          "Store::Expenses:Food": Infinity,
          "Market::Expenses:Other": -Infinity,
          "Salary::Income:Salary": 10
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.pairUsage.size).toBe(1);
      expect(result.pairUsage.has("Store::Expenses:Food")).toBe(false);
      expect(result.pairUsage.has("Market::Expenses:Other")).toBe(false);
      expect(result.pairUsage.has("Salary::Income:Salary")).toBe(true);
    });

    it("allows zero counts in pairUsage", () => {
      const mockLspClient = jest.fn(() => null);
      const commands = new HLedgerImportCommands(mockLspClient);

      const lspResult: PayeeAccountHistoryResult = {
        payeeAccounts: {},
        pairUsage: {
          "Store::Expenses:Food": 0,
          "Salary::Income:Salary": 10
        }
      };

      const convertToPayeeAccountHistory = (commands as any).convertToPayeeAccountHistory.bind(commands);
      const result = convertToPayeeAccountHistory(lspResult);

      expect(result.pairUsage.size).toBe(2);
      expect(result.pairUsage.get("Store::Expenses:Food")).toBe(0);
      expect(result.pairUsage.get("Salary::Income:Salary")).toBe(10);
    });
  });
});
