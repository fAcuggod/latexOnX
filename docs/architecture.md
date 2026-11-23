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
   - **Delegated interaction handler:** a single global listener handles both click-to-copy (with localized CSS `attr(data-copied-label)` feedback) and the discrete opt-in `∑ Render LaTeX` / `↺ Show raw` post button.
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


