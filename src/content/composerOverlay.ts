import {
  analyzeComposerDraft,
  createDebouncer,
  type ComposerDiagnostic,
  type Debouncer,
} from "../core/composerPreview.js";
import { getMessages, type Locale } from "../i18n/messages.js";
import { renderFormulaToElement } from "../renderer/katexRenderer.js";

export const COMPOSER_SELECTOR =
  '[role="textbox"][contenteditable="true"], textarea[data-latex-composer="true"]';
export const PREVIEW_PANEL_ATTR = "data-latex-on-x-preview";

export interface ComposerPreviewOptions {
  locale?: Locale;
  enableChemistry?: boolean;
  debounceMs?: number;
}

export interface ComposerPreviewController {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  refresh(): void;
}

/**
 * Extracts plain text from an X contenteditable composer or sandbox textarea,
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

function findComposerElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const match = target.closest(COMPOSER_SELECTOR);
  return match instanceof HTMLElement ? match : null;
}

/**
 * Detects whether the active page (x.com) is currently in Light, Dim, or Dark mode
 * by inspecting the computed background color of `document.body`.
 */
function detectPageTheme(doc: Document): "light" | "dim" | "dark" {
  const body = doc.body;
  if (!body || typeof window === "undefined" || !window.getComputedStyle) {
    return "dark";
  }

  const bg = window.getComputedStyle(body).backgroundColor;
  const match = bg.match(/\d+/g);
  if (!match || match.length < 3) return "dark";

  const [r, g, b] = match.map(Number);
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
      .replace("{open}", diag.open)
      .replace("{close}", diag.close);
  }

  const prefix = msg.diagFormulaPrefix.replace(
    "{n}",
    String(diag.formulaIndex + 1)
  );

  if (diag.kind === "chemistry_disabled") {
    return `${prefix} ${msg.diagChemDisabled}`;
  }

  return `${prefix} ${diag.message}`;
}

/**
 * Creates a floating live-preview controller anchored to whichever X composer
 * (`[role="textbox"][contenteditable="true"]`) currently has focus.
 *
 * Mounted as a portal on `document.body` so it never interferes with X's React
 * editor reconciliation, and builds every DOM node safely without `.innerHTML`
 * (100% compliant with x.com's Trusted Types CSP).
 */
export function createComposerPreviewController(
  doc: Document = document,
  getOptions: () => ComposerPreviewOptions = () => ({})
): ComposerPreviewController {
  let running = false;
  let activeComposer: HTMLElement | null = null;
  let dismissedForText: string | null = null;
  let panelEl: HTMLElement | null = null;
  let debouncer: Debouncer | null = null;

  const hidePanel = (): void => {
    if (panelEl) {
      panelEl.style.display = "none";
      panelEl.setAttribute("aria-hidden", "true");
    }
  };

  const destroyPanel = (): void => {
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
  };

  const ensurePanel = (): HTMLElement => {
    if (panelEl && panelEl.isConnected) {
      return panelEl;
    }

    const panel = doc.createElement("aside");
    panel.className = "latex-on-x-preview-panel";
    panel.setAttribute(PREVIEW_PANEL_ATTR, "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-live", "polite");
    panel.style.display = "none";

    // Prevent clicking inside the preview panel from stealing focus from the composer
    panel.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    (doc.body ?? doc.documentElement).appendChild(panel);
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

  const renderPreviewNow = (): void => {
    if (!running || !activeComposer || !activeComposer.isConnected) {
      hidePanel();
      return;
    }

    const text = readComposerText(activeComposer);
    if (dismissedForText !== null && text === dismissedForText) {
      hidePanel();
      return;
    }
    dismissedForText = null;

    const opts = getOptions();
    const locale: Locale = opts.locale ?? "en";
    const enableChemistry = opts.enableChemistry ?? true;
    const msg = getMessages(locale);

    const analysis = analyzeComposerDraft(text, { enableChemistry });
    if (!analysis.shouldShowPreview) {
      hidePanel();
      return;
    }

    const panel = ensurePanel();
    panel.setAttribute("data-theme", detectPageTheme(doc));
    panel.textContent = "";

    // Build preview content first so we also capture any KaTeX syntax errors
    const bodyEl = doc.createElement("div");
    bodyEl.className = "latex-on-x-preview-body";

    const extraKatexErrors: Array<{
      kind: "katex_error";
      formulaIndex: number;
      message: string;
    }> = [];

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
    for (const seg of analysis.segments) {
      if (seg.type === "text") {
        bodyEl.appendChild(doc.createTextNode(seg.content));
      } else {
        const currentIdx = formulaIdx;
        formulaIdx += 1;

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
          wrapper.className =
            seg.mode === "display"
              ? "latex-on-x-formula latex-on-x-display"
              : "latex-on-x-formula latex-on-x-inline";
          bodyEl.appendChild(wrapper);
        }
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
    titleEl.textContent = `∑ ${msg.previewTitle}`;

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

    titleGroup.appendChild(titleEl);
    titleGroup.appendChild(badgeEl);

    const actionsGroup = doc.createElement("div");
    actionsGroup.className = "latex-on-x-preview-actions";

    const closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "latex-on-x-preview-close";
    closeBtn.setAttribute("aria-label", msg.previewCloseTooltip);
    closeBtn.setAttribute("title", msg.previewCloseTooltip);
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      dismissedForText = text;
      hidePanel();
    });

    actionsGroup.appendChild(closeBtn);
    headerEl.appendChild(titleGroup);
    headerEl.appendChild(actionsGroup);

    panel.appendChild(headerEl);
    panel.appendChild(bodyEl);

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

    panel.style.display = "block";
    panel.setAttribute("aria-hidden", "false");
    positionPanel(panel, activeComposer);
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
    activeComposer = composer;
    dismissedForText = null;
    renderPreviewNow();
  };

  const onFocusOut = (event: FocusEvent): void => {
    const composer = findComposerElement(event.target);
    if (!composer || composer !== activeComposer) return;

    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Element &&
      nextTarget.closest(`[${PREVIEW_PANEL_ATTR}="true"]`)
    ) {
      return;
    }

    debouncer?.cancel();
    activeComposer = null;
    hidePanel();
  };

  const onInputOrKey = (event: Event): void => {
    const composer = findComposerElement(event.target);
    if (!composer) return;
    activeComposer = composer;
    scheduleUpdate();
  };

  const onViewportChange = (): void => {
    if (
      panelEl &&
      panelEl.style.display !== "none" &&
      activeComposer &&
      activeComposer.isConnected
    ) {
      positionPanel(panelEl, activeComposer);
    }
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      doc.addEventListener("focusin", onFocusIn);
      doc.addEventListener("focusout", onFocusOut);
      doc.addEventListener("input", onInputOrKey);
      doc.addEventListener("keyup", onInputOrKey);
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("scroll", onViewportChange, true);

      // If a composer is already focused when enabled, show preview immediately
      const currentFocus = findComposerElement(doc.activeElement);
      if (currentFocus) {
        activeComposer = currentFocus;
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

      doc.removeEventListener("focusin", onFocusIn);
      doc.removeEventListener("focusout", onFocusOut);
      doc.removeEventListener("input", onInputOrKey);
      doc.removeEventListener("keyup", onInputOrKey);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);

      destroyPanel();
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
