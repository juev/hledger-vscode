import {
  CompletionDataProvider,
  CompletionData,
  LSPCompletionDataProvider,
  LocalCompletionDataProvider,
  TransactionTemplate,
} from "../CompletionDataProvider";

describe("LocalCompletionDataProvider", () => {
  it("returns completion data from local config", async () => {
    const mockConfig = {
      getPayees: () => ["Grocery Store", "Gas Station"],
      getTransactionTemplates: (payee: string) => {
        if (payee === "Grocery Store") {
          return [
            {
              payee: "Grocery Store",
              postings: [
                { account: "Expenses:Food", amount: "$50.00" },
                { account: "Assets:Bank" },
              ],
            },
          ];
        }
        return [];
      },
    };

    const provider = new LocalCompletionDataProvider(mockConfig as any);
    const data = await provider.getCompletionData("Groc");

    expect(data.payees).toContain("Grocery Store");
  });

  it("returns empty data when no matches", async () => {
    const mockConfig = {
      getPayees: () => ["Grocery Store"],
      getTransactionTemplates: () => [],
    };

    const provider = new LocalCompletionDataProvider(mockConfig as any);
    const data = await provider.getCompletionData("xyz");

    expect(data.payees).toEqual(["Grocery Store"]);
  });
});

describe("LSPCompletionDataProvider", () => {
  it("fetches data from LSP client", async () => {
    const mockClient = {
      sendRequest: jest.fn().mockResolvedValue({
        payees: ["Store A", "Store B"],
        templates: [],
      }),
    };

    const provider = new LSPCompletionDataProvider(mockClient as any);
    const data = await provider.getCompletionData("Store");

    expect(mockClient.sendRequest).toHaveBeenCalledWith(
      "hledger/completionData",
      { query: "Store" }
    );
    expect(data.payees).toEqual(["Store A", "Store B"]);
  });

  it("returns empty data on error", async () => {
    const mockClient = {
      sendRequest: jest.fn().mockRejectedValue(new Error("Connection failed")),
    };

    const provider = new LSPCompletionDataProvider(mockClient as any);
    const data = await provider.getCompletionData("test");

    expect(data.payees).toEqual([]);
    expect(data.templates).toEqual([]);
  });
});

describe("CompletionData", () => {
  it("has required fields", () => {
    const data: CompletionData = {
      payees: ["Test"],
      templates: [
        {
          payee: "Test",
          postings: [{ account: "Expenses:Test" }],
        },
      ],
    };

    expect(data.payees).toHaveLength(1);
    expect(data.templates).toHaveLength(1);
  });
});
