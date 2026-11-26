import { parseMathSegments } from "./parser.js";
import {
  detectPlainMathExpressions,
  mightContainPlainMath,
} from "./plainMathCompiler.js";
import type { Segment } from "./types.js";

/**
 * Chemistry commands supported via KaTeX's `mhchem` extension.
 */
export const CHEMISTRY_COMMANDS: ReadonlySet<string> = new Set([
  "\\ce",
  "\\pu",
]);

/**
 * Unambiguous LaTeX mathematical commands that virtually never occur in plain prose
 * or programming string escapes (such as `\n`, `\t`, `\r`).
 */
export const MATH_STRONG_COMMANDS: ReadonlySet<string> = new Set([
  "\\frac",
  "\\dfrac",
  "\\tfrac",
  "\\sqrt",
  "\\sum",
  "\\int",
  "\\iint",
  "\\iiint",
  "\\oint",
  "\\prod",
  "\\lim",
  "\\limsup",
  "\\liminf",
  "\\binom",
  "\\mathbb",
  "\\mathcal",
  "\\mathfrak",
  "\\mathrm",
  "\\mathbf",
  "\\operatorname",
  "\\begin",
  "\\left",
  "\\overline",
  "\\hat",
  "\\vec",
  "\\alpha",
  "\\beta",
  "\\gamma",
  "\\delta",
  "\\epsilon",
  "\\varepsilon",
  "\\zeta",
  "\\theta",
  "\\lambda",
  "\\mu",
  "\\pi",
  "\\sigma",
  "\\phi",
  "\\varphi",
  "\\omega",
  "\\Delta",
  "\\Gamma",
  "\\Theta",
  "\\Lambda",
  "\\Xi",
  "\\Pi",
  "\\Sigma",
  "\\Phi",
  "\\Psi",
  "\\Omega",
  "\\sin",
  "\\cos",
  "\\tan",
  "\\ln",
  "\\log",
  "\\exp",
  "\\cdots",
  "\\ldots",
  "\\infty",
  "\\partial",
  "\\nabla",
  "\\forall",
  "\\exists",
  "\\approx",
  "\\equiv",
  "\\neq",
  "\\ne",
  "\\leq",
  "\\le",
  "\\geq",
  "\\ge",
  "\\pm",
  "\\times",
  "\\cdot",
  "\\leftarrow",
  "\\rightarrow",
  "\\leftrightarrow",
  "\\Rightarrow",
  "\\Leftrightarrow",
]);

/**
 * Union of unambiguous math and chemistry commands used for opt-in bare-LaTeX detection.
 */
export const STRONG_LATEX_COMMANDS: ReadonlySet<string> = new Set([
  ...MATH_STRONG_COMMANDS,
  ...CHEMISTRY_COMMANDS,
]);

function isAsciiLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

/**
 * CHALLENGE #3: Function 1: `extractLatexCommands`
 *
 * Formal Contract:
 * - Precondition:  `text` is any string (possibly empty).
 * - Postcondition: Returns an ordered array `cmds` of every LaTeX control word
 *                  (`\` followed by one or more ASCII letters `[a-zA-Z]+`) found
 *                  in `text` from left to right.
 *                  - Double backslashes `\\` consume 2 characters and emit no command
 *                    (e.g. `"a \\\\frac"` -> `[]`, `"a \\\\\\frac"` -> `["\\frac"]`).
 *                  - Backslash followed by a non-letter (e.g. `\{`, `\,`, `\(`)
 *                    consumes 2 characters and emits no command.
 * - Complexity:    O(n) time, O(n) worst-case space, where n = text.length.
 */
export function extractLatexCommands(text: string): string[] {
  const cmds: string[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "\\") {
      let j = i + 1;
      while (j < text.length && isAsciiLetter(text[j])) {
        j += 1;
      }

      if (j > i + 1) {
        cmds.push(text.slice(i, j));
        i = j;
      } else {
        i += 2;
      }
    } else {
      i += 1;
    }
  }

  return cmds;
}

