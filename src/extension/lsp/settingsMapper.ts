export interface VSCodeSettings {
  autoCompletion?: {
    enabled?: boolean;
    maxResults?: number;
    maxAccountResults?: number;
    transactionTemplates?: {
      enabled?: boolean;
    };
  };
  diagnostics?: {
    enabled?: boolean;
    checkBalance?: boolean;
    balanceTolerance?: number;
  };
  formatting?: {
    amountAlignmentColumn?: number;
  };
  semanticHighlighting?: {
    enabled?: boolean;
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
  };
  import?: {
    defaultDebitAccount?: string;
    defaultCreditAccount?: string;
    defaultBalancingAccount?: string;
    dateFormat?: string;
    invertAmounts?: boolean;
    useJournalHistory?: boolean;
    merchantPatterns?: Record<string, string>;
    categoryMapping?: Record<string, string>;
  };
}

export interface LSPSettings {
  completion: {
    enabled: boolean;
    maxResults: number;
    maxAccountResults: number;
    transactionTemplates: {
      enabled: boolean;
    };
  };
  diagnostics: {
    enabled: boolean;
    checkBalance: boolean;
    balanceTolerance: number;
  };
  formatting: {
    amountAlignmentColumn: number;
  };
  semanticHighlighting: {
    enabled: boolean;
  };
}

const DEFAULT_SETTINGS: LSPSettings = {
  completion: {
    enabled: true,
    maxResults: 25,
    maxAccountResults: 30,
    transactionTemplates: {
      enabled: true,
    },
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
};

export function mapVSCodeSettingsToLSP(settings: VSCodeSettings): LSPSettings {
  return {
    completion: {
      enabled: settings.autoCompletion?.enabled ?? DEFAULT_SETTINGS.completion.enabled,
      maxResults: settings.autoCompletion?.maxResults ?? DEFAULT_SETTINGS.completion.maxResults,
      maxAccountResults: settings.autoCompletion?.maxAccountResults ?? DEFAULT_SETTINGS.completion.maxAccountResults,
      transactionTemplates: {
        enabled: settings.autoCompletion?.transactionTemplates?.enabled ?? DEFAULT_SETTINGS.completion.transactionTemplates.enabled,
      },
    },
    diagnostics: {
      enabled: settings.diagnostics?.enabled ?? DEFAULT_SETTINGS.diagnostics.enabled,
      checkBalance: settings.diagnostics?.checkBalance ?? DEFAULT_SETTINGS.diagnostics.checkBalance,
      balanceTolerance: settings.diagnostics?.balanceTolerance ?? DEFAULT_SETTINGS.diagnostics.balanceTolerance,
    },
    formatting: {
      amountAlignmentColumn: settings.formatting?.amountAlignmentColumn ?? DEFAULT_SETTINGS.formatting.amountAlignmentColumn,
    },
    semanticHighlighting: {
      enabled: settings.semanticHighlighting?.enabled ?? DEFAULT_SETTINGS.semanticHighlighting.enabled,
    },
  };
}
