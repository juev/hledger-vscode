import * as fs from "fs";
import * as path from "path";

interface EnterRule {
  beforeText: string;
  afterText?: string;
  action: { indent: string };
}

const configuration = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, "../../../language-configuration.json"), "utf8",
)) as { onEnterRules: EnterRule[] };

function enterAction(beforeText: string, afterText = ""): string | undefined {
  // VS Code applies the first matching rule.
  return configuration.onEnterRules.find(rule =>
    new RegExp(rule.beforeText).test(beforeText) &&
    (!rule.afterText || new RegExp(rule.afterText).test(afterText)),
  )?.action.indent;
}

describe("journal Enter rules", () => {
  it.each(["  ", "    ", "\t"])("ends a transaction after a blank posting containing %j", indent => {
    expect(enterAction(indent)).toBe("outdent");
  });

  it("keeps an empty line at the start of the next line", () => {
    expect(enterAction("")).toBe("none");
  });

  it("does not treat indentation before a posting as a blank line", () => {
    expect(enterAction("    ", "Активы:Банк  10 RUB")).not.toBe("outdent");
  });

  it("indents the first posting and preserves indentation between postings", () => {
    expect(enterAction("09-15 Метрополитен")).toBe("indent");
    expect(enterAction("    Расходы:Транспорт  10 RUB")).toBe("none");
  });
});
