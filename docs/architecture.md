# Architecture & Engineering Decisions

This document explains how each layer of **LaTeX on X** works and why key design decisions were made.

---

## 1. Layered Design: Functional Core, Imperative Shell

The codebase strictly separates pure computation from browser/DOM side effects:

```text
src/content/   (Imperative shell: x.com DOM, MutationObserver, chrome.storage)
     │
     ▼
src/renderer/  (KaTeX bridge: DOM tree rendering, HTML + MathML, graceful fallback)
     │
     ▼
src/core/      (100% pure core: parser & security validator, zero external dependencies)
```

Because `src/core/` has no DOM or browser API dependencies, it is fast to test, easy to reason about, and completely insulated from frontend churn on `x.com`.

---

## 2. End-to-End Post Processing Pipeline

1. **Timeline Observation (`src/content/observer.ts`):**
   - A `MutationObserver` watches `document.body` (`childList: true, subtree: true, characterData: true`), capturing both infinite-scroll posts and React SPA hydration updates inside already-mounted `<article>` elements (resolving ancestors via `closest()`).
   - Mutations created by our own rendered spans (`data-latex-on-x="rendered"` / `.katex`) are ignored to avoid feedback loops.
   - Added/updated elements are deduplicated into a `Set` and flushed once per animation frame (`requestAnimationFrame`) to sustain 60-120 FPS scrolling.

2. **Resilient DOM Traversal (`src/content/domProcessor.ts`):**
   - **Semantic selectors:** targets `[data-testid="tweetText"], article, [role="article"]`. Unlike fragile internal `data-testid` attributes (which X removed during frontend rewrites), HTML5 `<article>` landmarks persist for accessibility.
   - **Zero-allocation fast-path (`mightContainMath`):** posts without `$$`, `\(` or `\[` are skipped immediately in $O(n)$ with zero allocations.
   - **Safe `TreeWalker`:** only processes text nodes outside `<a>`, `<button>`, `<time>`, `<code>`, `<pre>`, `<svg>`, `.sr-only`, `[aria-hidden="true"]`, `[contenteditable="true"]`, and already-rendered formulas (idempotency).
   - **Collect-then-mutate + `DocumentFragment`:** collects candidate text nodes before mutating the tree, then replaces each node using a single off-screen `DocumentFragment` (one reflow).

3. **Lexical Scanner (`src/core/parser.ts`):**
   - Linear scanner using half-open `[start, end)` slicing and explicit delimiters (`$$...$$`, `\[...\]`, `\(...\)`) to avoid collisions with currency notation and cashtags.
   - Enforces a **lossless round-trip invariant**: concatenating `text.content` and `math.raw` always reconstructs the exact original string.

