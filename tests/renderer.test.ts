import { describe, expect, it } from "vitest";
import {
  renderFormula,
  renderTweetText,
} from "../src/renderer/katexRenderer.js";

describe("katexRenderer (Fase 3)", () => {
  it("renderiza fórmulas inline y display generando HTML + MathML accesible", () => {
    const result = renderTweetText(
      "Si \\(x^2 + 1\\) es positivo, entonces $$E = mc^2$$"
    );

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ type: "text", content: "Si " });

    expect(result[1].type).toBe("math");
    if (result[1].type === "math") {
      expect(result[1].mode).toBe("inline");
      expect(result[1].latex).toBe("x^2 + 1");
      expect(result[1].raw).toBe("\\(x^2 + 1\\)");
      expect(result[1].html).toContain("katex-html");
      expect(result[1].html).toContain("<math");
      expect(result[1].html).not.toContain("katex-display");
    }

    expect(result[2]).toEqual({ type: "text", content: " es positivo, entonces " });

    expect(result[3].type).toBe("math");
    if (result[3].type === "math") {
      expect(result[3].mode).toBe("display");
      expect(result[3].latex).toBe("E = mc^2");
      expect(result[3].html).toContain("katex-display");
      expect(result[3].html).toContain("<math");
    }
  });

  it("no toca precios ni cashtags financieros ($50, $BTC)", () => {
    const input = "Compré $BTC a $50 y subió a $100.";
    expect(renderTweetText(input)).toEqual([{ type: "text", content: input }]);
  });

  it("rechaza fórmulas peligrosas ANTES de llegar a KaTeX y conserva raw", () => {
    const result = renderTweetText(
      "Ataque: $$\\def\\a{\\a}\\a$$ y $$\\href{https://evil.example}{click}$$"
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

  it("rechaza fórmulas con sintaxis LaTeX inválida como 'katex_error' sin lanzar excepción", () => {
    const result = renderFormula("\\frac{1}", "display", "$$\\frac{1}$$");

    expect(result.type).toBe("rejected");
    if (result.type === "rejected") {
      expect(result.reason).toBe("katex_error");
      expect(result.raw).toBe("$$\\frac{1}$$");
    }
  });

  it("mantiene texto malicioso HTML/XSS como segmento de texto plano sin interpretar", () => {
    const input = "<script>alert('xss')</script> y \\(a + b\\)";
    const result = renderTweetText(input);

    expect(result[0]).toEqual({
      type: "text",
      content: "<script>alert('xss')</script> y ",
    });
    expect(result[1].type).toBe("math");
  });

  it("permite límites personalizados en renderTweetText", () => {
    const result = renderTweetText("$$x^2 + y^2$$", { maxLength: 4 });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("rejected");
    if (result[0].type === "rejected") {
      expect(result[0].reason).toBe("too_long");
      expect(result[0].raw).toBe("$$x^2 + y^2$$");
    }
  });
});
