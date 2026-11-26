import {
  analyzeBareLatexDraft,
  analyzeComposerDraft,
  convertDisplayHintToInline,
  createDebouncer,
  findInlineDisplayHints,
  wrapBareLatexDraft,
  type ComposerDiagnostic,
  type Debouncer,
  type InlineDisplayHint,
} from "../core/composerPreview.js";
import {
  applyFormulaInsertion,
  CATALOG_CATEGORIES,
  extractAutocompleteContext,
  filterCatalogEntries,
  insertCatalogEntryAtSelection,
  searchFormulaCatalog,
  type FormulaCategory,
  type FormulaEntry,
  type FormulaMatch,
} from "../core/formulaCatalog.js";
import {
  applyPlainMathConversions,
  detectPlainMathExpressions,
  type PlainMathSuggestion,
} from "../core/plainMathCompiler.js";
import type { ExportTheme } from "../core/pngExporter.js";
import {
  applyQuickSymbol,
  QUICK_SYMBOLS,
  type QuickSymbol,
} from "../core/symbolBar.js";
import { getMessages, type Locale, type Messages } from "../i18n/messages.js";
import { renderFormulaToElement } from "../renderer/katexRenderer.js";
import {
  exportPreviewBodyToPng,
  type ExportPngResult,
} from "./formulaImageExport.js";

export const COMPOSER_SELECTOR =
  'textarea:not([disabled]):not([readonly]), [role="textbox"][contenteditable="true"], [role="textbox"][contenteditable="plaintext-only"], [contenteditable="true"][aria-multiline="true"]';
export const PREVIEW_PANEL_ATTR = "data-latex-on-x-preview";
export const LAUNCHER_BTN_ATTR = "data-latex-on-x-launcher";

type PopoverHTMLElement = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

export interface ComposerPreviewOptions {
  locale?: Locale;
  enableChemistry?: boolean;
  debounceMs?: number;
  exportPng?: (
    bodyEl: HTMLElement,
    theme: ExportTheme,
    doc: Document
  ) => Promise<ExportPngResult>;
}

export interface ComposerPreviewController {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  refresh(): void;
}

/**
 * Extracts plain text from an X `<textarea>` or `contenteditable` composer,
 * preserving newlines across block elements and stripping zero-width placeholders.
 */
export function readComposerText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }

  const raw =
    typeof el.innerText === "string" && el.innerText.length > 0
      ? el.innerText
      : (el.textContent ?? "");

  return raw.replace(/\u200B/g, "");
}

/**
 * Reads the current caret character offset inside a `<textarea>` or `contenteditable`.
 */
export function readComposerCursor(el: HTMLElement, text: string): number {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return typeof el.selectionStart === "number" ? el.selectionStart : text.length;
  }

  if (typeof window !== "undefined" && window.getSelection) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.focusNode && el.contains(sel.focusNode)) {
      try {
        const range = el.ownerDocument.createRange();
        range.selectNodeContents(el);
        range.setEnd(sel.focusNode, sel.focusOffset);
        return range.toString().replace(/\u200B/g, "").length;
      } catch {
        return text.length;
      }
    }
  }

  return text.length;
}

/**
 * Reads the current `[start, end]` character selection range inside a `<textarea>`
 * or `contenteditable` composer so quick symbols can wrap highlighted text.
 */
export function readComposerSelection(
  el: HTMLElement,
  text: string
): { start: number; end: number } {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start =
      typeof el.selectionStart === "number" ? el.selectionStart : text.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : start;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  if (typeof window !== "undefined" && window.getSelection) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.startContainer) && el.contains(range.endContainer)) {
        try {
          const preStart = el.ownerDocument.createRange();
          preStart.selectNodeContents(el);
          preStart.setEnd(range.startContainer, range.startOffset);
          const start = preStart.toString().replace(/\u200B/g, "").length;

          const preEnd = el.ownerDocument.createRange();
          preEnd.selectNodeContents(el);
          preEnd.setEnd(range.endContainer, range.endOffset);
          const end = preEnd.toString().replace(/\u200B/g, "").length;

          return start <= end ? { start, end } : { start: end, end: start };
        } catch {
          const cursor = readComposerCursor(el, text);
          return { start: cursor, end: cursor };
        }
      }
    }
  }

  const cursor = readComposerCursor(el, text);
  return { start: cursor, end: cursor };
}

/**
 * Writes updated text + caret offset into a React-controlled `<textarea>` (using
 * the native prototype setter so React's `_valueTracker` registers the change) or
 * a legacy `contenteditable` composer, then dispatches a bubbling `input` event.
 */
export function writeComposerValue(
  el: HTMLElement,
  nextText: string,
  nextCursorPos: number,
  inserted: string
): void {
  if (el instanceof HTMLTextAreaElement) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, nextText);
    } else {
      el.value = nextText;
    }
    try {
      el.setSelectionRange(nextCursorPos, nextCursorPos);
    } catch {
      // Ignore in environments without selection range support
    }
  } else {
    el.textContent = nextText;
    if (typeof window !== "undefined" && window.getSelection && el.firstChild) {
      try {
        const sel = window.getSelection();
        const range = el.ownerDocument.createRange();
        const offset = Math.min(nextCursorPos, el.firstChild.textContent?.length ?? 0);
        range.setStart(el.firstChild, offset);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        // Ignore selection placement errors on complex contenteditable trees
      }
    }
  }

  try {
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: inserted,
      })
    );
  } catch {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function isInsideOverlay(target: EventTarget | null): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return false;
  return Boolean(
    el.closest(`[${PREVIEW_PANEL_ATTR}="true"]`) ||
      el.closest(`[${LAUNCHER_BTN_ATTR}="true"]`)
  );
}

function findComposerElement(target: EventTarget | null): HTMLElement | null {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return null;
  if (isInsideOverlay(el)) return null;
  const match = el.closest(COMPOSER_SELECTOR);
  return match instanceof HTMLElement ? match : null;
}

function getCategoryLabel(category: FormulaCategory, msg: Messages): string {
  switch (category) {
    case "command":
      return msg.catBasics;
    case "calculus":
      return msg.catCalculus;
    case "algebra":
      return msg.catAlgebra;
    case "physics":
      return msg.catPhysics;
    case "probability":
      return msg.catProbability;
    case "chemistry":
      return msg.catChemistry;
  }
}

function supportsPopover(el: HTMLElement): el is PopoverHTMLElement {
  const candidate = el as PopoverHTMLElement;
  return (
    typeof candidate.showPopover === "function" &&
    typeof candidate.hidePopover === "function"
  );
}

function resolvePanelHost(
  doc: Document,
  composer: HTMLElement | null
): Element {
  const nativeDialog = composer?.closest("dialog");
  if (nativeDialog) {
    return nativeDialog;
  }
  return doc.body ?? doc.documentElement;
}

