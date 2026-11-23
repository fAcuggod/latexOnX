import {
  buildFormulaSvgDocument,
  computeExportGeometry,
  extractFontFilenamesFromCss,
  rewriteCssFontUrls,
  type ExportTheme,
} from "../core/pngExporter.js";

export type ExportPngResult =
  | { ok: true; method: "copied" | "downloaded" }
  | { ok: false; error: string };

const EXPORT_EXTRA_CSS = [
  ".latex-export-content{width:100%;white-space:pre-wrap;word-break:break-word;}",
  ".latex-export-content.is-math-only{text-align:center;}",
  ".latex-on-x-inline{display:inline-block;padding:0 2px;vertical-align:baseline;}",
  ".latex-on-x-display{display:block;margin:0.4em 0;text-align:center;}",
  ".latex-on-x-display .katex-display{margin:0.15em 0;}",
  ".latex-on-x-formula .katex{font-size:1.08em;color:inherit;}",
  ".latex-on-x-preview-error-chip{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;padding:1px 4px;border-radius:4px;background:rgba(244,33,46,0.14);border-bottom:1.5px dashed #f4212e;}",
].join("");

let cachedInlinedCssPromise: Promise<string> | null = null;

export function resetInlineCssCacheForTests(): void {
  cachedInlinedCssPromise = null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function resolveAssetUrl(relativePath: string): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relativePath);
  }
  return relativePath;
}

function readAccessibleKatexCssFromDocument(doc: Document): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(doc.styleSheets ?? [])) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (rule.cssText.includes("katex") || rule.cssText.includes("KaTeX")) {
          chunks.push(rule.cssText);
        }
      }
    } catch {
      // Cross-origin or extension stylesheet cannot be read via cssRules
    }
  }
  return chunks.join("\n");
}

async function fetchInlinedKatexCss(doc: Document): Promise<string> {
  try {
    const cssResp = await fetch(resolveAssetUrl("katex.min.css"));
    if (!cssResp.ok) {
      throw new Error(`HTTP ${cssResp.status}`);
    }
    const rawCss = await cssResp.text();
    const fontFiles = extractFontFilenamesFromCss(rawCss);
    const fontDataUris: Record<string, string> = {};

    await Promise.all(
      fontFiles.map(async (filename) => {
        try {
          const resp = await fetch(resolveAssetUrl(`fonts/${filename}`));
          if (!resp.ok) return;
          const buf = await resp.arrayBuffer();
          fontDataUris[filename] = `data:font/woff2;base64,${arrayBufferToBase64(buf)}`;
        } catch {
          // Leave individual missing fonts untouched so remaining fonts still embed
        }
      })
    );

    return `${rewriteCssFontUrls(rawCss, fontDataUris)}\n${EXPORT_EXTRA_CSS}`;
  } catch {
    const fallbackCss = readAccessibleKatexCssFromDocument(doc);
    return `${fallbackCss}\n${EXPORT_EXTRA_CSS}`;
  }
}

async function loadInlinedKatexCss(doc: Document): Promise<string> {
  if (!cachedInlinedCssPromise) {
    cachedInlinedCssPromise = fetchInlinedKatexCss(doc).catch((err) => {
      cachedInlinedCssPromise = null;
      throw err;
    });
  }
  return cachedInlinedCssPromise;
}

function isMathOnlyPreview(bodyEl: HTMLElement): boolean {
  let hasFormula = false;
  for (const node of Array.from(bodyEl.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim().length > 0) {
        return false;
      }
    } else if (node instanceof Element) {
      if (node.classList.contains("latex-on-x-formula")) {
        hasFormula = true;
      } else {
        return false;
      }
    }
  }
  return hasFormula;
}