/**
 * CHALLENGE #3: Function 2: `findMatchingBrace`
 *
 * Formal Contract:
 * - Precondition:  `text` is any string and `openBraceIdx` is an integer index.
 *                  If `openBraceIdx < 0`, `openBraceIdx >= text.length`, or
 *                  `text[openBraceIdx] !== "{"`, returns `-1`.
 * - Postcondition: Returns the smallest index `closeIdx > openBraceIdx` of the
 *                  unescaped `}` that closes the `{` at `openBraceIdx`, properly
 *                  tracking nested `{...}` pairs and skipping backslash-escaped
 *                  pairs (`\\`, `\{`, `\}`). Returns `-1` if the brace never closes.
 * - Loop Invariant: While scanning inside the brace group, `depth >= 1` and
 *                   `openBraceIdx < i <= text.length`.
 * - Complexity:    O(n) time, O(1) auxiliary space.
 */
export function findMatchingBrace(text: string, openBraceIdx: number): number {
  if (
    openBraceIdx < 0 ||
    openBraceIdx >= text.length ||
    text[openBraceIdx] !== "{"
  ) {
    return -1;
  }

  let depth = 1;
  let i = openBraceIdx + 1;

  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    } else if (text[i] === "{") {
      depth += 1;
    } else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
    i += 1;
  }

  return -1;
}

function hasWindowsDrivePath(text: string): boolean {
  for (let i = 0; i < text.length - 2; i++) {
    if (isAsciiLetter(text[i]) && text[i + 1] === ":" && text[i + 2] === "\\") {
      return true;
    }
  }
  return false;
}

export interface BareLatexOptions {
  /** Include chemistry commands (`\ce`, `\pu`) in detection/segmentation. Defaults to `true`. */
  includeChemistry?: boolean;
}

/**
 * Returns `true` if `latex` contains any `mhchem` chemistry command (`\ce`, `\pu`).
 */
export function usesChemistryCommands(latex: string): boolean {
  return extractLatexCommands(latex).some((cmd) => CHEMISTRY_COMMANDS.has(cmd));
}

/**
 * CHALLENGE #3: Function 3: `hasBareLatex`
 *
 * Formal Contract:
 * - Precondition:  `text` is any string.
 * - Postcondition: Returns `true` if and only if ALL three conditions hold:
 *                  1. `parseMathSegments(text)` contains NO `"math"` segment
 *                     (the post is not already explicitly delimited).
 *                  2. `text` contains NO Windows drive path prefix (`<ASCII letter>:\`,
 *                     e.g. `C:\Users\...`).
 *                  3. At least one command returned by `extractLatexCommands(text)`
 *                     belongs to the active strong command set (`STRONG_LATEX_COMMANDS`
 *                     when `includeChemistry !== false`, or `MATH_STRONG_COMMANDS` otherwise).
 * - Complexity:    O(n) time.
 */
export function hasBareLatex(
  text: string,
  options?: BareLatexOptions
): boolean {
  const includeChemistry = options?.includeChemistry ?? true;
  const activeCommands = includeChemistry
    ? STRONG_LATEX_COMMANDS
    : MATH_STRONG_COMMANDS;

  const segments = parseMathSegments(text);
  for (const segment of segments) {
    if (segment.type === "math") {
      return false;
    }
  }

  if (hasWindowsDrivePath(text)) {
    return false;
  }

  const commands = extractLatexCommands(text);
  for (const cmd of commands) {
    if (activeCommands.has(cmd)) {
      return true;
    }
  }

  return false;
}

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
 * Extracts balanced `\ce{...}` and `\pu{...}` commands from a chemistry-only line,
 * preserving surrounding prose and keeping unclosed or empty commands as literal text.
 */
