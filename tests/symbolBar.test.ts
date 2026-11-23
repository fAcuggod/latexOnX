import { describe, expect, it } from "vitest";
import { applyQuickSymbol, QUICK_SYMBOLS } from "../src/core/symbolBar.js";

describe("symbolBar (v1.3 Quick Symbol Bar Core)", () => {
  const byId = (id: string) => {
    const found = QUICK_SYMBOLS.find((s) => s.id === id);
    if (!found) throw new Error(`Missing symbol ${id}`);
    return found;
  };

  it("inserts inline and display wrappers cleanly around empty caret or highlighted selection", () => {
    const inlineWrap = byId("inline-wrap");

    // Empty caret
    const empty = applyQuickSymbol("Hola ", 5, 5, inlineWrap);
    expect(empty.text).toBe("Hola \\(\\)");
    expect(empty.cursorPos).toBe(7);

    // Highlighted selection wraps cleanly
    const wrapped = applyQuickSymbol("Valor x^2 + 1 listo", 6, 13, inlineWrap);
    expect(wrapped.text).toBe("Valor \\(x^2 + 1\\) listo");
    expect(wrapped.cursorPos).toBe("Valor \\(x^2 + 1\\)".length);
  });

  it("auto-wraps bare symbols in \\(...\\) when outside math and inserts raw inside math", () => {
    const frac = byId("frac");
    const sqrt = byId("sqrt");

    // Outside math: auto-wraps and places caret inside numerator `{}`
    const outFrac = applyQuickSymbol("Ratio ", 6, 6, frac);
    expect(outFrac.text).toBe("Ratio \\(\\frac{}{}\\)");
    expect(outFrac.cursorPos).toBe("Ratio \\(\\frac{".length);

    // Inside math: inserts raw \frac{}{} without extra delimiters
    const inFrac = applyQuickSymbol("$$1 + $$", 6, 6, frac);
    expect(inFrac.text).toBe("$$1 + \\frac{}{}$$");
    expect(inFrac.cursorPos).toBe("$$1 + \\frac{".length);

    // Highlighted numerator inside math jumps caret into denominator `{}`
    const selFrac = applyQuickSymbol("$$x+1$$", 2, 5, frac);
    expect(selFrac.text).toBe("$$\\frac{x+1}{}$$");
    expect(selFrac.cursorPos).toBe("$$\\frac{x+1}{".length);

    // Highlighted selection with sqrt wraps selection cleanly
    const selSqrt = applyQuickSymbol("$$a^2+b^2$$", 2, 9, sqrt);
    expect(selSqrt.text).toBe("$$\\sqrt{a^2+b^2}$$");
  });

  it("provides localized non-empty tooltips without dash artifacts for every symbol", () => {
    expect(QUICK_SYMBOLS.length).toBeGreaterThanOrEqual(10);
    for (const sym of QUICK_SYMBOLS) {
      expect(sym.label.length).toBeGreaterThan(0);
      for (const tip of Object.values(sym.tooltips)) {
        expect(tip.trim().length).toBeGreaterThan(0);
        expect(tip).not.toMatch(/—|–|--/);
      }
    }
  });
});
