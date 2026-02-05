export interface VSCodeSettings {
  features?: {
    hover?: boolean;
    completion?: boolean;
    formatting?: boolean;
    diagnostics?: boolean;
    semanticTokens?: boolean;
    codeActions?: boolean;
    foldingRanges?: boolean;
    documentLinks?: boolean;
    workspaceSymbol?: boolean;
  };
  autoCompletion?: {
    enabled?: boolean;
    maxResults?: number;
    maxAccountResults?: number;
    transactionTemplates?: {
      enabled?: boolean;
    };
  };
  completion?: {
    snippets?: boolean;
    fuzzyMatching?: boolean;
    showCounts?: boolean;
  };
  diagnostics?: {
    enabled?: boolean;
    checkBalance?: boolean;
    balanceTolerance?: number;
    undeclaredAccounts?: boolean;
    undeclaredCommodities?: boolean;
    unbalancedTransactions?: boolean;
  };
  formatting?: {
    amountAlignmentColumn?: number;
    indentSize?: number;
    alignAmounts?: boolean;
    minAlignmentColumn?: number;
  };
  inlineCompletion?: {
    enabled?: boolean;
    minPayeeChars?: number;
  };
  smartIndent?: {
    enabled?: boolean;
  };
  cli?: {
    path?: string;
    journalFile?: string;
    enabled?: boolean;
    timeout?: number;
  };
  limits?: {
    maxFileSizeBytes?: number;
    maxIncludeDepth?: number;
  };
  import?: {
    defaultDebitAccount?: string;
    defaultCreditAccount?: string;
    defaultBalancingAccount?: string;
    dateFormat?: string;
    invertAmounts?: boolean;
    useJournalHistory?: boolean;
  };
}

export interface LSPSettings {
  features: {
    hover: boolean;
    completion: boolean;
    formatting: boolean;
    diagnostics: boolean;
    semanticTokens: boolean;
    codeActions: boolean;
    foldingRanges: boolean;
    documentLinks: boolean;
    workspaceSymbol: boolean;
  };
  completion: {
    enabled: boolean;
    maxResults: number;
    maxAccountResults: number;
    transactionTemplates: {
      enabled: boolean;
    };
    snippets: boolean;
    fuzzyMatching: boolean;
    showCounts: boolean;
  };
  diagnostics: {
    enabled: boolean;
    checkBalance: boolean;
    balanceTolerance: number;
    undeclaredAccounts: boolean;
    undeclaredCommodities: boolean;
    unbalancedTransactions: boolean;
  };
  formatting: {
    amountAlignmentColumn: number;
    indentSize: number;
    alignAmounts: boolean;
    minAlignmentColumn: number;
  };
  semanticHighlighting: {
    enabled: boolean;
  };
  cli: {
    enabled: boolean;
    timeout: number;
  };
  limits: {
    maxFileSizeBytes: number;
    maxIncludeDepth: number;
  };
}

