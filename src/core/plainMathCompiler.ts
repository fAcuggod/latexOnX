/**
 * Pure Plain-Math (AsciiMath-lite) -> LaTeX Mini-Compiler (v1.2).
 *
 * Architecture:
 *   Input text
 *     -> Lexer (`tokenizePlainMath`)
 *     -> Recursive-Descent Parser (`parsePlainMathToAst`)
 *     -> Abstract Syntax Tree (`MathAstNode`)
 *     -> LaTeX Code Generator (`emitLatexFromAst`)
 *
 * Zero browser/DOM dependencies, O(n) tokenization and parsing, bounded AST
 * recursion depth (anti-DoS), and strict precision filters to avoid false
 * positives on everyday prose, dates, scores, URLs, and currency notation.
 */

import { parseMathSegments } from "./parser.js";
import type { MathDisplayMode } from "./types.js";
import { validateLatex } from "./validator.js";

const MAX_AST_DEPTH = 32;

export type MathToken =
  | { kind: "number"; value: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "lbracket" }
  | { kind: "rbracket" }
  | { kind: "comma" }
  | { kind: "pipe" }
  | { kind: "prime" };

export type MathAstNode =
  | { kind: "number"; value: string }
  | { kind: "ident"; name: string }
  | { kind: "unary"; op: "+" | "-" | "+-"; operand: MathAstNode }
  | { kind: "postfix"; op: "!" | "'"; operand: MathAstNode }
  | {
      kind: "binary";
      op: string;
      left: MathAstNode;
      right: MathAstNode;
      implicit?: boolean;
    }
  | { kind: "call"; callee: string; primes: number; args: MathAstNode[] }
  | { kind: "group"; bracket: "(" | "["; expr: MathAstNode }
  | { kind: "abs"; expr: MathAstNode };

export interface PlainMathSuggestion {
  /** Exact plain-math slice detected inside the user's draft. */
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
  sqrt: "\\sqrt",
  root: "\\sqrt",
  abs: "abs",
};

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

const RELATION_OPS = new Set([
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
  "*": "\\cdot",
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
]);

function isAsciiDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isAsciiLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

/**
 * Phase 1: Lexer.
 * Converts a plain-math string into a typed token stream.
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

    // Identifier (variable, Greek name, or function name)
    if (isAsciiLetter(ch)) {
      let j = i + 1;
      while (j < input.length && isAsciiLetter(input[j])) {
        j += 1;
      }
      tokens.push({ kind: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Multi-character operators (maximal munch)
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

    // Single-character punctuation and operators
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
 * (rejecting natural-language prose words of length >= 3).
 */
function isValidMathIdentifier(name: string): boolean {
  if (name.length === 1) return true;
  if (Object.prototype.hasOwnProperty.call(KNOWN_FUNCTIONS, name)) return true;
  if (Object.prototype.hasOwnProperty.call(KNOWN_SYMBOLS, name)) return true;
  if (name.length === 2) {
    // Allow 2-letter algebra products/differentials like `dx`, `dt`, `mx`, `mc`, `PV`, `RT`
    // while excluding common 2-letter Spanish/English stop-words when lowercase
    return !ALLOWED_TWO_CHAR_PROSE.has(name);
  }
  // Allow 3-letter uppercase physics/math products like `nRT`, `abc` only if all caps or differential
  if (name === "nRT") return true;
  return false;
}

/**
 * Phase 2: Recursive-Descent Parser.
 * Parses tokens into a typed Abstract Syntax Tree respecting standard math
 * precedence (Relations < Additive < Multiplicative/Implicit < Unary < Power < Postfix < Primary).
 */
