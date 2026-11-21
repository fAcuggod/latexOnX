import type { ValidationResult } from "./types.js";

/**
 * Configurable safety bounds to protect the browser against pathological/DoS formulas.
 */
export interface ValidationLimits {
  /** Maximum allowed formula length in characters. */
  maxLength: number;
  /** Maximum allowed `{...}` nesting depth. */
  maxBraceDepth: number;
}

export const DEFAULT_VALIDATION_LIMITS: Readonly<ValidationLimits> = {
  maxLength: 500,
  maxBraceDepth: 15,
};

/**
 * Disallowed LaTeX/KaTeX commands (defense in depth):
 * - Macro definitions (`\def`, `\let`, `\newcommand`, ...) can cause unbounded expansion.
 * - Link/HTML commands (`\href`, `\url`, `\htmlStyle`, ...) could inject links or custom styles.
 */
export const FORBIDDEN_COMMANDS: readonly string[] = [
  "\\def",
  "\\gdef",
  "\\edef",
  "\\xdef",
  "\\let",
  "\\newcommand",
  "\\renewcommand",
  "\\href",
  "\\url",
  "\\htmlClass",
  "\\htmlStyle",
  "\\htmlId",
  "\\htmlData",
];

const FORBIDDEN_COMMAND_SET: ReadonlySet<string> = new Set(FORBIDDEN_COMMANDS);

function isAsciiLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

/**
 * Verifies balanced `{...}` braces and enforces maximum nesting depth,
 * skipping backslash-escaped pairs (`\{`, `\}`, `\\`).
 */
function checkBraces(
  formula: string,
  maxBraceDepth: number
): "too_deep" | "unbalanced_braces" | null {
  let i = 0;
  let depth = 0;

  while (i < formula.length) {
    if (formula[i] === "\\") {
      i += 2;
      continue;
    }

    if (formula[i] === "{") {
      depth += 1;
      if (depth > maxBraceDepth) {
        return "too_deep";
      }
    } else if (formula[i] === "}") {
      depth -= 1;
      if (depth < 0) {
        return "unbalanced_braces";
      }
    }

    i += 1;
  }

  if (depth !== 0) {
    return "unbalanced_braces";
  }

  return null;
}

/**
 * Tokenizes real LaTeX control words (`\` followed by ASCII letters) and returns
 * the first command in `FORBIDDEN_COMMAND_SET`, or `null` if all commands are safe.
 * Avoids false positives on shared prefixes such as `\let` vs `\leftarrow`.
 */
function findForbiddenCommand(formula: string): string | null {
  let i = 0;

  while (i < formula.length) {
    if (formula[i] !== "\\") {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < formula.length && isAsciiLetter(formula[j])) {
      j += 1;
    }

    if (j > i + 1) {
      const cmd = formula.slice(i, j);
      if (FORBIDDEN_COMMAND_SET.has(cmd)) {
        return cmd;
      }
      i = j;
    } else {
      i += 2;
    }
  }

  return null;
}

/**
 * Validates a LaTeX expression before passing it to KaTeX.
 * Checks run in order: non-empty, max length, brace balance/depth, forbidden commands.
 */
export function validateLatex(
  formula: string,
  limits?: Partial<ValidationLimits>
): ValidationResult {
  const maxLength = limits?.maxLength ?? DEFAULT_VALIDATION_LIMITS.maxLength;
  const maxBraceDepth =
    limits?.maxBraceDepth ?? DEFAULT_VALIDATION_LIMITS.maxBraceDepth;

  if (formula.trim() === "") {
    return {
      ok: false,
      reason: "empty",
      message: "Formula is empty.",
    };
  }

  if (formula.length > maxLength) {
    return {
      ok: false,
      reason: "too_long",
      message: `Formula exceeds the maximum length of ${maxLength} characters.`,
    };
  }

  const braceError = checkBraces(formula, maxBraceDepth);
  if (braceError !== null) {
    return {
      ok: false,
      reason: braceError,
      message:
        braceError === "too_deep"
          ? `Formula exceeds the maximum brace nesting depth of ${maxBraceDepth}.`
          : "Formula contains unbalanced braces.",
    };
  }

  const forbidden = findForbiddenCommand(formula);
  if (forbidden !== null) {
    return {
      ok: false,
      reason: "forbidden_command",
      message: `Formula contains disallowed command ${forbidden}.`,
    };
  }

  return { ok: true };
}