function parseOpaqueRgb(bg: string): [number, number, number] | null {
  const match = bg.match(/[\d.]+/g);
  if (!match || match.length < 3) return null;
  const [r, g, b, a] = match.map(Number);
  if (a !== undefined && a === 0) return null;
  return [r, g, b];
}

/**
 * Detects whether the active page (x.com) is currently in Light, Dim, or Dark mode
 * by inspecting the computed background color of `document.body` / `document.documentElement`.
 */
function detectPageTheme(doc: Document): "light" | "dim" | "dark" {
  if (typeof window === "undefined" || !window.getComputedStyle) {
    return "dark";
  }

  const candidates = [doc.body, doc.documentElement];
  let rgb: [number, number, number] | null = null;
  for (const el of candidates) {
    if (!el) continue;
    rgb = parseOpaqueRgb(window.getComputedStyle(el).backgroundColor);
    if (rgb) break;
  }
  if (!rgb) return "dark";

  const [r, g, b] = rgb;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  if (luminance > 180) return "light";
  if (luminance > 12) return "dim";
  return "dark";
}

function formatDiagnosticLine(
  diag: ComposerDiagnostic | { kind: "katex_error"; formulaIndex: number; message: string },
  locale: Locale
): string {
  const msg = getMessages(locale);

  if (diag.kind === "unclosed_delimiter") {
    return msg.diagUnclosed
      .replace("{open}", () => diag.open)
      .replace("{close}", () => diag.close);
  }

  const prefix = msg.diagFormulaPrefix.replace(
    "{n}",
    String(diag.formulaIndex + 1)
  );

  if (diag.kind === "chemistry_disabled") {
    return `${prefix} ${msg.diagChemDisabled}`;
  }

  if (diag.kind === "validation_error") {
    switch (diag.reason) {
      case "empty":
        return `${prefix} ${msg.diagEmpty}`;
      case "too_long":
        return `${prefix} ${msg.diagTooLong}`;
      case "too_deep":
        return `${prefix} ${msg.diagTooDeep}`;
      case "unbalanced_braces":
        return `${prefix} ${msg.diagUnbalancedBraces}`;
      case "forbidden_command": {
        const cmd = diag.message.match(/\\[a-zA-Z]+/)?.[0];
        if (cmd) {
          return `${prefix} ${msg.diagForbiddenCommand.replace("{cmd}", () => cmd)}`;
        }
        return `${prefix} ${diag.message}`;
      }
    }
  }

  return `${prefix} ${diag.message}`;
}

/**
 * Creates a floating live-preview controller anchored to whichever X composer
 * (`<textarea>` in X's 2026 frontend or legacy `[role="textbox"][contenteditable]`)
 * currently has focus.
 *
 * Mounted as a portal (using the Top Layer Popover API when available, and hosted
 * inside a native `<dialog>` when editing inside a modal dialog) so it never gets
 * clipped or trapped behind modals, never interferes with React editor state, and
 * builds every DOM node safely without `.innerHTML` (Trusted Types CSP compliant).
 */
