// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComposerPreviewController,
  PREVIEW_PANEL_ATTR,
} from "../src/content/composerOverlay.js";
import type { Locale } from "../src/i18n/messages.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("composerOverlay (Milestone B.2)", () => {
  it("stays hidden for plain text and renders debounced KaTeX preview when typing math", () => {
    vi.useFakeTimers();

    const composer = document.createElement("div");
    composer.setAttribute("role", "textbox");
    composer.setAttribute("contenteditable", "true");
    document.body.appendChild(composer);

    const controller = createComposerPreviewController(document, () => ({
      locale: "en",
      enableChemistry: true,
      debounceMs: 120,
    }));
    controller.start();

    composer.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    composer.textContent = "Just plain text without math";
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(150);

    const panelBefore = document.querySelector(
      `[${PREVIEW_PANEL_ATTR}="true"]`
    ) as HTMLElement | null;
    expect(panelBefore === null || panelBefore.style.display === "none").toBe(
      true
    );

    // Type math -> should remain unrendered before 120ms debounce elapses
    composer.textContent = "Euler: \\(e^{i\\pi} + 1 = 0\\)";
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(80);
    expect(document.querySelector(".katex")).toBeNull();

    // After debounce elapses -> panel opens with rendered KaTeX and green badge
    vi.advanceTimersByTime(40);
    const panel = document.querySelector(
      `[${PREVIEW_PANEL_ATTR}="true"]`
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.style.display).toBe("block");
    expect(panel.querySelector(".katex")).not.toBeNull();
    expect(panel.textContent).toContain("1 formula ready");
    expect(panel.querySelector(".latex-on-x-preview-diagnostics")).toBeNull();

    controller.stop();
    expect(
      document.querySelector(`[${PREVIEW_PANEL_ATTR}="true"]`)
    ).toBeNull();
  });

  it("surfaces unclosed delimiter, validation, and KaTeX syntax diagnostics live", () => {
    vi.useFakeTimers();

    const composer = document.createElement("div");
    composer.setAttribute("role", "textbox");
    composer.setAttribute("contenteditable", "true");
    document.body.appendChild(composer);

    let locale: Locale = "en";
    const controller = createComposerPreviewController(document, () => ({
      locale,
      enableChemistry: true,
      debounceMs: 50,
    }));
    controller.start();

    composer.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    composer.textContent =
      "Broken brace $$\\frac{a}{b$$, syntax $$\\frac{1}$$, and unclosed \\(x^2";
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(60);

    const panel = document.querySelector(
      `[${PREVIEW_PANEL_ATTR}="true"]`
    ) as HTMLElement;
    expect(panel.style.display).toBe("block");

    const items = panel.querySelectorAll(".latex-on-x-preview-diagnostics li");
    expect(items).toHaveLength(3);
    expect(panel.textContent).toContain("3 issues");
    expect(panel.textContent).toContain("Unclosed \\( delimiter (missing \\)).");
    expect(panel.textContent).toContain("Formula #1: Unbalanced braces.");

    // Live locale switch updates header and diagnostics immediately
    locale = "es";
    controller.refresh();
    expect(panel.textContent).toContain("Vista previa LaTeX");
    expect(panel.textContent).toContain("3 avisos");
    expect(panel.textContent).toContain("Delimitador \\( sin cerrar (falta \\)).");
    expect(panel.textContent).toContain("Fórmula #1: Llaves desbalanceadas.");

    controller.stop();
  });

  it("complies with Trusted Types CSP (never assigns .innerHTML) and supports dismiss button", () => {
    vi.useFakeTimers();

    const composer = document.createElement("div");
    composer.setAttribute("role", "textbox");
    composer.setAttribute("contenteditable", "true");
    composer.textContent = "$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$";
    document.body.appendChild(composer);

    const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "innerHTML"
    );
    const spySetter = vi.fn(() => {
      throw new TypeError("TrustedHTML required");
    });
    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: true,
      get: innerHtmlDescriptor?.get,
      set: spySetter,
    });

    const controller = createComposerPreviewController(document, () => ({
      debounceMs: 50,
    }));

    try {
      controller.start();
      composer.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

      expect(spySetter).not.toHaveBeenCalled();
      const panel = document.querySelector(
        `[${PREVIEW_PANEL_ATTR}="true"]`
      ) as HTMLElement;
      expect(panel.style.display).toBe("block");
      expect(panel.querySelector(".katex")).not.toBeNull();

      // Dismiss hides panel for the same text
      const closeBtn = panel.querySelector(
        ".latex-on-x-preview-close"
      ) as HTMLButtonElement;
      closeBtn.click();
      expect(panel.style.display).toBe("none");

      // Typing new text re-opens preview cleanly
      composer.textContent = "$$E = mc^2$$";
      composer.dispatchEvent(new Event("input", { bubbles: true }));
      vi.advanceTimersByTime(60);
      expect(panel.style.display).toBe("block");

      controller.stop();
    } finally {
      if (innerHtmlDescriptor) {
        Object.defineProperty(Element.prototype, "innerHTML", innerHtmlDescriptor);
      }
    }
  });

  it("works on X's 2026 plain <textarea> composers (inline and inside native <dialog>) even if input events call stopPropagation", () => {
    vi.useFakeTimers();

    // 1. Plain inline <textarea> (no role, no contenteditable, no data-testid)
    const inlineTextarea = document.createElement("textarea");
    inlineTextarea.placeholder = "What's happening?";
    // Simulate a React handler stopping propagation on input
    inlineTextarea.addEventListener("input", (event) => {
      event.stopPropagation();
    });
    document.body.appendChild(inlineTextarea);

    // 2. Modal <textarea> inside a native <dialog>
    const dialog = document.createElement("dialog");
    const modalTextarea = document.createElement("textarea");
    modalTextarea.placeholder = "What's happening?";
    dialog.appendChild(modalTextarea);
    document.body.appendChild(dialog);

    // 3. Disabled / readonly textareas and search <input> must be ignored
    const readonlyTextarea = document.createElement("textarea");
    readonlyTextarea.readOnly = true;
    readonlyTextarea.value = "$$E = mc^2$$";
    document.body.appendChild(readonlyTextarea);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.value = "$$E = mc^2$$";
    document.body.appendChild(searchInput);

    const controller = createComposerPreviewController(document, () => ({
      locale: "en",
      enableChemistry: true,
      debounceMs: 50,
    }));
    controller.start();

    // Ignored controls never open the preview
    readonlyTextarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    searchInput.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(document.querySelector(`[${PREVIEW_PANEL_ATTR}="true"]`)).toBeNull();

    // Inline <textarea>: unclosed delimiter triggers preview despite stopPropagation
    inlineTextarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    inlineTextarea.value = "$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}";
    inlineTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(60);

    const panel = document.querySelector(
      `[${PREVIEW_PANEL_ATTR}="true"]`
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.display).toBe("block");
    expect(panel.textContent).toContain("Unclosed $$ delimiter (missing $$).");

    // Switching focus into a modal <dialog> composer re-hosts the panel inside <dialog>
    inlineTextarea.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(panel.style.display).toBe("none");

    modalTextarea.value = "$$\\frac{a}{b$$";
    modalTextarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(panel.parentElement).toBe(dialog);
    expect(panel.style.display).toBe("block");
    expect(panel.textContent).toContain("Formula #1: Unbalanced braces.");

    controller.stop();
  });

  it("shows the 1-click PNG export button only when valid formulas render and displays localized feedback", async () => {
    vi.useFakeTimers();

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const exportPngMock = vi.fn(async () => ({
      ok: true as const,
      method: "copied" as const,
    }));

    const controller = createComposerPreviewController(document, () => ({
      locale: "es",
      enableChemistry: true,
      debounceMs: 50,
      exportPng: exportPngMock,
    }));
    controller.start();

    // Unclosed delimiter with 0 valid rendered formulas -> no PNG button
    textarea.value = "$$\\frac{1}{2}";
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const panel = document.querySelector(
      `[${PREVIEW_PANEL_ATTR}="true"]`
    ) as HTMLElement;
    expect(panel.querySelector(".latex-on-x-preview-export")).toBeNull();

    // Complete formula -> PNG button appears and triggers exporter on click
    textarea.value = "$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(60);

    const exportBtn = panel.querySelector(
      ".latex-on-x-preview-export"
    ) as HTMLButtonElement;
    expect(exportBtn).not.toBeNull();
    expect(exportBtn.textContent).toBe("PNG");

    exportBtn.click();
    expect(exportPngMock).toHaveBeenCalledTimes(1);

    // Flush microtasks from async exporter promise
    await Promise.resolve();
    await Promise.resolve();
    expect(exportBtn.textContent).toBe("PNG copiado ✓");
    expect(exportBtn.classList.contains("is-success")).toBe(true);

    // Resets back to default label after feedback timeout
    vi.advanceTimersByTime(1900);
    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toBe("PNG");

    controller.stop();
  });
});


