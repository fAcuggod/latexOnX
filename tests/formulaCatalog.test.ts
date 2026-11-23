import { describe, expect, it } from "vitest";
import {
  applyFormulaInsertion,
  CATALOG_CATEGORIES,
  extractAutocompleteContext,
  filterCatalogEntries,
  FORMULA_CATALOG,
  insertCatalogEntryAtSelection,
  isCursorInsideMath,
  normalizeQuery,
  searchFormulaCatalog,
} from "../src/core/formulaCatalog.js";

describe("formulaCatalog (v1.1 Smart Autocomplete Core)", () => {
  it("normalizes accents, casing, punctuation, and extra whitespace", () => {
    expect(normalizeQuery("Función Zeta de Ríemann")).toBe(
      "funcion zeta de riemann"
    );
    expect(normalizeQuery("  Euler's   Identity  ")).toBe("euler s identity");
    expect(normalizeQuery("Ecuación de Schrödinger")).toBe(
      "ecuacion de schrodinger"
    );
  });

  it("accurately tracks whether cursor is inside or outside math delimiters", () => {
    expect(isCursorInsideMath("Plain text", 5)).toBe(false);
    expect(isCursorInsideMath("$$\\fr", 5)).toBe(true);
    expect(isCursorInsideMath("$$x^2$$ plain", 10)).toBe(false);
    expect(isCursorInsideMath("Inline \\(a + \\sq", 16)).toBe(true);
    expect(isCursorInsideMath("Inline \\(a\\) after", 15)).toBe(false);
  });

  it("detects ambient natural-language formula phrases in Spanish, English, and Chinese without false positives on normal prose", () => {
    // Exact user example: "funcion zeta de riemann"
    const draftEs = "Miren la funcion zeta de riemann";
    const ctxEs = extractAutocompleteContext(draftEs, draftEs.length);
    expect(ctxEs?.mode).toBe("ambient");
    const matchesEs = searchFormulaCatalog(ctxEs!, "es");
    expect(matchesEs.length).toBeGreaterThan(0);
    expect(matchesEs[0].entry.id).toBe("riemann-zeta");

    // Replacing preserves preceding prose verbatim
    const applied = applyFormulaInsertion(draftEs, matchesEs[0]);
    expect(applied.text).toBe(
      "Miren la $$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$"
    );

    // Accented Spanish phrase also matches and preserves exact replacement boundary
    const draftAccented = "Hoy vimos función zeta";
    const ctxAcc = extractAutocompleteContext(draftAccented, draftAccented.length);
    const matchesAcc = searchFormulaCatalog(ctxAcc!, "es");
    expect(matchesAcc[0].entry.id).toBe("riemann-zeta");
    expect(applyFormulaInsertion(draftAccented, matchesAcc[0]).text).toBe(
      "Hoy vimos $$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$"
    );

    // Chinese formula phrase
    const draftZh = "看看 欧拉恒等式";
    const ctxZh = extractAutocompleteContext(draftZh, draftZh.length);
    const matchesZh = searchFormulaCatalog(ctxZh!, "zh");
    expect(matchesZh[0].entry.id).toBe("euler-identity");

    // Normal everyday prose must NEVER trigger ambient suggestions
    for (const prose of [
      "Hola como estas hoy en X",
      "Just reading a great thread about coffee",
      "El partido termino 2 a 1",
    ]) {
      const ctx = extractAutocompleteContext(prose, prose.length);
      const matches = ctx ? searchFormulaCatalog(ctx, "es") : [];
      expect(matches).toEqual([]);
    }
  });

  it("supports explicit :query lookup for rapid search across all categories", () => {
    const draft = "Probando :cuad";
    const ctx = extractAutocompleteContext(draft, draft.length);
    expect(ctx?.mode).toBe("explicit");

    const matches = searchFormulaCatalog(ctx!, "es");
    expect(matches.some((m) => m.entry.id === "quadratic-formula")).toBe(true);

    const applied = applyFormulaInsertion(draft, matches[0]);
    expect(applied.text).toBe(
      "Probando $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"
    );

    // Never triggers on URLs or timestamps
    expect(extractAutocompleteContext("https://x.com", 13)?.mode).not.toBe(
      "explicit"
    );
    expect(extractAutocompleteContext("Meet at 12:30", 13)?.mode).not.toBe(
      "explicit"
    );
  });

  it("autocompletes backslash commands and wraps bare commands in \\(...\\) only when outside math", () => {
    // 1. Inside math delimiters: inserts bare \frac{}{} with cursor inside first braces
    const insideDraft = "$$\\fr";
    const insideCtx = extractAutocompleteContext(insideDraft, insideDraft.length);
    expect(insideCtx?.mode).toBe("command");
    expect(insideCtx?.insideMath).toBe(true);

    const insideMatches = searchFormulaCatalog(insideCtx!, "en");
    expect(insideMatches[0].entry.id).toBe("cmd-frac");

    const insideApplied = applyFormulaInsertion(insideDraft, insideMatches[0]);
    expect(insideApplied.text).toBe("$$\\frac{}{}");
    expect(insideApplied.cursorPos).toBe(2 + 6); // right inside first `{}`

    // 2. Outside math delimiters: wraps cleanly in \(...\) with cursor inside first braces
    const outsideDraft = "Ratio \\fr";
    const outsideCtx = extractAutocompleteContext(
      outsideDraft,
      outsideDraft.length
    );
    expect(outsideCtx?.insideMath).toBe(false);

    const outsideMatches = searchFormulaCatalog(outsideCtx!, "en");
    const outsideApplied = applyFormulaInsertion(
      outsideDraft,
      outsideMatches[0]
    );
    expect(outsideApplied.text).toBe("Ratio \\(\\frac{}{}\\)");
    expect(outsideApplied.cursorPos).toBe("Ratio \\(\\frac{".length);

    // 3. Ignores escaped line-break `\\fr`
    expect(extractAutocompleteContext("a \\\\fr", 6)?.mode).not.toBe("command");
  });

  it("ensures every catalog entry has non-empty localized labels across en/es/zh", () => {
    expect(FORMULA_CATALOG.length).toBeGreaterThanOrEqual(45);
    for (const entry of FORMULA_CATALOG) {
      expect(entry.labels.en.trim().length).toBeGreaterThan(0);
      expect(entry.labels.es.trim().length).toBeGreaterThan(0);
      expect(entry.labels.zh.trim().length).toBeGreaterThan(0);
      expect(entry.previewLatex.trim().length).toBeGreaterThan(0);
      expect(entry.keywords.en.length).toBeGreaterThan(0);
      expect(entry.keywords.es.length).toBeGreaterThan(0);
      expect(entry.keywords.zh.length).toBeGreaterThan(0);
    }
  });

  it("scopes ambient autocomplete strictly to the active UI locale (en, es, zh) including function / funcion / 函数", () => {
    const queryAmbient = (text: string, locale: "en" | "es" | "zh") => {
      const ctx = extractAutocompleteContext(text, text.length);
      return ctx ? searchFormulaCatalog(ctx, locale, 5) : [];
    };

    // English UI: "function" suggests functions, Spanish "funcion" does NOT trigger
    const enFunc = queryAmbient("function", "en");
    expect(enFunc.map((m) => m.entry.id)).toEqual(
      expect.arrayContaining(["piecewise-function", "riemann-zeta", "softmax-function"])
    );
    expect(queryAmbient("funcion", "en")).toEqual([]);

    // Spanish UI: "funcion" suggests functions, English "function" does NOT trigger
    const esFunc = queryAmbient("funcion", "es");
    expect(esFunc.map((m) => m.entry.id)).toEqual(
      expect.arrayContaining(["piecewise-function", "riemann-zeta", "softmax-function"])
    );
    expect(queryAmbient("function", "es")).toEqual([]);

    // Chinese UI: "函数" and unspaced "看看函数" suggest functions; "funcion" / "function" do NOT trigger
    const zhFunc = queryAmbient("函数", "zh");
    expect(zhFunc.map((m) => m.entry.id)).toEqual(
      expect.arrayContaining(["piecewise-function", "riemann-zeta", "softmax-function"])
    );
    const zhInline = queryAmbient("看看函数", "zh");
    expect(zhInline.length).toBeGreaterThanOrEqual(3);
    const appliedZh = applyFormulaInsertion("看看函数", zhInline[0]);
    expect(appliedZh.text.startsWith("看看")).toBe(true);
    expect(appliedZh.text).not.toContain("函数");

    expect(queryAmbient("funcion", "zh")).toEqual([]);
    expect(queryAmbient("function", "zh")).toEqual([]);

    // Generic everyday words in each language must NOT spam ambient suggestions
    expect(queryAmbient("I have a normal problem", "en")).toEqual([]);
    expect(queryAmbient("no hay problema normal", "es")).toEqual([]);
    expect(queryAmbient("这个状态很好", "zh")).toEqual([]);
  });
});

