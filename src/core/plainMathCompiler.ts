/**
 * Pure Plain-Math & Unicode-Math -> LaTeX Mini-Compiler (v1.5).
 *
 * Architecture:
 *   Input text
 *     -> Fast pre-check (`mightContainPlainMath`)
 *     -> Lexer (`tokenizePlainMath`) with Unicode math, Greek, superscripts/subscripts & ellipsis
 *     -> Recursive-Descent Parser (`parsePlainMathToAst`)
 *     -> Abstract Syntax Tree (`MathAstNode`)
 *     -> LaTeX Code Generator (`emitLatexFromAst`)
 *
 * Zero browser/DOM dependencies, O(n) tokenization and parsing, bounded AST
 * recursion depth (anti-DoS), and dual-mode precision filters (`composer` vs `feed`)
 * to avoid false positives on everyday prose, slash abbreviations, units, dates,
 * scores, resolutions, URLs, and currency notation.
 */

import { parseMathSegments } from "./parser.js";
import type { MathDisplayMode } from "./types.js";
import { validateLatex } from "./validator.js";

const MAX_AST_DEPTH = 32;
const MAX_PLAIN_MATH_INPUT_LENGTH = 360;

export type PlainMathDetectionMode = "composer" | "feed";

export interface PlainMathOptions {
  mode?: PlainMathDetectionMode;
}

export type MathToken =
  | { kind: "number"; value: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string; unicodeScript?: boolean }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "lbracket" }
  | { kind: "rbracket" }
  | { kind: "lbrace" }
  | { kind: "rbrace" }
  | { kind: "comma" }
  | { kind: "pipe" }
  | { kind: "prime" }
  | { kind: "sqrt" }
  | { kind: "ellipsis" };

export type MathAstNode =
  | { kind: "number"; value: string }
  | { kind: "ident"; name: string }
  | { kind: "ellipsis" }
  | { kind: "sqrt"; operand: MathAstNode }
  | {
      kind: "unary";
      op: "+" | "-" | "+-" | "-+" | "∀" | "∃" | "¬";
      operand: MathAstNode;
    }
  | { kind: "postfix"; op: "!" | "'"; operand: MathAstNode }
  | {
      kind: "binary";
      op: string;
      left: MathAstNode;
      right: MathAstNode;
      implicit?: boolean;
      unicodeScript?: boolean;
    }
  | { kind: "call"; callee: string; primes: number; args: MathAstNode[] }
  | { kind: "group"; bracket: "(" | "[" | "{"; expr: MathAstNode }
  | { kind: "abs"; expr: MathAstNode };

export interface PlainMathSuggestion {
  /** Exact plain-math or Unicode-math slice detected inside the source text. */
  raw: string;
  /** Compiled clean LaTeX source (without delimiters). */
  latex: string;
  /** Delimited LaTeX ready to insert (`\(...\)` or `$$...$$`). */
  wrappedLatex: string;
  mode: MathDisplayMode;
  replaceStart: number;
  replaceEnd: number;
  ast: MathAstNode;
}

const KNOWN_FUNCTIONS: Readonly<Record<string, string>> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  csc: "\\csc",
  sec: "\\sec",
  cot: "\\cot",
  arcsin: "\\arcsin",
  arccos: "\\arccos",
  arctan: "\\arctan",
  sinh: "\\sinh",
  cosh: "\\cosh",
  tanh: "\\tanh",
  ln: "\\ln",
  log: "\\log",
  exp: "\\exp",
  lim: "\\lim",
  max: "\\max",
  min: "\\min",
  det: "\\det",
  dim: "\\dim",
  ker: "\\ker",
  gcd: "\\gcd",
  lcm: "\\operatorname{lcm}",
  tr: "\\operatorname{tr}",
  rank: "\\operatorname{rank}",
  Re: "\\operatorname{Re}",
  Im: "\\operatorname{Im}",
  sqrt: "\\sqrt",
  root: "\\sqrt",
  abs: "abs",
};

const STRONG_FEED_FUNCTIONS: ReadonlySet<string> = new Set([
  "sin",
  "cos",
  "tan",
  "csc",
  "sec",
  "cot",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "ln",
  "log",
  "exp",
  "lim",
  "gcd",
  "lcm",
  "sqrt",
  "root",
]);

const KNOWN_SYMBOLS: Readonly<Record<string, string>> = {
  alpha: "\\alpha",
  beta: "\\beta",
  gamma: "\\gamma",
  delta: "\\delta",
  epsilon: "\\epsilon",
  varepsilon: "\\varepsilon",
  zeta: "\\zeta",
  eta: "\\eta",
  theta: "\\theta",
  iota: "\\iota",
  kappa: "\\kappa",
  lambda: "\\lambda",
  mu: "\\mu",
  nu: "\\nu",
  xi: "\\xi",
  pi: "\\pi",
  rho: "\\rho",
  sigma: "\\sigma",
  tau: "\\tau",
  upsilon: "\\upsilon",
  phi: "\\phi",
  varphi: "\\varphi",
  chi: "\\chi",
  psi: "\\psi",
  omega: "\\omega",
  Gamma: "\\Gamma",
  Delta: "\\Delta",
  Theta: "\\Theta",
  Lambda: "\\Lambda",
  Xi: "\\Xi",
  Pi: "\\Pi",
  Sigma: "\\Sigma",
  Phi: "\\Phi",
  Psi: "\\Psi",
  Omega: "\\Omega",
  inf: "\\infty",
  infinity: "\\infty",
  infty: "\\infty",
  nabla: "\\nabla",
  partial: "\\partial",
  forall: "\\forall",
  exists: "\\exists",
};

const UNICODE_GREEK_SYMBOLS: Readonly<Record<string, string>> = {
  "α": "\\alpha",
  "β": "\\beta",
  "γ": "\\gamma",
  "δ": "\\delta",
  "ε": "\\varepsilon",
  "ϵ": "\\epsilon",
  "ζ": "\\zeta",
  "η": "\\eta",
  "θ": "\\theta",
  "ϑ": "\\vartheta",
  "ι": "\\iota",
  "κ": "\\kappa",
  "λ": "\\lambda",
  "μ": "\\mu",
  "ν": "\\nu",
  "ξ": "\\xi",
  "π": "\\pi",
  "ρ": "\\rho",
  "σ": "\\sigma",
  "ς": "\\varsigma",
  "τ": "\\tau",
  "υ": "\\upsilon",
  "φ": "\\varphi",
  "ϕ": "\\phi",
  "χ": "\\chi",
  "ψ": "\\psi",
  "ω": "\\omega",
  "Γ": "\\Gamma",
  "Δ": "\\Delta",
  "Θ": "\\Theta",
  "Λ": "\\Lambda",
  "Ξ": "\\Xi",
  "Π": "\\Pi",
  "Σ": "\\Sigma",
  "Φ": "\\Phi",
  "Ψ": "\\Psi",
  "Ω": "\\Omega",
};

const UNICODE_MATH_SYMBOLS: Readonly<Record<string, string>> = {
  "∞": "\\infty",
  "∂": "\\partial",
  "∇": "\\nabla",
  "∅": "\\emptyset",
  "ℝ": "\\mathbb{R}",
  "ℂ": "\\mathbb{C}",
  "ℤ": "\\mathbb{Z}",
  "ℕ": "\\mathbb{N}",
  "ℚ": "\\mathbb{Q}",
  "ℙ": "\\mathbb{P}",
  "𝔼": "\\mathbb{E}",
  "ℏ": "\\hbar",
  "ℓ": "\\ell",
  "℘": "\\wp",
  "∑": "\\sum",
  "∏": "\\prod",
  "∫": "\\int",
  "∮": "\\oint",
};

const BIG_OP_NAMES: ReadonlySet<string> = new Set([
  "∑",
  "∏",
  "∫",
  "∮",
  "lim",
]);

const DIFFERENTIALS: ReadonlySet<string> = new Set([
  "dx",
  "dy",
  "dz",
  "dt",
  "ds",
  "du",
  "dv",
]);

const UNICODE_SUPERSCRIPT_MAP: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
  "⁼": "=",
  "⁽": "(",
  "⁾": ")",
  "ⁿ": "n",
  "ⁱ": "i",
  "ˣ": "x",
  "ʸ": "y",
  "ᵗ": "t",
  "ᵏ": "k",
  "ᵐ": "m",
  "ˢ": "s",
  "ᵃ": "a",
  "ᵇ": "b",
  "ᶜ": "c",
  "ᵈ": "d",
  "ᵉ": "e",
  "ᶠ": "f",
  "ᵍ": "g",
  "ʰ": "h",
  "ʲ": "j",
  "ˡ": "l",
  "ᵒ": "o",
  "ᵖ": "p",
  "ʳ": "r",
  "ᵘ": "u",
  "ᵛ": "v",
  "ʷ": "w",
  "ᶻ": "z",
};

