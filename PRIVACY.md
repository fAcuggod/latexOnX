# Privacy Policy for LaTeX on X

**Last updated:** November 2026

**LaTeX on X** is an open-source browser extension that renders LaTeX mathematical and chemical formulas on `x.com` and `twitter.com`.

## Data Collection

**LaTeX on X does not collect, store on external servers, sell, or share any personal data, browsing history, post content, or analytics.**

- **Zero network requests:** All parsing, validation, KaTeX rendering, formula suggestions, plain-math compilation, and PNG export run 100% locally inside your browser. KaTeX stylesheets and `.woff2` math fonts are bundled directly inside the extension package (no external CDNs).
- **Zero telemetry:** The extension contains no tracking scripts, advertising SDKs, or error reporting beacons.

## Permissions Used

LaTeX on X follows the principle of least privilege and requests only:

- **`storage` (`chrome.storage.sync`):** Used exclusively to save your local extension preferences across browser sessions (auto-render On/Off, chemistry `mhchem` toggle, undelimited LaTeX button toggle, live composer preview toggle, and interface language `en` / `es` / `zh`).
- **Host access (`https://x.com/*`, `https://twitter.com/*`):** Restricted strictly to X / Twitter pages so the content script can render math formulas in posts and provide live preview inside the post composer. The extension does not run on any other website.
- **Clipboard (user-initiated only):** Writing a formula's LaTeX source or an exported 3x PNG image to the clipboard happens only when you explicitly click a formula or the `PNG` export button. The extension never reads your clipboard.

## Source Code & Contact

The full source code is publicly auditable under the MIT License at:
https://github.com/fAcuggod/latexOnX

If you have any questions about this privacy policy, please open an issue in the repository above.
