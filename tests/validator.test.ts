import { describe, expect, it } from "vitest";
import {
  DEFAULT_VALIDATION_LIMITS,
  validateLatex,
} from "../src/core/validator.js";

describe("validateLatex (Reto #2)", () => {
  it("acepta fórmulas matemáticas válidas habituales", () => {
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

  it("rechaza fórmulas vacías o de solo espacios con reason 'empty'", () => {
    for (const empty of ["", "   ", "\n\t  "]) {
      const result = validateLatex(empty);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("empty");
      }
    }
  });

  it("acepta exactamente el largo máximo y rechaza cuando lo supera ('too_long')", () => {
    const max = DEFAULT_VALIDATION_LIMITS.maxLength;
    expect(validateLatex("x".repeat(max))).toEqual({ ok: true });

    const tooLong = validateLatex("x".repeat(max + 1));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.reason).toBe("too_long");
    }
  });

  it("rechaza llaves sin cerrar o cerradas de más ('unbalanced_braces')", () => {
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

  it("ignora llaves escapadas (\\{ y \\}) pero cuenta llaves reales tras \\\\", () => {
    // Conjunto con llaves literales escapadas
    expect(validateLatex("\\{1, 2, 3\\}")).toEqual({ ok: true });
    // Llave literal escapada sin par (ej. \left\{ ... \right.)
    expect(validateLatex("\\left\\{ x \\in \\mathbb{R} \\right.")).toEqual({
      ok: true,
    });
    // Salto de línea \\ seguido de llaves reales balanceadas
    expect(validateLatex("a \\\\ {b}")).toEqual({ ok: true });

    // Salto de línea \\ seguido de llave real SIN cerrar -> debe fallar
    const result = validateLatex("a \\\\ {b");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unbalanced_braces");
    }
  });

  it("acepta profundidad máxima exacta y rechaza anidamiento excesivo ('too_deep')", () => {
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

  it("rechaza comandos peligrosos como \\def, \\let, \\newcommand y \\href", () => {
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

  it("no genera falsos positivos con comandos válidos que comparten prefijo (\\leftarrow) ni con \\\\def", () => {
    expect(validateLatex("x \\leftarrow 0")).toEqual({ ok: true });
    expect(validateLatex("A \\leftrightarrow B")).toEqual({ ok: true });
    expect(validateLatex("a \\\\def b")).toEqual({ ok: true });
  });

  it("respeta límites personalizados pasados por parámetro", () => {
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
