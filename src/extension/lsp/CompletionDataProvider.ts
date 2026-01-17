export interface Posting {
  account: string;
  amount?: string;
  commodity?: string;
}

export interface TransactionTemplate {
  payee: string;
  postings: Posting[];
}

export interface CompletionData {
  payees: string[];
  templates: TransactionTemplate[];
}

export interface CompletionDataProvider {
  getCompletionData(query: string): Promise<CompletionData>;
}

interface LocalConfig {
  getPayees(): string[];
  getTransactionTemplates(payee: string): TransactionTemplate[];
}

export class LocalCompletionDataProvider implements CompletionDataProvider {
  private readonly config: LocalConfig;

  constructor(config: LocalConfig) {
    this.config = config;
  }

  async getCompletionData(query: string): Promise<CompletionData> {
    const payees = this.config.getPayees();
    const templates: TransactionTemplate[] = [];

    for (const payee of payees) {
      if (payee.toLowerCase().includes(query.toLowerCase())) {
        const payeeTemplates = this.config.getTransactionTemplates(payee);
        templates.push(...payeeTemplates);
      }
    }

    return {
      payees,
      templates,
    };
  }
}

interface LSPClient {
  sendRequest<R>(method: string, params?: unknown): Promise<R>;
}

interface LSPCompletionDataResponse {
  payees: string[];
  templates: TransactionTemplate[];
}

export class LSPCompletionDataProvider implements CompletionDataProvider {
  private readonly client: LSPClient;

  constructor(client: LSPClient) {
    this.client = client;
  }

  async getCompletionData(query: string): Promise<CompletionData> {
    try {
      const response = await this.client.sendRequest<LSPCompletionDataResponse>(
        "hledger/completionData",
        { query }
      );

      return {
        payees: response.payees,
        templates: response.templates,
      };
    } catch (error) {
      console.error("HLedger LSP: Failed to get completion data", error);
      return {
        payees: [],
        templates: [],
      };
    }
  }
}

interface ClientProvider {
  getClient(): LSPClient | null;
}

export class LazyLSPCompletionDataProvider implements CompletionDataProvider {
  private readonly clientProvider: ClientProvider;

  constructor(clientProvider: ClientProvider) {
    this.clientProvider = clientProvider;
  }

  async getCompletionData(query: string): Promise<CompletionData> {
    const client = this.clientProvider.getClient();
    if (!client) {
      return { payees: [], templates: [] };
    }

    try {
      const response = await client.sendRequest<LSPCompletionDataResponse>(
        "hledger/completionData",
        { query }
      );

      return {
        payees: response.payees,
        templates: response.templates,
      };
    } catch (error) {
      console.error("HLedger LSP: Failed to get completion data", error);
      return {
        payees: [],
        templates: [],
      };
    }
  }
}
