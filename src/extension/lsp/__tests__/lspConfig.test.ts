import {
  hasCustomLSPPath,
  isLSPUpdateCheckEnabled,
  getCustomLSPPath,
} from "../lspConfig";

describe("lspConfig", () => {
  let originalGetConfiguration: typeof import("vscode").workspace.getConfiguration;

  beforeEach(() => {
    const vscode = require("vscode");
    originalGetConfiguration = vscode.workspace.getConfiguration;
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
        if (key in config) {
          return config[key];
        }
        return defaultValue;
      },
    });
  }

  describe("hasCustomLSPPath", () => {
    it("returns true when path is set", () => {
      mockConfiguration({ path: "/custom/path/to/hledger-lsp" });

      expect(hasCustomLSPPath()).toBe(true);
    });

    it("returns false when path is empty string", () => {
      mockConfiguration({ path: "" });

      expect(hasCustomLSPPath()).toBe(false);
    });

    it("returns false when path is whitespace only", () => {
      mockConfiguration({ path: "   " });

      expect(hasCustomLSPPath()).toBe(false);
    });

    it("returns false when path is undefined", () => {
      mockConfiguration({});

      expect(hasCustomLSPPath()).toBe(false);
    });
  });

  describe("isLSPUpdateCheckEnabled", () => {
    it("returns true by default", () => {
      mockConfiguration({});

      expect(isLSPUpdateCheckEnabled()).toBe(true);
    });

    it("returns true when explicitly enabled", () => {
      mockConfiguration({ checkForUpdates: true });

      expect(isLSPUpdateCheckEnabled()).toBe(true);
    });

    it("returns false when disabled", () => {
      mockConfiguration({ checkForUpdates: false });

      expect(isLSPUpdateCheckEnabled()).toBe(false);
    });
  });

  describe("getCustomLSPPath", () => {
    it("returns the path when set", () => {
      mockConfiguration({ path: "/custom/path/to/hledger-lsp" });

      expect(getCustomLSPPath()).toBe("/custom/path/to/hledger-lsp");
    });

    it("returns null when path is empty string", () => {
      mockConfiguration({ path: "" });

      expect(getCustomLSPPath()).toBeNull();
    });

    it("returns null when path is whitespace only", () => {
      mockConfiguration({ path: "   " });

      expect(getCustomLSPPath()).toBeNull();
    });

    it("returns null when path is undefined", () => {
      mockConfiguration({});

      expect(getCustomLSPPath()).toBeNull();
    });

    it("trims the path before returning", () => {
      mockConfiguration({ path: "  /custom/path  " });

      expect(getCustomLSPPath()).toBe("/custom/path");
    });
  });
});
