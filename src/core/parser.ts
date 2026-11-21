import type { MathDisplayMode, Segment } from "./types.js";

/**
 * Opening/closing delimiter pair recognized by the scanner.
 */
export interface DelimiterSpec {
  open: string;
  close: string;
  mode: MathDisplayMode;
}

/**
 * Supported math delimiters in evaluation order.
 * Single `$` is intentionally excluded to avoid collisions with currency notation and cashtags.
 */
export const DELIMITERS: readonly DelimiterSpec[] = [
  { open: "$$", close: "$$", mode: "display" },
  { open: "\\[", close: "\\]", mode: "display" },
  { open: "\\(", close: "\\)", mode: "inline" },
];

/**
 * Appends a plain-text chunk to `segments`, merging with the previous `"text"`
 * segment when adjacent (maintains non-empty and non-adjacent text invariants).
 */
function pushText(segments: Segment[], chunk: string): void {
  if (chunk.length === 0) return;

  const last = segments[segments.length - 1];
  if (last && last.type === "text") {
    last.content += chunk;
  } else {
    segments.push({ type: "text", content: chunk });
  }
}

/**
 * Splits raw post text into an ordered list of `Segment`s alternating between
 * plain text (`type: "text"`) and math expressions (`type: "math"`).
 *
 * Supported delimiters:
 * - `$$...$$` -> mode: "display"
 * - `\[...\]` -> mode: "display"
 * - `\(...\)` -> mode: "inline"
 *
 * Guarantees:
 * - Single `$` (currency notation and cashtags) is never treated as math.
 * - Unclosed delimiters and empty/whitespace-only formulas stay literal text.
 * - Lossless round-trip: concatenating `text.content` / `math.raw` always
 *   reconstructs the exact original string.
 */
export function parseMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < text.length) {
    let matched: DelimiterSpec | null = null;
    for (const delim of DELIMITERS) {
      if (text.startsWith(delim.open, i)) {
        matched = delim;
        break;
      }
    }

    if (matched === null) {
      pushText(segments, text[i]);
      i += 1;
    } else {
      const closeIdx = text.indexOf(matched.close, i + matched.open.length);

      if (closeIdx === -1) {
        pushText(segments, matched.open);
        i += matched.open.length;
      } else {
        const endIdx = closeIdx + matched.close.length;
        const raw = text.slice(i, endIdx);
        const inner = text.slice(i + matched.open.length, closeIdx).trim();

        if (inner === "") {
          pushText(segments, raw);
        } else {
          segments.push({
            type: "math",
            content: inner,
            mode: matched.mode,
            raw,
          });
        }

        i = endIdx;
      }
    }
  }

  return segments;
}