describe("formulaCatalog (v1.4 Formula Explorer & Search)", () => {
  it("lists entries by category and excludes chemistry entries when enableChemistry is false", () => {
    expect(CATALOG_CATEGORIES[0]).toBe("command");

    const basics = filterCatalogEntries({ category: "command", locale: "es" });
    expect(basics.length).toBeGreaterThan(10);
    expect(basics.every((e) => e.category === "command")).toBe(true);
    expect(basics.some((e) => e.id === "cmd-int")).toBe(true);
    expect(basics.some((e) => e.id === "cmd-int-indef")).toBe(true);

    const chemOn = filterCatalogEntries({
      category: "chemistry",
      enableChemistry: true,
    });
    expect(chemOn.length).toBeGreaterThan(0);

    const chemOff = filterCatalogEntries({
      category: "chemistry",
      enableChemistry: false,
    });
    expect(chemOff).toEqual([]);

    // Search across all categories ignores chemistry when disabled
    const searchChemOff = filterCatalogEntries({
      query: "agua",
      locale: "es",
      enableChemistry: false,
    });
    expect(searchChemOff.some((e) => e.category === "chemistry")).toBe(false);
  });

  it("searches across all categories accent-insensitively by natural name or LaTeX command", () => {
    // Searching "integral" finds definite, indefinite, and Gaussian integrals regardless of active tab
    const integrals = filterCatalogEntries({
      query: "integral",
      category: "algebra",
      locale: "es",
    });
    expect(integrals.some((e) => e.id === "cmd-int")).toBe(true);
    expect(integrals.some((e) => e.id === "cmd-int-indef")).toBe(true);
    expect(integrals.some((e) => e.id === "gaussian-integral")).toBe(true);

    // Searching with accent-free Spanish or LaTeX command works directly
    const limits = filterCatalogEntries({ query: "limite", locale: "es" });
    expect(limits[0].id).toBe("cmd-lim");

    const byCmd = filterCatalogEntries({ query: "\\frac", locale: "en" });
    expect(byCmd[0].id).toBe("cmd-frac");
  });

  it("inserts catalog entries at selection, wrapping bare commands outside math and filling braces for selected text", () => {
    const defInt = FORMULA_CATALOG.find((e) => e.id === "cmd-int")!;
    const frac = FORMULA_CATALOG.find((e) => e.id === "cmd-frac")!;
    const sqrt = FORMULA_CATALOG.find((e) => e.id === "cmd-sqrt")!;

    // 1. Inserting an integral into an empty composer auto-wraps in \(...\) and places caret before \,dx
    const insertedInt = insertCatalogEntryAtSelection("", 0, 0, defInt);
    expect(insertedInt.text).toBe("\\(\\int_{a}^{b} \\,dx\\)");
    expect(insertedInt.cursorPos).toBe(2 + 13);

    // 2. Highlighted selection + \sqrt{} puts selection inside braces and auto-wraps outside math
    const wrappedSqrt = insertCatalogEntryAtSelection("Sea x + 1 listo", 4, 9, sqrt);
    expect(wrappedSqrt.text).toBe("Sea \\(\\sqrt{x + 1}\\) listo");

    // 3. Highlighted selection + \frac{}{} inside math puts selection in numerator and moves caret to denominator
    const wrappedFrac = insertCatalogEntryAtSelection("$$a+b$$", 2, 5, frac);
    expect(wrappedFrac.text).toBe("$$\\frac{a+b}{}$$");
    expect(wrappedFrac.cursorPos).toBe("$$\\frac{a+b}{".length);
  });
});

