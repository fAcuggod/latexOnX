import { describe, expect, it } from "vitest";
import { parseMathSegments } from "../src/core/parser.js";
import type { Segment } from "../src/core/types.js";

function reconstruct(segments: Segment[]): string {
  return segments
    .map((segment) => (segment.type === "text" ? segment.content : segment.raw))
    .join("");
}

describe("parseMathSegments", () => {
  it("returns an empty array for empty input", () => {
    expect(parseMathSegments("")).toEqual([]);
  });

  it("preserves plain text without math as a single text segment", () => {
    const input = "Hello X, studying computer science today.";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: input },
    ]);
  });

  it("ignores single-dollar currency notation and cashtags", () => {
    const input = "Spent $50 on $BTC and ranged $10 - $20 on $TSLA.";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: input },
    ]);
  });

  it("parses inline math delimited by \\(...\\)", () => {
    const input = "If \\(x^2 + 1\\) is positive";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "If " },
      {
        type: "math",
        content: "x^2 + 1",
        mode: "inline",
        raw: "\\(x^2 + 1\\)",
      },
      { type: "text", content: " is positive" },
    ]);
  });

  it("parses display math delimited by $$...$$", () => {
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

  it("parses display math delimited by \\[...\\]", () => {
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

  it("trims surrounding whitespace in content while preserving raw verbatim", () => {
    const input = "Block:\n$$\n  \\frac{a}{b}\n$$\nEnd";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Block:\n" },
      {
        type: "math",
        content: "\\frac{a}{b}",
        mode: "display",
        raw: "$$\n  \\frac{a}{b}\n$$",
      },
      { type: "text", content: "\nEnd" },
    ]);
  });

  it("handles multiple mixed formulas in the same post", () => {
    const input =
      "Given \\(a = 3\\) and \\(b = 4\\) we get $$c = \\sqrt{a^2 + b^2} = 5$$";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Given " },
      { type: "math", content: "a = 3", mode: "inline", raw: "\\(a = 3\\)" },
      { type: "text", content: " and " },
      { type: "math", content: "b = 4", mode: "inline", raw: "\\(b = 4\\)" },
      { type: "text", content: " we get " },
      {
        type: "math",
        content: "c = \\sqrt{a^2 + b^2} = 5",
        mode: "display",
        raw: "$$c = \\sqrt{a^2 + b^2} = 5$$",
      },
    ]);
  });

  it("supports adjacent formulas without emitting empty text segments", () => {
    const input = "\\(x\\)\\(y\\)";
    expect(parseMathSegments(input)).toEqual([
      { type: "math", content: "x", mode: "inline", raw: "\\(x\\)" },
      { type: "math", content: "y", mode: "inline", raw: "\\(y\\)" },
    ]);
  });

  it("treats unclosed delimiters as literal text without breaking subsequent math", () => {
    const input = "Unclosed $$x^2 but valid: \\(y + 1\\)";
    expect(parseMathSegments(input)).toEqual([
      { type: "text", content: "Unclosed $$x^2 but valid: " },
      { type: "math", content: "y + 1", mode: "inline", raw: "\\(y + 1\\)" },
    ]);
  });

  it("treats empty or whitespace-only formulas as literal text", () => {
    expect(parseMathSegments("Empty: $$$$ and \\(\\) and $$   $$")).toEqual([
      { type: "text", content: "Empty: $$$$ and \\(\\) and $$   $$" },
    ]);
  });

  it("preserves core invariants: lossless round-trip, no empty or adjacent text segments", () => {
    const samples = [
      "",
      "Plain text with $BTC and $100",
      "\\(a\\) + \\(b\\) = $$c$$",
      "Broken \\[unclosed and \\(ok\\) and $$   $$ end",
      "$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$",
    ];

    for (const sample of samples) {
      const segments = parseMathSegments(sample);
      expect(reconstruct(segments)).toBe(sample);

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
