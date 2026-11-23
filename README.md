<div align="center">
  <img src="public/icons/icon.svg" alt="LaTeX on X logo" width="84" height="84" />
  <h1>LaTeX on X</h1>
  <p><strong>Render LaTeX math formulas natively on X (<code>x.com</code>) in real time with KaTeX.</strong></p>

  <p>
    <strong>English</strong> · <a href="README.es.md">Español</a> · <a href="README.zh-CN.md">简体中文</a>
  </p>

  <p>
    <a href="https://github.com/fAcuggod/latexOnX/actions/workflows/ci.yml">
      <img src="https://github.com/fAcuggod/latexOnX/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript Strict" />
    <img src="https://img.shields.io/badge/Rust-WebAssembly-DEA584?logo=rust&logoColor=white" alt="Rust WebAssembly" />
    <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3" />
    <img src="https://img.shields.io/badge/Renderer-KaTeX-329894" alt="KaTeX" />
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" />
    </a>
  </p>
</div>

---

## Why LaTeX on X?

Sharing mathematics on **X** (`x.com`) usually means uploading low-resolution screenshots or writing unreadable plain-text approximations. Unlike single-dollar (`$...$`) renderers, which collide with currency notation and financial cashtags, **LaTeX on X** uses unambiguous mathematical delimiters, validates every expression against DoS payloads, and renders formulas in under 1 ms using **KaTeX** (visual HTML + accessible MathML).

### Key Features

- **Collision-free delimiters:** supports `\(...\)` inline and `$$...$$` / `\[...\]` display blocks, leaving single-dollar currency notation and cashtags completely untouched.
- **Live composer preview & diagnostics:** floating, debounced KaTeX preview below X's post/reply composer showing unclosed delimiters, unbalanced braces, disallowed macros, and syntax errors *before* posting, plus a one-click `Use inline \(...\)` tip when a `$$...$$` display block is embedded mid-sentence.
- **On-demand Formula Explorer & Quick Symbol Bar:** a discrete `∑` button appears on any focused X composer (even when empty) to open a searchable catalog of formulas and symbols organized by category (`Basics`, `Calculus`, `Algebra`, `Physics`, `Probability`, `Chemistry`) alongside the Quick Symbol Bar (`\(x\)`, `$$`, `a/b`, `√`, `x²`, `∑`, `∫`, `π`, `∞`, `≤`, `→`, `\ce`).
- **Inline composer autocomplete:** type formula names in English, Spanish, or Chinese (e.g. `riemann zeta`, `funcion zeta de riemann`, `formula cuadratica`, `欧拉恒等式`), search with `:query`, or type `\frac` / `\sum` commands and press `Tab` (or click) to insert LaTeX.
- **Plain-math AST compiler (`f(x) = 5x + 2` -> LaTeX):** pure recursive-descent parser (`Lexer -> AST -> LaTeX`) previews everyday expressions like `f(x) = 5x + 2`, `(a+b)/(c-d)`, `sqrt(a^2+b^2)`, `det(A) = ad - bc`, and `Av = lambda v` directly in KaTeX with one-click `Convert to LaTeX` (`Tab`) or direct 3x `PNG` export, strictly ignoring dates, scores, and prose.
- **One-click 3x HiDPI PNG export:** click `PNG` in the live preview header to copy a crisp 3x formula card matching X's Light, Dim, or Lights Out theme directly to your clipboard (paste into X with `Ctrl+V`, with automatic `.png` download fallback).
- **Chemistry & physical units (`mhchem`):** natively renders chemical formulas, ionic charges, reaction arrows, and physical units (`\ce{...}`, `\pu{...}`), toggleable from the popup.
- **Opt-in undelimited LaTeX button:** detects posts containing unambiguous raw LaTeX/chemistry commands (ignoring code escapes and Windows paths) and offers a discrete `∑ Render LaTeX` / `↺ Show raw` toggle right below the post.
- **Built for X's modern frontend:** targets resilient HTML5 semantic landmarks (`<article>` / `[role="article"]`) and builds DOM trees directly via `katex.render()` with **zero `.innerHTML`**, complying with X's strict *Trusted Types* CSP.
- **60-120 FPS infinite scrolling:** `O(n)` zero-allocation fast-path skips non-math posts immediately, paired with a `requestAnimationFrame`-batched `MutationObserver`.
- **Zero-dependency Rust/WASM core:** pure parser and anti-DoS validator ported to zero-copy Rust (`crates/latex-core/`), compiled to a **37.5 KB** `.wasm` module and verified for differential equivalence against TypeScript.
- **Defense-in-depth security:** pre-render validator enforces length caps, brace nesting depth, and blocks unsafe macros (`\def`, `\let`, `\newcommand`, `\href`, `\htmlStyle`, etc.) before KaTeX executes; plain text is always inserted as `TextNode` (XSS-safe).
- **Accessible & theme-native:** outputs HTML + native MathML for screen readers and adapts automatically to X's **Light**, **Dim**, and **Lights Out** themes.
- **Click-to-copy & instant On/Off:** click (or press Enter/Space on) any rendered formula to copy its LaTeX source; toggle rendering, chemistry, live preview, or the opt-in button live without reloading tabs.
- **Multilingual UI:** built-in **English**, **Español**, and **简体中文** support (auto-detected with manual switcher in the popup).
- **Minimal permissions:** requests only `"storage"`, runs with no background service worker, and bundles `.woff2` KaTeX fonts locally (zero external CDNs).

