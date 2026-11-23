import { usesChemistryCommands } from "./detector.js";
import { DELIMITERS, parseMathSegments } from "./parser.js";
import type { Segment, ValidationReason } from "./types.js";
import { validateLatex, type ValidationLimits } from "./validator.js";

/**
 * Describes an opening math delimiter in a composer draft that has no matching closer.
 */
export interface UnclosedDelimiter {
  open: string;
  close: string;
  /** 0-based index in the draft text where the unclosed opening delimiter begins. */
  index: number;
}

/**
 * Structured warning/error surfaced in the live composer preview before posting.
 */
export type ComposerDiagnostic =
  | {
      kind: "unclosed_delimiter";
      open: string;
      close: string;
      index: number;
    }
  | {
      kind: "validation_error";
      /** 0-based index among `"math"` segments found in the draft. */
      formulaIndex: number;
      reason: ValidationReason;
      message: string;
      raw: string;
    }
  | {
      kind: "chemistry_disabled";
      /** 0-based index among `"math"` segments found in the draft. */
      formulaIndex: number;
      raw: string;
    };

export interface ComposerAnalyzeOptions {
  /** Whether `mhchem` chemistry commands (`\ce`, `\pu`) are enabled. Defaults to `true`. */
  enableChemistry?: boolean;
  /** Optional custom validation bounds passed through to `validateLatex`. */
  limits?: Partial<ValidationLimits>;
}

/**
 * Pure state snapshot computed for the live composer preview panel.
 */
export interface ComposerDraftAnalysis {
  /** `true` iff the draft contains at least one math segment or diagnostic worth showing. */
  shouldShowPreview: boolean;
  /** Parsed segments from `parseMathSegments(text)`. */
  segments: Segment[];
  /** Validation errors, disabled-chemistry notices, and/or unclosed delimiter warning. */
  diagnostics: ComposerDiagnostic[];
  /** Number of `"math"` segments found in `segments`. */
  formulaCount: number;
}

/**
 * Resettable timer controller used to throttle rapid typing updates.
 */
export interface Debouncer {
  trigger(): void;
  cancel(): void;
  flush(): void;
  isPending(): boolean;
}

/**
 * CHALLENGE #4: Function 4.1: `findUnclosedDelimiter`
 *
 * Role:
 *   While `parseMathSegments` intentionally treats unclosed delimiters as literal text
 *   when reading the feed, in the post composer we want to warn the author immediately
 *   if they forgot to close `$$`, `\(` or `\[`.
 *
 * Formal Contract:
 * - Precondition:  `text` is any string (possibly empty).
 * - Postcondition: Scans `text` from left to right using `DELIMITERS`:
 *                  - When an opening delimiter `d` matches at `i`, searches for `d.close`
 *                    starting at `i + d.open.length`.
 *                  - If no closing delimiter exists (`closeIdx === -1`), immediately returns
 *                    `{ open: d.open, close: d.close, index: i }`.
 *                  - If closed, advances `i = closeIdx + d.close.length` to skip the
 *                    entire closed block.
 *                  - If no delimiter matches at `i`, advances `i += 1`.
 *                  - Returns `null` if every opening delimiter in `text` is properly closed.
 * - Loop Invariant: Before each iteration at index `i`, prefix `text[0..i)` contains only
 *                   plain text and completely closed delimited math blocks.
 * - Complexity:    O(n) time, O(1) auxiliary space.
 */
export function findUnclosedDelimiter(text: string): UnclosedDelimiter | null {
  let i = 0;

  while (i < text.length) {
    let matched = null;
    for (const delim of DELIMITERS) {
      if (text.startsWith(delim.open, i)) {
        matched = delim;
        break;
      }
    }

    if (matched === null) {
      i += 1;
    } else {
      const closeIdx = text.indexOf(matched.close, i + matched.open.length);
      if (closeIdx === -1) {
        return {
          open: matched.open,
          close: matched.close,
          index: i,
        };
      }
      i = closeIdx + matched.close.length;
    }
  }

  return null;
}

