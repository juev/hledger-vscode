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
    inlineCompletion?: boolean;
    codeLens?: boolean;
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
    maxResults?: number;
    includeNotes?: boolean;
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
  };
  inlineCompletion?: {
    enabled?: boolean;
    minPayeeChars?: number;
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
    inlineCompletion: boolean;
    codeLens: boolean;
  };
  completion: {
    maxResults: number;
    fuzzyMatching: boolean;
    showCounts: boolean;
    includeNotes: boolean;
  };
  diagnostics: {
    balanceTolerance: number;
    undeclaredAccounts: boolean;
    undeclaredCommodities: boolean;
    unbalancedTransactions: boolean;
  };
  formatting: {
    amountAlignmentColumn: number;
    indentSize: number;
    alignAmounts: boolean;
  };
  cli: {
    enabled: boolean;
    path: string;
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
    amountAlignmentColumn: 40,
    indentSize: 4,
    alignAmounts: true,
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
      inlineCompletion: settings.features?.inlineCompletion ?? DEFAULT_SETTINGS.features.inlineCompletion,
      codeLens: settings.features?.codeLens ?? DEFAULT_SETTINGS.features.codeLens,
    },
    completion: {
      maxResults: validateNumber(
        settings.completion?.maxResults ?? settings.autoCompletion?.maxResults,
        DEFAULT_SETTINGS.completion.maxResults,
        5,
        200
      ),
      fuzzyMatching: settings.completion?.fuzzyMatching ?? DEFAULT_SETTINGS.completion.fuzzyMatching,
      showCounts: settings.completion?.showCounts ?? DEFAULT_SETTINGS.completion.showCounts,
      includeNotes: settings.completion?.includeNotes ?? DEFAULT_SETTINGS.completion.includeNotes,
    },
    diagnostics: {
      balanceTolerance: validateNumber(
        settings.diagnostics?.balanceTolerance,
        DEFAULT_SETTINGS.diagnostics.balanceTolerance,
        0,
        1
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
        2,
        8
      ),
      alignAmounts: settings.formatting?.alignAmounts ?? DEFAULT_SETTINGS.formatting.alignAmounts,
    },
    cli: {
      enabled: settings.cli?.enabled ?? DEFAULT_SETTINGS.cli.enabled,
      path: settings.cli?.path ?? DEFAULT_SETTINGS.cli.path,
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
