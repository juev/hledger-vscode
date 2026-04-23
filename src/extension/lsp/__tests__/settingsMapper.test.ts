import {
  mapVSCodeSettingsToLSP,
  VSCodeSettings,
} from "../settingsMapper";

describe("mapVSCodeSettingsToLSP", () => {
  describe("default values", () => {
    it("maps empty settings to defaults", () => {
      const result = mapVSCodeSettingsToLSP({});

      expect(result).toEqual({
        features: {
          hover: true,
          completion: true,
          formatting: true,
          diagnostics: true,
          semanticTokens: true,
          codeActions: true,
          foldingRanges: true,
          documentLinks: true,
          workspaceSymbol: true,
          inlineCompletion: true,
          codeLens: false,
        },
        completion: {
          maxResults: 25,
          fuzzyMatching: true,
          showCounts: true,
          includeNotes: true,
        },
        diagnostics: {
          balanceTolerance: 1e-10,
          undeclaredAccounts: true,
          undeclaredCommodities: true,
          unbalancedTransactions: true,
        },
        formatting: {
          amountAlignmentColumn: 0,
          indentSize: 4,
          alignAmounts: true,
          amountAlignmentMode: "right",
        },
        cli: {
          enabled: true,
          path: "hledger",
          timeout: 30000,
        },
        limits: {
          maxFileSizeBytes: 10485760,
          maxIncludeDepth: 50,
        },
      });
    });
  });

  describe("features settings", () => {
    it("maps features settings from new namespace", () => {
      const settings: VSCodeSettings = {
        features: {
          hover: false,
          completion: false,
          formatting: false,
          diagnostics: false,
          semanticTokens: false,
          codeActions: false,
          foldingRanges: false,
          documentLinks: false,
          workspaceSymbol: false,
          inlineCompletion: false,
          codeLens: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features).toEqual({
        hover: false,
        completion: false,
        formatting: false,
        diagnostics: false,
        semanticTokens: false,
        codeActions: false,
        foldingRanges: false,
        documentLinks: false,
        workspaceSymbol: false,
        inlineCompletion: false,
        codeLens: false,
      });
    });

    it("falls back to legacy autoCompletion.enabled for features.completion", () => {
      const settings: VSCodeSettings = {
        autoCompletion: { enabled: false },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features.completion).toBe(false);
    });

    it("falls back to legacy diagnostics.enabled for features.diagnostics", () => {
      const settings: VSCodeSettings = {
        diagnostics: { enabled: false },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features.diagnostics).toBe(false);
    });

    it("prefers new features settings over legacy settings", () => {
      const settings: VSCodeSettings = {
        features: { completion: true },
        autoCompletion: { enabled: false },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features.completion).toBe(true);
    });

    it("maps features.inlineCompletion when set to false", () => {
      const settings: VSCodeSettings = {
        features: { inlineCompletion: false },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features.inlineCompletion).toBe(false);
    });

    it("maps features.codeLens when set to true", () => {
      const settings: VSCodeSettings = {
        features: { codeLens: true },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features.codeLens).toBe(true);
    });
  });

  describe("completion settings", () => {
    it("maps completion.maxResults from autoCompletion fallback", () => {
      const settings: VSCodeSettings = {
        autoCompletion: {
          maxResults: 50,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.maxResults).toBe(50);
    });

    it("maps new completion namespace settings", () => {
      const settings: VSCodeSettings = {
        completion: {
          fuzzyMatching: false,
          showCounts: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.fuzzyMatching).toBe(false);
      expect(result.completion.showCounts).toBe(false);
    });

    it("maps completion.includeNotes when set to false", () => {
      const settings: VSCodeSettings = {
        completion: { includeNotes: false },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.includeNotes).toBe(false);
    });

    it("completion.maxResults takes precedence over autoCompletion.maxResults", () => {
      const settings: VSCodeSettings = {
        completion: { maxResults: 100 },
        autoCompletion: { maxResults: 20 },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.maxResults).toBe(100);
    });
  });

  describe("diagnostics settings", () => {
    it("maps diagnostics.balanceTolerance", () => {
      const settings: VSCodeSettings = {
        diagnostics: {
          balanceTolerance: 1e-8,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.diagnostics.balanceTolerance).toBe(1e-8);
    });

    it("maps new diagnostics namespace settings", () => {
      const settings: VSCodeSettings = {
        diagnostics: {
          undeclaredAccounts: false,
          undeclaredCommodities: false,
          unbalancedTransactions: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.diagnostics.undeclaredAccounts).toBe(false);
      expect(result.diagnostics.undeclaredCommodities).toBe(false);
      expect(result.diagnostics.unbalancedTransactions).toBe(false);
    });

    it("falls back to legacy checkBalance for unbalancedTransactions", () => {
      const settings: VSCodeSettings = {
        diagnostics: {
          checkBalance: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.diagnostics.unbalancedTransactions).toBe(false);
    });
  });

  describe("formatting settings", () => {
    it("maps legacy formatting settings", () => {
      const settings: VSCodeSettings = {
        formatting: {
          amountAlignmentColumn: 60,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.formatting.amountAlignmentColumn).toBe(60);
    });

    it("maps new formatting namespace settings", () => {
      const settings: VSCodeSettings = {
        formatting: {
          indentSize: 2,
          alignAmounts: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.formatting.indentSize).toBe(2);
      expect(result.formatting.alignAmounts).toBe(false);
    });

    it("defaults amountAlignmentMode to 'right'", () => {
      const result = mapVSCodeSettingsToLSP({});

      expect(result.formatting.amountAlignmentMode).toBe("right");
    });

    it("maps amountAlignmentMode 'decimal'", () => {
      const settings: VSCodeSettings = {
        formatting: {
          amountAlignmentMode: "decimal",
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.formatting.amountAlignmentMode).toBe("decimal");
    });

    it("falls back to default for invalid amountAlignmentMode", () => {
      const settings: VSCodeSettings = {
        formatting: {
          amountAlignmentMode: "invalid" as "right" | "decimal",
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.formatting.amountAlignmentMode).toBe("right");
    });

  });

  describe("CLI settings", () => {
    it("maps CLI settings with defaults", () => {
      const result = mapVSCodeSettingsToLSP({});

      expect(result.cli.enabled).toBe(true);
      expect(result.cli.timeout).toBe(30000);
    });

    it("maps explicit CLI settings", () => {
      const settings: VSCodeSettings = {
        cli: {
          enabled: false,
          timeout: 60000,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.cli.enabled).toBe(false);
      expect(result.cli.timeout).toBe(60000);
    });

    it("maps cli.path to LSP settings", () => {
      const settings: VSCodeSettings = {
        cli: {
          path: "/usr/local/bin/hledger",
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.cli.path).toBe("/usr/local/bin/hledger");
    });

    it("defaults cli.path to 'hledger'", () => {
      const result = mapVSCodeSettingsToLSP({});

      expect(result.cli.path).toBe("hledger");
    });
  });

  describe("limits settings", () => {
    it("maps limits settings with defaults", () => {
      const result = mapVSCodeSettingsToLSP({});

      expect(result.limits.maxFileSizeBytes).toBe(10485760);
      expect(result.limits.maxIncludeDepth).toBe(50);
    });

    it("maps explicit limits settings", () => {
      const settings: VSCodeSettings = {
        limits: {
          maxFileSizeBytes: 5242880,
          maxIncludeDepth: 25,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.limits.maxFileSizeBytes).toBe(5242880);
      expect(result.limits.maxIncludeDepth).toBe(25);
    });
  });

  describe("partial settings with defaults", () => {
    it("preserves partial settings with defaults for missing values", () => {
      const settings: VSCodeSettings = {
        autoCompletion: {
          maxResults: 15,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.maxResults).toBe(15);
      expect(result.completion.fuzzyMatching).toBe(true);
    });

    it("applies defaults for partially specified features", () => {
      const settings: VSCodeSettings = {
        features: {
          hover: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.features.hover).toBe(false);
      expect(result.features.completion).toBe(true);
      expect(result.features.formatting).toBe(true);
    });
  });
});
