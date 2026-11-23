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
    tok.kind === "prime" ||
    (tok.kind === "op" && tok.value === "!")
  );
}

function startsAtom(tok: MathToken): boolean {
  return (
    tok.kind === "number" ||
    tok.kind === "ident" ||
    tok.kind === "lparen" ||
    tok.kind === "lbracket" ||
    tok.kind === "pipe"
  );
}

function canJoinAcrossWhitespace(prev: MathToken, next: MathToken): boolean {
  // Allow space-separated implicit multiplication with Greek symbols or math functions
  // (e.g., `lambda v`, `pi r`, `2 pi`, `sin x`), while splitting prose conjunctions (`2 y g(x)`)
  if (prev.kind === "ident") {
    if (Object.prototype.hasOwnProperty.call(KNOWN_SYMBOLS, prev.value)) {
      return next.kind === "ident" || next.kind === "number";
    }
    if (Object.prototype.hasOwnProperty.call(KNOWN_FUNCTIONS, prev.value)) {
      return next.kind === "lparen" || next.kind === "ident" || next.kind === "number";
    }
  }
  if (
    prev.kind === "number" &&
    next.kind === "ident" &&
    Object.prototype.hasOwnProperty.call(KNOWN_SYMBOLS, next.value)
  ) {
    return true;
  }
  return false;
}

function scanChunkForPlainMath(
  chunk: string,
  baseOffset: number,
  results: PlainMathSuggestion[]
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

    // Trim trailing stray openers/binary operators that may precede a prose break
    let endIdx = run.length;
    while (endIdx > 0) {
      const last = run[endIdx - 1].token;
      if (
        last.kind === "lparen" ||
        last.kind === "lbracket" ||
        last.kind === "comma" ||
        (last.kind === "op" && last.value !== "!")
      ) {
        endIdx -= 1;
      } else {
        break;
      }
    }

    let startIdx = 0;
    while (startIdx < endIdx) {
      const first = run[startIdx].token;
      if (
        first.kind === "rparen" ||
        first.kind === "rbracket" ||
        first.kind === "comma" ||
        (first.kind === "op" &&
          first.value !== "-" &&
          first.value !== "+" &&
          first.value !== "+-")
      ) {
        startIdx += 1;
      } else {
        break;
      }
    }

    if (endIdx - startIdx >= 2) {
      const spanStart = run[startIdx].start;
      const spanEnd = run[endIdx - 1].end;
      const raw = chunk.slice(spanStart, spanEnd);
      const compiled = compilePlainMathToLatex(raw);
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

    // Read one positioned token
    let tok: MathToken | null = null;
    let tokEnd = i + 1;

    if (isAsciiDigit(ch)) {
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
      tok = { kind: "number", value: chunk.slice(i, j) };
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
      tok = { kind: "ident", value: word };
      tokEnd = j;
    } else {
      let matchedMulti: string | null = null;
      for (const op of MULTI_CHAR_OPS) {
        if (chunk.startsWith(op, i)) {
          matchedMulti = op;
          break;
        }
      }
      if (matchedMulti !== null) {
        tok = { kind: "op", value: matchedMulti };
        tokEnd = i + matchedMulti.length;
      } else {
        switch (ch) {
          case "(":
            tok = { kind: "lparen" };
            break;
          case ")":
            tok = { kind: "rparen" };
            break;
          case "[":
            tok = { kind: "lbracket" };
            break;
          case "]":
            tok = { kind: "rbracket" };
            break;
          case ",":
            if (parenDepth === 0) {
              flushRun();
              i += 1;
              hadLeadingSpace = false;
              continue;
            }
            tok = { kind: "comma" };
            break;
          case "|":
            tok = { kind: "pipe" };
            break;
          case "'":
            tok = { kind: "prime" };
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
            tok = { kind: "op", value: ch };
            break;
          default:
            flushRun();
            i += 1;
            hadLeadingSpace = false;
            continue;
        }
      }
    }

    // Split between two whitespace-separated atoms at top level (e.g. `f(x) = 5x + 2 y g(x) = 3`)
    if (
      run.length > 0 &&
      parenDepth === 0 &&
      hadLeadingSpace &&
      endsAtom(run[run.length - 1].token) &&
      startsAtom(tok) &&
      !canJoinAcrossWhitespace(run[run.length - 1].token, tok)
    ) {
      flushRun();
    }

    if (tok.kind === "lparen" || tok.kind === "lbracket") {
      parenDepth += 1;
    } else if (tok.kind === "rparen" || tok.kind === "rbracket") {
      parenDepth = Math.max(0, parenDepth - 1);
    }

    run.push({ token: tok, start: i, end: tokEnd, hadLeadingSpace });
    hadLeadingSpace = false;
    i = tokEnd;
  }

  flushRun();
}

/**
 * Scans an entire composer draft and extracts ALL high-confidence plain-math
 * expressions in left-to-right order (including multiple expressions inside prose
 * and expressions followed by trailing text), while leaving already-delimited
 * LaTeX blocks untouched.
 */
export function detectPlainMathExpressions(
  text: string
): PlainMathSuggestion[] {
  if (text.trim().length < 3) return [];

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
      scanChunkForPlainMath(seg.content, offset, results);
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
  text: string
): PlainMathSuggestion | null {
  const all = detectPlainMathExpressions(text);
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