const DEFAULT_SETTINGS: LSPSettings = {
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
  },
  completion: {
    enabled: true,
    maxResults: 25,
    maxAccountResults: 30,
    transactionTemplates: {
      enabled: true,
    },
    snippets: true,
    fuzzyMatching: true,
    showCounts: true,
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
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateNumber(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return clamp(value, min, max);
}

export function mapVSCodeSettingsToLSP(settings: VSCodeSettings): LSPSettings {
  const completionEnabled = settings.features?.completion
    ?? settings.autoCompletion?.enabled
    ?? DEFAULT_SETTINGS.features.completion;

  const diagnosticsEnabled = settings.features?.diagnostics
    ?? settings.diagnostics?.enabled
    ?? DEFAULT_SETTINGS.features.diagnostics;

  const semanticTokensEnabled = settings.features?.semanticTokens
    ?? DEFAULT_SETTINGS.features.semanticTokens;

  const unbalancedTransactions = settings.diagnostics?.unbalancedTransactions
    ?? settings.diagnostics?.checkBalance
    ?? DEFAULT_SETTINGS.diagnostics.unbalancedTransactions;

  return {
    features: {
      hover: settings.features?.hover ?? DEFAULT_SETTINGS.features.hover,
      completion: completionEnabled,
      formatting: settings.features?.formatting ?? DEFAULT_SETTINGS.features.formatting,
      diagnostics: diagnosticsEnabled,
      semanticTokens: semanticTokensEnabled,
      codeActions: settings.features?.codeActions ?? DEFAULT_SETTINGS.features.codeActions,
      foldingRanges: settings.features?.foldingRanges ?? DEFAULT_SETTINGS.features.foldingRanges,
      documentLinks: settings.features?.documentLinks ?? DEFAULT_SETTINGS.features.documentLinks,
      workspaceSymbol: settings.features?.workspaceSymbol ?? DEFAULT_SETTINGS.features.workspaceSymbol,
    },
    completion: {
      enabled: settings.autoCompletion?.enabled ?? DEFAULT_SETTINGS.completion.enabled,
      maxResults: validateNumber(
        settings.autoCompletion?.maxResults,
        DEFAULT_SETTINGS.completion.maxResults,
        5,
        50
      ),
      maxAccountResults: validateNumber(
        settings.autoCompletion?.maxAccountResults,
        DEFAULT_SETTINGS.completion.maxAccountResults,
        5,
        50
      ),
      transactionTemplates: {
        enabled: settings.autoCompletion?.transactionTemplates?.enabled ?? DEFAULT_SETTINGS.completion.transactionTemplates.enabled,
      },
      snippets: settings.completion?.snippets ?? DEFAULT_SETTINGS.completion.snippets,
      fuzzyMatching: settings.completion?.fuzzyMatching ?? DEFAULT_SETTINGS.completion.fuzzyMatching,
      showCounts: settings.completion?.showCounts ?? DEFAULT_SETTINGS.completion.showCounts,
    },
    diagnostics: {
      enabled: settings.diagnostics?.enabled ?? DEFAULT_SETTINGS.diagnostics.enabled,
      checkBalance: settings.diagnostics?.checkBalance ?? DEFAULT_SETTINGS.diagnostics.checkBalance,
      balanceTolerance: validateNumber(
        settings.diagnostics?.balanceTolerance,
        DEFAULT_SETTINGS.diagnostics.balanceTolerance,
        0,
        1000
      ),
      undeclaredAccounts: settings.diagnostics?.undeclaredAccounts ?? DEFAULT_SETTINGS.diagnostics.undeclaredAccounts,
      undeclaredCommodities: settings.diagnostics?.undeclaredCommodities ?? DEFAULT_SETTINGS.diagnostics.undeclaredCommodities,
      unbalancedTransactions: unbalancedTransactions,
    },
    formatting: {
      amountAlignmentColumn: validateNumber(
        settings.formatting?.amountAlignmentColumn,
        DEFAULT_SETTINGS.formatting.amountAlignmentColumn,
        0,
        200
      ),
      indentSize: validateNumber(
        settings.formatting?.indentSize,
        DEFAULT_SETTINGS.formatting.indentSize,
        0,
        16
      ),
      alignAmounts: settings.formatting?.alignAmounts ?? DEFAULT_SETTINGS.formatting.alignAmounts,
      minAlignmentColumn: validateNumber(
        settings.formatting?.minAlignmentColumn,
        DEFAULT_SETTINGS.formatting.minAlignmentColumn,
        0,
        200
      ),
    },
    semanticHighlighting: {
      enabled: semanticTokensEnabled,
    },
    cli: {
      enabled: settings.cli?.enabled ?? DEFAULT_SETTINGS.cli.enabled,
      timeout: validateNumber(
        settings.cli?.timeout,
        DEFAULT_SETTINGS.cli.timeout,
        1000,
        300000
      ),
    },
    limits: {
      maxFileSizeBytes: validateNumber(
        settings.limits?.maxFileSizeBytes,
        DEFAULT_SETTINGS.limits.maxFileSizeBytes,
        1024,
        104857600
      ),
      maxIncludeDepth: validateNumber(
        settings.limits?.maxIncludeDepth,
        DEFAULT_SETTINGS.limits.maxIncludeDepth,
        1,
        100
      ),
    },
  };
}
