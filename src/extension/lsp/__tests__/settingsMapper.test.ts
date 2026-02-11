import {
  mapVSCodeSettingsToLSP,
  LSPSettings,
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
          enabled: true,
          maxResults: 25,
          maxAccountResults: 30,
          transactionTemplates: { enabled: true },
          snippets: true,
          fuzzyMatching: true,
          showCounts: true,
          includeNotes: true,
        },
        diagnostics: {
          enabled: true,
          checkBalance: true,
          balanceTolerance: 1e-10,
          undeclaredAccounts: true,
          undeclaredCommodities: true,
          unbalancedTransactions: true,
        },
        formatting: {
          amountAlignmentColumn: 40,
          indentSize: 4,
          alignAmounts: true,
          minAlignmentColumn: 0,
        },
        semanticHighlighting: {
          enabled: true,
        },
        cli: {
          enabled: true,
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
    it("maps completion settings", () => {
      const settings: VSCodeSettings = {
        autoCompletion: {
          enabled: false,
          maxResults: 50,
          maxAccountResults: 40,
          transactionTemplates: { enabled: false },
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.enabled).toBe(false);
      expect(result.completion.maxResults).toBe(50);
      expect(result.completion.maxAccountResults).toBe(40);
      expect(result.completion.transactionTemplates.enabled).toBe(false);
    });

    it("maps new completion namespace settings", () => {
      const settings: VSCodeSettings = {
        completion: {
          snippets: false,
          fuzzyMatching: false,
          showCounts: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.snippets).toBe(false);
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
    it("maps legacy diagnostics settings", () => {
      const settings: VSCodeSettings = {
        diagnostics: {
          enabled: false,
          checkBalance: false,
          balanceTolerance: 1e-8,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.diagnostics.enabled).toBe(false);
      expect(result.diagnostics.checkBalance).toBe(false);
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

    it("maps minAlignmentColumn independently from amountAlignmentColumn", () => {
      const settings: VSCodeSettings = {
        formatting: {
          amountAlignmentColumn: 55,
          minAlignmentColumn: 20,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.formatting.amountAlignmentColumn).toBe(55);
      expect(result.formatting.minAlignmentColumn).toBe(20);
    });

    it("uses default for minAlignmentColumn when not specified", () => {
      const settings: VSCodeSettings = {
        formatting: {
          amountAlignmentColumn: 55,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.formatting.amountAlignmentColumn).toBe(55);
      expect(result.formatting.minAlignmentColumn).toBe(0);
    });
  });

  describe("semantic highlighting settings", () => {
    it("maps semanticHighlighting.enabled from features.semanticTokens", () => {
      const settings: VSCodeSettings = {
        features: {
          semanticTokens: false,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.semanticHighlighting.enabled).toBe(false);
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
          enabled: true,
          maxResults: 15,
        },
      };

      const result = mapVSCodeSettingsToLSP(settings);

      expect(result.completion.maxAccountResults).toBe(30);
      expect(result.completion.transactionTemplates.enabled).toBe(true);
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