4. **High-Precision Bare-LaTeX & Chemistry Detector (`src/core/detector.ts`):**
   - Extracts real LaTeX control words via two-pointer scanning (`extractLatexCommands`) and matches nested brace groups (`findMatchingBrace`) to support ionic charges like `\ce{Fe^{2+} + 2OH- -> Fe(OH)2}`.
   - `hasBareLatex` triggers only when a post has no explicit delimiters, no Windows drive paths (`<letter>:\`), and at least one unambiguous math/chemistry command.
   - `parseBareLatexSegments` preserves lossless round-trip invariants line by line, extracting inline `\ce{...}` / `\pu{...}` spans alongside display equation lines.

5. **Anti-DoS Security Validator (`src/core/validator.ts`):**
   - **Max length check first** (default 500 chars) to bound all downstream work.
   - **Brace balance & nesting depth** (default 15 levels), handling escaped braces (`\{`, `\}`) and line breaks (`\\`).
   - **Control-word tokenization** using two pointers (`i`, `j`) over ASCII letters so disallowed commands (`\def`, `\let`, `\newcommand`, `\href`, `\htmlStyle`, etc.) never falsely match legitimate shared-prefix symbols like `\leftarrow`.

6. **Trusted-Types-Safe KaTeX + `mhchem` Rendering (`src/renderer/katexRenderer.ts`):**
   - Registers KaTeX's official `mhchem` extension (`\ce`, `\pu`) guarded by the user's `enableChemistry` toggle.
   - Second defense-in-depth layer: `trust: false`, `maxSize: 10`, `maxExpand: 100`.
   - **Zero `.innerHTML`:** `renderFormulaToElement` calls `katex.render()`, which builds DOM nodes directly via `createElement`/`appendChild`, complying with X's *Trusted Types* CSP (`require-trusted-types-for 'script'`).
   - **Accessibility:** `output: "htmlAndMathml"` emits visual HTML+CSS alongside native `<math>` MathML for screen readers.
   - **Graceful fallback & XSS safety:** syntax errors are caught and restored to literal `raw` text; all plain text is inserted via `document.createTextNode(...)`.

7. **Chrome Manifest V3 & Internationalization (`public/`, `src/i18n/`, `scripts/build.mjs`):**
   - **Least privilege:** requests only `"storage"` permission, restricts injection to `x.com` / `twitter.com`, and runs without a persistent background service worker.
   - **Delegated interaction handler:** a single global listener handles both click-to-copy (with an overflow-proof floating Top Layer toast anchored via `getBoundingClientRect()` so `overflow-y: hidden` on display equations never clips it) and the discrete opt-in `∑ Render LaTeX` / `↺ Show raw` post button.
   - **Optimized local fonts:** `scripts/build.mjs` strips legacy `.ttf`/`.woff` rules, bundling only `.woff2` (~250 KB vs ~1.3 MB) rewritten to `chrome-extension://__MSG_@@extension_id__/fonts/` in `web_accessible_resources`.
   - **Multilingual support:** official Chrome `_locales/` (`en`, `es`, `zh_CN`) plus a live `EN | ES | 中文` switcher and feature toggles synced across tabs via `chrome.storage.sync`.

8. **Live Composer Preview (`src/core/composerPreview.ts` & `src/content/composerOverlay.ts`):**
   - **Pure draft analyzer:** `analyzeComposerDraft` runs `parseMathSegments`, `validateLatex`, and `findUnclosedDelimiter` to produce a declarative preview state (`shouldShowPreview`, `segments`, `diagnostics`, `formulaCount`).
   - **Debounced updates:** `createDebouncer(120, ...)` throttles rapid keystrokes so KaTeX re-renders once per typing pause rather than on every character.
   - **Floating Top Layer portal:** anchored to X's native `<textarea>` composers (and legacy `[role="textbox"][contenteditable]` editors) via `getBoundingClientRect()` (auto-flipping above when near the bottom edge), lifted into the browser Top Layer via `popover="manual"` (and hosted inside native `<dialog>` modals when active) with capture-phase listeners so X's React handlers cannot block updates, and rendered without `.innerHTML` (Trusted Types compliant).
   - **Automatic theme matching:** inspects `getComputedStyle(document.body / document.documentElement).backgroundColor` luminance to match X's Light, Dim, or Lights Out surface.

9. **3x HiDPI PNG Formula Export (`src/core/pngExporter.ts` & `src/content/formulaImageExport.ts`):**
   - **Pure geometry & SVG builder:** `computeExportGeometry` enforces minimum card dimensions and proportional anti-OOM clamping (`maxPixelDimension = 4096`), `rewriteCssFontUrls` embeds Base64 `.woff2` font URIs in a single linear pass, and `buildFormulaSvgDocument` builds a CDATA-escaped SVG `<foreignObject>` scaled cleanly at 3x via `width`/`height` + `viewBox`.
   - **Trusted-Types-safe rasterization:** clones preview nodes without `.innerHTML`, strips hidden `.katex-mathml` from the offscreen clone, rasterizes via `data:image/svg+xml` onto `<canvas>`, and copies `image/png` to the clipboard (preserving user activation via `ClipboardItem` promise support, with automatic `.png` download fallback).

10. **Zero-Dependency Rust/WebAssembly Core (`crates/latex-core/` & `src/wasm/`):**
    - **Zero-copy Rust core:** mirrors `src/core/parser.ts` and `src/core/validator.ts` using borrowed `&'a str` slices, algebraic `enum` types, and a UTF-8-safe ASCII byte fast-path (`21` native `cargo test` cases).
    - **Linear-memory WASM ABI:** compiles directly to `src/wasm/latex_core.wasm` (`37.5 KB`, zero external crates) using a flat `u32` offset table and reusable scratch buffer (`src/wasm/wasmCore.ts`), verified by differential equivalence tests (`tests/wasmCore.test.ts`) and benchmarked at up to **8.02x** throughput vs. V8 JIT TypeScript over 10,000 posts.

11. **Smart Composer Autocomplete & Natural-Name Formula Catalog (`src/core/formulaCatalog.ts` & `src/content/composerOverlay.ts`):**
    - **Accent-insensitive multilingual search:** normalizes queries with Unicode NFD decomposition to match named formulas in EN/ES/ZH via three contexts: ambient high-precision phrases (`funcion zeta de riemann`), explicit `:query` triggers, and `\command` templates.
    - **React-safe caret insertion:** updates X's controlled `<textarea>` via `HTMLTextAreaElement.prototype`'s native `value` setter + `InputEvent("input")` so React's internal state tracks every insertion, automatically wrapping bare commands in `\(...\)` when outside math delimiters and placing the caret inside the first `{}` placeholder.

12. **Plain-Math AST Mini-Compiler (`src/core/plainMathCompiler.ts`):**
    - **Four-stage pure compiler:** `tokenizePlainMath` (maximal-munch lexer) -> `parsePlainMathToAst` (recursive-descent parser respecting operator precedence, implicit multiplication, right-associative powers, primes, and bounded recursion depth) -> `emitLatexFromAst` (unwrapping redundant parens inside `\frac`, `\sqrt`, and scripts with smart `\left(...\right)`) -> `detectPlainMathExpressions` (linear multi-span prose scanner handling multiple embedded formulas with trailing prose while rejecting dates, scores, ratios, URLs, and plain words).
    - **Zero-LaTeX authoring workflow:** shows a live KaTeX preview directly in X's composer for expressions like `f(x) = 5x + 2` or `(a+b)/(c-d)`, with both atomic one-click `Convert to LaTeX` (`Tab`) and direct 3x `PNG` export.

13. **Inline-Display Typography Assistant & Quick Symbol Bar (`src/core/composerPreview.ts`, `src/core/symbolBar.ts` & `src/content/composerOverlay.ts`):**
    - **Non-blocking inline-display hints:** preserves standard LaTeX display semantics (`$$...$$` = centered block) while `findInlineDisplayHints` detects `$$...$$` formulas embedded mid-sentence (ignoring standalone, colon-introduced, block-command, and `\[...\]` equations) and offers a localized 1-click `Use inline \(...\)` conversion button (`convertDisplayHintToInline`).
    - **Quick Symbol Bar:** renders a compact `role="toolbar"` palette (`\(x\)`, `$$`, `a/b`, `√`, `x²`, `∑`, `∫`, `π`, `∞`, `≤`, `→`, `\ce`) via `applyQuickSymbol` and `readComposerSelection`, wrapping highlighted selections or auto-wrapping bare math symbols in `\(...\)` when outside math delimiters while positioning the caret inside the first editable slot and hiding `\ce` whenever `enableChemistry` is disabled.

14. **On-Demand Composer Launcher & Formula Explorer (`src/core/formulaCatalog.ts` & `src/content/composerOverlay.ts`):**
    - **Zero-idle-cost floating launcher (`∑`):** mounted in the same Top Layer portal (`popover="manual"` / native `<dialog>`) as the preview panel without mutating X's React toolbar DOM, running zero KaTeX calls until clicked.
    - **Lazy category tabs & live search:** `filterCatalogEntries` ranks entries across EN/ES/ZH titles, aliases, and LaTeX commands (`< 0.1 ms`), rendering only the active category or visible search matches via KaTeX while updating only the results list so the search `<input>` keeps focus across keystrokes.
    - **Selection-preserving insertion:** `insertCatalogEntryAtSelection` preserves the composer's `[selectionStart, selectionEnd]` range while searching, places highlighted text inside brace templates (`\sqrt{}`, `\frac{}{}`, `\ce{}`), wraps bare commands in `\(...\)` outside math, and returns focus directly to X's `<textarea>`.

15. **Unicode/Plain-Math Feed Detection & Auto-Render Undelimited Mode (`src/core/plainMathCompiler.ts`, `src/core/detector.ts`, `src/content/domProcessor.ts` & `src/popup/`):**
    - **Unicode-aware AST compiler:** extends `tokenizePlainMath` and `parsePlainMathToAst` to handle single Greek letters (rejecting multi-letter Greek prose words), Unicode operators and relations (`−`, `×`, `÷`, `±`, `≤`, `≥`, `≠`, `≈`, `→`, `⇒`, `∈`, `∀`, `∃`, `ℝ`), roots (`√`), big operators (`∑`, `∏`, `∫`, `∮`, `lim`), Unicode superscript/subscript runs (`x²`, `aₙ₊₁`, `2¹⁻ˢ`), brace script groups (`e^{iπ}`), `Re`/`Im` operators, ellipsis (`...`, `…`, `⋯`), and unmatched prose parentheses (`(where Re(s)>0)`).
    - **Dual-mode precision filtering (`composer` vs `feed`):** guarded by the zero-allocation `O(n)` pre-check `mightContainPlainMath`, `feed` mode enforces stricter structural rules rejecting slash abbreviations (`A/B`, `I/O`, `w/o`, `UI/UX`, `f/1.8`), everyday units and bare chemical subscripts (`m²`, `CO₂`, `H₂O`), screen resolutions (`1920 × 1080`), prose arrows (`A → B`), and trivial shorthand (`A = B`), while preserving lossless round-trip invariants in `parsePlainMathSegments` and `parseUndelimitedMathSegments`.
    - **Optional auto-render undelimited (`autoRenderBareLatex`):** synced live via `chrome.storage.sync` from the popup; when enabled alongside undelimited detection, `processTweetElement` attaches the `↺ Show raw` revert bar before replacing text nodes (preserving anchor placement), renders immediately with zero `.innerHTML`, and respects manual reversions across subsequent `MutationObserver` passes because the persisted button bar prevents re-triggering.


