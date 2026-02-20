import * as fs from "fs";
import * as path from "path";
import { Registry, INITIAL, IGrammar, StateStack } from "vscode-textmate";
import { loadWASM, OnigScanner, OnigString } from "vscode-oniguruma";

const grammarPath = path.resolve(
  __dirname,
  "../../../syntaxes/hledger-rules.tmLanguage.json"
);

const SAMPLE_RULES = `# Bank CSV import rules
skip 1
fields date, description, amount
separator ,
date-format %Y-%m-%d
newest-first

if Groceries
  account1 Expenses:Food
end

if
SALARY
BONUS
  account1 Income:Salary
  description %payee - %description
end

account1 Expenses:Unknown
comment
`;

describe("hledger-rules grammar snapshot", () => {
  let grammar: IGrammar;

  beforeAll(async () => {
    const wasmBin = fs.readFileSync(
      path.join(
        __dirname,
        "../../../node_modules/vscode-oniguruma/release/onig.wasm"
      )
    ).buffer;
    await loadWASM(wasmBin);

    const registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (sources: string[]) => new OnigScanner(sources),
        createOnigString: (str: string) => new OnigString(str),
      }),
      loadGrammar: async (scopeName: string) => {
        if (scopeName === "source.hledger-rules") {
          return JSON.parse(fs.readFileSync(grammarPath, "utf-8"));
        }
        return null;
      },
    });

    const loaded = await registry.loadGrammar("source.hledger-rules");
    if (!loaded) throw new Error("Failed to load hledger-rules grammar");
    grammar = loaded;
  }, 15000);

  it("tokenizes representative rules file", () => {
    const lines = SAMPLE_RULES.split("\n");
    let state: StateStack = INITIAL;

    const result = lines.map((line) => {
      const { tokens, ruleStack } = grammar.tokenizeLine(line, state);
      state = ruleStack;
      return {
        line,
        tokens: tokens.map((t) => ({
          text: line.substring(t.startIndex, t.endIndex),
          scopes: t.scopes.filter((s) => s !== "source.hledger-rules"),
        })),
      };
    });

    expect(result).toMatchSnapshot();
  });
});
