import * as fs from "fs";
import * as path from "path";
import { Registry, INITIAL, IGrammar } from "vscode-textmate";
import { loadWASM, OnigScanner, OnigString } from "vscode-oniguruma";

const grammarPath = path.resolve(
  __dirname,
  "../../../syntaxes/hledger.tmLanguage.json"
);

const TAG_NAME_SCOPE = "entity.name.tag.hledger";
const TAG_VALUE_SCOPE = "string.unquoted.tag-value.hledger";

// Per hledger, a tag value runs until the next comma or end of line:
// internal whitespace (including 2+ consecutive spaces) and semicolons
// are part of the value. Verified against hledger 1.52.1 (issue #182).
describe("hledger grammar tag tokenization", () => {
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
        if (scopeName === "source.hledger") {
          return JSON.parse(fs.readFileSync(grammarPath, "utf-8"));
        }
        return null;
      },
    });

    const loaded = await registry.loadGrammar("source.hledger");
    if (!loaded) throw new Error("Failed to load hledger grammar");
    grammar = loaded;
  }, 15000);

  function tokensWithScope(line: string, scope: string): string[] {
    const { tokens } = grammar.tokenizeLine(line, INITIAL);
    return tokens
      .filter((token) => token.scopes.includes(scope))
      .map((token) => line.substring(token.startIndex, token.endIndex));
  }

  it("keeps consecutive whitespace inside tag values (issue #182 example)", () => {
    const line =
      "; Double-Space: This  is one example, Triple-Space: This   is another example, No-Space: regular tag";
    expect(tokensWithScope(line, TAG_NAME_SCOPE)).toEqual([
      "Double-Space",
      "Triple-Space",
      "No-Space",
    ]);
    expect(tokensWithScope(line, TAG_VALUE_SCOPE)).toEqual([
      "This  is one example",
      "This   is another example",
      "regular tag",
    ]);
  });

  it("highlights a simple tag and value", () => {
    expect(tokensWithScope("; tag:value", TAG_NAME_SCOPE)).toEqual(["tag"]);
    expect(tokensWithScope("; tag:value", TAG_VALUE_SCOPE)).toEqual(["value"]);
  });

  it("terminates the value at a comma", () => {
    const line = "; a:x, b:y";
    expect(tokensWithScope(line, TAG_NAME_SCOPE)).toEqual(["a", "b"]);
    expect(tokensWithScope(line, TAG_VALUE_SCOPE)).toEqual(["x", "y"]);
  });

  it("excludes trailing whitespace from the value", () => {
    expect(tokensWithScope("; tag:value   ", TAG_VALUE_SCOPE)).toEqual([
      "value",
    ]);
  });

  it("highlights a valueless tag without a value token", () => {
    expect(tokensWithScope("; reviewed:", TAG_NAME_SCOPE)).toEqual([
      "reviewed",
    ]);
    expect(tokensWithScope("; reviewed:", TAG_VALUE_SCOPE)).toEqual([]);
  });

  it("treats a semicolon and a second colon word as part of the value", () => {
    // hledger reports a single tag alpha with value "one ; beta:two"
    const line = "; alpha:one ; beta:two";
    expect(tokensWithScope(line, TAG_NAME_SCOPE)).toEqual(["alpha"]);
    expect(tokensWithScope(line, TAG_VALUE_SCOPE)).toEqual([
      "one ; beta:two",
    ]);
  });

  it("keeps double space in a tag value on a transaction line", () => {
    const line = "2026-06-11 desc  ; note:v  w";
    expect(tokensWithScope(line, TAG_VALUE_SCOPE)).toEqual(["v  w"]);
  });

  it("does not treat a bare URL in a comment as a tag", () => {
    const line = "; see https://example.com/page for details";
    expect(tokensWithScope(line, TAG_NAME_SCOPE)).toEqual([]);
    expect(
      tokensWithScope(line, "markup.underline.link.hledger")
    ).toEqual(["https://example.com/page"]);
  });
});
