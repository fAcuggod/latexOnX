import type { ValidationResult } from "./types.js";

/**
 * Límites configurables para proteger el navegador contra fórmulas abusivas (DoS).
 */
export interface ValidationLimits {
  /** Largo máximo permitido para una fórmula (en caracteres). */
  maxLength: number;
  /** Profundidad máxima de anidamiento de llaves `{...}`. */
  maxBraceDepth: number;
}

export const DEFAULT_VALIDATION_LIMITS: Readonly<ValidationLimits> = {
  maxLength: 500,
  maxBraceDepth: 15,
};

/**
 * Comandos de LaTeX/KaTeX prohibidos por seguridad (defensa en profundidad):
 * - Macros (`\def`, `\let`, `\newcommand`, ...) pueden causar expansión infinita.
 * - Enlaces/HTML (`\href`, `\url`, `\htmlStyle`, ...) podrían inyectar links o estilos maliciosos.
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

/**
 * Equivalente en TypeScript a `char.isascii() and char.isalpha()` en Python.
 */
function isAsciiLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

/**
 * Verifica que las llaves `{...}` estén balanceadas y no superen la profundidad máxima,
 * ignorando caracteres escapados tras `\` (`\{`, `\}`, `\\`).
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
 * Busca comandos LaTeX reales (`\` seguido de letras ASCII) y devuelve el primero
 * que aparezca en `FORBIDDEN_COMMAND_SET`, o `null` si todos son seguros.
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
 * Valida una fórmula LaTeX antes de enviarla al motor de renderizado (KaTeX),
 * aplicando controles en orden: no vacía, longitud máxima, llaves y comandos prohibidos.
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
      message: "La fórmula está vacía.",
    };
  }

  if (formula.length > maxLength) {
    return {
      ok: false,
      reason: "too_long",
      message: `La fórmula supera el máximo de ${maxLength} caracteres.`,
    };
  }

  const braceError = checkBraces(formula, maxBraceDepth);
  if (braceError !== null) {
    return {
      ok: false,
      reason: braceError,
      message:
        braceError === "too_deep"
          ? `La fórmula supera la profundidad máxima de ${maxBraceDepth} llaves.`
          : "La fórmula tiene llaves desbalanceadas.",
    };
  }

  const forbidden = findForbiddenCommand(formula);
  if (forbidden !== null) {
    return {
      ok: false,
      reason: "forbidden_command",
      message: `La fórmula contiene el comando prohibido ${forbidden}.`,
    };
  }

  return { ok: true };
}
