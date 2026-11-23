import { describe, expect, it } from "vitest";
import {
  buildFormulaSvgDocument,
  computeExportGeometry,
  EXPORT_THEME_PALETTES,
  extractFontFilenamesFromCss,
  rewriteCssFontUrls,
} from "../src/core/pngExporter.js";

describe("computeExportGeometry (Challenge #5.1)", () => {
  it("applies default 3x scale, padding, and minimum card dimensions for small formulas", () => {
    const geom = computeExportGeometry(30, 20);
    expect(geom).toEqual({
      cssWidth: 240,
      cssHeight: 72,
      pixelWidth: 720,
      pixelHeight: 216,
      paddingX: 32,
      paddingY: 24,
      effectiveScale: 3,
    });
  });

  it("grows cleanly around medium formulas using ceil for fractional CSS measurements", () => {
    const geom = computeExportGeometry(310.2, 64.7);
    expect(geom.cssWidth).toBe(311 + 64);
    expect(geom.cssHeight).toBe(65 + 48);
    expect(geom.effectiveScale).toBe(3);
    expect(geom.pixelWidth).toBe(geom.cssWidth * 3);
    expect(geom.pixelHeight).toBe(geom.cssHeight * 3);
  });

  it("proportionally clamps oversized formulas at maxPixelDimension to prevent OOM", () => {
    const geom = computeExportGeometry(2000, 100);
    expect(geom.cssWidth).toBe(2064);
    expect(geom.cssHeight).toBe(148);
    expect(geom.effectiveScale).toBeCloseTo(4096 / 2064, 6);
    expect(geom.pixelWidth).toBe(4096);
    expect(geom.pixelHeight).toBe(Math.round(148 * (4096 / 2064)));
    expect(geom.pixelWidth).toBeLessThanOrEqual(4096);
    expect(geom.pixelHeight).toBeLessThanOrEqual(4096);
  });

  it("handles degenerate inputs (NaN, Infinity, negative sizes, non-positive scale) safely", () => {
    const geom = computeExportGeometry(Number.NaN, -50, {
      scale: -2,
      paddingX: -10,
      paddingY: -5,
    });
    expect(geom.cssWidth).toBe(240);
    expect(geom.cssHeight).toBe(72);
    expect(geom.paddingX).toBe(0);
    expect(geom.paddingY).toBe(0);
    expect(geom.effectiveScale).toBe(1);
    expect(geom.pixelWidth).toBe(240);
    expect(geom.pixelHeight).toBe(72);
  });
});

describe("extractFontFilenamesFromCss & rewriteCssFontUrls (Challenge #5.2)", () => {
  it("extracts unique .woff2 filenames across quoted, unquoted, extension, and query URLs", () => {
    const css = [
      `@font-face{src:url("chrome-extension://__MSG_@@extension_id__/fonts/KaTeX_Main-Regular.woff2") format("woff2")}`,
      `@font-face{src:url(fonts/KaTeX_Math-Italic.woff2?v=1#hash) format("woff2")}`,
      `@font-face{src:url('fonts/KaTeX_Main-Regular.woff2') format("woff2")}`,
      `@font-face{src:url(data:font/woff2;base64,AAA) format("woff2")}`,
      `.bg{background:url(images/logo.png)}`,
    ].join("\n");

    expect(extractFontFilenamesFromCss(css)).toEqual([
      "KaTeX_Main-Regular.woff2",
      "KaTeX_Math-Italic.woff2",
    ]);
  });

  it("rewrites matching font URLs to data URIs while preserving unknown and data: URLs losslessly", () => {
    const css =
      `@font-face{src:url("chrome-extension://id/fonts/KaTeX_Main-Regular.woff2") format("woff2");}` +
      `@font-face{src:url(fonts/KaTeX_AMS-Regular.woff2) format("woff2");}` +
      `@font-face{src:url(data:font/woff2;base64,ALREADY) format("woff2");}` +
      `.x{background:url(fonts/Unknown.woff2)}`;

    const fontMap = {
      "KaTeX_Main-Regular.woff2": "data:font/woff2;base64,MAIN",
      "KaTeX_AMS-Regular.woff2": "data:font/woff2;base64,AMS",
    };

    const out = rewriteCssFontUrls(css, fontMap);
    expect(out).toBe(
      `@font-face{src:url(data:font/woff2;base64,MAIN) format("woff2");}` +
        `@font-face{src:url(data:font/woff2;base64,AMS) format("woff2");}` +
        `@font-face{src:url(data:font/woff2;base64,ALREADY) format("woff2");}` +
        `.x{background:url(fonts/Unknown.woff2)}`
    );
  });

  it("keeps malformed unclosed url( tokens lossless without looping infinitely", () => {
    const css = `.a{color:red}.broken{src:url(fonts/KaTeX_Main-Regular.woff2`;
    expect(
      rewriteCssFontUrls(css, {
        "KaTeX_Main-Regular.woff2": "data:font/woff2;base64,MAIN",
      })
    ).toBe(css);
  });

  it("does not match Object.prototype keys like toString", () => {
    const css = `.a{src:url(fonts/toString)}`;
    expect(rewriteCssFontUrls(css, {})).toBe(css);
  });
});

describe("buildFormulaSvgDocument (Challenge #5.3)", () => {
  it("builds a 3x HiDPI self-contained SVG matching each X theme palette", () => {
    const geom = computeExportGeometry(200, 50);

    for (const theme of ["light", "dim", "dark"] as const) {
      const svg = buildFormulaSvgDocument(
        `<span class="katex">x^2</span>`,
        `.katex-html>.newline{display:block}`,
        geom,
        theme
      );

      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(
        true
      );
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain(`width="${geom.pixelWidth}"`);
      expect(svg).toContain(`height="${geom.pixelHeight}"`);
      expect(svg).toContain(`viewBox="0 0 ${geom.cssWidth} ${geom.cssHeight}"`);
      expect(svg).toContain(`fill="${EXPORT_THEME_PALETTES[theme].background}"`);
      expect(svg).toContain(`stroke="${EXPORT_THEME_PALETTES[theme].border}"`);
      expect(svg).toContain(`color:${EXPORT_THEME_PALETTES[theme].text}`);
      expect(svg).toContain(
        '<div xmlns="http://www.w3.org/1999/xhtml" class="latex-export-card"'
      );
      expect(svg).toContain(`<span class="katex">x^2</span>`);
    }
  });

  it("safely escapes literal ]]> sequences inside CSS so CDATA cannot break XML", () => {
    const geom = computeExportGeometry(100, 40);
    const maliciousCss = `.a{content:"]]> </style><script>alert(1)</script>"}`;
    const svg = buildFormulaSvgDocument("<span/>", maliciousCss, geom, "dark");

    expect(svg).toContain("]]]]><![CDATA[>");
    // Ensure the raw unescaped closing sequence does not close <style> prematurely
    const styleStart = svg.indexOf("<style>");
    const styleEnd = svg.indexOf("</style>");
    const innerStyle = svg.slice(styleStart, styleEnd);
    expect(innerStyle).toContain("<![CDATA[");
    expect(innerStyle).toContain("]]]]><![CDATA[>");
  });
});
