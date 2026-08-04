import { SnippetString } from "../vscode";

/**
 * The mock stands in for vscode.SnippetString, so it has to produce the same
 * snippet syntax the real class does. Both defaulting rules matter:
 *
 *   - an omitted index takes the next value from an auto-incrementing counter
 *     that starts at 1, shared by tabstops, placeholders and choices;
 *   - an explicit index is used as given, including 0, which in snippet syntax
 *     means the final cursor position.
 */
describe("SnippetString mock", () => {
  describe("appendTabstop", () => {
    it("auto-increments from 1 when no index is given", () => {
      const snippet = new SnippetString().appendTabstop().appendTabstop();

      expect(snippet.value).toBe("$1$2");
    });

    it("uses an explicit index", () => {
      expect(new SnippetString().appendTabstop(3).value).toBe("$3");
    });

    it("keeps index 0 rather than treating it as absent", () => {
      expect(new SnippetString().appendTabstop(0).value).toBe("$0");
    });
  });

  describe("appendPlaceholder", () => {
    it("auto-increments from 1 when no index is given", () => {
      const snippet = new SnippetString()
        .appendPlaceholder("one")
        .appendPlaceholder("two");

      expect(snippet.value).toBe("${1:one}${2:two}");
    });

    it("keeps index 0 rather than falling back to 1", () => {
      expect(new SnippetString().appendPlaceholder("x", 0).value).toBe("${0:x}");
    });

    it("supports the nested builder form", () => {
      const snippet = new SnippetString().appendPlaceholder((inner) => {
        inner.appendText("nested");
      });

      expect(snippet.value).toBe("${1:nested}");
    });
  });

  describe("appendChoice", () => {
    it("auto-increments from 1 when no index is given", () => {
      const snippet = new SnippetString()
        .appendChoice(["a", "b"])
        .appendChoice(["c"]);

      expect(snippet.value).toBe("${1|a,b|}${2|c|}");
    });

    it("keeps index 0 rather than falling back to 1", () => {
      expect(new SnippetString().appendChoice(["a"], 0).value).toBe("${0|a|}");
    });
  });

  describe("the shared counter", () => {
    it("advances across all three index-consuming builders", () => {
      const snippet = new SnippetString()
        .appendTabstop()
        .appendPlaceholder("p")
        .appendChoice(["c"]);

      expect(snippet.value).toBe("$1${2:p}${3|c|}");
    });

    it("is not advanced by an explicit index", () => {
      const snippet = new SnippetString().appendTabstop(9).appendTabstop();

      expect(snippet.value).toBe("$9$1");
    });

    it("is not advanced by appendVariable", () => {
      const snippet = new SnippetString()
        .appendVariable("TM_FILENAME")
        .appendTabstop();

      expect(snippet.value).toBe("$TM_FILENAME$1");
    });

    it("is per instance, not shared between snippets", () => {
      new SnippetString().appendTabstop().appendTabstop();

      expect(new SnippetString().appendTabstop().value).toBe("$1");
    });
  });

  describe("appendText", () => {
    it("appends verbatim and takes no index", () => {
      const snippet = new SnippetString("start ")
        .appendText("middle ")
        .appendTabstop();

      expect(snippet.value).toBe("start middle $1");
    });
  });
});