function parseChemistryLine(line: string, segments: Segment[]): void {
  const trimmedLine = line.trim();
  let i = 0;

  while (i < line.length) {
    // Skip escaped double backslashes (\\) so \\ce{...} is not treated as \ce{...}
    if (line[i] === "\\" && line[i + 1] === "\\") {
      pushText(segments, "\\\\");
      i += 2;
      continue;
    }

    if (line.startsWith("\\ce{", i) || line.startsWith("\\pu{", i)) {
      const openBraceIdx = i + 3;
      const closeIdx = findMatchingBrace(line, openBraceIdx);

      if (closeIdx === -1) {
        // Unclosed chemistry command -> keep opening prefix as literal text and keep scanning
        pushText(segments, line.slice(i, openBraceIdx + 1));
        i = openBraceIdx + 1;
        continue;
      }

      const raw = line.slice(i, closeIdx + 1);
      const inner = line.slice(openBraceIdx + 1, closeIdx).trim();

      if (inner === "") {
        pushText(segments, raw);
      } else {
        segments.push({
          type: "math",
          content: raw,
          mode: raw === trimmedLine ? "display" : "inline",
          raw,
        });
      }

      i = closeIdx + 1;
    } else {
      pushText(segments, line[i]);
      i += 1;
    }
  }
}

/**
 * CHALLENGE #3: Function 4: `parseBareLatexSegments`
 *
 * Formal Contract:
 * - Precondition:  `text` is any string.
 * - Postcondition:
 *   - If `text === ""`, returns `[]`.
 *   - If `!hasBareLatex(text)`, returns `[{ type: "text", content: text }]`.
 *   - Otherwise, processes `text` line by line while preserving every `"\n"`:
 *     * Case A (No strong command on the line): keep the line as `"text"`.
 *     * Case B (Only chemistry commands `\ce`/`\pu` among strong commands on the line):
 *       scan the line extracting each balanced `\ce{...}` / `\pu{...}` (using
 *       `findMatchingBrace`) whose inner brace content is non-empty after `.trim()`.
 *       Use `mode: "display"` if that chemistry command is the entire trimmed line,
 *       otherwise `mode: "inline"`. Unclosed or empty `\ce{}` stays literal `"text"`.
 *     * Case C (Line contains at least one strong math command from `MATH_STRONG_COMMANDS`):
 *       preserve leading and trailing whitespace on the line as `"text"`, and emit
 *       the trimmed core as `{ type: "math", content: trimmed, mode: "display", raw: trimmed }`.
 * - Global Invariants:
 *   1. Lossless round-trip: concatenating `text.content` / `math.raw` equals `text`.
 *   2. No empty `"text"` segments (`content.length > 0`).
 *   3. No two consecutive `"text"` segments.
 * - Complexity:    O(n) time.
 */
export function parseBareLatexSegments(
  text: string,
  options?: BareLatexOptions
): Segment[] {
  const includeChemistry = options?.includeChemistry ?? true;

  if (text === "") return [];
  if (!hasBareLatex(text, options)) {
    return [{ type: "text", content: text }];
  }

  const segments: Segment[] = [];
  const lines = text.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineCmds = extractLatexCommands(line);
    const hasMathCmd = lineCmds.some((cmd) => MATH_STRONG_COMMANDS.has(cmd));
    const hasChemCmd =
      includeChemistry && lineCmds.some((cmd) => CHEMISTRY_COMMANDS.has(cmd));

    if (!hasMathCmd && !hasChemCmd) {
      // Case A: regular text line
      pushText(segments, line);
    } else if (hasMathCmd) {
      // Case C: mathematical equation line (preserve leading/trailing whitespace losslessly)
      const trimmed = line.trim();
      const start = line.indexOf(trimmed);
      const leading = line.slice(0, start);
      const trailing = line.slice(start + trimmed.length);

      pushText(segments, leading);
      segments.push({
        type: "math",
        content: trimmed,
        mode: "display",
        raw: trimmed,
      });
      pushText(segments, trailing);
    } else {
      // Case B: chemistry-only line (\ce{...} / \pu{...})
      parseChemistryLine(line, segments);
    }

    // Re-insert the exact newline separator between lines to preserve lossless round-trip
    if (lineIdx < lines.length - 1) {
      pushText(segments, "\n");
    }
  }

  return segments;
}

