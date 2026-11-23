import { describe, expect, it } from "vitest";
import {
  applyPlainMathConversions,
  compilePlainMathToLatex,
  detectPlainMathExpressions,
  detectPlainMathInDraft,
  emitLatexFromAst,
  parsePlainMathToAst,
  tokenizePlainMath,
} from "../src/core/plainMathCompiler.js";

describe("plainMathCompiler (v1.2 Lexer -> AST -> LaTeX)", () => {
  it("compiles linear and polynomial functions with implicit multiplication", () => {
    expect(compilePlainMathToLatex("f(x) = 5x + 2")?.latex).toBe(
      "f(x) = 5x + 2"
    );
    expect(compilePlainMathToLatex("g(x) = x^2 + 3x - 4")?.latex).toBe(
      "g(x) = x^2 + 3x - 4"
    );
    expect(compilePlainMathToLatex("f'(x) = 2x + 1")?.latex).toBe(
      "f'(x) = 2x + 1"
    );
    expect(compilePlainMathToLatex("y = mx + b")?.latex).toBe("y = mx + b");
    expect(compilePlainMathToLatex("E = mc^2")?.latex).toBe("E = mc^2");
  });

  it("compiles fractions, nested parentheses, roots, Greek symbols, and relations", () => {
    expect(compilePlainMathToLatex("(a + b) / (c - d)")?.latex).toBe(
      "\\frac{a + b}{c - d}"
    );
    expect(compilePlainMathToLatex("((x + 1)/(x - 1))^2")?.latex).toBe(
      "\\left(\\frac{x + 1}{x - 1}\\right)^2"
    );
    expect(compilePlainMathToLatex("sqrt(a^2 + b^2) = c")?.latex).toBe(
      "\\sqrt{a^2 + b^2} = c"
    );
    expect(compilePlainMathToLatex("root(3, x + 1)")?.latex).toBe(
      "\\sqrt[3]{x + 1}"
    );
    expect(compilePlainMathToLatex("e^(-x^2)")?.latex).toBe("e^{-x^2}");
    expect(compilePlainMathToLatex("sin(x)^2 + cos(x)^2 = 1")?.latex).toBe(
      "\\sin(x)^2 + \\cos(x)^2 = 1"
    );
    expect(compilePlainMathToLatex("x >= 0")?.latex).toBe("x \\ge 0");
    expect(compilePlainMathToLatex("x -> inf")?.latex).toBe("x \\to \\infty");
    expect(compilePlainMathToLatex("a_(n+1) = 2a_n + 1")?.latex).toBe(
      "a_{n + 1} = 2a_n + 1"
    );
    expect(compilePlainMathToLatex("|x - a| <= delta")?.latex).toBe(
      "\\left|x - a\\right| \\le \\delta"
    );
  });

  it("builds a right-associative power AST (2^3^4 = 2^(3^4))", () => {
    const tokens = tokenizePlainMath("x^2^3");
    expect(tokens).not.toBeNull();
    const ast = parsePlainMathToAst(tokens!);
    expect(ast).toEqual({
      kind: "binary",
      op: "^",
      left: { kind: "ident", name: "x" },
      right: {
        kind: "binary",
        op: "^",
        left: { kind: "number", value: "2" },
        right: { kind: "number", value: "3" },
      },
    });
    expect(emitLatexFromAst(ast!)).toBe("x^{2^3}");
  });

  it("detects standalone and inline plain-math inside natural drafts", () => {
    // 1. Standalone function definition
    const standalone = detectPlainMathInDraft("f(x) = 5x + 2");
    expect(standalone).not.toBeNull();
    expect(standalone?.raw).toBe("f(x) = 5x + 2");
    expect(standalone?.wrappedLatex).toBe("\\(f(x) = 5x + 2\\)");

    // 2. Standalone fraction uses display mode
    const frac = detectPlainMathInDraft("(a + b)/(x^2 + 1)");
    expect(frac).not.toBeNull();
    expect(frac?.mode).toBe("display");
    expect(frac?.wrappedLatex).toBe("$$\\frac{a + b}{x^2 + 1}$$");

    // 3. Embedded inside Spanish prose
    const draft = "Definimos la funcion lineal: f(x) = 5x + 2.";
    const embedded = detectPlainMathInDraft(draft);
    expect(embedded).not.toBeNull();
    expect(embedded?.raw).toBe("f(x) = 5x + 2");
    expect(
      draft.slice(0, embedded!.replaceStart) +
        embedded!.wrappedLatex +
        draft.slice(embedded!.replaceEnd)
    ).toBe("Definimos la funcion lineal: \\(f(x) = 5x + 2\\).");
  });

  it("yields immediately when draft already uses LaTeX delimiters or backslashes", () => {
    expect(detectPlainMathInDraft("$$f(x) = 5x + 2$$")).toBeNull();
    expect(detectPlainMathInDraft("\\frac{1}{2}")).toBeNull();
  });

  it("strictly rejects non-math prose, dates, scores, ratios, URLs, and currency", () => {
    const nonMath = [
      "Hola como estas hoy en X",
      "24/7",
      "10/10",
      "23/11/2026",
      "3 - 2",
      "v1.2",
      "a = casa",
      "el partido termino 2 a 1",
      "Spent $50 on $BTC today",
      "https://x.com/fAcuggod",
      "@user check this out #math",
    ];

    for (const sample of nonMath) {
      expect(detectPlainMathInDraft(sample)).toBeNull();
    }
  });

  it("extracts multiple plain-math formulas anywhere in prose, including with trailing text and Spanish conjunctions", () => {
    // Exact user screenshot #1
    const s1 =
      "Definimos  f'(x) = 5x + 4  se puede ver entonces que luego la derivada segunda es f''(x) = 5";
    const m1 = detectPlainMathExpressions(s1);
    expect(m1.map((m) => m.latex)).toEqual(["f'(x) = 5x + 4", "f''(x) = 5"]);
    expect(applyPlainMathConversions(s1, m1).text).toBe(
      "Definimos  \\(f'(x) = 5x + 4\\)  se puede ver entonces que luego la derivada segunda es \\(f''(x) = 5\\)"
    );

    // Exact user screenshot #2 (both formulas followed by trailing prose!)
    const s2 =
      "definamos  f(x) = 4x +d es facil ver que entonces, f'(x) = 4 como queriamos ver.";
    const m2 = detectPlainMathExpressions(s2);
    expect(m2.map((m) => m.latex)).toEqual(["f(x) = 4x + d", "f'(x) = 4"]);
    expect(applyPlainMathConversions(s2, m2).text).toBe(
      "definamos  \\(f(x) = 4x + d\\) es facil ver que entonces, \\(f'(x) = 4\\) como queriamos ver."
    );

    // Spanish conjunction `y` between two equations stays literal prose
    const s3 = "Sea a = 3 y b = 4 entonces a^2 + b^2 = 25.";
    const m3 = detectPlainMathExpressions(s3);
    expect(m3.map((m) => m.latex)).toEqual(["a = 3", "b = 4", "a^2 + b^2 = 25"]);
    expect(applyPlainMathConversions(s3, m3).text).toBe(
      "Sea \\(a = 3\\) y \\(b = 4\\) entonces \\(a^2 + b^2 = 25\\)."
    );

    // Mixed already-delimited LaTeX + new plain math leaves delimited block untouched
    const s4 = "Ya tenemos \\(f(x) = 4x + d\\) y luego f'(x) = 4 listo.";
    const m4 = detectPlainMathExpressions(s4);
    expect(m4.map((m) => m.latex)).toEqual(["f'(x) = 4"]);
    expect(applyPlainMathConversions(s4, m4).text).toBe(
      "Ya tenemos \\(f(x) = 4x + d\\) y luego \\(f'(x) = 4\\) listo."
    );
  });
});

