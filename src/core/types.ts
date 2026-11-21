/**
 * Modo de presentación de una fórmula matemática:
 * - "inline": se muestra dentro del flujo normal de una oración, ej. \(x^2 + 1\)
 * - "display": se muestra destacada como bloque matemático, ej. $$...$$ o \[...\]
 */
export type MathDisplayMode = "inline" | "display";

/**
 * Representa un fragmento del texto de un tweet luego de analizarlo.
 *
 * Si venís de Haskell, esto es equivalente a un tipo de dato algebraico (ADT):
 *
 *   data Segment
 *     = TextSegment String
 *     | MathSegment MathDisplayMode String String
 *
 * En TypeScript se modela como una "unión discriminada" usando el campo `type`.
 */
export type Segment =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "math";
      /** Código LaTeX limpio (sin delimitadores y sin espacios sobrantes en los bordes). */
      content: string;
      /** Modo de renderizado: en línea o en bloque. */
      mode: MathDisplayMode;
      /** Subcadena original exacta del tweet, incluyendo los delimitadores. */
      raw: string;
    };

/**
 * Motivo codificado por el cual una fórmula fue rechazada por el validador.
 */
export type ValidationReason =
  | "empty"
  | "too_long"
  | "too_deep"
  | "unbalanced_braces"
  | "forbidden_command";

/**
 * Resultado de validar una fórmula LaTeX antes de enviarla a KaTeX.
 *
 * Equivalente en Haskell a `Either ValidationError ()`:
 * - `{ ok: true }` si la fórmula es segura y válida.
 * - `{ ok: false, reason, message }` si viola alguna regla de seguridad.
 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason; message: string };