function hasExplicitDelimitedMath(text: string): boolean {
  const segments = parseMathSegments(text);
  for (const segment of segments) {
    if (segment.type === "math") {
      return true;
    }
  }
  return false;
}

/**
 * Returns `true` when `text` contains no explicit math delimiters, no Windows
 * drive paths, and at least one high-precision Unicode or plain-math formula
 * suitable for feed posts (e.g. `ζ(s) = (1 − 1/2^s + ...) / (1 − 2^(1−s))`,
 * `0<Re(s)<1`, `e^(iπ) + 1 = 0`).
 */
export function hasPlainMath(text: string): boolean {
  if (!mightContainPlainMath(text)) return false;
  if (hasWindowsDrivePath(text)) return false;
  if (hasExplicitDelimitedMath(text)) return false;

  return detectPlainMathExpressions(text, { mode: "feed" }).length > 0;
}

function pushPlainMathSegments(text: string, segments: Segment[]): void {
  const matches = detectPlainMathExpressions(text, { mode: "feed" });
  if (matches.length === 0) {
    pushText(segments, text);
    return;
  }

  let cursor = 0;
  for (const match of matches) {
    pushText(segments, text.slice(cursor, match.replaceStart));
    segments.push({
      type: "math",
      content: match.latex,
      mode: match.mode,
      raw: match.raw,
    });
    cursor = match.replaceEnd;
  }

  pushText(segments, text.slice(cursor));
}

/**
 * Splits `text` into lossless `Segment[]`, converting feed-grade Unicode and
 * plain-math expressions into `"math"` segments while preserving every surrounding
 * character verbatim.
 */
export function parsePlainMathSegments(text: string): Segment[] {
  if (text === "") return [];
  if (!hasPlainMath(text)) {
    return [{ type: "text", content: text }];
  }

  const segments: Segment[] = [];
  pushPlainMathSegments(text, segments);
  return segments;
}

/**
 * Unified detector for undelimited posts: returns `true` if `text` contains
 * either strong bare LaTeX/chemistry commands OR feed-grade Unicode/plain math.
 */
export function hasUndelimitedMath(
  text: string,
  options?: BareLatexOptions
): boolean {
  const maybeBare = text.includes("\\");
  const maybePlain = mightContainPlainMath(text);
  if (!maybeBare && !maybePlain) return false;
  if (hasWindowsDrivePath(text)) return false;
  if (hasExplicitDelimitedMath(text)) return false;

  if (maybeBare && hasBareLatex(text, options)) {
    return true;
  }

  if (maybePlain && detectPlainMathExpressions(text, { mode: "feed" }).length > 0) {
    return true;
  }

  return false;
}

/**
 * Unified lossless segmenter for undelimited posts: handles bare LaTeX/chemistry
 * commands, Unicode/plain-math formulas, and hybrid posts combining both.
 */
export function parseUndelimitedMathSegments(
  text: string,
  options?: BareLatexOptions
): Segment[] {
  if (text === "") return [];

  if (text.includes("\\") && hasBareLatex(text, options)) {
    const bareSegments = parseBareLatexSegments(text, options);
    const merged: Segment[] = [];

    for (const seg of bareSegments) {
      if (
        seg.type === "text" &&
        !seg.content.includes("\\") &&
        mightContainPlainMath(seg.content)
      ) {
        pushPlainMathSegments(seg.content, merged);
      } else if (seg.type === "text") {
        pushText(merged, seg.content);
      } else {
        merged.push(seg);
      }
    }

    return merged;
  }

  return parsePlainMathSegments(text);
}