function measurePreviewContent(
  bodyEl: HTMLElement,
  mathOnly: boolean
): { width: number; height: number } {
  if (mathOnly) {
    const katexEls = Array.from(bodyEl.querySelectorAll(".katex"));
    let maxWidth = 0;
    let totalHeight = 0;

    for (const el of katexEls) {
      const rect = el.getBoundingClientRect();
      if (rect.width > maxWidth) maxWidth = rect.width;
      totalHeight += rect.height;
    }

    if (katexEls.length > 1) {
      totalHeight += (katexEls.length - 1) * 14;
    }

    if (maxWidth > 0 && totalHeight > 0) {
      return { width: maxWidth + 16, height: totalHeight + 12 };
    }
  }

  const style =
    typeof window !== "undefined" && window.getComputedStyle
      ? window.getComputedStyle(bodyEl)
      : null;
  const padX = style
    ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    : 0;
  const padY = style
    ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
    : 0;

  const rect = bodyEl.getBoundingClientRect();
  const measuredW = Math.max(bodyEl.scrollWidth, rect.width) - padX;
  const measuredH = Math.max(bodyEl.scrollHeight, rect.height) - padY;

  return {
    width: measuredW > 0 ? measuredW : 320,
    height: measuredH > 0 ? measuredH : 64,
  };
}

/**
 * Clones rendered preview DOM nodes into a clean XHTML fragment (stripping hidden
 * MathML so only visual KaTeX HTML is rasterized inside SVG `<foreignObject>`),
 * using zero `.innerHTML` (Trusted Types CSP safe).
 */
export function prepareExportMarkup(
  bodyEl: HTMLElement,
  doc: Document = document
): { xhtml: string; contentWidth: number; contentHeight: number } {
  const mathOnly = isMathOnlyPreview(bodyEl);
  const { width, height } = measurePreviewContent(bodyEl, mathOnly);

  const wrapper = doc.createElement("div");
  wrapper.className = mathOnly
    ? "latex-export-content is-math-only"
    : "latex-export-content";

  for (const child of Array.from(bodyEl.childNodes)) {
    wrapper.appendChild(child.cloneNode(true));
  }

  for (const mathml of Array.from(wrapper.querySelectorAll(".katex-mathml"))) {
    mathml.remove();
  }

  const serializer = new XMLSerializer();
  const xhtml = serializer.serializeToString(wrapper);

  return {
    xhtml,
    contentWidth: width,
    contentHeight: height,
  };
}

function renderSvgToPngBlob(
  svgXml: string,
  pixelWidth: number,
  pixelHeight: number,
  doc: Document
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";

    img.onload = () => {
      try {
        const canvas = doc.createElement("canvas");
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable."));
          return;
        }

        ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas PNG encoding returned null."));
            }
          },
          "image/png"
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to rasterize formula SVG image."));
    };

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgXml)}`;
  });
}

async function createPreviewPngBlob(
  bodyEl: HTMLElement,
  theme: ExportTheme,
  doc: Document
): Promise<Blob> {
  const { xhtml, contentWidth, contentHeight } = prepareExportMarkup(
    bodyEl,
    doc
  );
  const geometry = computeExportGeometry(contentWidth, contentHeight, {
    scale: 3,
  });
  const inlineCss = await loadInlinedKatexCss(doc);
  const svgXml = buildFormulaSvgDocument(xhtml, inlineCss, geometry, theme);

  return renderSvgToPngBlob(
    svgXml,
    geometry.pixelWidth,
    geometry.pixelHeight,
    doc
  );
}

function triggerPngDownload(blob: Blob, doc: Document): void {
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = "latex-on-x-formula.png";
  anchor.style.display = "none";
  (doc.body ?? doc.documentElement).appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports a rendered preview body to a 3x HiDPI PNG matching X's active theme
 * and copies it to the system clipboard (falling back to `.png` download if
 * clipboard image writes are unavailable).
 */
export async function exportPreviewBodyToPng(
  bodyEl: HTMLElement,
  theme: ExportTheme,
  doc: Document = document
): Promise<ExportPngResult> {
  try {
    // Kick off generation synchronously inside the user click gesture
    const blobPromise = createPreviewPngBlob(bodyEl, theme, doc);

    const canWriteClipboard =
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.write === "function" &&
      typeof ClipboardItem !== "undefined";

    if (canWriteClipboard) {
      // Chromium supports Promise<Blob> directly inside ClipboardItem, preserving user activation
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
        return { ok: true, method: "copied" };
      } catch {
        // Retry with resolved Blob for browsers without Promise ClipboardItem support
        const blob = await blobPromise;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          return { ok: true, method: "copied" };
        } catch {
          triggerPngDownload(blob, doc);
          return { ok: true, method: "downloaded" };
        }
      }
    }

    const blob = await blobPromise;
    triggerPngDownload(blob, doc);
    return { ok: true, method: "downloaded" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
