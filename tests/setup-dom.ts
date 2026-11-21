/**
 * In real browsers (such as Chrome on x.com with `<!DOCTYPE html>`),
 * `document.compatMode` is `"CSS1Compat"`. In `happy-dom`, it defaults to
 * `undefined`, causing KaTeX to disable `katex.render()` for quirks mode on import.
 * Setting `"CSS1Compat"` aligns the test environment with real Chromium.
 */
if (typeof document !== "undefined" && !document.compatMode) {
  Object.defineProperty(document, "compatMode", {
    value: "CSS1Compat",
    configurable: true,
  });
}
