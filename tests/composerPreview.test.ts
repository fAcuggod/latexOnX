import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeComposerDraft,
  convertDisplayHintToInline,
  createDebouncer,
  findInlineDisplayHints,
  findUnclosedDelimiter,
} from "../src/core/composerPreview.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("findUnclosedDelimiter (Challenge #4.1)", () => {
  it("returns null for empty text, plain text, and properly closed formulas", () => {
    expect(findUnclosedDelimiter("")).toBeNull();
    expect(findUnclosedDelimiter("Plain draft with $50 and $BTC")).toBeNull();
    expect(
      findUnclosedDelimiter("Inline \\(x^2\\) and block $$E = mc^2$$ and \\[a\\]")
    ).toBeNull();
  });

  it("detects unclosed $$, \\(, and \\[ delimiters with exact starting index", () => {
    expect(findUnclosedDelimiter("Proof: $$\\frac{1}{2}")).toEqual({
      open: "$$",
      close: "$$",
      index: 7,
    });

    expect(findUnclosedDelimiter("Inline \\(e^{i\\pi}")).toEqual({
      open: "\\(",
      close: "\\)",
      index: 7,
    });

    expect(findUnclosedDelimiter("\\[\\int_0^1 x\\,dx")).toEqual({
      open: "\\[",
      close: "\\]",
      index: 0,
    });
  });

  it("skips completely closed formulas before detecting a later unclosed delimiter", () => {
    const draft = "First \\(a + b\\) ok, second $$\\zeta(s)";
    expect(findUnclosedDelimiter(draft)).toEqual({
      open: "$$",
      close: "$$",
      index: draft.indexOf("$$"),
    });
  });

  it("does not get fooled by another delimiter inside a closed block", () => {
    expect(findUnclosedDelimiter("$$\\text{literal \\( inside}$$")).toBeNull();
  });
});

describe("analyzeComposerDraft (Challenge #4.2)", () => {
  it("hides preview for plain drafts without math or diagnostics", () => {
    const res = analyzeComposerDraft("Just a regular post on X!");
    expect(res.shouldShowPreview).toBe(false);
    expect(res.formulaCount).toBe(0);
    expect(res.diagnostics).toEqual([]);
    expect(res.segments).toEqual([
      { type: "text", content: "Just a regular post on X!" },
    ]);
  });

  it("shows preview with zero diagnostics for valid formulas", () => {
    const res = analyzeComposerDraft(
      "Euler \\(e^{i\\pi} + 1 = 0\\) and $$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$"
    );
    expect(res.shouldShowPreview).toBe(true);
    expect(res.formulaCount).toBe(2);
    expect(res.diagnostics).toEqual([]);
  });

  it("reports validation errors with exact formulaIndex while preserving valid formulas", () => {
    const res = analyzeComposerDraft(
      "Ok \\(x^2\\), broken $$\\frac{a}{b$$, forbidden $$\\def\\a{1}$$"
    );
    expect(res.shouldShowPreview).toBe(true);
    expect(res.formulaCount).toBe(3);
    expect(res.diagnostics).toHaveLength(2);

    expect(res.diagnostics[0]).toMatchObject({
      kind: "validation_error",
      formulaIndex: 1,
      reason: "unbalanced_braces",
      raw: "$$\\frac{a}{b$$",
    });
    expect(res.diagnostics[1]).toMatchObject({
      kind: "validation_error",
      formulaIndex: 2,
      reason: "forbidden_command",
      raw: "$$\\def\\a{1}$$",
    });
  });

  it("shows preview and reports unclosed_delimiter even when formulaCount is 0", () => {
    const res = analyzeComposerDraft("Typing $$\\sum_{n=1}^\\infty");
    expect(res.shouldShowPreview).toBe(true);
    expect(res.formulaCount).toBe(0);
    expect(res.diagnostics).toEqual([
      {
        kind: "unclosed_delimiter",
        open: "$$",
        close: "$$",
        index: 7,
      },
    ]);
  });

  it("reports chemistry_disabled diagnostic when enableChemistry is false", () => {
    const res = analyzeComposerDraft("Water $$\\ce{H2O}$$", {
      enableChemistry: false,
    });
    expect(res.shouldShowPreview).toBe(true);
    expect(res.formulaCount).toBe(1);
    expect(res.diagnostics).toEqual([
      {
        kind: "chemistry_disabled",
        formulaIndex: 0,
        raw: "$$\\ce{H2O}$$",
      },
    ]);
  });
});