/**
 * CHALLENGE #4: Function 4.2: `analyzeComposerDraft`
 *
 * Role:
 *   Pure brain of the live composer preview panel. Given the author's current draft text,
 *   computes whether the preview panel should appear, which segments to render, and every
 *   diagnostic (validation errors, disabled chemistry, or unclosed delimiter) to display
 *   before the user hits Post.
 *
 * Formal Contract:
 * - Precondition:  `text` is any string; `options?.enableChemistry` defaults to `true`.
 * - Postcondition: Returns a `ComposerDraftAnalysis` satisfying:
 *                  1. `segments` equals `parseMathSegments(text)`.
 *                  2. `formulaCount` equals the number of `"math"` segments in `segments`.
 *                  3. `diagnostics` contains (in order):
 *                     a) For each `"math"` segment (indexed `0, 1, ...` via `formulaIndex`):
 *                        - If `!enableChemistry && usesChemistryCommands(seg.content)`:
 *                          `{ kind: "chemistry_disabled", formulaIndex, raw: seg.raw }`.
 *                        - Otherwise, if `validateLatex(seg.content, options?.limits)` fails:
 *                          `{ kind: "validation_error", formulaIndex, reason, message, raw: seg.raw }`.
 *                     b) If `findUnclosedDelimiter(text)` is non-null:
 *                        `{ kind: "unclosed_delimiter", open, close, index }`.
 *                  4. `shouldShowPreview === (formulaCount > 0 || diagnostics.length > 0)`.
 * - Complexity:    O(n) time.
 */
export function analyzeComposerDraft(
  text: string,
  options?: ComposerAnalyzeOptions
): ComposerDraftAnalysis {
  const enableChemistry = options?.enableChemistry ?? true;
  const segments = parseMathSegments(text);
  let formulaCount = 0;
  const diagnostics: ComposerDiagnostic[] = [];

  for (const segment of segments) {
    if (segment.type === "math") {
      const formulaIndex = formulaCount;
      formulaCount += 1;

      if (!enableChemistry && usesChemistryCommands(segment.content)) {
        diagnostics.push({
          kind: "chemistry_disabled",
          formulaIndex,
          raw: segment.raw,
        });
      } else {
        const validation = validateLatex(segment.content, options?.limits);
        if (!validation.ok) {
          diagnostics.push({
            kind: "validation_error",
            formulaIndex,
            reason: validation.reason,
            message: validation.message,
            raw: segment.raw,
          });
        }
      }
    }
  }

  const unclosed = findUnclosedDelimiter(text);
  if (unclosed !== null) {
    diagnostics.push({
      kind: "unclosed_delimiter",
      open: unclosed.open,
      close: unclosed.close,
      index: unclosed.index,
    });
  }

  return {
    shouldShowPreview: formulaCount > 0 || diagnostics.length > 0,
    segments,
    diagnostics,
    formulaCount,
  };
}

/**
 * CHALLENGE #4: Function 4.3: `createDebouncer`
 *
 * Role:
 *   Prevents re-parsing and re-rendering KaTeX on every single keystroke while typing fast.
 *   Waits until `delayMs` milliseconds pass without a new `trigger()` before invoking `callback`.
 *
 * Formal Contract:
 * - Precondition:  `delayMs >= 0`; `callback` is a zero-argument function.
 * - Postcondition: Returns a `Debouncer` controller `{ trigger, cancel, flush, isPending }`:
 *                  - `trigger()`: cancels any active timer and schedules `callback` to run
 *                    once after `delayMs` ms; `isPending()` becomes `true` until execution.
 *                  - `cancel()`: cancels any active timer without invoking `callback`;
 *                    idempotent if nothing is pending; `isPending()` becomes `false`.
 *                  - `flush()`: if a timer is pending, cancels it and invokes `callback()`
 *                    immediately once, setting `isPending()` to `false`; no-op if idle.
 *                  - `isPending()`: returns `true` iff a scheduled callback has neither
 *                    executed nor been cancelled.
 * - State Invariant: At most one timer is active at any point in time
 *                    (`timerId !== null` iff `isPending() === true`).
 * - Complexity:    O(1) time and O(1) space per operation.
 */