const UNICODE_SUBSCRIPT_MAP: Readonly<Record<string, string>> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "₊": "+",
  "₋": "-",
  "₌": "=",
  "₍": "(",
  "₎": ")",
  "ₐ": "a",
  "ₑ": "e",
  "ₕ": "h",
  "ᵢ": "i",
  "ⱼ": "j",
  "ₖ": "k",
  "ₗ": "l",
  "ₘ": "m",
  "ₙ": "n",
  "ₒ": "o",
  "ₚ": "p",
  "ᵣ": "r",
  "ₛ": "s",
  "ₜ": "t",
  "ᵤ": "u",
  "ᵥ": "v",
  "ₓ": "x",
};

const UNICODE_OP_MAP: Readonly<Record<string, string>> = {
  "\u2212": "-",
  "\u2013": "-",
  "×": "×",
  "·": "*",
  "⋅": "*",
  "÷": "÷",
  "±": "+-",
  "∓": "-+",
  "∪": "∪",
  "∩": "∩",
  "≤": "≤",
  "≥": "≥",
  "≠": "≠",
  "≈": "≈",
  "≡": "≡",
  "∼": "∼",
  "≅": "≅",
  "∝": "∝",
  "∈": "∈",
  "∉": "∉",
  "⊂": "⊂",
  "⊆": "⊆",
  "⊃": "⊃",
  "⊇": "⊇",
  "↦": "↦",
  "→": "→",
  "←": "←",
  "↔": "↔",
  "⇒": "⇒",
  "⇐": "⇐",
  "⇔": "⇔",
  "∀": "∀",
  "∃": "∃",
  "¬": "¬",
};

const STRICT_UNICODE_RELATIONS: ReadonlySet<string> = new Set([
  "≤",
  "≥",
  "≠",
  "≈",
  "≡",
  "∼",
  "≅",
  "∝",
  "∈",
  "∉",
  "⊂",
  "⊆",
  "⊃",
  "⊇",
  "↦",
]);

const ARROW_RELATIONS: ReadonlySet<string> = new Set([
  "->",
  "=>",
  "<=>",
  "→",
  "←",
  "↔",
  "⇒",
  "⇐",
  "⇔",
]);

const RELATION_OPS: ReadonlySet<string> = new Set([
  "=",
  "<",
  ">",
  "<=",
  ">=",
  "!=",
  "~=",
  "->",
  "=>",
  "<=>",
  ...STRICT_UNICODE_RELATIONS,
  ...ARROW_RELATIONS,
]);

const ADDITIVE_OPS: ReadonlySet<string> = new Set([
  "+",
  "-",
  "+-",
  "-+",
  "∪",
]);

const MULTIPLICATIVE_OPS: ReadonlySet<string> = new Set([
  "*",
  "/",
  "×",
  "÷",
  "∩",
]);

const UNARY_OPS: ReadonlySet<string> = new Set([
  "+",
  "-",
  "+-",
  "-+",
  "∀",
  "∃",
  "¬",
]);

const LATEX_OPS: Readonly<Record<string, string>> = {
  "=": "=",
  "<": "<",
  ">": ">",
  "<=": "\\le",
  ">=": "\\ge",
  "!=": "\\ne",
  "~=": "\\approx",
  "->": "\\to",
  "=>": "\\Rightarrow",
  "<=>": "\\Leftrightarrow",
  "+": "+",
  "-": "-",
  "+-": "\\pm",
  "-+": "\\mp",
  "*": "\\cdot",
  "×": "\\times",
  "÷": "\\div",
  "∪": "\\cup",
  "∩": "\\cap",
  "≤": "\\le",
  "≥": "\\ge",
  "≠": "\\ne",
  "≈": "\\approx",
  "≡": "\\equiv",
  "∼": "\\sim",
  "≅": "\\cong",
  "∝": "\\propto",
  "∈": "\\in",
  "∉": "\\notin",
  "⊂": "\\subset",
  "⊆": "\\subseteq",
  "⊃": "\\supset",
  "⊇": "\\supseteq",
  "↦": "\\mapsto",
  "→": "\\to",
  "←": "\\leftarrow",
  "↔": "\\leftrightarrow",
  "⇒": "\\Rightarrow",
  "⇐": "\\Leftarrow",
  "⇔": "\\Leftrightarrow",
};

const MULTI_CHAR_OPS = ["<=>", "<=", ">=", "!=", "~=", "->", "=>", "+-"];

const ALLOWED_TWO_CHAR_PROSE = new Set([
  "en",
  "el",
  "la",
  "lo",
  "un",
  "de",
  "es",
  "si",
  "no",
  "ya",
  "al",
  "me",
  "te",
  "se",
  "le",
  "tu",
  "su",
  "mi",
  "in",
  "on",
  "at",
  "to",
  "of",
  "is",
  "be",
  "or",
  "as",
  "by",
  "an",
  "if",
  "it",
  "my",
  "we",
  "he",
  "so",
  "do",
  "go",
  "up",
  "am",
  "pm",
  "vs",
  "ok",
  "ha",
  "hi",
  "oh",
  "ah",
  "uh",
]);

function isAsciiDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isAsciiLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

function isGreekBlockChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff);
}

function hasOwn(obj: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isUnicodeMathTriggerChar(ch: string): boolean {
  return (
    hasOwn(UNICODE_GREEK_SYMBOLS, ch) ||
    hasOwn(UNICODE_MATH_SYMBOLS, ch) ||
    hasOwn(UNICODE_OP_MAP, ch) ||
    hasOwn(UNICODE_SUPERSCRIPT_MAP, ch) ||
    hasOwn(UNICODE_SUBSCRIPT_MAP, ch) ||
    ch === "√" ||
    ch === "′" ||
    ch === "″"
  );
}

/**
 * Fast O(n) zero-allocation pre-check:
 * Returns `true` only if `text` contains at least one character capable of
 * forming a plain-math or Unicode-math expression. Skips ~95% of everyday
 * posts immediately to preserve 60-120 FPS infinite scrolling on x.com.
 */
export function mightContainPlainMath(text: string): boolean {
  if (text.length < 3) return false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (
      ch === "=" ||
      ch === "<" ||
      ch === ">" ||
      ch === "^" ||
      ch === "_" ||
      ch === "("
    ) {
      return true;
    }
    if (ch.charCodeAt(0) >= 0x00b1 && isUnicodeMathTriggerChar(ch)) {
      return true;
    }
  }

  return false;
}

function readUnicodeScript(
  input: string,
  start: number
): { tokens: MathToken[]; end: number } | null {
  const first = input[start];
  let scriptOp: "^" | "_" | null = null;
  let map: Readonly<Record<string, string>> | null = null;

  if (hasOwn(UNICODE_SUPERSCRIPT_MAP, first)) {
    scriptOp = "^";
    map = UNICODE_SUPERSCRIPT_MAP;
  } else if (hasOwn(UNICODE_SUBSCRIPT_MAP, first)) {
    scriptOp = "_";
    map = UNICODE_SUBSCRIPT_MAP;
  } else {
    return null;
  }

  let end = start;
  let mapped = "";
  while (end < input.length && hasOwn(map, input[end])) {
    mapped += map[input[end]];
    end += 1;
  }

  const innerTokens = tokenizePlainMath(mapped);
  if (!innerTokens || innerTokens.length === 0) {
    return null;
  }

  if (innerTokens.length === 1) {
    return {
      tokens: [{ kind: "op", value: scriptOp, unicodeScript: true }, innerTokens[0]],
      end,
    };
  }

  return {
    tokens: [
      { kind: "op", value: scriptOp, unicodeScript: true },
      { kind: "lbrace" },
      ...innerTokens,
      { kind: "rbrace" },
    ],
    end,
  };
}

/**
 * Phase 1: Lexer.
 * Converts a plain-math or Unicode-math string into a typed token stream.
 * Returns `null` if any disallowed/non-math character is encountered.
 */
