import { describe, expect, it } from "vitest";
import {
  DEFAULT_VALIDATION_LIMITS,
  validateLatex,
} from "../src/core/validator.js";

describe("validateLatex", () => {
  it("accepts standard mathematical expressions", () => {
    const validFormulas = [
      "x^2 + 1",
      "E = mc^2",
      "\\frac{a + b}{c - d}",
      "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
      "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}",
    ];

    for (const formula of validFormulas) {
      expect(validateLatex(formula)).toEqual({ ok: true });
    }
  });

  it("rejects empty or whitespace-only formulas with reason 'empty'", () => {
    for (const empty of ["", "   ", "\n\t  "]) {
      const result = validateLatex(empty);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("empty");
      }
    }
  });

  it("accepts exact max length and rejects longer formulas with 'too_long'", () => {
    const max = DEFAULT_VALIDATION_LIMITS.maxLength;
    expect(validateLatex("x".repeat(max))).toEqual({ ok: true });

    const tooLong = validateLatex("x".repeat(max + 1));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.reason).toBe("too_long");
    }
  });

  it("rejects unbalanced braces with 'unbalanced_braces'", () => {
    const broken = [
      "\\frac{a}{b",
      "x}",
      "a} + {b",
      "{{x}",
      "\\frac{1}{2}}",
    ];

    for (const formula of broken) {
      const result = validateLatex(formula);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unbalanced_braces");
      }
    }
  });

  it("ignores escaped braces (\\{ and \\}) while counting real braces after \\\\", () => {
    expect(validateLatex("\\{1, 2, 3\\}")).toEqual({ ok: true });
    expect(validateLatex("\\left\\{ x \\in \\mathbb{R} \\right.")).toEqual({
      ok: true,
    });
    expect(validateLatex("a \\\\ {b}")).toEqual({ ok: true });

    const result = validateLatex("a \\\\ {b");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unbalanced_braces");
    }
  });

  it("accepts exact max brace depth and rejects deeper nesting with 'too_deep'", () => {
    const maxDepth = DEFAULT_VALIDATION_LIMITS.maxBraceDepth;
    const atLimit = "{".repeat(maxDepth) + "x" + "}".repeat(maxDepth);
    expect(validateLatex(atLimit)).toEqual({ ok: true });

    const overLimit =
      "{".repeat(maxDepth + 1) + "x" + "}".repeat(maxDepth + 1);
    const result = validateLatex(overLimit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_deep");
    }
  });

  it("rejects disallowed commands such as \\def, \\let, \\newcommand, and \\href", () => {
    const dangerous = [
      "\\def\\x{1} \\x",
      "\\gdef\\a{\\a}\\a",
      "\\let\\foo\\bar",
      "\\newcommand{\\mycmd}{x}",
      "\\href{https://evil.example}{click}",
      "\\url{https://evil.example}",
      "\\htmlStyle{color:red}{x}",
    ];

    for (const formula of dangerous) {
      const result = validateLatex(formula);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("forbidden_command");
      }
    }
  });

  it("avoids false positives on shared prefixes (\\leftarrow) and line breaks (\\\\def)", () => {
    expect(validateLatex("x \\leftarrow 0")).toEqual({ ok: true });
    expect(validateLatex("A \\leftrightarrow B")).toEqual({ ok: true });
    expect(validateLatex("a \\\\def b")).toEqual({ ok: true });
  });

  it("respects custom limit overrides", () => {
    const tooLongCustom = validateLatex("x^2 + y^2", { maxLength: 5 });
    expect(tooLongCustom.ok).toBe(false);
    if (!tooLongCustom.ok) {
      expect(tooLongCustom.reason).toBe("too_long");
    }

    const tooDeepCustom = validateLatex("{{{x}}}", { maxBraceDepth: 2 });
    expect(tooDeepCustom.ok).toBe(false);
    if (!tooDeepCustom.ok) {
      expect(tooDeepCustom.reason).toBe("too_deep");
    }
  });
});
