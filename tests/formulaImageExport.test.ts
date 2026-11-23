// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepareExportMarkup,
  resetInlineCssCacheForTests,
} from "../src/content/formulaImageExport.js";
import { renderFormulaToElement } from "../src/renderer/katexRenderer.js";

afterEach(() => {
  document.body.innerHTML = "";
  resetInlineCssCacheForTests();
  vi.restoreAllMocks();
});

describe("formulaImageExport (Milestone C.2)", () => {
  it("serializes KaTeX preview nodes to clean XHTML, strips hidden .katex-mathml, and never touches .innerHTML", () => {
    const bodyEl = document.createElement("div");
    const wrapper = document.createElement("span");
    wrapper.className = "latex-on-x-formula latex-on-x-display";

    const res = renderFormulaToElement(
      "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}",
      "display",
      wrapper
    );
    expect(res.ok).toBe(true);
    expect(wrapper.querySelector(".katex-mathml")).not.toBeNull();

    bodyEl.appendChild(wrapper);
    document.body.appendChild(bodyEl);

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

    try {
      const prepared = prepareExportMarkup(bodyEl, document);

      expect(spySetter).not.toHaveBeenCalled();
      expect(prepared.xhtml).toContain("latex-export-content is-math-only");
      expect(prepared.xhtml).toContain("katex-html");
      expect(prepared.xhtml).not.toContain("katex-mathml");
      expect(prepared.contentWidth).toBeGreaterThan(0);
      expect(prepared.contentHeight).toBeGreaterThan(0);
      // Original preview DOM keeps its accessible MathML intact
      expect(bodyEl.querySelector(".katex-mathml")).not.toBeNull();
    } finally {
      if (innerHtmlDescriptor) {
        Object.defineProperty(Element.prototype, "innerHTML", innerHtmlDescriptor);
      }
    }
  });

  it("omits is-math-only alignment class when preview mixes prose and inline math", () => {
    const bodyEl = document.createElement("div");
    bodyEl.appendChild(document.createTextNode("Euler identity: "));

    const wrapper = document.createElement("span");
    wrapper.className = "latex-on-x-formula latex-on-x-inline";
    renderFormulaToElement("e^{i\\pi} + 1 = 0", "inline", wrapper);
    bodyEl.appendChild(wrapper);
    document.body.appendChild(bodyEl);

    const prepared = prepareExportMarkup(bodyEl, document);
    expect(prepared.xhtml).toContain('class="latex-export-content"');
    expect(prepared.xhtml).not.toContain("is-math-only");
    expect(prepared.xhtml).toContain("Euler identity:");
    expect(prepared.xhtml).toContain("katex-html");
  });
});
