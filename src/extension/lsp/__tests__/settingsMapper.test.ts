import {
  mapVSCodeSettingsToLSP,
  LSPSettings,
  VSCodeSettings,
} from "../settingsMapper";

describe("mapVSCodeSettingsToLSP", () => {
  it("maps empty settings to defaults", () => {
    const result = mapVSCodeSettingsToLSP({});

    expect(result).toEqual({
      completion: {
        enabled: true,
        maxResults: 25,
        maxAccountResults: 30,
        transactionTemplates: { enabled: true },
      },
      diagnostics: {
        enabled: true,
        checkBalance: true,
        balanceTolerance: 1e-10,
      },
      formatting: {
        amountAlignmentColumn: 40,
      },
      semanticHighlighting: {
        enabled: false,
      },
    });
  });

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

    expect(result.completion).toEqual({
      enabled: false,
      maxResults: 50,
      maxAccountResults: 40,
      transactionTemplates: { enabled: false },
    });
  });

  it("maps diagnostics settings", () => {
    const settings: VSCodeSettings = {
      diagnostics: {
        enabled: false,
        checkBalance: false,
        balanceTolerance: 1e-8,
      },
    };

    const result = mapVSCodeSettingsToLSP(settings);

    expect(result.diagnostics).toEqual({
      enabled: false,
      checkBalance: false,
      balanceTolerance: 1e-8,
    });
  });

  it("maps formatting settings", () => {
    const settings: VSCodeSettings = {
      formatting: {
        amountAlignmentColumn: 60,
      },
    };

    const result = mapVSCodeSettingsToLSP(settings);

    expect(result.formatting).toEqual({
      amountAlignmentColumn: 60,
    });
  });

  it("maps semantic highlighting settings", () => {
    const settings: VSCodeSettings = {
      semanticHighlighting: {
        enabled: true,
      },
    };

    const result = mapVSCodeSettingsToLSP(settings);

    expect(result.semanticHighlighting).toEqual({
      enabled: true,
    });
  });

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
});
