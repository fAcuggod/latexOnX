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
- **Live composer preview & diagnostics:** floating, debounced KaTeX preview directly below X's post/reply composer, highlighting unclosed delimiters, unbalanced braces, disallowed macros, and syntax errors *before* posting.
- **Chemistry & physical units (`mhchem`):** natively renders chemical formulas, ionic charges, reaction arrows, and physical units (`\ce{...}`, `\pu{...}`), toggleable from the popup.
- **Opt-in undelimited LaTeX button:** detects posts containing unambiguous raw LaTeX/chemistry commands (ignoring code escapes and Windows paths) and offers a discrete `∑ Render LaTeX` / `↺ Show raw` toggle right below the post.
- **Built for X's modern frontend:** targets resilient HTML5 semantic landmarks (`<article>` / `[role="article"]`) and builds DOM trees directly via `katex.render()` with **zero `.innerHTML`**, complying with X's strict *Trusted Types* CSP.
- **60-120 FPS infinite scrolling:** `O(n)` zero-allocation fast-path skips non-math posts immediately, paired with a `requestAnimationFrame`-batched `MutationObserver`.
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
| **Undelimited (opt-in)** | `∑ Render LaTeX` button | `\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s}` |
| **Ignored** | Single `$` | Currency notation & cashtags *(never altered)* |

---

## Installation (Chrome / Brave / Edge / Arc)

> Requires [Node.js 18+](https://nodejs.org/).

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
├── src/
│   ├── core/            # 100% pure logic (zero browser/DOM dependencies)
│   │   ├── types.ts           # Discriminated union domain types
│   │   ├── parser.ts          # Lossless linear delimiter scanner
│   │   ├── validator.ts       # Anti-DoS validator (length, brace depth, disallowed macros)
│   │   ├── detector.ts        # High-precision bare-LaTeX & chemistry detector/segmenter
│   │   └── composerPreview.ts # Draft analyzer, unclosed delimiter detector & debouncer
│   ├── renderer/
│   │   └── katexRenderer.ts # Trusted-Types-safe KaTeX + mhchem pipeline (HTML + MathML)
│   ├── content/         # Browser layer (Chrome Manifest V3)
│   │   ├── domProcessor.ts    # Safe TreeWalker, opt-in button bar, restore & copy
│   │   ├── composerOverlay.ts # Floating Trusted-Types-safe live composer preview portal
│   │   ├── observer.ts        # rAF-batched MutationObserver for SPA/infinite scroll
│   │   ├── index.ts           # Entry point synced with chrome.storage.sync
│   │   └── styles.css         # Light/Dim/Dark adaptive styles, preview & copy toast
│   ├── i18n/            # English, Spanish & Simplified Chinese UI strings
│   ├── popup/           # Minimal On/Off, feature toggles & language switcher popup
│   └── demo/            # Live local KaTeX + mhchem sandbox
├── public/              # manifest.json (MV3), icons & Chrome _locales
├── scripts/build.mjs    # Transparent esbuild bundler + .woff2 font optimizer
├── tests/               # 82 automated unit & DOM tests (Vitest + happy-dom)
└── docs/                # Architecture & TypeScript reference guides
```

Read the full technical breakdown in [docs/architecture.md](docs/architecture.md).

---

## Development Scripts

```bash
npm run typecheck   # Strict TypeScript type checking (tsc --noEmit)
npm test            # Run all 82 unit & DOM tests (Vitest + happy-dom)
npm run test:watch  # Watch mode for TDD
npm run build       # Build Chrome MV3 extension into dist/
npm run build:demo  # Build local KaTeX sandbox into dist-demo/
npm run check       # Run typecheck + tests + extension build
```

---

## Roadmap

- [x] **v0.1 (Core & MV3 Extension):** lossless delimiter scanner, anti-DoS validator, Trusted-Types-safe KaTeX renderer, `<article>` DOM observer, click-to-copy, and EN/ES/ZH i18n.
- [x] **v0.2 (Chemistry & Opt-In Bare LaTeX):** `mhchem` (`\ce`, `\pu`) support and discrete `∑ Render LaTeX` / `↺ Show raw` button for undelimited posts.
- [x] **v0.3 (Live Composer Preview):** real-time debounced KaTeX preview and validator diagnostics inside the X post composer.
- [ ] **v0.4 (3x HiDPI PNG Export):** one-click copy of crisp formula images for sharing with non-extension users.
- [ ] **v1.0 (Rust/WASM Core):** port `src/core/` to Rust/WebAssembly with TypeScript vs. WASM benchmarks.

---

## License

Released under the [MIT License](LICENSE).
