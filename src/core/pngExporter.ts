/**
 * Pure Functional Core for Milestone C (v0.4): 3x HiDPI PNG Formula Exporter.
 * Zero browser/DOM/Canvas/Fetch dependencies, 100% unit-testable.
 */

export type ExportTheme = "light" | "dim" | "dark";

export interface ExportGeometryOptions {
  /** HiDPI scale multiplier (default: 3). */
  scale?: number;
  /** Horizontal inner padding in CSS pixels on each side (default: 32). */
  paddingX?: number;
  /** Vertical inner padding in CSS pixels on each side (default: 24). */
  paddingY?: number;
  /** Minimum logical CSS width of the exported card (default: 240). */
  minWidth?: number;
  /** Minimum logical CSS height of the exported card (default: 72). */
  minHeight?: number;
  /** Anti-OOM upper bound on both physical bitmap dimensions (default: 4096). */
  maxPixelDimension?: number;
}

export interface ExportGeometry {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  paddingX: number;
  paddingY: number;
  effectiveScale: number;
}

export interface ThemePalette {
  background: string;
  text: string;
  border: string;
}

export const EXPORT_THEME_PALETTES: Readonly<Record<ExportTheme, ThemePalette>> =
  {
    light: { background: "#ffffff", text: "#0f1419", border: "#cfd9de" },
    dim: { background: "#15202b", text: "#f7f9f9", border: "#38444d" },
    dark: { background: "#000000", text: "#e7e9ea", border: "#2f3336" },
  };

export const DEFAULT_EXPORT_GEOMETRY_OPTIONS: Readonly<
  Required<ExportGeometryOptions>
> = {
  scale: 3,
  paddingX: 32,
  paddingY: 24,
  minWidth: 240,
  minHeight: 72,
  maxPixelDimension: 4096,
};

/**
 * CHALLENGE #5: Function 5.1: `computeExportGeometry`
 *
 * Computes logical CSS dimensions and physical HiDPI bitmap dimensions for an
 * exported formula card, enforcing minimum card dimensions and proportional
 * anti-OOM clamping at `maxPixelDimension`.
 *
 * Time: O(1), Space: O(1).
 */
export function computeExportGeometry(
  contentWidth: number,
  contentHeight: number,
  options?: ExportGeometryOptions
): ExportGeometry {
  const safeW =
    Number.isFinite(contentWidth) && contentWidth > 0 ? contentWidth : 0;
  const safeH =
    Number.isFinite(contentHeight) && contentHeight > 0 ? contentHeight : 0;

  const rawScale = options?.scale ?? DEFAULT_EXPORT_GEOMETRY_OPTIONS.scale;
  const safeScale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  const safePadX = Math.max(
    0,
    Math.trunc(options?.paddingX ?? DEFAULT_EXPORT_GEOMETRY_OPTIONS.paddingX)
  );
  const safePadY = Math.max(
    0,
    Math.trunc(options?.paddingY ?? DEFAULT_EXPORT_GEOMETRY_OPTIONS.paddingY)
  );
  const safeMinW = Math.max(
    1,
    Math.trunc(options?.minWidth ?? DEFAULT_EXPORT_GEOMETRY_OPTIONS.minWidth)
  );
  const safeMinH = Math.max(
    1,
    Math.trunc(options?.minHeight ?? DEFAULT_EXPORT_GEOMETRY_OPTIONS.minHeight)
  );
  const safeMaxPx = Math.max(
    1,
    Math.trunc(
      options?.maxPixelDimension ??
        DEFAULT_EXPORT_GEOMETRY_OPTIONS.maxPixelDimension
    )
  );

  const cssWidth = Math.max(safeMinW, Math.ceil(safeW) + 2 * safePadX);
  const cssHeight = Math.max(safeMinH, Math.ceil(safeH) + 2 * safePadY);

  const maxCssSide = Math.max(cssWidth, cssHeight);
  const effectiveScale =
    maxCssSide * safeScale > safeMaxPx ? safeMaxPx / maxCssSide : safeScale;

  const pixelWidth = Math.min(
    safeMaxPx,
    Math.max(1, Math.round(cssWidth * effectiveScale))
  );
  const pixelHeight = Math.min(
    safeMaxPx,
    Math.max(1, Math.round(cssHeight * effectiveScale))
  );

  return {
    cssWidth,
    cssHeight,
    pixelWidth,
    pixelHeight,
    paddingX: safePadX,
    paddingY: safePadY,
    effectiveScale,
  };
}

function unwrapCssUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (
    trimmed.length >= 2 &&
    trimmed[0] === trimmed[trimmed.length - 1] &&
    (trimmed[0] === "'" || trimmed[0] === '"')
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractUrlFilename(cleanUrl: string): string {
  const withoutQuery = cleanUrl.split("?")[0].split("#")[0];
  const lastSlash = withoutQuery.lastIndexOf("/");
  return lastSlash === -1 ? withoutQuery : withoutQuery.slice(lastSlash + 1);
}

/**
 * Extracts unique `.woff2` font filenames referenced inside `url(...)` tokens
 * of a stylesheet (e.g., `katex.min.css`), preserving first-seen order.
 *
 * Time: O(|css|), Space: O(|unique filenames|).
 */
export function extractFontFilenamesFromCss(css: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  let i = 0;

  while (i < css.length) {
    const idx = css.indexOf("url(", i);
    if (idx === -1) break;

    const closeIdx = css.indexOf(")", idx + 4);
    if (closeIdx === -1) break;

    const cleanUrl = unwrapCssUrl(css.slice(idx + 4, closeIdx));
    if (!cleanUrl.startsWith("data:")) {
      const filename = extractUrlFilename(cleanUrl);
      if (filename.endsWith(".woff2") && !seen.has(filename)) {
        seen.add(filename);
        result.push(filename);
      }
    }

    i = closeIdx + 1;
  }

  return result;
}

/**
 * CHALLENGE #5: Function 5.2: `rewriteCssFontUrls`
 *
 * Scans CSS in a single linear pass and replaces every `url(...)` referencing a
 * font filename present in `fontDataUris` with `url(<data_uri>)`. Preserves all
 * surrounding CSS, already-inlined `data:` URIs, and unknown URLs losslessly.
 *
 * Time: O(|css| + |output|), Space: O(|output|).
 */
export function rewriteCssFontUrls(
  css: string,
  fontDataUris: Readonly<Record<string, string>>
): string {
  const parts: string[] = [];
  let i = 0;

  while (i < css.length) {
    const idx = css.indexOf("url(", i);
    if (idx === -1) {
      parts.push(css.slice(i));
      break;
    }

    parts.push(css.slice(i, idx));
    const closeIdx = css.indexOf(")", idx + 4);
    if (closeIdx === -1) {
      parts.push(css.slice(idx));
      break;
    }

    const cleanUrl = unwrapCssUrl(css.slice(idx + 4, closeIdx));
    if (cleanUrl.startsWith("data:")) {
      parts.push(css.slice(idx, closeIdx + 1));
    } else {
      const filename = extractUrlFilename(cleanUrl);
      if (Object.prototype.hasOwnProperty.call(fontDataUris, filename)) {
        parts.push(`url(${fontDataUris[filename]})`);
      } else {
        parts.push(css.slice(idx, closeIdx + 1));
      }
    }

    i = closeIdx + 1;
  }

  return parts.join("");
}

/**
 * CHALLENGE #5: Function 5.3: `buildFormulaSvgDocument`
 *
 * Assembles a self-contained, XML-valid `<svg>` wrapping serialized XHTML KaTeX
 * markup inside `<foreignObject>`, styled to match X's Light/Dim/Dark palette and
 * rasterized cleanly at HiDPI physical pixel dimensions via `width`/`height` + `viewBox`.
 *
 * Time: O(|xhtmlContent| + |inlineCss|), Space: O(|xhtmlContent| + |inlineCss|).
 */
export function buildFormulaSvgDocument(
  xhtmlContent: string,
  inlineCss: string,
  geometry: ExportGeometry,
  theme: ExportTheme = "dark"
): string {
  const palette = EXPORT_THEME_PALETTES[theme];
  const { cssWidth, cssHeight, pixelWidth, pixelHeight, paddingX, paddingY } =
    geometry;

  // Prevent any literal `]]>` in CSS from terminating the XML CDATA section early
  const safeCss = inlineCss.replace(/\]\]>/g, "]]]]><![CDATA[>");

  const cardStyle = [
    `width:${cssWidth}px`,
    `height:${cssHeight}px`,
    `padding:${paddingY}px ${paddingX}px`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
    `color:${palette.text}`,
    "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "font-size:15px",
    "line-height:1.5",
    "overflow:hidden",
  ].join(";");

  const rectWidth = Math.max(0, cssWidth - 1);
  const rectHeight = Math.max(0, cssHeight - 1);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${pixelWidth}" height="${pixelHeight}" ` +
    `viewBox="0 0 ${cssWidth} ${cssHeight}">` +
    `<style><![CDATA[*{box-sizing:border-box;}${safeCss}]]></style>` +
    `<rect x="0.5" y="0.5" width="${rectWidth}" height="${rectHeight}" rx="16" ry="16" ` +
    `fill="${palette.background}" stroke="${palette.border}" stroke-width="1" />` +
    `<foreignObject x="0" y="0" width="${cssWidth}" height="${cssHeight}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" class="latex-export-card" style="${cardStyle}">` +
    `${xhtmlContent}` +
    `</div>` +
    `</foreignObject>` +
    `</svg>`
  );
}
