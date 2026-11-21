import { describe, expect, it } from "vitest";
import {
  renderFormula,
  renderTweetText,
} from "../src/renderer/katexRenderer.js";

describe("katexRenderer", () => {
  it("renders inline and display formulas to HTML + accessible MathML", () => {
    const result = renderTweetText(
      "If \\(x^2 + 1\\) is positive, then $$E = mc^2$$"
    );

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ type: "text", content: "If " });

    expect(result[1].type).toBe("math");
    if (result[1].type === "math") {
      expect(result[1].mode).toBe("inline");
      expect(result[1].latex).toBe("x^2 + 1");
      expect(result[1].raw).toBe("\\(x^2 + 1\\)");
      expect(result[1].html).toContain("katex-html");
      expect(result[1].html).toContain("<math");
      expect(result[1].html).not.toContain("katex-display");
    }

    expect(result[2]).toEqual({ type: "text", content: " is positive, then " });

    expect(result[3].type).toBe("math");
    if (result[3].type === "math") {
      expect(result[3].mode).toBe("display");
      expect(result[3].latex).toBe("E = mc^2");
      expect(result[3].html).toContain("katex-display");
      expect(result[3].html).toContain("<math");
    }
  });

  it("leaves currency notation and cashtags untouched", () => {
    const input = "Spent $50 on $BTC and sold at $100.";
    expect(renderTweetText(input)).toEqual([{ type: "text", content: input }]);
  });

  it("blocks disallowed formulas before calling KaTeX and preserves raw text", () => {
    const result = renderTweetText(
      "Attack: $$\\def\\a{\\a}\\a$$ and $$\\href{https://evil.example}{click}$$"
    );

    expect(result[1].type).toBe("rejected");
    if (result[1].type === "rejected") {
      expect(result[1].reason).toBe("forbidden_command");
      expect(result[1].raw).toBe("$$\\def\\a{\\a}\\a$$");
    }

    expect(result[3].type).toBe("rejected");
    if (result[3].type === "rejected") {
      expect(result[3].reason).toBe("forbidden_command");
      expect(result[3].raw).toBe("$$\\href{https://evil.example}{click}$$");
    }
  });

  it("degrades invalid LaTeX syntax to 'katex_error' without throwing", () => {
    const result = renderFormula("\\frac{1}", "display", "$$\\frac{1}$$");

    expect(result.type).toBe("rejected");
    if (result.type === "rejected") {
      expect(result.reason).toBe("katex_error");
      expect(result.raw).toBe("$$\\frac{1}$$");
    }
  });

  it("keeps potentially malicious HTML/XSS text as a plain text segment", () => {
    const input = "<script>alert('xss')</script> and \\(a + b\\)";
    const result = renderTweetText(input);

    expect(result[0]).toEqual({
      type: "text",
      content: "<script>alert('xss')</script> and ",
    });
    expect(result[1].type).toBe("math");
  });

  it("supports custom validation limits in renderTweetText", () => {
    const result = renderTweetText("$$x^2 + y^2$$", { maxLength: 4 });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("rejected");
    if (result[0].type === "rejected") {
      expect(result[0].reason).toBe("too_long");
      expect(result[0].raw).toBe("$$x^2 + y^2$$");
    }
  });
});
