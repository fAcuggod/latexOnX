import { describe, expect, it } from "vitest";
import { parseMathSegments } from "../src/core/parser.js";
import type { Segment } from "../src/core/types.js";

/**
 * Función auxiliar para comprobar la invariante fundamental del parser:
 * unir todos los segmentos debe devolver EXACTAMENTE el texto original.
 */
function reconstruct(segments: Segment[]): string {
  return segments
    .map((segment) => (segment.type === "text" ? segment.content : segment.raw))
    .join("");
}

describe("parseMathSegments (Reto #1)", () => {
  it("devuelve una lista vacía para texto vacío", () => {
    expect(parseMathSegments("")).toEqual([]);
  });

  it("mantiene texto plano sin fórmulas como un único segmento de texto", () => {
    const input = "Hola X, hoy estoy aprendiendo ciencias de la computación.";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: input },
    ]);
  });

  it("no confunde precios ni cashtags con fórmulas ($50, $BTC, $10 - $20)", () => {
    const input = "Compré $BTC a $50 y el rango es $10 - $20 en $TSLA.";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: input },
    ]);
  });

  it("detecta una fórmula en línea con \\(...\\)", () => {
    const input = "Si \\(x^2 + 1\\) es positivo";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Si " },
      {
        type: "math",
        content: "x^2 + 1",
        mode: "inline",
        raw: "\\(x^2 + 1\\)",
      },
      { type: "text", content: " es positivo" },
    ]);
  });

  it("detecta una fórmula en bloque con $$...$$", () => {
    const input = "$$E = mc^2$$";
    expect(parseMathSegments(input)).toEqual([
      {
        type: "math",
        content: "E = mc^2",
        mode: "display",
        raw: "$$E = mc^2$$",
      },
    ]);
  });

  it("detecta una fórmula en bloque con \\[...\\]", () => {
    const input = "Integral: \\[\\int_0^1 x\\,dx = \\frac{1}{2}\\]";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Integral: " },
      {
        type: "math",
        content: "\\int_0^1 x\\,dx = \\frac{1}{2}",
        mode: "display",
        raw: "\\[\\int_0^1 x\\,dx = \\frac{1}{2}\\]",
      },
    ]);
  });

  it("recorta espacios en los bordes de content pero preserva raw intacto", () => {
    const input = "Bloque:\n$$\n  \\frac{a}{b}\n$$\nFin";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Bloque:\n" },
      {
        type: "math",
        content: "\\frac{a}{b}",
        mode: "display",
        raw: "$$\n  \\frac{a}{b}\n$$",
      },
      { type: "text", content: "\nFin" },
    ]);
  });

  it("soporta múltiples fórmulas mezcladas en el mismo tweet", () => {
    const input =
      "Con \\(a = 3\\) y \\(b = 4\\) tenemos $$c = \\sqrt{a^2 + b^2} = 5$$";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Con " },
      { type: "math", content: "a = 3", mode: "inline", raw: "\\(a = 3\\)" },
      { type: "text", content: " y " },
      { type: "math", content: "b = 4", mode: "inline", raw: "\\(b = 4\\)" },
      { type: "text", content: " tenemos " },
      {
        type: "math",
        content: "c = \\sqrt{a^2 + b^2} = 5",
        mode: "display",
        raw: "$$c = \\sqrt{a^2 + b^2} = 5$$",
      },
    ]);
  });

  it("soporta fórmulas adyacentes sin generar segmentos de texto vacíos", () => {
    const input = "\\(x\\)\\(y\\)";
    expect(parseMathSegments(input)).toEqual([
      { type: "math", content: "x", mode: "inline", raw: "\\(x\\)" },
      { type: "math", content: "y", mode: "inline", raw: "\\(y\\)" },
    ]);
  });

  it("trata delimitadores sin cierre como texto literal sin romper el resto", () => {
    const input = "Sin cerrar $$x^2 pero esto sí: \\(y + 1\\)";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Sin cerrar $$x^2 pero esto sí: " },
      { type: "math", content: "y + 1", mode: "inline", raw: "\\(y + 1\\)" },
    ]);
  });

  it("trata fórmulas vacías o de solo espacios como texto literal", () => {
    expect(parseMathSegments("Nada aquí: $$$$ ni \\(\\) ni $$   $$")).toEqual([
      { type: "text", content: "Nada aquí: $$$$ ni \\(\\) ni $$   $$" },
    ]);
  });

  it("cumple las invariantes: sin pérdida de texto, sin textos vacíos ni adyacentes", () => {
    const samples = [
      "",
      "Solo texto con $BTC y $100",
      "\\(a\\) + \\(b\\) = $$c$$",
      "Roto \\[sin cerrar y \\(ok\\) y $$   $$ fin",
      "$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$",
    ];

    for (const sample of samples) {
      const segments = parseMathSegments(sample);

      // Invariante 1: reconstrucción exacta (lossless)
      expect(reconstruct(segments)).toBe(sample);

      // Invariante 2 y 3: sin textos vacíos ni dos textos seguidos
      for (let i = 0; i < segments.length; i++) {
        const current = segments[i];
        if (current.type === "text") {
          expect(current.content.length).toBeGreaterThan(0);
          if (i > 0) {
            expect(segments[i - 1].type).not.toBe("text");
          }
        }
      }
    }
  });
});
