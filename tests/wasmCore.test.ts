import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseMathSegments as parseTs } from "../src/core/parser.js";
import {
  DEFAULT_VALIDATION_LIMITS,
  validateLatex as validateTs,
} from "../src/core/validator.js";
import { loadWasmCore, type WasmCore } from "../src/wasm/wasmCore.js";

let wasm: WasmCore;

beforeAll(async () => {
  const wasmPath = path.join(process.cwd(), "src", "wasm", "latex_core.wasm");
  const bytes = await readFile(wasmPath);
  wasm = await loadWasmCore(bytes);
});

afterAll(() => {
  wasm?.dispose();
});

describe("Rust/WASM core differential equivalence (Milestone D)", () => {
  it("matches TypeScript parseMathSegments across ASCII, delimiters, edge cases, and Unicode", () => {
    const samples = [
      "",
      "Hello X, studying computer science today.",
      "Spent $50 on $BTC and ranged $10 - $20 on $TSLA.",
      "If \\(x^2 + 1\\) is positive",
      "$$E = mc^2$$",
      "Integral: \\[\\int_0^1 x\\,dx = \\frac{1}{2}\\]",
      "Block:\n$$\n  \\frac{a}{b}\n$$\nEnd",
      "Given \\(a = 3\\) and \\(b = 4\\) we get $$c = \\sqrt{a^2 + b^2} = 5$$",
      "\\(x\\)\\(y\\)",
      "Unclosed $$x^2 but valid: \\(y + 1\\)",
      "Empty: $$$$ and \\(\\) and $$   $$",
      "Broken \\[unclosed and \\(ok\\) and $$   $$ end",
      "Fórmula en español, 公式 en chino y emoji 🚀: \\(e^{i\\pi} + 1 = 0\\) fin!",
      "$$\\ce{CO2 + C <=> 2 CO}$$ and \\(\\pu{9.8 m/s^2}\\)",
    ];

    for (const sample of samples) {
      expect(wasm.parseMathSegments(sample)).toEqual(parseTs(sample));
    }
  });

  it("matches TypeScript validateLatex across valid, empty, length, brace, and forbidden command cases", () => {
    const formulas = [
      "x^2 + 1",
      "E = mc^2",
      "\\frac{a + b}{c - d}",
      "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
      "",
      "   \n\t ",
      "x".repeat(DEFAULT_VALIDATION_LIMITS.maxLength),
      "x".repeat(DEFAULT_VALIDATION_LIMITS.maxLength + 1),
      "\\frac{a}{b",
      "x}",
      "a} + {b",
      "\\{1, 2, 3\\}",
      "a \\\\ {b}",
      "a \\\\ {b",
      "{".repeat(DEFAULT_VALIDATION_LIMITS.maxBraceDepth) +
        "x" +
        "}".repeat(DEFAULT_VALIDATION_LIMITS.maxBraceDepth),
      "{".repeat(DEFAULT_VALIDATION_LIMITS.maxBraceDepth + 1) +
        "x" +
        "}".repeat(DEFAULT_VALIDATION_LIMITS.maxBraceDepth + 1),
      "\\def\\x{1} \\x",
      "\\gdef\\a{\\a}\\a",
      "\\let\\foo\\bar",
      "\\newcommand{\\mycmd}{x}",
      "\\href{https://evil.example}{click}",
      "\\url{https://evil.example}",
      "\\htmlStyle{color:red}{x}",
      "x \\leftarrow 0",
      "A \\leftrightarrow B",
      "a \\\\def b",
      "🚀".repeat(250),
      "🚀".repeat(251),
    ];

    for (const formula of formulas) {
      expect(wasm.validateLatex(formula)).toEqual(validateTs(formula));
    }

    // Custom limits parity
    expect(wasm.validateLatex("x^2 + y^2", { maxLength: 5 })).toEqual(
      validateTs("x^2 + y^2", { maxLength: 5 })
    );
    expect(wasm.validateLatex("{{{x}}}", { maxBraceDepth: 2 })).toEqual(
      validateTs("{{{x}}}", { maxBraceDepth: 2 })
    );
  });

  it("matches TypeScript valid formula counts on batched linear-memory scans", () => {
    const posts = [
      "Plain post without math",
      "Euler: \\(e^{i\\pi} + 1 = 0\\) and $$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$",
      "Bad brace $$\\frac{a}{b$$ and bad macro $$\\def\\x{1}$$",
      "Chemistry: $$\\ce{H2O}$$",
    ];

    let expectedValid = 0;
    for (const post of posts) {
      for (const seg of parseTs(post)) {
        if (seg.type === "math" && validateTs(seg.content).ok) {
          expectedValid += 1;
        }
      }
    }

    const packed = new TextEncoder().encode(posts.join("\0"));
    expect(wasm.processBatch(packed)).toBe(expectedValid);
    expect(expectedValid).toBe(3);
  });
});