export function createDebouncer(
  delayMs: number,
  callback: () => void
): Debouncer {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger(): void {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        timerId = null;
        callback();
      }, delayMs);
    },

    cancel(): void {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },

    flush(): void {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
        callback();
      }
    },

    isPending(): boolean {
      return timerId !== null;
    },
  };
}

export interface InlineDisplayHint {
  /** Exact raw display formula substring (e.g. `$$1$$`). */
  raw: string;
  /** Inner trimmed LaTeX source (e.g. `1`). */
  content: string;
  /** Exact start index in the draft text. */
  start: number;
  /** Exact end index in the draft text. */
  end: number;
  /** Suggested inline replacement (`\(1\)`). */
  inlineReplacement: string;
}

const BLOCK_ONLY_COMMAND_RE =
  /\\(?:begin|sum|int|iint|iiint|oint|prod|lim|frac|dfrac|cases|matrix|pmatrix|bmatrix|align)\b|\\\\/;

/**
 * Detects `$$...$$` display blocks embedded inside a sentence on the same line
 * (e.g., `"restando $$1$$ a ambos lados"`), so the composer can offer a friendly
 * non-blocking 1-click tip to switch to inline `\(...\)` without breaking standard
 * LaTeX display semantics.
 *
 * Intentionally ignores:
 * - Standalone `$$...$$` on its own line.
 * - Large/display-oriented blocks at the end of a line containing `\sum`, `\int`, `\frac`, `\begin{...}`, etc.
 */
export function findInlineDisplayHints(text: string): InlineDisplayHint[] {
  const segments = parseMathSegments(text);
  const hints: InlineDisplayHint[] = [];
  let offset = 0;

  for (const seg of segments) {
    if (seg.type === "text") {
      offset += seg.content.length;
      continue;
    }

    const start = offset;
    const end = offset + seg.raw.length;
    offset = end;

    // Only suggest for `$$...$$` blocks (authors explicitly using `\[...\]` know display syntax)
    if (seg.mode !== "display" || !seg.raw.startsWith("$$")) {
      continue;
    }
    if (seg.content.includes("\n") || /\\begin\b|\\\\/.test(seg.content)) {
      continue;
    }

    const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
    const nextNl = text.indexOf("\n", end);
    const lineEnd = nextNl === -1 ? text.length : nextNl;

    const textBeforeTrimmed = text.slice(lineStart, start).trim();
    const textAfterTrimmed = text.slice(end, lineEnd).trim();
    const hasTextBeforeOnLine = textBeforeTrimmed.length > 0;
    const hasTextAfterOnLine = textAfterTrimmed.length > 0;

    // Case 1: Surrounded by text on BOTH sides of the same line (`restando $$1$$ a ambos lados`)
    const embeddedMidSentence = hasTextBeforeOnLine && hasTextAfterOnLine;
    // Case 2: Short simple formula inline with prose on one side (excluding equations introduced by `:`)
    const shortInlineWithProse =
      (hasTextBeforeOnLine || hasTextAfterOnLine) &&
      !textBeforeTrimmed.endsWith(":") &&
      seg.content.length <= 20 &&
      !BLOCK_ONLY_COMMAND_RE.test(seg.content);

    if (embeddedMidSentence || shortInlineWithProse) {
      hints.push({
        raw: seg.raw,
        content: seg.content,
        start,
        end,
        inlineReplacement: `\\(${seg.content}\\)`,
      });
    }
  }

  return hints;
}

/**
 * Replaces a single inline-embedded `$$...$$` display block with inline `\(...\)`.
 */
export function convertDisplayHintToInline(
  text: string,
  hint: InlineDisplayHint
): { text: string; cursorPos: number } {
  const nextText =
    text.slice(0, hint.start) + hint.inlineReplacement + text.slice(hint.end);
  return {
    text: nextText,
    cursorPos: hint.start + hint.inlineReplacement.length,
  };
}