describe("createDebouncer (Challenge #4.3)", () => {
  it("delays execution until delayMs elapses without a new trigger", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncer = createDebouncer(120, fn);

    expect(debouncer.isPending()).toBe(false);

    debouncer.trigger();
    expect(debouncer.isPending()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();

    // Rapid re-trigger resets the 120ms countdown
    debouncer.trigger();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
    expect(debouncer.isPending()).toBe(true);

    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(debouncer.isPending()).toBe(false);
  });

  it("cancels pending execution cleanly and is idempotent", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncer = createDebouncer(100, fn);

    debouncer.cancel(); // no-op when idle
    expect(debouncer.isPending()).toBe(false);

    debouncer.trigger();
    expect(debouncer.isPending()).toBe(true);

    debouncer.cancel();
    expect(debouncer.isPending()).toBe(false);

    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it("flushes immediately once when pending and is a no-op when idle", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncer = createDebouncer(150, fn);

    debouncer.flush(); // idle -> no-op
    expect(fn).not.toHaveBeenCalled();

    debouncer.trigger();
    expect(debouncer.isPending()).toBe(true);

    debouncer.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(debouncer.isPending()).toBe(false);

    // Ensure original timer was cancelled and does not double-fire
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("findInlineDisplayHints & convertDisplayHintToInline (v1.3)", () => {
  it("flags mid-sentence $$...$$ blocks and converts cleanly to inline \\(...\\)", () => {
    const draft =
      "si definimos a \\(e^{i\\pi} + 1 = 0\\) es facil ver que restando $$1$$ a ambos lados, se tiene que \\(e^{i\\pi} = -1\\)";
    const hints = findInlineDisplayHints(draft);

    expect(hints).toHaveLength(1);
    expect(hints[0]).toEqual({
      raw: "$$1$$",
      content: "1",
      start: draft.indexOf("$$1$$"),
      end: draft.indexOf("$$1$$") + "$$1$$".length,
      inlineReplacement: "\\(1\\)",
    });

    const converted = convertDisplayHintToInline(draft, hints[0]);
    expect(converted.text).toBe(
      "si definimos a \\(e^{i\\pi} + 1 = 0\\) es facil ver que restando \\(1\\) a ambos lados, se tiene que \\(e^{i\\pi} = -1\\)"
    );
    expect(converted.cursorPos).toBe(hints[0].start + "\\(1\\)".length);
  });

  it("flags short one-sided inline $$x$$ prose while ignoring standalone, colon-introduced, block-command, and \\[...\\] equations", () => {
    // Short inline on one side without colon -> helpful tip
    expect(findInlineDisplayHints("sumamos el valor $$x$$")).toHaveLength(1);
    expect(findInlineDisplayHints("$$1$$ es el neutro")).toHaveLength(1);

    // Standalone display formulas -> NOT flagged
    expect(findInlineDisplayHints("$$E = mc^2$$")).toEqual([]);
    expect(
      findInlineDisplayHints(
        "Intro line\n$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$\nOutro"
      )
    ).toEqual([]);

    // Colon-introduced or block-command equations at end of line -> NOT flagged
    expect(findInlineDisplayHints("Euler: $$e^{i\\pi} + 1 = 0$$")).toEqual([]);
    expect(findInlineDisplayHints("Integral: $$\\int_0^1 x\\,dx$$")).toEqual([]);
    expect(
      findInlineDisplayHints("Mirar la $$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$")
    ).toEqual([]);

    // Explicit \[...\] syntax -> NOT flagged
    expect(findInlineDisplayHints("restando \\[1\\] a ambos lados")).toEqual([]);
  });
});

