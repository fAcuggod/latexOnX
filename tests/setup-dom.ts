/**
 * En navegadores reales (como Chrome en x.com con `<!DOCTYPE html>`),
 * `document.compatMode` vale `"CSS1Compat"`. En `happy-dom` queda `undefined`,
 * lo que hace que KaTeX desactive `katex.render()` por modo quirks al importarse.
 * Definir `"CSS1Compat"` aquí alinea el entorno de test con Chrome real.
 */
if (typeof document !== "undefined" && !document.compatMode) {
  Object.defineProperty(document, "compatMode", {
    value: "CSS1Compat",
    configurable: true,
  });
}
