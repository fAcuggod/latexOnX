import { describe, expect, it } from "vitest";
import {
  extractLatexCommands,
  findMatchingBrace,
  hasBareLatex,
  parseBareLatexSegments,
} from "../src/core/detector.js";
import type { Segment } from "../src/core/types.js";

function reconstruct(segments: Segment[]): string {
  return segments
    .map((segment) => (segment.type === "text" ? segment.content : segment.raw))
    .join("");
}

describe("extractLatexCommands (Challenge #3.1)", () => {
  it("returns empty array when no commands are present", () => {
    expect(extractLatexCommands("")).toEqual([]);
    expect(extractLatexCommands("Plain post without backslashes")).toEqual([]);
  });

  it("extracts ASCII LaTeX commands in left-to-right order", () => {
    expect(
      extractLatexCommands("\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}")
    ).toEqual(["\\zeta", "\\sum", "\\infty", "\\frac"]);
  });

  it("skips double backslashes (\\\\) and non-letter escapes (\\{, \\,)", () => {
    expect(extractLatexCommands("a \\\\frac b")).toEqual([]);
    expect(extractLatexCommands("a \\\\\\frac{1}{2} \\{x\\}\\,dx")).toEqual([
      "\\frac",
    ]);
    expect(extractLatexCommands("trailing \\")).toEqual([]);
  });
});

describe("findMatchingBrace (Challenge #3.2)", () => {
  it("returns -1 for out-of-bounds or non-brace starting indices", () => {
    expect(findMatchingBrace("{abc}", -1)).toBe(-1);
    expect(findMatchingBrace("{abc}", 5)).toBe(-1);
    expect(findMatchingBrace("{abc}", 1)).toBe(-1);
  });

  it("matches simple and nested brace groups (e.g., chemical ions)", () => {
    expect(findMatchingBrace("\\ce{H2O}", 3)).toBe(7);
    const ion = "\\ce{Fe^{2+} + 2OH- -> Fe(OH)2}";
    expect(findMatchingBrace(ion, 3)).toBe(ion.length - 1);
  });

  it("skips escaped braces (\\{, \\}) and respects double backslashes (\\\\})", () => {
    expect(findMatchingBrace("{a \\} b}", 0)).toBe(7);
    expect(findMatchingBrace("{a \\\\} rest", 0)).toBe(5);
  });

  it("returns -1 when a brace group is never closed", () => {
    expect(findMatchingBrace("\\ce{Fe^{2+}", 3)).toBe(-1);
  });
});

describe("hasBareLatex (Challenge #3.3)", () => {
  it("detects undelimited math and chemistry posts", () => {
    expect(hasBareLatex("\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}")).toBe(
      true
    );
    expect(hasBareLatex("Water is \\ce{H2O}!")).toBe(true);
    expect(hasBareLatex("Gravity: \\pu{9.8 m/s^2}")).toBe(true);
  });

  it("returns false for plain text, code escapes, and Windows paths", () => {
    expect(hasBareLatex("")).toBe(false);
    expect(hasBareLatex("Regular post with 2+2=4")).toBe(false);
    expect(hasBareLatex("Use \\n and \\t for formatting")).toBe(false);
    expect(hasBareLatex("Open C:\\Users\\sum\\notes.txt")).toBe(false);
    expect(hasBareLatex("Path d:\\frac\\data.csv")).toBe(false);
  });

  it("returns false if the post already contains explicit math delimiters", () => {
    expect(hasBareLatex("Already ok: $$\\frac{1}{2}$$")).toBe(false);
    expect(hasBareLatex("Inline \\(\\zeta(s)\\) and extra \\frac{1}{2}")).toBe(
      false
    );
  });

  it("ignores chemistry-only posts when includeChemistry is false", () => {
    expect(hasBareLatex("Water is \\ce{H2O}", { includeChemistry: false })).toBe(
      false
    );
    expect(
      hasBareLatex("\\frac{1}{2}", { includeChemistry: false })
    ).toBe(true);
  });
});

describe("parseBareLatexSegments (Challenge #3.4)", () => {
  it("handles empty and non-bare-LaTeX strings safely", () => {
    expect(parseBareLatexSegments("")).toEqual([]);
    const plain = "Nothing to render here";
    expect(parseBareLatexSegments(plain)).toEqual([
      { type: "text", content: plain },
    ]);
  });

  it("segments multiline posts with standalone math lines (Case A & Case C)", () => {
    const input =
      "Today's proof:\n  \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}  \nPretty neat!";
    expect(parseBareLatexSegments(input)).toEqual([
      { type: "text", content: "Today's proof:\n  " },
      {
        type: "math",
        content: "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}",
        mode: "display",
        raw: "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}",
      },
      { type: "text", content: "  \nPretty neat!" },
    ]);
  });

  it("extracts inline chemistry commands with nested braces inside prose (Case B)", () => {
    const input =
      "Reaction: \\ce{Fe^{2+} + 2OH- -> Fe(OH)2} at \\pu{25 °C}.";
    expect(parseBareLatexSegments(input)).toEqual([
      { type: "text", content: "Reaction: " },
      {
        type: "math",
        content: "\\ce{Fe^{2+} + 2OH- -> Fe(OH)2}",
        mode: "inline",
        raw: "\\ce{Fe^{2+} + 2OH- -> Fe(OH)2}",
      },
      { type: "text", content: " at " },
      {
        type: "math",
        content: "\\pu{25 °C}",
        mode: "inline",
        raw: "\\pu{25 °C}",
      },
      { type: "text", content: "." },
    ]);
  });

  it("uses display mode when a chemistry command is the entire trimmed line", () => {
    const input = "Equation:\n\\ce{CO2 + C -> 2 CO}";
    expect(parseBareLatexSegments(input)).toEqual([
      { type: "text", content: "Equation:\n" },
      {
        type: "math",
        content: "\\ce{CO2 + C -> 2 CO}",
        mode: "display",
        raw: "\\ce{CO2 + C -> 2 CO}",
      },
    ]);
  });

  it("keeps unclosed or empty chemistry commands as literal text", () => {
    const input = "Valid \\ce{H2O} broken \\ce{O2 empty \\ce{   } end";
    expect(parseBareLatexSegments(input)).toEqual([
      { type: "text", content: "Valid " },
      {
        type: "math",
        content: "\\ce{H2O}",
        mode: "inline",
        raw: "\\ce{H2O}",
      },
      { type: "text", content: " broken \\ce{O2 empty \\ce{   } end" },
    ]);
  });

  it("preserves lossless, non-empty, and non-adjacent text invariants", () => {
    const samples = [
      "",
      "Plain text C:\\Users\\sum\\a.txt",
      "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}",
      "Intro\n\\frac{1}{2} \\ce{O2} -> \\ce{H2O}\nWater \\ce{H2O}!\n",
      "Unclosed \\ce{Fe^{2+} and ok \\ce{H2O}",
    ];

    for (const sample of samples) {
      const segments = parseBareLatexSegments(sample);
      expect(reconstruct(segments)).toBe(sample);

      for (let i = 0; i < segments.length; i++) {
        const cur = segments[i];
        if (cur.type === "text") {
          expect(cur.content.length).toBeGreaterThan(0);
          if (i > 0) {
            expect(segments[i - 1].type).not.toBe("text");
          }
        }
      }
    }
  });
});