export function createComposerPreviewController(
  doc: Document = document,
  getOptions: () => ComposerPreviewOptions = () => ({})
): ComposerPreviewController {
  let running = false;
  let activeComposer: HTMLElement | null = null;
  let dismissedForText: string | null = null;
  let panelEl: HTMLElement | null = null;
  let launcherEl: HTMLButtonElement | null = null;
  let debouncer: Debouncer | null = null;
  let activeSuggestions: FormulaMatch[] = [];
  let activePlainMaths: PlainMathSuggestion[] = [];
  let selectedSuggestionIdx = 0;
  let lastSuggestionSignature = "";
  let catalogOpen = false;
  let catalogCategory: FormulaCategory = "command";
  let catalogQuery = "";
  let selectedCatalogIdx = 0;
  let activeCatalogEntries: FormulaEntry[] = [];
  let catalogSearchInputEl: HTMLInputElement | null = null;
  let lastSelection: { start: number; end: number } = { start: 0, end: 0 };

  const captureComposerSelection = (): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    const text = readComposerText(activeComposer);
    lastSelection = readComposerSelection(activeComposer, text);
  };

  const resolveActiveSelection = (
    text: string
  ): { start: number; end: number } => {
    if (
      activeComposer instanceof HTMLTextAreaElement ||
      activeComposer instanceof HTMLInputElement
    ) {
      return readComposerSelection(activeComposer, text);
    }
    const start = Math.max(0, Math.min(lastSelection.start, text.length));
    const end = Math.max(start, Math.min(lastSelection.end, text.length));
    return { start, end };
  };

  const clearSuggestions = (): void => {
    activeSuggestions = [];
    activePlainMaths = [];
    selectedSuggestionIdx = 0;
    lastSuggestionSignature = "";
  };

  const syncSelectedSuggestionClass = (): void => {
    if (!panelEl) return;
    const locale: Locale = getOptions().locale ?? "en";
    const insertLabel = getMessages(locale).suggestionInsertBtn;
    const buttons = panelEl.querySelectorAll(
      ".latex-on-x-suggestions .latex-on-x-suggestion-item"
    );
    buttons.forEach((btn, idx) => {
      const selected = idx === selectedSuggestionIdx;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      const actionEl = btn.querySelector(".latex-on-x-suggestion-action");
      if (actionEl) {
        actionEl.textContent = selected ? "Tab" : insertLabel;
      }
    });
  };

  const syncSelectedCatalogClass = (
    resultsEl: HTMLElement,
    insertLabel: string
  ): void => {
    const buttons = resultsEl.querySelectorAll(".latex-on-x-suggestion-item");
    buttons.forEach((btn, idx) => {
      const selected = idx === selectedCatalogIdx;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      const actionEl = btn.querySelector(".latex-on-x-suggestion-action");
      if (actionEl) {
        actionEl.textContent = selected ? "Enter" : insertLabel;
      }
    });
  };

  const hidePopoverSafely = (el: HTMLElement): void => {
    if (!supportsPopover(el)) return;
    try {
      if (el.matches(":popover-open")) {
        el.hidePopover?.();
      }
    } catch {
      // Ignore if already closed or unsupported in the current runtime
    }
  };

  const showPopoverSafely = (el: HTMLElement): void => {
    if (!supportsPopover(el)) return;
    try {
      if (!el.matches(":popover-open")) {
        el.showPopover?.();
      }
    } catch {
      // Fall back gracefully to fixed z-index positioning
    }
  };

  const hideLauncher = (): void => {
    if (launcherEl) {
      hidePopoverSafely(launcherEl);
      launcherEl.style.display = "none";
      launcherEl.setAttribute("aria-hidden", "true");
    }
  };

  const destroyLauncher = (): void => {
    if (launcherEl) {
      hidePopoverSafely(launcherEl);
      launcherEl.remove();
      launcherEl = null;
    }
  };

  const positionLauncher = (
    btn: HTMLButtonElement,
    composer: HTMLElement
  ): void => {
    if (typeof window === "undefined") return;
    const rect = composer.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const btnWidth = btn.offsetWidth || 34;
    const btnHeight = btn.offsetHeight || 26;
    const left = Math.max(
      12,
      Math.min(rect.right - btnWidth - 6, window.innerWidth - btnWidth - 12)
    );
    const top = Math.max(
      12,
      Math.min(rect.bottom - btnHeight - 6, window.innerHeight - btnHeight - 12)
    );

    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(top)}px`;
  };

  const ensureLauncher = (composer: HTMLElement | null): HTMLButtonElement => {
    const host = resolvePanelHost(doc, composer);
    if (launcherEl && launcherEl.isConnected) {
      if (launcherEl.parentElement !== host) {
        hidePopoverSafely(launcherEl);
        host.appendChild(launcherEl);
      }
      return launcherEl;
    }

    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "latex-on-x-launcher";
    btn.setAttribute(LAUNCHER_BTN_ATTR, "true");
    btn.textContent = "∑";
    if (supportsPopover(btn)) {
      btn.setAttribute("popover", "manual");
    }
    btn.style.display = "none";

    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openCatalog(true);
    });

    host.appendChild(btn);
    launcherEl = btn;
    return btn;
  };

  const showLauncherForComposer = (
    composer: HTMLElement,
    theme: "light" | "dim" | "dark",
    locale: Locale
  ): void => {
    const msg = getMessages(locale);
    const btn = ensureLauncher(composer);
    btn.setAttribute("data-theme", theme);
    btn.setAttribute("title", msg.launcherTooltip);
    btn.setAttribute("aria-label", msg.launcherTooltip);
    btn.style.display = "inline-flex";
    btn.setAttribute("aria-hidden", "false");
    showPopoverSafely(btn);
    positionLauncher(btn, composer);
  };

  const showPanel = (panel: HTMLElement): void => {
    hideLauncher();
    panel.style.display = "block";
    panel.setAttribute("aria-hidden", "false");
    showPopoverSafely(panel);
  };

  const hidePanel = (): void => {
    catalogSearchInputEl = null;
    if (panelEl) {
      hidePopoverSafely(panelEl);
      panelEl.style.display = "none";
      panelEl.setAttribute("aria-hidden", "true");
    }
  };

  const destroyPanel = (): void => {
    catalogSearchInputEl = null;
    if (panelEl) {
      hidePopoverSafely(panelEl);
      panelEl.remove();
      panelEl = null;
    }
  };

  const ensurePanel = (composer: HTMLElement | null): HTMLElement => {
    const host = resolvePanelHost(doc, composer);
    if (panelEl && panelEl.isConnected) {
      if (panelEl.parentElement !== host) {
        hidePopoverSafely(panelEl);
        host.appendChild(panelEl);
      }
      return panelEl;
    }

    const panel = doc.createElement("aside");
    panel.className = "latex-on-x-preview-panel";
    panel.setAttribute(PREVIEW_PANEL_ATTR, "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-live", "polite");
    if (supportsPopover(panel)) {
      panel.setAttribute("popover", "manual");
    }
    panel.style.display = "none";

    // Prevent clicking buttons inside the preview panel from stealing focus from the composer,
    // while still allowing the catalog search input to receive focus normally.
    panel.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".latex-on-x-catalog-search")
      ) {
        return;
      }
      event.preventDefault();
    });

    host.appendChild(panel);
    panelEl = panel;
    return panel;
  };

  const positionPanel = (panel: HTMLElement, composer: HTMLElement): void => {
    if (typeof window === "undefined") return;

    const rect = composer.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const margin = 8;
    const width = Math.min(Math.max(rect.width, 280), Math.min(560, window.innerWidth - 24));
    const left = Math.max(
      12,
      Math.min(rect.left, window.innerWidth - width - 12)
    );

    panel.style.width = `${Math.round(width)}px`;
    panel.style.left = `${Math.round(left)}px`;

    // Measure height after showing; flip above composer if near bottom of viewport
    const panelHeight = panel.offsetHeight || 120;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const top =
      spaceBelow >= panelHeight || spaceBelow >= rect.top
        ? rect.bottom + margin
        : Math.max(12, rect.top - panelHeight - margin);

    panel.style.top = `${Math.round(top)}px`;
  };

  const openCatalog = (focusSearch: boolean): void => {
    if (!running || !activeComposer || !activeComposer.isConnected) return;
    captureComposerSelection();
    dismissedForText = null;
    catalogOpen = true;
    renderPreviewNow();
    if (focusSearch && catalogSearchInputEl) {
      catalogSearchInputEl.focus();
    }
  };

  const closeCatalog = (restoreComposerFocus: boolean): void => {
    catalogOpen = false;
    catalogQuery = "";
    activeCatalogEntries = [];
    selectedCatalogIdx = 0;
    if (restoreComposerFocus && activeComposer && activeComposer.isConnected) {
      activeComposer.focus?.();
    }
    renderPreviewNow();
  };

  const renderPreviewNow = (): void => {
    if (!running || !activeComposer || !activeComposer.isConnected) {
      clearSuggestions();
      catalogOpen = false;
      hidePanel();
      hideLauncher();
      return;
    }

    const opts = getOptions();
    const locale: Locale = opts.locale ?? "en";
    const enableChemistry = opts.enableChemistry ?? true;
    const msg = getMessages(locale);
    const currentTheme = detectPageTheme(doc);

    if (!enableChemistry && catalogCategory === "chemistry") {
      catalogCategory = "command";
    }

    const text = readComposerText(activeComposer);
    if (dismissedForText !== null && text === dismissedForText && !catalogOpen) {
      clearSuggestions();
      hidePanel();
      showLauncherForComposer(activeComposer, currentTheme, locale);
      return;
    }
    dismissedForText = null;

    const analysis = analyzeComposerDraft(text, { enableChemistry });

    const cursorPos = readComposerCursor(activeComposer, text);
    const acCtx = extractAutocompleteContext(text, cursorPos);
    const suggestions =
      !catalogOpen && acCtx ? searchFormulaCatalog(acCtx, locale, 5) : [];

    const isTypingSingleBareCommand =
      suggestions.length > 0 &&
      acCtx?.mode === "command" &&
      text.slice(0, acCtx.replaceStart).trim().length === 0 &&
      text.slice(acCtx.replaceEnd).trim().length === 0;

    const bareDraft =
      !analysis.shouldShowPreview && !isTypingSingleBareCommand
        ? analyzeBareLatexDraft(text, { enableChemistry })
        : null;

    const plainMaths =
      suggestions.length === 0 && bareDraft === null
        ? detectPlainMathExpressions(text)
        : [];
    const hasPlainMaths = plainMaths.length > 0;

    if (
      !analysis.shouldShowPreview &&
      bareDraft === null &&
      suggestions.length === 0 &&
      !hasPlainMaths &&
      !catalogOpen
    ) {
      clearSuggestions();
      hidePanel();
      showLauncherForComposer(activeComposer, currentTheme, locale);
      return;
    }

    const sig = suggestions
      .map((s) => `${s.entry.id}:${s.replaceStart}:${s.replaceEnd}`)
      .join("|");
    if (sig !== lastSuggestionSignature) {
      selectedSuggestionIdx = 0;
      lastSuggestionSignature = sig;
    } else if (selectedSuggestionIdx >= suggestions.length) {
      selectedSuggestionIdx = 0;
    }
    activeSuggestions = suggestions;
    activePlainMaths = plainMaths;

    const panel = ensurePanel(activeComposer);
    panel.setAttribute("data-theme", currentTheme);
    panel.textContent = "";

    const bodyEl = doc.createElement("div");
    bodyEl.className = "latex-on-x-preview-body";

    const extraKatexErrors: Array<{
      kind: "katex_error";
      formulaIndex: number;
      message: string;
    }> = [];

    let renderedFormulaCount = 0;
    let hasPreviewBody = false;
    let hasBareLatexPreview = false;

    const appendTextChunkWithPlainMath = (
      chunk: string,
      chunkStartOffset: number
    ): void => {
      const chunkEndOffset = chunkStartOffset + chunk.length;
      let cursor = chunkStartOffset;

      for (const pm of plainMaths) {
        if (pm.replaceEnd <= chunkStartOffset) continue;
        if (pm.replaceStart >= chunkEndOffset) break;

        if (pm.replaceStart > cursor) {
          bodyEl.appendChild(
            doc.createTextNode(
              chunk.slice(cursor - chunkStartOffset, pm.replaceStart - chunkStartOffset)
            )
          );
        }

        const wrapper = doc.createElement("span");
        const res = renderFormulaToElement(pm.latex, pm.mode, wrapper, {
          enableChemistry,
        });
        if (res.ok) {
          renderedFormulaCount += 1;
          wrapper.className =
            pm.mode === "display"
              ? "latex-on-x-formula latex-on-x-display"
              : "latex-on-x-formula latex-on-x-inline";
          bodyEl.appendChild(wrapper);
        } else {
          bodyEl.appendChild(doc.createTextNode(pm.raw));
        }

        cursor = pm.replaceEnd;
      }

      if (cursor < chunkEndOffset) {
        bodyEl.appendChild(
          doc.createTextNode(chunk.slice(cursor - chunkStartOffset))
        );
      }
    };

    if (analysis.shouldShowPreview || hasPlainMaths) {
      hasPreviewBody = true;
      const erroredFormulaIndices = new Set<number>();
      for (const diag of analysis.diagnostics) {
        if (
          diag.kind === "validation_error" ||
          diag.kind === "chemistry_disabled"
        ) {
          erroredFormulaIndices.add(diag.formulaIndex);
        }
      }

      let formulaIdx = 0;
      let textOffset = 0;
      for (const seg of analysis.segments) {
        if (seg.type === "text") {
          if (hasPlainMaths) {
            appendTextChunkWithPlainMath(seg.content, textOffset);
          } else {
            bodyEl.appendChild(doc.createTextNode(seg.content));
          }
          textOffset += seg.content.length;
        } else {
          const currentIdx = formulaIdx;
          formulaIdx += 1;
          textOffset += seg.raw.length;

          if (erroredFormulaIndices.has(currentIdx)) {
            const badSpan = doc.createElement("span");
            badSpan.className = "latex-on-x-preview-error-chip";
            badSpan.textContent = seg.raw;
            bodyEl.appendChild(badSpan);
            continue;
          }

          const wrapper = doc.createElement("span");
          const result = renderFormulaToElement(seg.content, seg.mode, wrapper, {
            enableChemistry,
          });

          if (!result.ok) {
            const badSpan = doc.createElement("span");
            badSpan.className = "latex-on-x-preview-error-chip";
            badSpan.textContent = seg.raw;
            bodyEl.appendChild(badSpan);
            extraKatexErrors.push({
              kind: "katex_error",
              formulaIndex: currentIdx,
              message: result.message,
            });
          } else {
            renderedFormulaCount += 1;
            wrapper.className =
              seg.mode === "display"
                ? "latex-on-x-formula latex-on-x-display"
                : "latex-on-x-formula latex-on-x-inline";
            bodyEl.appendChild(wrapper);
          }
        }
      }

      if (!analysis.shouldShowPreview && renderedFormulaCount === 0) {
        hasPreviewBody = false;
        if (!catalogOpen) {
          clearSuggestions();
          hidePanel();
          showLauncherForComposer(activeComposer, currentTheme, locale);
          return;
        }
      }
    } else if (bareDraft !== null) {
      const bareErroredIndices = new Set<number>();
      for (const diag of bareDraft.diagnostics) {
        if (diag.kind === "validation_error") {
          bareErroredIndices.add(diag.formulaIndex);
        }
      }

      let bareIdx = 0;
      for (const seg of bareDraft.segments) {
        if (seg.type === "text") {
          bodyEl.appendChild(doc.createTextNode(seg.content));
        } else {
          const currentIdx = bareIdx;
          bareIdx += 1;

          if (bareErroredIndices.has(currentIdx)) {
            bodyEl.appendChild(doc.createTextNode(seg.raw));
            continue;
          }

          const wrapper = doc.createElement("span");
          const result = renderFormulaToElement(seg.content, seg.mode, wrapper, {
            enableChemistry,
          });
          if (result.ok) {
            renderedFormulaCount += 1;
            wrapper.className =
              seg.mode === "display"
                ? "latex-on-x-formula latex-on-x-display"
                : "latex-on-x-formula latex-on-x-inline";
            bodyEl.appendChild(wrapper);
          } else {
            bodyEl.appendChild(doc.createTextNode(seg.raw));
          }
        }
      }

      if (renderedFormulaCount > 0) {
        hasPreviewBody = true;
        hasBareLatexPreview = true;
      } else if (!catalogOpen && suggestions.length === 0) {
        clearSuggestions();
        hidePanel();
        showLauncherForComposer(activeComposer, currentTheme, locale);
        return;
      }
    }

    const allDiagnostics = [...analysis.diagnostics, ...extraKatexErrors];

    // Header
    const headerEl = doc.createElement("div");
    headerEl.className = "latex-on-x-preview-header";

    const titleGroup = doc.createElement("div");
    titleGroup.className = "latex-on-x-preview-title-group";

    const titleEl = doc.createElement("span");
    titleEl.className = "latex-on-x-preview-title";
    titleEl.textContent = hasPreviewBody
      ? `∑ ${msg.previewTitle}`
      : catalogOpen
        ? `∑ ${msg.catalogTitle}`
        : `∑ ${msg.suggestionsTitle}`;
    titleGroup.appendChild(titleEl);

    if (analysis.shouldShowPreview) {
      const badgeEl = doc.createElement("span");
      if (allDiagnostics.length > 0) {
        badgeEl.className = "latex-on-x-preview-badge is-warning";
        badgeEl.textContent =
          allDiagnostics.length === 1
            ? `⚠ ${msg.previewIssueSingular}`
            : `⚠ ${msg.previewIssuePlural.replace("{n}", String(allDiagnostics.length))}`;
      } else {
        badgeEl.className = "latex-on-x-preview-badge is-ok";
        badgeEl.textContent =
          analysis.formulaCount === 1
            ? `✓ ${msg.previewReadySingular}`
            : `✓ ${msg.previewReadyPlural.replace("{n}", String(analysis.formulaCount))}`;
      }
      titleGroup.appendChild(badgeEl);
    } else if (hasBareLatexPreview && hasPreviewBody) {
      const badgeEl = doc.createElement("span");
      badgeEl.className = "latex-on-x-preview-badge is-plain";
      badgeEl.textContent = msg.bareDraftBadge;
      titleGroup.appendChild(badgeEl);
    } else if (hasPlainMaths && hasPreviewBody) {
      const badgeEl = doc.createElement("span");
      badgeEl.className = "latex-on-x-preview-badge is-plain";
      badgeEl.textContent = msg.plainMathBadge;
      titleGroup.appendChild(badgeEl);
    } else if (!catalogOpen) {
      const hintEl = doc.createElement("span");
      hintEl.className = "latex-on-x-preview-hint";
      hintEl.textContent = msg.suggestionsHint;
      titleGroup.appendChild(hintEl);
    }

    const actionsGroup = doc.createElement("div");
    actionsGroup.className = "latex-on-x-preview-actions";

    if (hasBareLatexPreview && hasPreviewBody) {
      const wrapBtn = doc.createElement("button");
      wrapBtn.type = "button";
      wrapBtn.className = "latex-on-x-preview-convert";
      wrapBtn.setAttribute("aria-label", msg.wrapDelimitersTooltip);
      wrapBtn.setAttribute("title", msg.wrapDelimitersTooltip);
      wrapBtn.textContent = msg.wrapDelimitersBtn;
      wrapBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        acceptBareLatexWrap();
      });
      actionsGroup.appendChild(wrapBtn);
    } else if (hasPlainMaths && hasPreviewBody) {
      const convertBtn = doc.createElement("button");
      convertBtn.type = "button";
      convertBtn.className = "latex-on-x-preview-convert";
      convertBtn.setAttribute("aria-label", msg.convertLatexTooltip);
      convertBtn.setAttribute("title", msg.convertLatexTooltip);
      convertBtn.textContent = msg.convertLatexBtn;
      convertBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        acceptPlainMathConversion();
      });
      actionsGroup.appendChild(convertBtn);
    }

    if (renderedFormulaCount > 0) {
      const exportBtn = doc.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "latex-on-x-preview-export";
      exportBtn.setAttribute("aria-label", msg.exportPngTooltip);
      exportBtn.setAttribute("title", msg.exportPngTooltip);
      exportBtn.textContent = msg.exportPngBtn;

      exportBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (exportBtn.disabled) return;

        exportBtn.disabled = true;
        exportBtn.classList.remove("is-success", "is-error");
        exportBtn.textContent = msg.exportPngBusy;

        const exporter = opts.exportPng ?? exportPreviewBodyToPng;
        void exporter(bodyEl, currentTheme, doc).then((res) => {
          if (!exportBtn.isConnected) return;
          if (res.ok) {
            exportBtn.classList.add("is-success");
            exportBtn.textContent =
              res.method === "copied" ? msg.exportPngCopied : msg.exportPngSaved;
          } else {
            exportBtn.classList.add("is-error");
            exportBtn.textContent = msg.exportPngError;
          }

          setTimeout(() => {
            if (!exportBtn.isConnected) return;
            exportBtn.disabled = false;
            exportBtn.classList.remove("is-success", "is-error");
            exportBtn.textContent = msg.exportPngBtn;
          }, 1800);
        });
      });

      actionsGroup.appendChild(exportBtn);
    }

    if (hasPreviewBody) {
      const catalogToggleBtn = doc.createElement("button");
      catalogToggleBtn.type = "button";
      catalogToggleBtn.className = catalogOpen
        ? "latex-on-x-preview-catalog-toggle is-active"
        : "latex-on-x-preview-catalog-toggle";
      catalogToggleBtn.setAttribute("aria-label", msg.catalogToggleTooltip);
      catalogToggleBtn.setAttribute("title", msg.catalogToggleTooltip);
      catalogToggleBtn.setAttribute(
        "aria-expanded",
        catalogOpen ? "true" : "false"
      );
      catalogToggleBtn.textContent = msg.catalogToggleBtn;
      catalogToggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (catalogOpen) {
          closeCatalog(true);
        } else {
          openCatalog(true);
        }
      });
      actionsGroup.appendChild(catalogToggleBtn);
    }

    const closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "latex-on-x-preview-close";
    closeBtn.setAttribute("aria-label", msg.previewCloseTooltip);
    closeBtn.setAttribute("title", msg.previewCloseTooltip);
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const hadPreview = hasPreviewBody;
      const wasCatalogOpen = catalogOpen;
      catalogOpen = false;
      catalogQuery = "";
      activeCatalogEntries = [];
      if (hadPreview) {
        dismissedForText = text;
      }
      clearSuggestions();
      hidePanel();
      if (activeComposer && activeComposer.isConnected) {
        if (wasCatalogOpen && doc.activeElement !== activeComposer) {
          activeComposer.focus?.();
        }
        showLauncherForComposer(activeComposer, currentTheme, locale);
      }
    });

    actionsGroup.appendChild(closeBtn);
    headerEl.appendChild(titleGroup);
    headerEl.appendChild(actionsGroup);

    panel.appendChild(headerEl);

    if (hasPreviewBody) {
      panel.appendChild(bodyEl);
    }

    // Diagnostics footer (only when there are warnings/errors)
    if (allDiagnostics.length > 0) {
      const diagList = doc.createElement("ul");
      diagList.className = "latex-on-x-preview-diagnostics";

      for (const diag of allDiagnostics) {
        const li = doc.createElement("li");
        li.textContent = formatDiagnosticLine(diag, locale);
        diagList.appendChild(li);
      }

      panel.appendChild(diagList);
    }

    // Friendly non-blocking inline-display typography tips (v1.3)
    const inlineHints =
      analysis.shouldShowPreview && allDiagnostics.length === 0
        ? findInlineDisplayHints(text)
        : [];
    if (inlineHints.length > 0) {
      const tipsEl = doc.createElement("div");
      tipsEl.className = "latex-on-x-preview-tips";

      for (const hint of inlineHints) {
        const rowEl = doc.createElement("div");
        rowEl.className = "latex-on-x-preview-tip-row";

        const tipText = doc.createElement("span");
        tipText.className = "latex-on-x-preview-tip-text";
        tipText.textContent = msg.inlineDisplayTip.replace(
          "{raw}",
          () => hint.raw
        );

        const switchBtn = doc.createElement("button");
        switchBtn.type = "button";
        switchBtn.className = "latex-on-x-preview-tip-btn";
        switchBtn.textContent = msg.switchToInlineBtn;
        switchBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          applyInlineDisplayHint(hint);
        });

        rowEl.appendChild(tipText);
        rowEl.appendChild(switchBtn);
        tipsEl.appendChild(rowEl);
      }

      panel.appendChild(tipsEl);
    }

    // Formula Explorer & Search Palette (v1.4)
    catalogSearchInputEl = null;
    if (catalogOpen) {
      const catalogEl = doc.createElement("div");
      catalogEl.className = hasPreviewBody
        ? "latex-on-x-catalog"
        : "latex-on-x-catalog is-standalone";

      const controlsEl = doc.createElement("div");
      controlsEl.className = "latex-on-x-catalog-controls";

      const searchInput = doc.createElement("input");
      searchInput.type = "search";
      searchInput.className = "latex-on-x-catalog-search";
      searchInput.placeholder = msg.catalogSearchPlaceholder;
      searchInput.setAttribute("aria-label", msg.catalogSearchPlaceholder);
      searchInput.autocomplete = "off";
      searchInput.spellcheck = false;
      searchInput.value = catalogQuery;
      catalogSearchInputEl = searchInput;

      const tabsEl = doc.createElement("div");
      tabsEl.className = "latex-on-x-catalog-tabs";
      tabsEl.setAttribute("role", "tablist");

      const resultsEl = doc.createElement("ul");
      resultsEl.className = "latex-on-x-catalog-results";
      resultsEl.setAttribute("role", "listbox");

      const syncCatalogTabs = (): void => {
        const isSearching = catalogQuery.trim().length > 0;
        const tabButtons = tabsEl.querySelectorAll(".latex-on-x-catalog-tab");
        tabButtons.forEach((tabBtn) => {
          const cat = tabBtn.getAttribute("data-category");
          const active = !isSearching && cat === catalogCategory;
          tabBtn.classList.toggle("is-active", active);
          tabBtn.setAttribute("aria-selected", active ? "true" : "false");
        });
      };

      const populateCatalogResults = (): void => {
        const entries = filterCatalogEntries({
          query: catalogQuery,
          category: catalogCategory,
          locale,
          enableChemistry,
        });
        activeCatalogEntries = entries;
        selectedCatalogIdx = 0;
        resultsEl.textContent = "";

        if (entries.length === 0) {
          const emptyLi = doc.createElement("li");
          emptyLi.className = "latex-on-x-catalog-empty";
          emptyLi.textContent = msg.catalogEmpty;
          resultsEl.appendChild(emptyLi);
          return;
        }

        entries.forEach((entry, idx) => {
          const li = doc.createElement("li");
          const itemBtn = doc.createElement("button");
          itemBtn.type = "button";
          itemBtn.className =
            idx === selectedCatalogIdx
              ? "latex-on-x-suggestion-item is-selected"
              : "latex-on-x-suggestion-item";
          itemBtn.setAttribute("role", "option");
          itemBtn.setAttribute("data-entry-id", entry.id);
          itemBtn.setAttribute(
            "aria-selected",
            idx === selectedCatalogIdx ? "true" : "false"
          );

          const mainGroup = doc.createElement("div");
          mainGroup.className = "latex-on-x-suggestion-main";

          const formulaSpan = doc.createElement("span");
          formulaSpan.className = "latex-on-x-suggestion-formula";
          const previewRes = renderFormulaToElement(
            entry.previewLatex,
            entry.previewMode,
            formulaSpan,
            { enableChemistry }
          );
          if (!previewRes.ok) {
            formulaSpan.textContent = entry.snippet;
          }

          const metaGroup = doc.createElement("div");
          metaGroup.className = "latex-on-x-suggestion-meta";

          const labelEl = doc.createElement("span");
          labelEl.className = "latex-on-x-suggestion-label";
          labelEl.textContent = entry.labels[locale];
          metaGroup.appendChild(labelEl);

          if (entry.category === "command") {
            const codeEl = doc.createElement("span");
            codeEl.className = "latex-on-x-suggestion-code";
            codeEl.textContent = entry.snippet.trim();
            metaGroup.appendChild(codeEl);
          }

          mainGroup.appendChild(formulaSpan);
          mainGroup.appendChild(metaGroup);

          const actionEl = doc.createElement("span");
          actionEl.className = "latex-on-x-suggestion-action";
          actionEl.textContent =
            idx === selectedCatalogIdx ? "Enter" : msg.suggestionInsertBtn;

          itemBtn.appendChild(mainGroup);
          itemBtn.appendChild(actionEl);

          itemBtn.addEventListener("mouseenter", () => {
            selectedCatalogIdx = idx;
            syncSelectedCatalogClass(resultsEl, msg.suggestionInsertBtn);
          });

          itemBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            acceptCatalogEntry(idx);
          });

          li.appendChild(itemBtn);
          resultsEl.appendChild(li);
        });
      };

      for (const cat of CATALOG_CATEGORIES) {
        if (cat === "chemistry" && !enableChemistry) {
          continue;
        }
        const tabBtn = doc.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = "latex-on-x-catalog-tab";
        tabBtn.setAttribute("role", "tab");
        tabBtn.setAttribute("data-category", cat);
        tabBtn.textContent = getCategoryLabel(cat, msg);
        tabBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          catalogCategory = cat;
          catalogQuery = "";
          searchInput.value = "";
          syncCatalogTabs();
          populateCatalogResults();
          if (activeComposer && activeComposer.isConnected) {
            positionPanel(panel, activeComposer);
          }
        });
        tabsEl.appendChild(tabBtn);
      }

      searchInput.addEventListener("input", () => {
        catalogQuery = searchInput.value;
        syncCatalogTabs();
        populateCatalogResults();
        if (activeComposer && activeComposer.isConnected) {
          positionPanel(panel, activeComposer);
        }
      });

      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" && activeCatalogEntries.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          selectedCatalogIdx =
            (selectedCatalogIdx + 1) % activeCatalogEntries.length;
          syncSelectedCatalogClass(resultsEl, msg.suggestionInsertBtn);
        } else if (event.key === "ArrowUp" && activeCatalogEntries.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          selectedCatalogIdx =
            (selectedCatalogIdx - 1 + activeCatalogEntries.length) %
            activeCatalogEntries.length;
          syncSelectedCatalogClass(resultsEl, msg.suggestionInsertBtn);
        } else if (
          (event.key === "Enter" ||
            (event.key === "Tab" &&
              !event.shiftKey &&
              !event.ctrlKey &&
              !event.altKey &&
              !event.metaKey)) &&
          activeCatalogEntries.length > 0
        ) {
          event.preventDefault();
          event.stopPropagation();
          acceptCatalogEntry(selectedCatalogIdx);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeCatalog(true);
        }
      });

      controlsEl.appendChild(searchInput);
      controlsEl.appendChild(tabsEl);
      catalogEl.appendChild(controlsEl);
      catalogEl.appendChild(resultsEl);
      panel.appendChild(catalogEl);

      syncCatalogTabs();
      populateCatalogResults();
    }

    // Smart formula autocomplete suggestions list (v1.1)
    if (suggestions.length > 0) {
      const listEl = doc.createElement("ul");
      listEl.className = hasPreviewBody
        ? "latex-on-x-suggestions"
        : "latex-on-x-suggestions is-standalone";
      listEl.setAttribute("role", "listbox");

      suggestions.forEach((match, idx) => {
        const li = doc.createElement("li");
        const itemBtn = doc.createElement("button");
        itemBtn.type = "button";
        itemBtn.className =
          idx === selectedSuggestionIdx
            ? "latex-on-x-suggestion-item is-selected"
            : "latex-on-x-suggestion-item";
        itemBtn.setAttribute("role", "option");
        itemBtn.setAttribute(
          "aria-selected",
          idx === selectedSuggestionIdx ? "true" : "false"
        );

        const mainGroup = doc.createElement("div");
        mainGroup.className = "latex-on-x-suggestion-main";

        const formulaSpan = doc.createElement("span");
        formulaSpan.className = "latex-on-x-suggestion-formula";
        const previewRes = renderFormulaToElement(
          match.entry.previewLatex,
          match.entry.previewMode,
          formulaSpan,
          { enableChemistry }
        );
        if (!previewRes.ok) {
          formulaSpan.textContent = match.entry.snippet;
        }

        const metaGroup = doc.createElement("div");
        metaGroup.className = "latex-on-x-suggestion-meta";

        const labelEl = doc.createElement("span");
        labelEl.className = "latex-on-x-suggestion-label";
        labelEl.textContent = match.entry.labels[locale];
        metaGroup.appendChild(labelEl);

        if (match.entry.category === "command") {
          const codeEl = doc.createElement("span");
          codeEl.className = "latex-on-x-suggestion-code";
          codeEl.textContent = match.entry.snippet.trim();
          metaGroup.appendChild(codeEl);
        }

        mainGroup.appendChild(formulaSpan);
        mainGroup.appendChild(metaGroup);

        const actionEl = doc.createElement("span");
        actionEl.className = "latex-on-x-suggestion-action";
        actionEl.textContent =
          idx === selectedSuggestionIdx ? "Tab" : msg.suggestionInsertBtn;

        itemBtn.appendChild(mainGroup);
        itemBtn.appendChild(actionEl);

        itemBtn.addEventListener("mouseenter", () => {
          selectedSuggestionIdx = idx;
          syncSelectedSuggestionClass();
        });

        itemBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          acceptSuggestion(idx);
        });

        li.appendChild(itemBtn);
        listEl.appendChild(li);
      });

      panel.appendChild(listEl);
    }

    // Compact Quick Symbol Bar (v1.3 + always available inside Formula Explorer in v1.4)
    if ((hasPreviewBody || catalogOpen) && suggestions.length === 0) {
      const barEl = doc.createElement("div");
      barEl.className = "latex-on-x-symbol-bar";
      barEl.setAttribute("role", "toolbar");
      barEl.setAttribute("aria-label", msg.symbolBarLabel);

      for (const sym of QUICK_SYMBOLS) {
        if (sym.requiresChemistry && !enableChemistry) {
          continue;
        }
        const symBtn = doc.createElement("button");
        symBtn.type = "button";
        symBtn.className = "latex-on-x-symbol-btn";
        symBtn.setAttribute("data-symbol-id", sym.id);
        symBtn.setAttribute("title", sym.tooltips[locale]);
        symBtn.setAttribute("aria-label", sym.tooltips[locale]);
        symBtn.textContent = sym.label;
        symBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          insertQuickSymbol(sym);
        });
        barEl.appendChild(symBtn);
      }

      panel.appendChild(barEl);
    }

    showPanel(panel);
    positionPanel(panel, activeComposer);
  };

  const acceptSuggestion = (index: number): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    const match = activeSuggestions[index];
    if (!match) return;

    const currentText = readComposerText(activeComposer);
    const { text: nextText, cursorPos, inserted } = applyFormulaInsertion(
      currentText,
      match
    );

    clearSuggestions();
    debouncer?.cancel();
    writeComposerValue(activeComposer, nextText, cursorPos, inserted);
    lastSelection = { start: cursorPos, end: cursorPos };
    renderPreviewNow();
  };

  const acceptCatalogEntry = (index: number): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    const entry = activeCatalogEntries[index];
    if (!entry) return;

    const currentText = readComposerText(activeComposer);
    const { start, end } = resolveActiveSelection(currentText);
    const { text: nextText, cursorPos, inserted } = insertCatalogEntryAtSelection(
      currentText,
      start,
      end,
      entry
    );

    catalogOpen = false;
    catalogQuery = "";
    activeCatalogEntries = [];
    selectedCatalogIdx = 0;
    clearSuggestions();
    debouncer?.cancel();
    activeComposer.focus?.();
    writeComposerValue(activeComposer, nextText, cursorPos, inserted);
    lastSelection = { start: cursorPos, end: cursorPos };
    renderPreviewNow();
  };

  const acceptPlainMathConversion = (): void => {
    if (
      !activeComposer ||
      !activeComposer.isConnected ||
      activePlainMaths.length === 0
    ) {
      return;
    }

    const currentText = readComposerText(activeComposer);
    const { text: nextText, cursorPos } = applyPlainMathConversions(
      currentText,
      activePlainMaths
    );
    const lastWrapped =
      activePlainMaths[activePlainMaths.length - 1].wrappedLatex;

    clearSuggestions();
    debouncer?.cancel();
    writeComposerValue(activeComposer, nextText, cursorPos, lastWrapped);
    lastSelection = { start: cursorPos, end: cursorPos };
    renderPreviewNow();
  };

  const acceptBareLatexWrap = (): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    const enableChemistry = getOptions().enableChemistry ?? true;
    const currentText = readComposerText(activeComposer);
    const { text: nextText, cursorPos, inserted } = wrapBareLatexDraft(
      currentText,
      { enableChemistry }
    );
    if (nextText === currentText) return;

    clearSuggestions();
    debouncer?.cancel();
    writeComposerValue(activeComposer, nextText, cursorPos, inserted);
    lastSelection = { start: cursorPos, end: cursorPos };
    renderPreviewNow();
  };

  const applyInlineDisplayHint = (hint: InlineDisplayHint): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    const currentText = readComposerText(activeComposer);
    if (currentText.slice(hint.start, hint.end) !== hint.raw) {
      renderPreviewNow();
      return;
    }

    const { text: nextText, cursorPos } = convertDisplayHintToInline(
      currentText,
      hint
    );

    clearSuggestions();
    debouncer?.cancel();
    writeComposerValue(
      activeComposer,
      nextText,
      cursorPos,
      hint.inlineReplacement
    );
    lastSelection = { start: cursorPos, end: cursorPos };
    renderPreviewNow();
  };

  const insertQuickSymbol = (symbol: QuickSymbol): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    const currentText = readComposerText(activeComposer);
    const { start, end } = resolveActiveSelection(currentText);
    const { text: nextText, cursorPos, inserted } = applyQuickSymbol(
      currentText,
      start,
      end,
      symbol
    );

    const wasCatalogOpen = catalogOpen;
    catalogOpen = false;
    catalogQuery = "";
    activeCatalogEntries = [];
    selectedCatalogIdx = 0;
    clearSuggestions();
    debouncer?.cancel();
    if (wasCatalogOpen) {
      activeComposer.focus?.();
    }
    writeComposerValue(activeComposer, nextText, cursorPos, inserted);
    lastSelection = { start: cursorPos, end: cursorPos };
    renderPreviewNow();
  };

  const scheduleUpdate = (): void => {
    if (!debouncer) {
      const delay = getOptions().debounceMs ?? 120;
      debouncer = createDebouncer(delay, renderPreviewNow);
    }
    debouncer.trigger();
  };

  const onFocusIn = (event: FocusEvent): void => {
    const composer = findComposerElement(event.target);
    if (!composer) return;
    if (activeComposer !== composer) {
      catalogOpen = false;
      catalogQuery = "";
      dismissedForText = null;
    }
    activeComposer = composer;
    captureComposerSelection();
    renderPreviewNow();
  };

  const onFocusOut = (event: FocusEvent): void => {
    const composer = findComposerElement(event.target);
    const leftComposer = composer !== null && composer === activeComposer;
    const leftOverlay = isInsideOverlay(event.target);
    if (!leftComposer && !leftOverlay) return;

    const nextTarget = event.relatedTarget;
    if (isInsideOverlay(nextTarget)) {
      return;
    }
    if (
      activeComposer &&
      nextTarget instanceof Node &&
      activeComposer.contains(nextTarget)
    ) {
      return;
    }

    debouncer?.cancel();
    activeComposer = null;
    catalogOpen = false;
    catalogQuery = "";
    activeCatalogEntries = [];
    clearSuggestions();
    hidePanel();
    hideLauncher();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      !running ||
      !activeComposer ||
      !panelEl ||
      panelEl.style.display === "none"
    ) {
      return;
    }

    const composer = findComposerElement(event.target);
    if (!composer || composer !== activeComposer) return;

    if (catalogOpen && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCatalog(false);
      return;
    }

    const hasSuggestions = activeSuggestions.length > 0;
    const hasPlainMath = activePlainMaths.length > 0;
    if (!hasSuggestions && !hasPlainMath) return;

    if (hasSuggestions && event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      selectedSuggestionIdx =
        (selectedSuggestionIdx + 1) % activeSuggestions.length;
      syncSelectedSuggestionClass();
    } else if (hasSuggestions && event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      selectedSuggestionIdx =
        (selectedSuggestionIdx - 1 + activeSuggestions.length) %
        activeSuggestions.length;
      syncSelectedSuggestionClass();
    } else if (
      event.key === "Tab" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (hasSuggestions) {
        acceptSuggestion(selectedSuggestionIdx);
      } else if (hasPlainMath) {
        acceptPlainMathConversion();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismissedForText = readComposerText(activeComposer);
      clearSuggestions();
      hidePanel();
      showLauncherForComposer(
        activeComposer,
        detectPageTheme(doc),
        getOptions().locale ?? "en"
      );
    }
  };

  const onInputOrKey = (event: Event): void => {
    if (
      event instanceof KeyboardEvent &&
      event.type === "keyup" &&
      (event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Tab" ||
        event.key === "Escape")
    ) {
      return;
    }

    const composer = findComposerElement(event.target);
    if (!composer) return;
    activeComposer = composer;
    captureComposerSelection();
    scheduleUpdate();
  };

  const onViewportChange = (): void => {
    if (!activeComposer || !activeComposer.isConnected) return;
    if (panelEl && panelEl.style.display !== "none") {
      positionPanel(panelEl, activeComposer);
    }
    if (launcherEl && launcherEl.style.display !== "none") {
      positionLauncher(launcherEl, activeComposer);
    }
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      doc.addEventListener("focusin", onFocusIn, true);
      doc.addEventListener("focusout", onFocusOut, true);
      doc.addEventListener("keydown", onKeyDown, true);
      doc.addEventListener("input", onInputOrKey, true);
      doc.addEventListener("keyup", onInputOrKey, true);
      doc.addEventListener("click", onInputOrKey, true);
      doc.addEventListener("paste", onInputOrKey, true);
      doc.addEventListener("cut", onInputOrKey, true);
      doc.addEventListener("compositionend", onInputOrKey, true);
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("scroll", onViewportChange, true);

      // If a composer is already focused when enabled, show preview or launcher immediately
      const currentFocus = findComposerElement(doc.activeElement);
      if (currentFocus) {
        activeComposer = currentFocus;
        captureComposerSelection();
        renderPreviewNow();
      }
    },

    stop(): void {
      if (!running) return;
      running = false;
      debouncer?.cancel();
      debouncer = null;
      activeComposer = null;
      dismissedForText = null;
      catalogOpen = false;
      catalogQuery = "";
      activeCatalogEntries = [];
      selectedCatalogIdx = 0;
      clearSuggestions();

      doc.removeEventListener("focusin", onFocusIn, true);
      doc.removeEventListener("focusout", onFocusOut, true);
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("input", onInputOrKey, true);
      doc.removeEventListener("keyup", onInputOrKey, true);
      doc.removeEventListener("click", onInputOrKey, true);
      doc.removeEventListener("paste", onInputOrKey, true);
      doc.removeEventListener("cut", onInputOrKey, true);
      doc.removeEventListener("compositionend", onInputOrKey, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);

      destroyPanel();
      destroyLauncher();
    },

    isRunning(): boolean {
      return running;
    },

    refresh(): void {
      if (!running) return;
      debouncer?.cancel();
      renderPreviewNow();
    },
  };
}
