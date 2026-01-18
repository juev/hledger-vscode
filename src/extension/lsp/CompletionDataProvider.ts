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
