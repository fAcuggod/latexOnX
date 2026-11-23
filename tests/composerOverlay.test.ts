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
    expect(panel.textContent).toContain("Unclosed \\( delimiter");
    expect(panel.textContent).toContain("unbalanced braces");

    // Live locale switch updates header and diagnostics immediately
    locale = "es";
    controller.refresh();
    expect(panel.textContent).toContain("Vista previa LaTeX");
    expect(panel.textContent).toContain("3 avisos");
    expect(panel.textContent).toContain("Delimitador \\( sin cerrar");

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
});