export function tokenizePlainMath(input: string): MathToken[] | null {
  const tokens: MathToken[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    // Ellipsis (`...`, `…`, `⋯`)
    if (input.startsWith("...", i)) {
      tokens.push({ kind: "ellipsis" });
      i += 3;
      continue;
    }
    if (ch === "…" || ch === "⋯") {
      tokens.push({ kind: "ellipsis" });
      i += 1;
      continue;
    }

    // Number literal (integer or decimal)
    if (isAsciiDigit(ch)) {
      let j = i + 1;
      let sawDot = false;
      while (j < input.length) {
        if (isAsciiDigit(input[j])) {
          j += 1;
        } else if (
          input[j] === "." &&
          !sawDot &&
          j + 1 < input.length &&
          isAsciiDigit(input[j + 1])
        ) {
          sawDot = true;
          j += 1;
        } else {
          break;
        }
      }
      tokens.push({ kind: "number", value: input.slice(i, j) });
      i = j;
      continue;
    }

    // ASCII identifier (variable, Greek name, or function name)
    if (isAsciiLetter(ch)) {
      let j = i + 1;
      while (j < input.length && isAsciiLetter(input[j])) {
        j += 1;
      }
      tokens.push({ kind: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Single standalone Greek letter (reject contiguous multi-letter Greek prose words)
    if (isGreekBlockChar(ch)) {
      let j = i + 1;
      while (j < input.length && isGreekBlockChar(input[j])) {
        j += 1;
      }
      if (j - i === 1 && hasOwn(UNICODE_GREEK_SYMBOLS, ch)) {
        tokens.push({ kind: "ident", value: ch });
        i = j;
        continue;
      }
      return null;
    }

    // Unicode mathematical symbol / constant / big operator
    if (hasOwn(UNICODE_MATH_SYMBOLS, ch)) {
      tokens.push({ kind: "ident", value: ch });
      i += 1;
      continue;
    }

    // Unicode square root prefix (`√`)
    if (ch === "√") {
      tokens.push({ kind: "sqrt" });
      i += 1;
      continue;
    }

    // Unicode primes (`′`, `″`)
    if (ch === "′") {
      tokens.push({ kind: "prime" });
      i += 1;
      continue;
    }
    if (ch === "″") {
      tokens.push({ kind: "prime" }, { kind: "prime" });
      i += 1;
      continue;
    }

    // Unicode superscript / subscript runs (`²`, `⁻¹`, `¹⁻ˢ`, `ₙ₊₁`)
    if (hasOwn(UNICODE_SUPERSCRIPT_MAP, ch) || hasOwn(UNICODE_SUBSCRIPT_MAP, ch)) {
      const script = readUnicodeScript(input, i);
      if (!script) return null;
      tokens.push(...script.tokens);
      i = script.end;
      continue;
    }

    // Unicode math operators & relations (`−`, `×`, `≤`, `≥`, `→`, `∈`, ...)
    if (hasOwn(UNICODE_OP_MAP, ch)) {
      tokens.push({ kind: "op", value: UNICODE_OP_MAP[ch] });
      i += 1;
      continue;
    }

    // Multi-character ASCII operators (maximal munch)
    let matchedMulti: string | null = null;
    for (const op of MULTI_CHAR_OPS) {
      if (input.startsWith(op, i)) {
        matchedMulti = op;
        break;
      }
    }
    if (matchedMulti !== null) {
      tokens.push({ kind: "op", value: matchedMulti });
      i += matchedMulti.length;
      continue;
    }

    // Single-character ASCII punctuation and operators
    switch (ch) {
      case "(":
        tokens.push({ kind: "lparen" });
        break;
      case ")":
        tokens.push({ kind: "rparen" });
        break;
      case "[":
        tokens.push({ kind: "lbracket" });
        break;
      case "]":
        tokens.push({ kind: "rbracket" });
        break;
      case "{":
        tokens.push({ kind: "lbrace" });
        break;
      case "}":
        tokens.push({ kind: "rbrace" });
        break;
      case ",":
        tokens.push({ kind: "comma" });
        break;
      case "|":
        tokens.push({ kind: "pipe" });
        break;
      case "'":
        tokens.push({ kind: "prime" });
        break;
      case "+":
      case "-":
      case "*":
      case "/":
      case "^":
      case "_":
      case "=":
      case "<":
      case ">":
      case "!":
        tokens.push({ kind: "op", value: ch });
        break;
      default:
        return null;
    }

    i += 1;
  }

  return tokens;
}

/**
 * Checks whether an identifier token is a valid mathematical symbol/function/variable
 * (rejecting natural-language prose words of length >= 3 and common 2-letter stop-words).
 */
function isValidMathIdentifier(name: string): boolean {
  if (name.length === 1) return true;
  if (hasOwn(KNOWN_FUNCTIONS, name)) return true;
  if (hasOwn(KNOWN_SYMBOLS, name)) return true;
  if (hasOwn(UNICODE_GREEK_SYMBOLS, name)) return true;
  if (hasOwn(UNICODE_MATH_SYMBOLS, name)) return true;
  if (name.length === 2) {
    // Allow 2-letter algebra products/differentials like `dx`, `dt`, `mx`, `mc`, `PV`, `RT`
    // while excluding common 2-letter Spanish/English stop-words (case-insensitive)
    return !ALLOWED_TWO_CHAR_PROSE.has(name.toLowerCase());
  }
  if (name === "nRT") return true;
  return false;
}

function isBigOpNode(node: MathAstNode): boolean {
  if (node.kind === "ident") {
    return BIG_OP_NAMES.has(node.name);
  }
  if (node.kind === "binary" && (node.op === "_" || node.op === "^")) {
    return isBigOpNode(node.left);
  }
  return false;
}

/**
 * Phase 2: Recursive-Descent Parser.
 * Parses tokens into a typed Abstract Syntax Tree respecting standard math
 * precedence (Relations < Additive < Multiplicative/Implicit < Unary < Power < Postfix < Primary).
 */
export function parsePlainMathToAst(
  tokens: readonly MathToken[]
): MathAstNode | null {
  if (tokens.length === 0) return null;

  let pos = 0;
  let depth = 0;

  const peek = (offset = 0): MathToken | undefined => tokens[pos + offset];
  const consume = (): MathToken => tokens[pos++];

  const enter = (): boolean => {
    depth += 1;
    return depth <= MAX_AST_DEPTH;
  };
  const leave = (): void => {
    depth -= 1;
  };

  const canStartImplicitFactor = (
    tok: MathToken | undefined,
    afterBigOp: boolean
  ): boolean => {
    if (!tok) return false;
    if (
      tok.kind === "ident" ||
      tok.kind === "lparen" ||
      tok.kind === "lbracket" ||
      tok.kind === "sqrt"
    ) {
      return true;
    }
    if (afterBigOp && tok.kind === "number") {
      return true;
    }
    return false;
  };

  const parseRelation = (): MathAstNode | null => {
    if (!enter()) return null;
    let left = parseAdditive();
    if (!left) {
      leave();
      return null;
    }

    while (true) {
      const tok = peek();
      if (tok && tok.kind === "op" && RELATION_OPS.has(tok.value)) {
        consume();
        const right = parseAdditive();
        if (!right) {
          leave();
          return null;
        }
        left = { kind: "binary", op: tok.value, left, right };
      } else {
        break;
      }
    }

    leave();
    return left;
  };

  const parseAdditive = (): MathAstNode | null => {
    if (!enter()) return null;
    let left = parseMultiplicative();
    if (!left) {
      leave();
      return null;
    }

    while (true) {
      const tok = peek();
      if (tok && tok.kind === "op" && ADDITIVE_OPS.has(tok.value)) {
        consume();
        const right = parseMultiplicative();
        if (!right) {
          leave();
          return null;
        }
        left = { kind: "binary", op: tok.value, left, right };
      } else {
        break;
      }
    }

    leave();
    return left;
  };

  const parseMultiplicative = (): MathAstNode | null => {
    if (!enter()) return null;
    let left = parseUnary();
    if (!left) {
      leave();
      return null;
    }

    while (true) {
      const tok = peek();
      if (tok && tok.kind === "op" && MULTIPLICATIVE_OPS.has(tok.value)) {
        consume();
        const right = parseUnary();
        if (!right) {
          leave();
          return null;
        }
        left = { kind: "binary", op: tok.value, left, right };
      } else if (canStartImplicitFactor(tok, isBigOpNode(left))) {
        const right: MathAstNode | null = isBigOpNode(left)
          ? parseMultiplicative()
          : parseUnary();
        if (!right) {
          leave();
          return null;
        }
        left = { kind: "binary", op: "*", left, right, implicit: true };
      } else {
        break;
      }
    }

    leave();
    return left;
  };

  const parseUnary = (): MathAstNode | null => {
    if (!enter()) return null;
    const tok = peek();
    if (tok && tok.kind === "op" && UNARY_OPS.has(tok.value)) {
      consume();
      const operand = parseUnary();
      leave();
      return operand
        ? {
            kind: "unary",
            op: tok.value as "+" | "-" | "+-" | "-+" | "∀" | "∃" | "¬",
            operand,
          }
        : null;
    }

    const node = parsePower();
    leave();
    return node;
  };

  const parseScriptOperand = (scriptOp: "^" | "_"): MathAstNode | null => {
    const tok = peek();
    if (tok && tok.kind === "lbrace") {
      consume();
      const expr = parseRelation();
      if (!expr || peek()?.kind !== "rbrace") {
        return null;
      }
      consume();
      return { kind: "group", bracket: "{", expr };
    }
    if (scriptOp === "_") {
      // Subscript must not greedily steal a following `^` (e.g. `∑_(n=1)^∞`, `a_n^2`)
      if (tok && tok.kind === "op" && (tok.value === "-" || tok.value === "+")) {
        consume();
        const operand = parsePostfix();
        return operand
          ? { kind: "unary", op: tok.value as "+" | "-", operand }
          : null;
      }
      return parsePostfix();
    }
    return parseUnary();
  };

  const parsePower = (): MathAstNode | null => {
    if (!enter()) return null;
    let base = parsePostfix();
    if (!base) {
      leave();
      return null;
    }

    const tok = peek();
    if (tok && tok.kind === "op" && (tok.value === "^" || tok.value === "_")) {
      consume();
      const exp = parseScriptOperand(tok.value);
      if (!exp) {
        leave();
        return null;
      }
      base = tok.unicodeScript
        ? {
            kind: "binary",
            op: tok.value,
            left: base,
            right: exp,
            unicodeScript: true,
          }
        : { kind: "binary", op: tok.value, left: base, right: exp };

      // Support combined subscript + superscript (e.g. `a_n^2`, `∑_(n=1)^∞`, `∑_{n=1}^∞`, `aₙ²`)
      const next = peek();
      if (
        next &&
        next.kind === "op" &&
        (next.value === "^" || next.value === "_") &&
        next.value !== tok.value
      ) {
        consume();
        const second = parseScriptOperand(next.value);
        if (!second) {
          leave();
          return null;
        }
        base = next.unicodeScript
          ? {
              kind: "binary",
              op: next.value,
              left: base,
              right: second,
              unicodeScript: true,
            }
          : { kind: "binary", op: next.value, left: base, right: second };
      }
    }

    leave();
    return base;
  };

  const parsePostfix = (): MathAstNode | null => {
    if (!enter()) return null;
    let node = parsePrimary();
    if (!node) {
      leave();
      return null;
    }

    while (true) {
      const tok = peek();
      if (tok && tok.kind === "op" && tok.value === "!") {
        consume();
        node = { kind: "postfix", op: "!", operand: node };
      } else if (tok && tok.kind === "prime") {
        consume();
        node = { kind: "postfix", op: "'", operand: node };
      } else {
        break;
      }
    }

    leave();
    return node;
  };

  const parsePrimary = (): MathAstNode | null => {
    if (!enter()) return null;
    const tok = peek();
    if (!tok) {
      leave();
      return null;
    }

    if (tok.kind === "number") {
      consume();
      leave();
      return { kind: "number", value: tok.value };
    }

    if (tok.kind === "ellipsis") {
      consume();
      leave();
      return { kind: "ellipsis" };
    }

    if (tok.kind === "sqrt") {
      consume();
      const operand = parsePrimary();
      if (!operand) {
        leave();
        return null;
      }
      leave();
      return { kind: "sqrt", operand };
    }

    if (tok.kind === "ident") {
      if (!isValidMathIdentifier(tok.value)) {
        leave();
        return null;
      }
      consume();

      // Count optional primes right before a function call (e.g. `f'(x)`, `ζ'(s)`)
      let primes = 0;
      const savedPos = pos;
      while (peek()?.kind === "prime") {
        consume();
        primes += 1;
      }

      const isKnownFn = hasOwn(KNOWN_FUNCTIONS, tok.value);
      const isKnownSym =
        hasOwn(KNOWN_SYMBOLS, tok.value) ||
        hasOwn(UNICODE_GREEK_SYMBOLS, tok.value);
      const canBeCall =
        (isKnownFn || isKnownSym || tok.value.length === 1) &&
        !BIG_OP_NAMES.has(tok.value) &&
        peek()?.kind === "lparen";

      if (canBeCall) {
        consume(); // '('
        const args: MathAstNode[] = [];
        if (peek()?.kind !== "rparen") {
          while (true) {
            const arg = parseRelation();
            if (!arg) {
              leave();
              return null;
            }
            args.push(arg);
            if (peek()?.kind === "comma") {
              consume();
            } else {
              break;
            }
          }
        }
        if (peek()?.kind !== "rparen" || args.length === 0) {
          leave();
          return null;
        }
        consume(); // ')'
        leave();
        return { kind: "call", callee: tok.value, primes, args };
      }

      // If no `(` followed primes, restore position so `parsePostfix` handles `y'`
      pos = savedPos;
      leave();
      return { kind: "ident", name: tok.value };
    }

    if (tok.kind === "lparen" || tok.kind === "lbracket") {
      const openBracket = tok.kind === "lparen" ? "(" : "[";
      const closeKind = tok.kind === "lparen" ? "rparen" : "rbracket";
      consume();
      const expr = parseRelation();
      if (!expr || peek()?.kind !== closeKind) {
        leave();
        return null;
      }
      consume();
      leave();
      return { kind: "group", bracket: openBracket, expr };
    }

    if (tok.kind === "pipe") {
      consume();
      const expr = parseAdditive();
      if (!expr || peek()?.kind !== "pipe") {
        leave();
        return null;
      }
      consume();
      leave();
      return { kind: "abs", expr };
    }

    leave();
    return null;
  };

  const ast = parseRelation();
  if (!ast || pos !== tokens.length) {
    return null;
  }

  return ast;
}

function unwrapGroup(node: MathAstNode): MathAstNode {
  let current = node;
  while (
    current.kind === "group" &&
    (current.bracket === "(" || current.bracket === "{")
  ) {
    current = current.expr;
  }
  return current;
}

function containsTallConstruct(node: MathAstNode): boolean {
  switch (node.kind) {
    case "binary":
      return (
        node.op === "/" ||
        containsTallConstruct(node.left) ||
        containsTallConstruct(node.right)
      );
    case "unary":
    case "postfix":
      return containsTallConstruct(node.operand);
    case "sqrt":
      return true;
    case "group":
    case "abs":
      return containsTallConstruct(node.expr);
    case "call":
      return (
        node.callee === "sqrt" ||
        node.callee === "root" ||
        node.args.some(containsTallConstruct)
      );
    default:
      return false;
  }
}

function wrapBracesIfNeeded(rendered: string): string {
  return rendered.length === 1 ? rendered : `{${rendered}}`;
}

/**
 * Phase 3: LaTeX Code Generator.
 * Walks the AST and emits clean, idiomatic LaTeX (unwrapping redundant outer
 * parentheses inside `\frac`, `\sqrt`, exponents, and subscripts).
 */
export function emitLatexFromAst(node: MathAstNode): string {
  switch (node.kind) {
    case "number":
      return node.value;

    case "ellipsis":
      return "\\cdots";

    case "ident":
      if (hasOwn(UNICODE_GREEK_SYMBOLS, node.name)) {
        return UNICODE_GREEK_SYMBOLS[node.name];
      }
      if (hasOwn(UNICODE_MATH_SYMBOLS, node.name)) {
        return UNICODE_MATH_SYMBOLS[node.name];
      }
      if (hasOwn(KNOWN_SYMBOLS, node.name)) {
        return KNOWN_SYMBOLS[node.name];
      }
      if (hasOwn(KNOWN_FUNCTIONS, node.name)) {
        const fn = KNOWN_FUNCTIONS[node.name];
        return fn === "abs" ? "abs" : fn;
      }
      return node.name;

    case "sqrt":
      return `\\sqrt{${emitLatexFromAst(unwrapGroup(node.operand))}}`;

    case "unary": {
      const inner = emitLatexFromAst(node.operand);
      if (node.op === "+-") return `\\pm ${inner}`;
      if (node.op === "-+") return `\\mp ${inner}`;
      if (node.op === "∀") return `\\forall ${inner}`;
      if (node.op === "∃") return `\\exists ${inner}`;
      if (node.op === "¬") return `\\neg ${inner}`;
      return `${node.op}${inner}`;
    }

    case "postfix": {
      const inner = emitLatexFromAst(node.operand);
      return `${inner}${node.op}`;
    }

    case "group": {
      const inner = emitLatexFromAst(node.expr);
      if (node.bracket === "{") {
        return `{${inner}}`;
      }
      const tall = containsTallConstruct(node.expr);
      if (node.bracket === "(") {
        return tall ? `\\left(${inner}\\right)` : `(${inner})`;
      }
      return tall ? `\\left[${inner}\\right]` : `[${inner}]`;
    }

    case "abs": {
      const inner = emitLatexFromAst(node.expr);
      return `\\left|${inner}\\right|`;
    }

    case "call": {
      const primeStr = "'".repeat(node.primes);
      if (node.callee === "sqrt") {
        const radicand = emitLatexFromAst(unwrapGroup(node.args[0]));
        if (node.args.length === 2) {
          const degree = emitLatexFromAst(unwrapGroup(node.args[1]));
          return `\\sqrt[${degree}]{${radicand}}`;
        }
        return `\\sqrt{${radicand}}`;
      }
      if (node.callee === "root" && node.args.length === 2) {
        const degree = emitLatexFromAst(unwrapGroup(node.args[0]));
        const radicand = emitLatexFromAst(unwrapGroup(node.args[1]));
        return `\\sqrt[${degree}]{${radicand}}`;
      }
      if (node.callee === "abs" && node.args.length === 1) {
        return `\\left|${emitLatexFromAst(unwrapGroup(node.args[0]))}\\right|`;
      }

      const renderedArgs = node.args
        .map((arg) => (arg.kind === "ellipsis" ? "\\ldots" : emitLatexFromAst(arg)))
        .join(", ");
      const tall = node.args.some(containsTallConstruct);
      const parens = tall ? `\\left(${renderedArgs}\\right)` : `(${renderedArgs})`;

      if (hasOwn(KNOWN_FUNCTIONS, node.callee)) {
        return `${KNOWN_FUNCTIONS[node.callee]}${primeStr}${parens}`;
      }
      if (hasOwn(UNICODE_GREEK_SYMBOLS, node.callee)) {
        return `${UNICODE_GREEK_SYMBOLS[node.callee]}${primeStr}${parens}`;
      }
      if (hasOwn(KNOWN_SYMBOLS, node.callee)) {
        return `${KNOWN_SYMBOLS[node.callee]}${primeStr}${parens}`;
      }
      return `${node.callee}${primeStr}${parens}`;
    }

    case "binary": {
      if (node.op === "/") {
        const num = emitLatexFromAst(unwrapGroup(node.left));
        const den = emitLatexFromAst(unwrapGroup(node.right));
        return `\\frac{${num}}{${den}}`;
      }

      if (node.op === "^" || node.op === "_") {
        const base = emitLatexFromAst(node.left);
        const script = emitLatexFromAst(unwrapGroup(node.right));
        return `${base}${node.op}${wrapBracesIfNeeded(script)}`;
      }

      if (node.op === "*" && node.implicit) {
        const left = emitLatexFromAst(node.left);
        const right = emitLatexFromAst(node.right);
        if (isBigOpNode(node.left)) {
          return `${left} ${right}`;
        }
        if (node.right.kind === "ident" && DIFFERENTIALS.has(node.right.name)) {
          return `${left}\\,${right}`;
        }
        // Add space between a backslash command (e.g. `\pi`) and a following letter
        const needsSpace = /\\[a-zA-Z]+$/.test(left) && /^[a-zA-Z]/.test(right);
        return needsSpace ? `${left} ${right}` : `${left}${right}`;
      }

      const left = emitLatexFromAst(node.left);
      const right = emitLatexFromAst(node.right);
      const opLatex = LATEX_OPS[node.op] ?? node.op;
      return `${left} ${opLatex} ${right}`;
    }
  }
}

interface AstSignals {
  hasRelation: boolean;
  hasStrictUnicodeRelation: boolean;
  hasArrowRelation: boolean;
  hasKnownFunction: boolean;
  hasStrongKnownFunction: boolean;
  hasUserCall: boolean;
  hasGreekCall: boolean;
  hasAsciiPowerOrSub: boolean;
  hasUnicodeScript: boolean;
  hasPowerOrSub: boolean;
  hasDivision: boolean;
  hasComplexDivision: boolean;
  hasArithmetic: boolean;
  hasExplicitArithmetic: boolean;
  hasIdentifier: boolean;
  hasUnicodeSymbol: boolean;
  hasSqrtSymbol: boolean;
  hasBigOp: boolean;
  hasEllipsis: boolean;
  hasGroupOrAbs: boolean;
  nodeCount: number;
}

function isSimpleAtom(node: MathAstNode): boolean {
  return node.kind === "number" || node.kind === "ident";
}

function collectAstSignals(node: MathAstNode): AstSignals {
  const s: AstSignals = {
    hasRelation: false,
    hasStrictUnicodeRelation: false,
    hasArrowRelation: false,
    hasKnownFunction: false,
    hasStrongKnownFunction: false,
    hasUserCall: false,
    hasGreekCall: false,
    hasAsciiPowerOrSub: false,
    hasUnicodeScript: false,
    hasPowerOrSub: false,
    hasDivision: false,
    hasComplexDivision: false,
    hasArithmetic: false,
    hasExplicitArithmetic: false,
    hasIdentifier: false,
    hasUnicodeSymbol: false,
    hasSqrtSymbol: false,
    hasBigOp: false,
    hasEllipsis: false,
    hasGroupOrAbs: false,
    nodeCount: 0,
  };

  const walk = (n: MathAstNode): void => {
    s.nodeCount += 1;
    switch (n.kind) {
      case "ellipsis":
        s.hasEllipsis = true;
        break;
      case "sqrt":
        s.hasSqrtSymbol = true;
        s.hasUnicodeSymbol = true;
        walk(n.operand);
        break;
      case "ident":
        s.hasIdentifier = true;
        if (
          hasOwn(UNICODE_GREEK_SYMBOLS, n.name) ||
          hasOwn(UNICODE_MATH_SYMBOLS, n.name)
        ) {
          s.hasUnicodeSymbol = true;
        }
        if (BIG_OP_NAMES.has(n.name)) {
          s.hasBigOp = true;
        }
        break;
      case "unary":
        if (n.op === "∀" || n.op === "∃" || n.op === "¬") {
          s.hasUnicodeSymbol = true;
        }
        walk(n.operand);
        break;
      case "postfix":
        walk(n.operand);
        break;
      case "group":
        if (n.bracket === "(" || n.bracket === "[") {
          s.hasGroupOrAbs = true;
        }
        walk(n.expr);
        break;
      case "abs":
        s.hasGroupOrAbs = true;
        walk(n.expr);
        break;
      case "call":
        if (hasOwn(KNOWN_FUNCTIONS, n.callee)) {
          s.hasKnownFunction = true;
          if (STRONG_FEED_FUNCTIONS.has(n.callee)) {
            s.hasStrongKnownFunction = true;
          }
        } else {
          s.hasUserCall = true;
          if (hasOwn(UNICODE_GREEK_SYMBOLS, n.callee)) {
            s.hasGreekCall = true;
            s.hasUnicodeSymbol = true;
          }
        }
        s.hasIdentifier = true;
        for (const arg of n.args) walk(arg);
        break;
      case "binary":
        if (RELATION_OPS.has(n.op)) {
          s.hasRelation = true;
          if (STRICT_UNICODE_RELATIONS.has(n.op)) {
            s.hasStrictUnicodeRelation = true;
          }
          if (ARROW_RELATIONS.has(n.op)) {
            s.hasArrowRelation = true;
          }
        } else if (n.op === "^" || n.op === "_") {
          s.hasPowerOrSub = true;
          if (n.unicodeScript) {
            s.hasUnicodeScript = true;
          } else {
            s.hasAsciiPowerOrSub = true;
          }
        } else if (n.op === "/") {
          s.hasDivision = true;
          if (!isSimpleAtom(n.left) || !isSimpleAtom(n.right)) {
            s.hasComplexDivision = true;
          }
        } else {
          s.hasArithmetic = true;
          if (!n.implicit) {
            s.hasExplicitArithmetic = true;
          }
        }
        walk(n.left);
        walk(n.right);
        break;
    }
  };

  walk(node);
  return s;
}

/**
 * High-precision filter for composer drafts (`f(x) = 5x + 2`, `sqrt(a^2 + b^2)`,
 * `(a+b)/(c-d)`, `x^2 - 1 = 0`, `ζ(s) = ...`) rejecting everyday text, dates,
 * scores, and ratios.
 */
function isHighPrecisionComposerMath(ast: MathAstNode): boolean {
  const s = collectAstSignals(ast);

  // Single atom (`x`, `42`) is never worth converting on its own
  if (s.nodeCount < 2) return false;

  // Reject pure numeric dates/scores/ratios/resolutions (`24/7`, `10/10`, `23/11/2026`, `3 - 2`, `1920 × 1080`)
  if (
    !s.hasIdentifier &&
    !s.hasRelation &&
    !s.hasPowerOrSub &&
    !s.hasUnicodeSymbol &&
    !s.hasSqrtSymbol
  ) {
    return false;
  }

  // 1. Known math function call, big operator, or Unicode root (`sqrt(...)`, `sin(...)`, `√2`, `∑ ...`)
  if (s.hasKnownFunction || s.hasBigOp || s.hasSqrtSymbol || s.hasGreekCall) {
    return true;
  }

  // 2. Function definition or algebraic equation (`f(x) = 5x + 2`, `x^2 = 4`, `x >= 0`, `∀x ∈ ℝ`)
  if (
    s.hasRelation &&
    (s.hasUserCall ||
      s.hasArithmetic ||
      s.hasDivision ||
      s.hasPowerOrSub ||
      s.hasIdentifier ||
      s.hasUnicodeSymbol ||
      s.hasEllipsis)
  ) {
    return true;
  }

  // 3. Explicit exponent or subscript with identifier (`x^2`, `e^(-x^2)`, `a_n`)
  if (s.hasPowerOrSub && s.hasIdentifier) return true;

  // 4. Algebraic fraction (`(a + b)/(c + d)`, `1/(x + 1)`, `dy/dx`)
  if (s.hasDivision && (s.hasIdentifier || s.hasGroupOrAbs)) return true;

  // 5. Unicode math symbol combined with math structure (`π + 1`, `α · β`, `2πr`)
  if (s.hasUnicodeSymbol && (s.hasArithmetic || s.hasGroupOrAbs)) return true;

  return false;
}

/**
 * Stricter high-precision filter for feed posts on x.com:
 * Recognizes rich Unicode & plain-math formulas while rejecting prose slash
 * abbreviations (`A/B`, `I/O`, `w/o`, `UI/UX`, `f/1.8`), everyday units
 * (`m²`, `km²`, `CO₂`, `H₂O`), screen resolutions (`1920 × 1080`), prose arrows
 * (`A → B`), and trivial shorthand (`A = B`).
 */
function isHighPrecisionFeedMath(ast: MathAstNode): boolean {
  const s = collectAstSignals(ast);

  if (s.nodeCount < 2) return false;

  if (
    !s.hasIdentifier &&
    !s.hasRelation &&
    !s.hasPowerOrSub &&
    !s.hasUnicodeSymbol &&
    !s.hasSqrtSymbol
  ) {
    return false;
  }

  // 1. Big operators (`∑`, `∏`, `∫`, `∮`, `lim`) or square root symbol (`√`)
  if (s.hasBigOp || s.hasSqrtSymbol) return true;

  // 2. Unambiguous math function calls (`sin`, `cos`, `sqrt`, `ln`, `log`, `exp`, ...)
  if (s.hasStrongKnownFunction) return true;

  // 3. Context-sensitive math functions (`Re`, `Im`, `det`, `max`, `min`, `abs`, ...) with math structure
  if (
    s.hasKnownFunction &&
    (s.hasRelation ||
      s.hasExplicitArithmetic ||
      s.hasPowerOrSub ||
      s.hasDivision ||
      s.hasUnicodeSymbol)
  ) {
    return true;
  }

  // 4. Unicode Greek function calls (`ζ(s)`, `Γ(n)`, `φ(n)`)
  if (s.hasGreekCall) return true;

  // 5. Strict Unicode math relations (`≤`, `≥`, `≠`, `≈`, `≡`, `∈`, `∉`, `⊂`, `⊆`, ...)
  if (s.hasStrictUnicodeRelation && (s.hasIdentifier || s.hasUnicodeSymbol)) {
    return true;
  }

  // 6. Unicode math symbol (`π`, `ζ`, `∞`, `ℝ`, `∀`, `∇`, ...) with math structure
  if (
    s.hasUnicodeSymbol &&
    (s.hasRelation ||
      s.hasArithmetic ||
      s.hasDivision ||
      s.hasPowerOrSub ||
      s.hasGroupOrAbs)
  ) {
    return true;
  }

  // 7. Equations and function definitions (excluding bare `A = B`, `x = 1`, or prose `A → B`)
  if (
    s.hasRelation &&
    (s.hasUserCall ||
      s.hasPowerOrSub ||
      s.hasComplexDivision ||
      s.hasEllipsis ||
      (s.hasArithmetic && s.nodeCount >= 4 && !s.hasArrowRelation) ||
      (s.hasArithmetic && s.nodeCount >= 5))
  ) {
    return true;
  }

  // 8. Complex algebraic fractions (`(a + b)/(c - d)`, `1/(x + 1)`, `1/2^s`)
  if (s.hasComplexDivision && (s.hasIdentifier || s.hasPowerOrSub)) {
    return true;
  }

  // 9. ASCII exponent/subscript with identifier and structure (`e^(-x^2)`, `x^2 + 1`, `a_(n+1)`)
  if (
    s.hasAsciiPowerOrSub &&
    s.hasIdentifier &&
    (s.hasExplicitArithmetic ||
      s.hasDivision ||
      s.hasRelation ||
      s.hasGroupOrAbs ||
      s.nodeCount >= 4)
  ) {
    return true;
  }

  // 10. Unicode script (`²`, `³`, `ⁿ`) combined with explicit arithmetic or complex division (`x² + y²`, `x² - 1`)
  if (
    s.hasUnicodeScript &&
    s.hasIdentifier &&
    (s.hasExplicitArithmetic || s.hasComplexDivision) &&
    s.nodeCount >= 4
  ) {
    return true;
  }

  return false;
}

/**
 * Full single-expression compiler: plain-math / Unicode-math string -> `{ latex, ast }` or `null`.
 */
export function compilePlainMathToLatex(
  expression: string,
  options?: PlainMathOptions
): { latex: string; ast: MathAstNode } | null {
  const trimmed = expression.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_PLAIN_MATH_INPUT_LENGTH) {
    return null;
  }
  const mode = options?.mode ?? "composer";
  // Allow 2-char Unicode root (`√2`, `√x`); otherwise require length >= 3
  if (trimmed.length < 3 && !trimmed.startsWith("√")) return null;

  const tokens = tokenizePlainMath(trimmed);
  if (!tokens || tokens.length < 2) return null;

  const ast = parsePlainMathToAst(tokens);
  if (!ast) return null;

  const passesPrecision =
    mode === "feed"
      ? isHighPrecisionFeedMath(ast)
      : isHighPrecisionComposerMath(ast);
  if (!passesPrecision) return null;

  const latex = emitLatexFromAst(ast);
  if (!validateLatex(latex).ok) return null;

  return { latex, ast };
}

function chooseDisplayMode(
  latex: string,
  isStandaloneLine: boolean
): MathDisplayMode {
  if (
    isStandaloneLine &&
    (latex.includes("\\frac") ||
      latex.includes("\\sum") ||
      latex.includes("\\int") ||
      latex.includes("\\prod") ||
      latex.length >= 24)
  ) {
    return "display";
  }
  return "inline";
}

function buildSuggestion(
  raw: string,
  replaceStart: number,
  replaceEnd: number,
  isStandaloneLine: boolean,
  compiled: { latex: string; ast: MathAstNode }
): PlainMathSuggestion {
  const mode = chooseDisplayMode(compiled.latex, isStandaloneLine);
  const wrappedLatex =
    mode === "display" ? `$$${compiled.latex}$$` : `\\(${compiled.latex}\\)`;

  return {
    raw,
    latex: compiled.latex,
    wrappedLatex,
    mode,
    replaceStart,
    replaceEnd,
    ast: compiled.ast,
  };
}

interface PositionedToken {
  token: MathToken;
  start: number;
  end: number;
  hadLeadingSpace: boolean;
}

const SKIP_PATTERN = /https?:\/\/\S+|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+/g;

function endsAtom(tok: MathToken): boolean {
  return (
    tok.kind === "number" ||
    tok.kind === "ident" ||
    tok.kind === "rparen" ||
    tok.kind === "rbracket" ||
    tok.kind === "rbrace" ||
    tok.kind === "prime" ||
    tok.kind === "ellipsis" ||
    (tok.kind === "op" && tok.value === "!")
  );
}

function startsAtom(tok: MathToken): boolean {
  return (
    tok.kind === "number" ||
    tok.kind === "ident" ||
    tok.kind === "lparen" ||
    tok.kind === "lbracket" ||
    tok.kind === "pipe" ||
    tok.kind === "sqrt"
  );
}

function canJoinAcrossWhitespace(
  prev: MathToken,
  next: MathToken,
  run: readonly PositionedToken[]
): boolean {
  // Join differentials across whitespace (e.g. `e^(-x²) dx`, `x^2 dx`)
  if (next.kind === "ident" && DIFFERENTIALS.has(next.value)) {
    return true;
  }

  // Allow space-separated implicit multiplication with Greek/Unicode symbols or math functions
  // (e.g., `lambda v`, `pi r`, `2 pi`, `sin x`, `∑ 1/n²`, `∫ f(x) dx`)
  if (prev.kind === "ident") {
    if (BIG_OP_NAMES.has(prev.value)) {
      return true;
    }
    if (
      hasOwn(KNOWN_SYMBOLS, prev.value) ||
      hasOwn(UNICODE_GREEK_SYMBOLS, prev.value) ||
      hasOwn(UNICODE_MATH_SYMBOLS, prev.value)
    ) {
      return (
        next.kind === "ident" ||
        next.kind === "number" ||
        next.kind === "lparen" ||
        next.kind === "sqrt"
      );
    }
    if (hasOwn(KNOWN_FUNCTIONS, prev.value)) {
      return (
        next.kind === "lparen" ||
        next.kind === "ident" ||
        next.kind === "number" ||
        next.kind === "sqrt"
      );
    }
  }

  if (
    prev.kind === "number" &&
    next.kind === "ident" &&
    (hasOwn(KNOWN_SYMBOLS, next.value) ||
      hasOwn(UNICODE_GREEK_SYMBOLS, next.value) ||
      hasOwn(UNICODE_MATH_SYMBOLS, next.value))
  ) {
    return true;
  }

  // Join after a big operator with subscript/superscript limits (e.g. `∫_0^1 x² dx`, `lim_(x→0) sin(x)/x`)
  if (isRunEndingInBigOpLimits(run)) {
    return true;
  }

  return false;
}

/**
 * Checks whether the current token run ends right after a big operator
 * (`∑`, `∏`, `∫`, `∮`, `lim`) plus one or two `_` / `^` limit clauses.
 */
function isRunEndingInBigOpLimits(run: readonly PositionedToken[]): boolean {
  let idx = run.length - 1;
  let scriptsSeen = 0;

  while (idx >= 0 && scriptsSeen < 2) {
    const t = run[idx].token;
    if (t.kind === "rparen" || t.kind === "rbrace" || t.kind === "rbracket") {
      const openKind =
        t.kind === "rparen"
          ? "lparen"
          : t.kind === "rbrace"
            ? "lbrace"
            : "lbracket";
      let depth = 1;
      idx -= 1;
      while (idx >= 0 && depth > 0) {
        if (run[idx].token.kind === t.kind) depth += 1;
        else if (run[idx].token.kind === openKind) depth -= 1;
        idx -= 1;
      }
      if (depth !== 0) return false;
    } else if (t.kind === "number" || t.kind === "ident") {
      idx -= 1;
    } else {
      break;
    }

    // Optional unary minus/plus before script atom (e.g. `∫_-1^1`)
    const unaryTok = idx >= 0 ? run[idx].token : undefined;
    if (
      unaryTok &&
      unaryTok.kind === "op" &&
      (unaryTok.value === "-" || unaryTok.value === "+")
    ) {
      idx -= 1;
    }

    const scriptTok = idx >= 0 ? run[idx].token : undefined;
    if (
      scriptTok &&
      scriptTok.kind === "op" &&
      (scriptTok.value === "_" || scriptTok.value === "^")
    ) {
      scriptsSeen += 1;
      idx -= 1;
    } else {
      return false;
    }
  }

  if (scriptsSeen === 0 || idx < 0) return false;
  const base = run[idx].token;
  return base.kind === "ident" && BIG_OP_NAMES.has(base.value);
}

function scanChunkForPlainMath(
  chunk: string,
  baseOffset: number,
  results: PlainMathSuggestion[],
  mode: PlainMathDetectionMode
): void {
  // Mask URLs, @mentions, and #hashtags so they act as hard prose boundaries
  const skipRanges: Array<[number, number]> = [];
  SKIP_PATTERN.lastIndex = 0;
  let skipMatch: RegExpExecArray | null;
  while ((skipMatch = SKIP_PATTERN.exec(chunk)) !== null) {
    skipRanges.push([skipMatch.index, skipMatch.index + skipMatch[0].length]);
  }
  let skipIdx = 0;

  let i = 0;
  let parenDepth = 0;
  let run: PositionedToken[] = [];

  const flushRun = (): void => {
    if (run.length < 2) {
      run = [];
      parenDepth = 0;
      return;
    }

    let startIdx = 0;
    let endIdx = run.length;

    // Repeatedly trim stray boundary punctuation, dangling operators, stray ellipsis,
    // and unmatched outer parens/brackets (e.g. prose like `(where Re(s)>0)`).
    let trimmed = true;
    while (trimmed && startIdx < endIdx) {
      trimmed = false;

      // Trim trailing stray openers, operators, or unattached ellipsis
      while (endIdx > startIdx) {
        const last = run[endIdx - 1].token;
        if (
          last.kind === "lparen" ||
          last.kind === "lbracket" ||
          last.kind === "lbrace" ||
          last.kind === "comma" ||
          last.kind === "sqrt" ||
          (last.kind === "op" && last.value !== "!")
        ) {
          endIdx -= 1;
          trimmed = true;
        } else if (last.kind === "ellipsis") {
          const prev = endIdx - 2 >= startIdx ? run[endIdx - 2].token : null;
          const attached =
            prev !== null && (prev.kind === "op" || prev.kind === "comma");
          if (!attached) {
            endIdx -= 1;
            trimmed = true;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Trim leading stray closers, binary operators, or leading ellipsis
      while (startIdx < endIdx) {
        const first = run[startIdx].token;
        if (
          first.kind === "rparen" ||
          first.kind === "rbracket" ||
          first.kind === "rbrace" ||
          first.kind === "comma" ||
          first.kind === "ellipsis" ||
          (first.kind === "op" && !UNARY_OPS.has(first.value))
        ) {
          startIdx += 1;
          trimmed = true;
        } else {
          break;
        }
      }

      // Balance unmatched outer `(` / `)` or `[` / `]` from prose parentheses
      let openParens = 0;
      let closeParens = 0;
      let openBrackets = 0;
      let closeBrackets = 0;
      for (let k = startIdx; k < endIdx; k++) {
        const kind = run[k].token.kind;
        if (kind === "lparen") openParens += 1;
        else if (kind === "rparen") closeParens += 1;
        else if (kind === "lbracket") openBrackets += 1;
        else if (kind === "rbracket") closeBrackets += 1;
      }

      if (
        closeParens > openParens &&
        endIdx > startIdx &&
        run[endIdx - 1].token.kind === "rparen"
      ) {
        endIdx -= 1;
        trimmed = true;
      } else if (
        openParens > closeParens &&
        startIdx < endIdx &&
        run[startIdx].token.kind === "lparen"
      ) {
        startIdx += 1;
        trimmed = true;
      } else if (
        closeBrackets > openBrackets &&
        endIdx > startIdx &&
        run[endIdx - 1].token.kind === "rbracket"
      ) {
        endIdx -= 1;
        trimmed = true;
      } else if (
        openBrackets > closeBrackets &&
        startIdx < endIdx &&
        run[startIdx].token.kind === "lbracket"
      ) {
        startIdx += 1;
        trimmed = true;
      }
    }

    if (endIdx - startIdx >= 2) {
      const spanStart = run[startIdx].start;
      const spanEnd = run[endIdx - 1].end;
      const raw = chunk.slice(spanStart, spanEnd);
      const compiled = compilePlainMathToLatex(raw, { mode });
      if (compiled) {
        const lineStart = chunk.lastIndexOf("\n", spanStart - 1) + 1;
        const nextNl = chunk.indexOf("\n", spanEnd);
        const lineEnd = nextNl === -1 ? chunk.length : nextNl;
        const isStandaloneLine =
          chunk.slice(lineStart, spanStart).trim().length === 0 &&
          chunk.slice(spanEnd, lineEnd).trim().length === 0;

        results.push(
          buildSuggestion(
            raw,
            baseOffset + spanStart,
            baseOffset + spanEnd,
            isStandaloneLine,
            compiled
          )
        );
      }
    }

    run = [];
    parenDepth = 0;
  };

  let hadLeadingSpace = false;

  while (i < chunk.length) {
    while (skipIdx < skipRanges.length && skipRanges[skipIdx][1] <= i) {
      skipIdx += 1;
    }
    if (skipIdx < skipRanges.length && i >= skipRanges[skipIdx][0]) {
      flushRun();
      i = skipRanges[skipIdx][1];
      hadLeadingSpace = true;
      continue;
    }

    const ch = chunk[i];

    if (ch === "\n" || ch === "\r") {
      flushRun();
      i += 1;
      hadLeadingSpace = true;
      continue;
    }

    if (ch === " " || ch === "\t") {
      hadLeadingSpace = true;
      i += 1;
      continue;
    }

    // Read one or more positioned tokens (Unicode scripts expand to multiple tokens)
    let readTokens: MathToken[] | null = null;
    let tokEnd = i + 1;

    if (chunk.startsWith("...", i)) {
      readTokens = [{ kind: "ellipsis" }];
      tokEnd = i + 3;
    } else if (ch === "…" || ch === "⋯") {
      readTokens = [{ kind: "ellipsis" }];
      tokEnd = i + 1;
    } else if (isAsciiDigit(ch)) {
      let j = i + 1;
      let sawDot = false;
      while (j < chunk.length) {
        if (isAsciiDigit(chunk[j])) {
          j += 1;
        } else if (
          chunk[j] === "." &&
          !sawDot &&
          j + 1 < chunk.length &&
          isAsciiDigit(chunk[j + 1])
        ) {
          sawDot = true;
          j += 1;
        } else {
          break;
        }
      }
      readTokens = [{ kind: "number", value: chunk.slice(i, j) }];
      tokEnd = j;
    } else if (isAsciiLetter(ch)) {
      let j = i + 1;
      while (j < chunk.length && isAsciiLetter(chunk[j])) {
        j += 1;
      }
      const word = chunk.slice(i, j);
      if (!isValidMathIdentifier(word)) {
        flushRun();
        i = j;
        hadLeadingSpace = false;
        continue;
      }
      readTokens = [{ kind: "ident", value: word }];
      tokEnd = j;
    } else if (isGreekBlockChar(ch)) {
      let j = i + 1;
      while (j < chunk.length && isGreekBlockChar(chunk[j])) {
        j += 1;
      }
      if (j - i !== 1 || !hasOwn(UNICODE_GREEK_SYMBOLS, ch)) {
        flushRun();
        i = j;
        hadLeadingSpace = false;
        continue;
      }
      readTokens = [{ kind: "ident", value: ch }];
      tokEnd = j;
    } else if (hasOwn(UNICODE_MATH_SYMBOLS, ch)) {
      readTokens = [{ kind: "ident", value: ch }];
      tokEnd = i + 1;
    } else if (ch === "√") {
      readTokens = [{ kind: "sqrt" }];
      tokEnd = i + 1;
    } else if (ch === "′") {
      readTokens = [{ kind: "prime" }];
      tokEnd = i + 1;
    } else if (ch === "″") {
      readTokens = [{ kind: "prime" }, { kind: "prime" }];
      tokEnd = i + 1;
    } else if (
      hasOwn(UNICODE_SUPERSCRIPT_MAP, ch) ||
      hasOwn(UNICODE_SUBSCRIPT_MAP, ch)
    ) {
      const script = readUnicodeScript(chunk, i);
      if (!script) {
        flushRun();
        i += 1;
        hadLeadingSpace = false;
        continue;
      }
      readTokens = script.tokens;
      tokEnd = script.end;
    } else if (hasOwn(UNICODE_OP_MAP, ch)) {
      readTokens = [{ kind: "op", value: UNICODE_OP_MAP[ch] }];
      tokEnd = i + 1;
    } else {
      let matchedMulti: string | null = null;
      for (const op of MULTI_CHAR_OPS) {
        if (chunk.startsWith(op, i)) {
          matchedMulti = op;
          break;
        }
      }
      if (matchedMulti !== null) {
        readTokens = [{ kind: "op", value: matchedMulti }];
        tokEnd = i + matchedMulti.length;
      } else {
        switch (ch) {
          case "(":
            readTokens = [{ kind: "lparen" }];
            break;
          case ")":
            readTokens = [{ kind: "rparen" }];
            break;
          case "[":
            readTokens = [{ kind: "lbracket" }];
            break;
          case "]":
            readTokens = [{ kind: "rbracket" }];
            break;
          case "{": {
            // Only accept `{` right after `^` or `_` for script grouping (e.g. `e^{iπ}`, `∑_{n=1}^∞`)
            const prevTok = run.length > 0 ? run[run.length - 1].token : null;
            if (
              prevTok &&
              prevTok.kind === "op" &&
              (prevTok.value === "^" || prevTok.value === "_")
            ) {
              readTokens = [{ kind: "lbrace" }];
            } else {
              flushRun();
              i += 1;
              hadLeadingSpace = false;
              continue;
            }
            break;
          }
          case "}":
            if (parenDepth === 0) {
              flushRun();
              i += 1;
              hadLeadingSpace = false;
              continue;
            }
            readTokens = [{ kind: "rbrace" }];
            break;
          case ",":
            if (parenDepth === 0) {
              flushRun();
              i += 1;
              hadLeadingSpace = false;
              continue;
            }
            readTokens = [{ kind: "comma" }];
            break;
          case "|":
            readTokens = [{ kind: "pipe" }];
            break;
          case "'":
            readTokens = [{ kind: "prime" }];
            break;
          case "+":
          case "-":
          case "*":
          case "/":
          case "^":
          case "_":
          case "=":
          case "<":
          case ">":
          case "!":
            readTokens = [{ kind: "op", value: ch }];
            break;
          default:
            flushRun();
            i += 1;
            hadLeadingSpace = false;
            continue;
        }
      }
    }

    const firstTok = readTokens[0];

    // Split between two whitespace-separated atoms at top level (e.g. `f(x) = 5x + 2 y g(x) = 3`)
    if (
      run.length > 0 &&
      parenDepth === 0 &&
      hadLeadingSpace &&
      endsAtom(run[run.length - 1].token) &&
      startsAtom(firstTok) &&
      !canJoinAcrossWhitespace(run[run.length - 1].token, firstTok, run)
    ) {
      flushRun();
    }

    for (let tIdx = 0; tIdx < readTokens.length; tIdx++) {
      const tok = readTokens[tIdx];
      if (
        tok.kind === "lparen" ||
        tok.kind === "lbracket" ||
        tok.kind === "lbrace"
      ) {
        parenDepth += 1;
      } else if (
        tok.kind === "rparen" ||
        tok.kind === "rbracket" ||
        tok.kind === "rbrace"
      ) {
        parenDepth = Math.max(0, parenDepth - 1);
      }

      run.push({
        token: tok,
        start: i,
        end: tokEnd,
        hadLeadingSpace: tIdx === 0 ? hadLeadingSpace : false,
      });
    }

    hadLeadingSpace = false;
    i = tokEnd;
  }

  flushRun();
}

/**
 * Scans text and extracts ALL high-confidence plain-math / Unicode-math
 * expressions in left-to-right order (including multiple expressions inside prose
 * and expressions followed by trailing text), while leaving already-delimited
 * LaTeX blocks untouched.
 */
export function detectPlainMathExpressions(
  text: string,
  options?: PlainMathOptions
): PlainMathSuggestion[] {
  if (!mightContainPlainMath(text)) return [];

  const mode = options?.mode ?? "composer";
  const segments = parseMathSegments(text);
  const results: PlainMathSuggestion[] = [];
  let offset = 0;

  for (const seg of segments) {
    if (seg.type === "math") {
      offset += seg.raw.length;
      continue;
    }

    // Skip text chunks that contain raw LaTeX backslashes or unclosed `$$` delimiters
    if (!seg.content.includes("\\") && !seg.content.includes("$$")) {
      scanChunkForPlainMath(seg.content, offset, results, mode);
    }
    offset += seg.content.length;
  }

  return results;
}

/**
 * Convenience wrapper returning the first detected plain-math expression in `text`,
 * or `null` if none is found.
 */
export function detectPlainMathInDraft(
  text: string,
  options?: PlainMathOptions
): PlainMathSuggestion | null {
  const all = detectPlainMathExpressions(text, options);
  return all.length > 0 ? all[0] : null;
}

/**
 * Atomically replaces every detected plain-math span in `text` with its compiled
 * delimited LaTeX (`\(...\)` or `$$...$$`), preserving all surrounding prose verbatim.
 */
export function applyPlainMathConversions(
  text: string,
  matches: readonly PlainMathSuggestion[]
): { text: string; cursorPos: number } {
  if (matches.length === 0) {
    return { text, cursorPos: text.length };
  }

  let out = "";
  let cursor = 0;
  let lastInsertedEnd = text.length;

  for (const m of matches) {
    out += text.slice(cursor, m.replaceStart);
    out += m.wrappedLatex;
    lastInsertedEnd = out.length;
    cursor = m.replaceEnd;
  }

  out += text.slice(cursor);
  return { text: out, cursorPos: lastInsertedEnd };
}