export function parsePlainMathToAst(tokens: readonly MathToken[]): MathAstNode | null {
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

  const canStartImplicitFactor = (tok: MathToken | undefined): boolean => {
    if (!tok) return false;
    return tok.kind === "ident" || tok.kind === "lparen" || tok.kind === "lbracket";
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
      if (
        tok &&
        tok.kind === "op" &&
        (tok.value === "+" || tok.value === "-" || tok.value === "+-")
      ) {
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
      if (tok && tok.kind === "op" && (tok.value === "*" || tok.value === "/")) {
        consume();
        const right = parseUnary();
        if (!right) {
          leave();
          return null;
        }
        left = { kind: "binary", op: tok.value, left, right };
      } else if (canStartImplicitFactor(tok)) {
        const right = parseUnary();
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
    if (
      tok &&
      tok.kind === "op" &&
      (tok.value === "-" || tok.value === "+" || tok.value === "+-")
    ) {
      consume();
      const operand = parseUnary();
      leave();
      return operand
        ? { kind: "unary", op: tok.value as "+" | "-" | "+-", operand }
        : null;
    }

    const node = parsePower();
    leave();
    return node;
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
      const exp = parseUnary();
      if (!exp) {
        leave();
        return null;
      }
      base = { kind: "binary", op: tok.value, left: base, right: exp };

      // Support combined subscript + superscript (e.g. `a_n^2` or `x_1^2`)
      const next = peek();
      if (
        next &&
        next.kind === "op" &&
        (next.value === "^" || next.value === "_") &&
        next.value !== tok.value
      ) {
        consume();
        const second = parseUnary();
        if (!second) {
          leave();
          return null;
        }
        base = { kind: "binary", op: next.value, left: base, right: second };
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

    if (tok.kind === "ident") {
      if (!isValidMathIdentifier(tok.value)) {
        leave();
        return null;
      }
      consume();

      // Count optional primes right before a function call (e.g. `f'(x)`, `g''(t)`)
      let primes = 0;
      const savedPos = pos;
      while (peek()?.kind === "prime") {
        consume();
        primes += 1;
      }

      const isKnownFn = Object.prototype.hasOwnProperty.call(
        KNOWN_FUNCTIONS,
        tok.value
      );
      const canBeCall =
        isKnownFn ||
        (tok.value.length === 1 && peek()?.kind === "lparen");

      if (canBeCall && peek()?.kind === "lparen") {
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
  if (node.kind === "group" && node.bracket === "(") {
    return node.expr;
  }
  return node;
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

    case "ident":
      if (Object.prototype.hasOwnProperty.call(KNOWN_SYMBOLS, node.name)) {
        return KNOWN_SYMBOLS[node.name];
      }
      if (Object.prototype.hasOwnProperty.call(KNOWN_FUNCTIONS, node.name)) {
        const fn = KNOWN_FUNCTIONS[node.name];
        return fn === "abs" ? "abs" : fn;
      }
      return node.name;

    case "unary": {
      const inner = emitLatexFromAst(node.operand);
      if (node.op === "+-") return `\\pm ${inner}`;
      return `${node.op}${inner}`;
    }

    case "postfix": {
      const inner = emitLatexFromAst(node.operand);
      return `${inner}${node.op}`;
    }

    case "group": {
      const inner = emitLatexFromAst(node.expr);
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

      const renderedArgs = node.args.map(emitLatexFromAst).join(", ");
      const tall = node.args.some(containsTallConstruct);
      const parens = tall ? `\\left(${renderedArgs}\\right)` : `(${renderedArgs})`;

      if (Object.prototype.hasOwnProperty.call(KNOWN_FUNCTIONS, node.callee)) {
        return `${KNOWN_FUNCTIONS[node.callee]}${primeStr}${parens}`;
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
  hasKnownFunction: boolean;
  hasUserCall: boolean;
  hasPowerOrSub: boolean;
  hasDivision: boolean;
  hasArithmetic: boolean;
  hasIdentifier: boolean;
  hasGroupOrAbs: boolean;
  nodeCount: number;
}

function collectAstSignals(node: MathAstNode): AstSignals {
  const s: AstSignals = {
    hasRelation: false,
    hasKnownFunction: false,
    hasUserCall: false,
    hasPowerOrSub: false,
    hasDivision: false,
    hasArithmetic: false,
    hasIdentifier: false,
    hasGroupOrAbs: false,
    nodeCount: 0,
  };

  const walk = (n: MathAstNode): void => {
    s.nodeCount += 1;
    switch (n.kind) {
      case "ident":
        s.hasIdentifier = true;
        break;
      case "unary":
      case "postfix":
        walk(n.operand);
        break;
      case "group":
      case "abs":
        s.hasGroupOrAbs = true;
        walk(n.expr);
        break;
      case "call":
        if (Object.prototype.hasOwnProperty.call(KNOWN_FUNCTIONS, n.callee)) {
          s.hasKnownFunction = true;
        } else {
          s.hasUserCall = true;
        }
        s.hasIdentifier = true;
        for (const arg of n.args) walk(arg);
        break;
      case "binary":
        if (RELATION_OPS.has(n.op)) s.hasRelation = true;
        else if (n.op === "^" || n.op === "_") s.hasPowerOrSub = true;
        else if (n.op === "/") s.hasDivision = true;
        else s.hasArithmetic = true;
        walk(n.left);
        walk(n.right);
        break;
    }
  };

  walk(node);
  return s;
}

/**
 * High-precision filter distinguishing genuine mathematical expressions
 * (`f(x) = 5x + 2`, `sqrt(a^2 + b^2)`, `(a+b)/(c-d)`, `x^2 - 1 = 0`)
 * from everyday text, dates (`23/11/2026`), scores (`10/10`), and ratios (`24/7`).
 */
function isHighPrecisionPlainMath(ast: MathAstNode): boolean {
  const s = collectAstSignals(ast);

  // Single atom (`x`, `42`) is never worth converting on its own
  if (s.nodeCount < 2) return false;

  // Reject pure numeric dates/scores/ratios (`24/7`, `10/10`, `23/11/2026`, `3 - 2`)
  if (!s.hasIdentifier && !s.hasRelation && !s.hasPowerOrSub) {
    return false;
  }

  // Strong mathematical signals:
  // 1. Known math function call (`sqrt(...)`, `sin(...)`, `log(...)`, `abs(...)`)
  if (s.hasKnownFunction) return true;

  // 2. Function definition or algebraic equation (`f(x) = 5x + 2`, `x^2 = 4`, `x >= 0`)
  if (
    s.hasRelation &&
    (s.hasUserCall ||
      s.hasArithmetic ||
      s.hasDivision ||
      s.hasPowerOrSub ||
      s.hasIdentifier)
  ) {
    return true;
  }

  // 3. Explicit exponent or subscript with identifier (`x^2`, `e^(-x^2)`, `a_n`)
  if (s.hasPowerOrSub && s.hasIdentifier) return true;

  // 4. Algebraic fraction (`(a + b)/(c + d)`, `1/(x + 1)`, `dy/dx`)
  if (s.hasDivision && (s.hasIdentifier || s.hasGroupOrAbs)) return true;

  return false;
}

/**
 * Full single-expression compiler: plain-math string -> `{ latex, ast }` or `null`.
 */
export function compilePlainMathToLatex(
  expression: string
): { latex: string; ast: MathAstNode } | null {
  const trimmed = expression.trim();
  if (trimmed.length < 3 || trimmed.length > 240) return null;

  const tokens = tokenizePlainMath(trimmed);
  if (!tokens || tokens.length < 2) return null;

  const ast = parsePlainMathToAst(tokens);
  if (!ast || !isHighPrecisionPlainMath(ast)) return null;

  const latex = emitLatexFromAst(ast);
  if (!validateLatex(latex).ok) return null;

  return { latex, ast };
}

function chooseDisplayMode(
  latex: string,
  isStandaloneLine: boolean
): MathDisplayMode {
  if (isStandaloneLine && (latex.includes("\\frac") || latex.length >= 24)) {
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

/**
 * Scans a composer draft for a high-confidence plain-math expression (such as
 * `f(x) = 5x + 2` or `(a + b)/(c + d)`) when the draft does not already contain
 * delimited LaTeX. Supports both standalone expressions and trailing equations
 * inside prose (e.g., `"Definimos la función: f(x) = 5x + 2"`).
 */
export function detectPlainMathInDraft(
  text: string
): PlainMathSuggestion | null {
  const trimmedFull = text.trim();
  if (trimmedFull.length < 3) return null;

  // Yield completely if the draft already uses explicit LaTeX delimiters or backslashes
  if (text.includes("\\") || text.includes("$$")) return null;
  if (parseMathSegments(text).some((s) => s.type === "math")) return null;

  // 1. Try the whole draft directly (fast path for pure math drafts like `f(x) = 5x + 2`)
  const fullCompiled = compilePlainMathToLatex(trimmedFull);
  if (fullCompiled) {
    const start = text.indexOf(trimmedFull);
    return buildSuggestion(
      trimmedFull,
      start,
      start + trimmedFull.length,
      true,
      fullCompiled
    );
  }

  // 2. Scan individual lines from bottom to top, checking full line or trailing clause
  let offset = 0;
  const lines = text.split("\n");
  const lineSpans: Array<{ line: string; start: number }> = [];
  for (const line of lines) {
    lineSpans.push({ line, start: offset });
    offset += line.length + 1;
  }

  for (let idx = lineSpans.length - 1; idx >= 0; idx -= 1) {
    const { line, start: lineStart } = lineSpans[idx];
    const trimmedLine = line.trim();
    if (trimmedLine.length < 3) continue;

    // 2a. Entire line is a valid plain-math expression
    const lineCompiled = compilePlainMathToLatex(trimmedLine);
    if (lineCompiled) {
      const relStart = line.indexOf(trimmedLine);
      return buildSuggestion(
        trimmedLine,
        lineStart + relStart,
        lineStart + relStart + trimmedLine.length,
        true,
        lineCompiled
      );
    }

    // 2b. Trailing equation after `:` or prose words (try longest valid token-boundary suffix)
    const tokenStarts: number[] = [];
    for (let k = 0; k < line.length; k += 1) {
      if (
        (k === 0 || /[\s:;,]/.test(line[k - 1])) &&
        !/[\s:;,]/.test(line[k])
      ) {
        tokenStarts.push(k);
      }
    }

    for (const relStart of tokenStarts) {
      if (relStart === 0) continue;
      // Strip optional trailing sentence period/punctuation
      let relEnd = line.length;
      while (relEnd > relStart && /[\s.?!;,]/.test(line[relEnd - 1])) {
        relEnd -= 1;
      }
      const candidate = line.slice(relStart, relEnd);
      const compiled = compilePlainMathToLatex(candidate);
      if (compiled) {
        return buildSuggestion(
          candidate,
          lineStart + relStart,
          lineStart + relEnd,
          false,
          compiled
        );
      }
    }
  }

  return null;
}
