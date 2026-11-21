/**
 * Presentation mode for a mathematical formula:
 * - "inline": rendered inline inside a sentence, e.g. \(x^2 + 1\)
 * - "display": rendered as a centered block equation, e.g. $$...$$ or \[...\]
 */
export type MathDisplayMode = "inline" | "display";

/**
 * A parsed slice of post text modeled as a discriminated union
 * (equivalent to an Algebraic Data Type in Haskell/ML).
 */
export type Segment =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "math";
      /** Clean LaTeX source (delimiters stripped and trimmed). */
      content: string;
      /** Inline or display block rendering mode. */
      mode: MathDisplayMode;
      /** Exact original substring from the post, including delimiters. */
      raw: string;
    };

/**
 * Machine-readable reason why a formula was rejected by the security validator.
 */
export type ValidationReason =
  | "empty"
  | "too_long"
  | "too_deep"
  | "unbalanced_braces"
  | "forbidden_command";

/**
 * Outcome of validating a LaTeX expression before rendering with KaTeX
 * (equivalent to `Either ValidationError ()`).
 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason; message: string };