---

## Supported Syntax

| Mode | Delimiters / Command | Example |
| :--- | :--- | :--- |
| **Inline** | `\(...\)` | `Euler's identity \(e^{i\pi} + 1 = 0\)` |
| **Display block** | `$$...$$` | `$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$` |
| **Display block** | `\[...\]` | `\[\int_0^1 x^2\,dx = \frac{1}{3}\]` |
| **Chemistry (`mhchem`)** | `\ce{...}`, `\pu{...}` | `$$\ce{CO2 + C <=> 2 CO}$$`, `\(\pu{9.8 m/s^2}\)` |
| **Composer autocomplete** | Natural names, `:query`, `\cmd` + `Tab` | `riemann zeta`, `:cuad`, `\frac` |
| **Plain math (composer)** | Algebraic syntax + `Tab` / `Convert` | `f(x) = 5x + 2`, `(a+b)/(c-d)`, `sqrt(a^2+b^2)` |
| **Undelimited (opt-in)** | `∑ Render LaTeX` button | `\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s}` |
| **Ignored** | Single `$` | Currency notation & cashtags *(never altered)* |

---

## Installation (Chrome / Brave / Edge / Arc)

### Option A: Prebuilt ZIP (No Node.js Required)

1. Download `latex-on-x-v1.4.0.zip` from [GitHub Releases](https://github.com/fAcuggod/latexOnX/releases) and extract it to a folder.
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the extracted folder.
5. Open [x.com](https://x.com) (or refresh an already-open tab).

### Option B: Build from Source

> Requires [Node.js 18+](https://nodejs.org/). (Optional: [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` to rebuild the WASM core from source.)

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/fAcuggod/latexOnX.git
   cd latexOnX
   npm install
   ```

2. **Build the Manifest V3 extension:**
   ```bash
   npm run build
   ```
   This outputs the ready-to-load extension bundle into `dist/`.

3. **Load into your Chromium browser:**
   - Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
   - Enable **Developer mode** (top-right).
   - Click **Load unpacked** and select the `dist/` directory.
   - Open [x.com](https://x.com) (or refresh an already-open tab).

### Local KaTeX Sandbox (No X Account Required)

```bash
npm run build:demo
```
Open `dist-demo/index.html` in your browser to test live rendering and the live composer preview across X's **Light**, **Dim**, and **Lights Out** themes.

---

## Architecture

Follows a **Functional Core, Imperative Shell** design:

```text
latexOnX/
├── crates/
│   └── latex-core/      # Zero-dependency Rust core (parser + validator -> 37.5 KB WASM)
│       ├── Cargo.toml
│       └── src/               # types.rs, parser.rs, validator.rs, wasm.rs (21 cargo tests)
├── src/
│   ├── core/            # 100% pure TypeScript logic (zero browser/DOM dependencies)
│   │   ├── types.ts             # Discriminated union domain types
│   │   ├── parser.ts            # Lossless linear delimiter scanner
│   │   ├── validator.ts         # Anti-DoS validator (length, brace depth, disallowed macros)
│   │   ├── detector.ts          # High-precision bare-LaTeX & chemistry detector/segmenter
│   │   ├── composerPreview.ts   # Draft analyzer, unclosed/inline-display hints & debouncer
│   │   ├── formulaCatalog.ts    # Multilingual natural-name formula catalog & command autocomplete
│   │   ├── plainMathCompiler.ts # Plain-math Lexer -> Recursive-Descent AST -> LaTeX compiler
│   │   ├── symbolBar.ts         # Quick Symbol Bar palette & selection-aware insertion
│   │   └── pngExporter.ts       # 3x HiDPI export geometry, CSS font rewriter & SVG builder
│   ├── wasm/            # Compiled WebAssembly module + linear-memory TypeScript bridge
│   │   ├── latex_core.wasm    # 37.5 KB release wasm32 binary
│   │   └── wasmCore.ts        # Reusable scratch-buffer linear memory wrapper
│   ├── renderer/
│   │   └── katexRenderer.ts # Trusted-Types-safe KaTeX + mhchem pipeline (HTML + MathML)
│   ├── content/         # Browser layer (Chrome Manifest V3)
│   │   ├── domProcessor.ts       # Safe TreeWalker, opt-in button bar, restore & copy
│   │   ├── composerOverlay.ts    # Floating preview, launcher, explorer, symbol bar & PNG export
│   │   ├── formulaImageExport.ts # Base64 font embedder, SVG-to-Canvas PNG & clipboard export
│   │   ├── observer.ts           # rAF-batched MutationObserver for SPA/infinite scroll
│   │   ├── index.ts              # Entry point synced with chrome.storage.sync
│   │   └── styles.css            # Light/Dim/Dark adaptive styles, preview & copy toast
│   ├── i18n/            # English, Spanish & Simplified Chinese UI strings
│   ├── popup/           # Minimal On/Off, feature toggles & language switcher popup
│   └── demo/            # Live local KaTeX + mhchem sandbox
├── public/              # manifest.json (MV3), icons & Chrome _locales
├── scripts/             # build.mjs, package.mjs, build-wasm.mjs & benchmark.mjs
├── tests/               # 125 automated Vitest unit, DOM & WASM equivalence tests
└── docs/                # Architecture, TypeScript & Rust/WASM guides
```

Read the technical breakdowns in [docs/architecture.md](docs/architecture.md) and [docs/rust-wasm-guide.md](docs/rust-wasm-guide.md).

---

## Performance Benchmarks (TypeScript vs. Rust/WASM)

Measured via `npm run bench` on **10,000 mixed X posts** (8,000 valid formulas, plus plain text, currency/cashtags, chemistry, Unicode, unclosed delimiters, and adversarial DoS payloads) on Node v24.22.2 (median of 9 measured runs after 3 warmups):

| Implementation | Median (10k posts) | Throughput | Speedup vs. TS |
| :--- | ---: | ---: | ---: |
| **TypeScript (V8 JIT)** | 20.56 ms | 486,369 posts/s | 1.00x |
| **Rust/WASM (per-post FFI, 10k calls)** | 12.45 ms | 803,227 posts/s | **1.65x** |
| **Rust/WASM (batched linear memory, 1 call)** | 2.56 ms | 3,898,838 posts/s | **8.02x** |

---

## Development Scripts

```bash
npm run typecheck   # Strict TypeScript type checking (tsc --noEmit)
npm test            # Run all 125 Vitest unit, DOM & WASM equivalence tests
npm run test:rust   # Run all 21 native Rust unit tests (cargo test)
npm run build:wasm  # Recompile crates/latex-core -> src/wasm/latex_core.wasm
npm run bench       # Run TypeScript vs. Rust/WASM benchmark over 10,000 posts
npm run build       # Build Chrome MV3 extension into dist/
npm run build:demo  # Build local KaTeX sandbox into dist-demo/
npm run package     # Package dist/ into release/latex-on-x-v<version>.zip
npm run check       # Run typecheck + tests + extension build
```

---

## Roadmap

- [x] **v0.1 (Core & MV3 Extension):** lossless delimiter scanner, anti-DoS validator, Trusted-Types-safe KaTeX renderer, `<article>` DOM observer, click-to-copy, and EN/ES/ZH i18n.
- [x] **v0.2 (Chemistry & Opt-In Bare LaTeX):** `mhchem` (`\ce`, `\pu`) support and discrete `∑ Render LaTeX` / `↺ Show raw` button for undelimited posts.
- [x] **v0.3 (Live Composer Preview):** real-time debounced KaTeX preview and validator diagnostics inside the X post composer.
- [x] **v0.4 (3x HiDPI PNG Export):** one-click copy of crisp formula images for sharing with non-extension users.
- [x] **v1.0 (Rust/WASM Core):** zero-dependency Rust/WebAssembly parser and validator (`37.5 KB`), differential equivalence tests, and reproducible TypeScript vs. WASM benchmarks.
- [x] **v1.1 (Smart Composer Autocomplete & Formula Catalog):** accent-insensitive EN/ES/ZH natural-name formula suggestions, `:query` search, and `\command` Tab-completion directly inside X's composer.
- [x] **v1.2 (Plain-Math / AsciiMath-lite Compiler):** pure recursive-descent parser (`Lexer -> AST -> LaTeX`) converting everyday expressions like `f(x) = 5x + 2` and `(a+b)/(c+d)` into LaTeX with one click.
- [x] **v1.3 (Quick Symbol Bar & Inline-Display Assistant):** non-blocking 1-click `Use inline \(...\)` tip for mid-sentence `$$...$$` blocks and a compact clickable symbol toolbar (`\(x\)`, `$$`, `a/b`, `√`, `x²`, `∑`, `∫`, `π`, `∞`, `≤`, `→`, `\ce`) inside the composer panel.
- [x] **v1.4 (On-Demand Formula Explorer & Launcher):** discrete `∑` composer launcher opening a searchable, categorized formula and symbol browser on empty or active drafts with lazy KaTeX rendering and selection-preserving insertion.

---

## Privacy & License

LaTeX on X runs 100% locally in your browser and collects zero user data. See [PRIVACY.md](PRIVACY.md).

Released under the [MIT License](LICENSE).
