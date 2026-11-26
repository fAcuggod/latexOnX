// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COPIED_LABEL_ATTR,
  installCopyHandler,
  mightContainMath,
  processAllTweets,
  processTweetElement,
  restoreAllMath,
  updateRenderedLabels,
} from "../src/content/domProcessor.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("domProcessor", () => {
  it("fast-rejects posts without math delimiters via mightContainMath", () => {
    expect(mightContainMath("Plain post with $BTC and $50")).toBe(false);
    expect(mightContainMath("Regular text without math")).toBe(false);
    expect(mightContainMath("Inline \\(x^2\\)")).toBe(true);
    expect(mightContainMath("Display $$E=mc^2$$")).toBe(true);
    expect(mightContainMath("Display \\[x\\]")).toBe(true);
  });

  it("renders math inside tweetText while preserving links, mentions, and emojis", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText">
        <span>Check this </span>
        <a href="/user">@euler</a>
        <span>: \\(e^{i\\pi} + 1 = 0\\) and </span>
        <img alt="🔥" src="emoji.png" />
        <a href="/search">$$do-not-touch-links$$</a>
      </div>
    `;

    const tweet = document.querySelector('[data-testid="tweetText"]')!;
    const count = processTweetElement(tweet);

    expect(count).toBe(1);
    const rendered = tweet.querySelectorAll('[data-latex-on-x="rendered"]');
    expect(rendered).toHaveLength(1);
    expect(rendered[0].getAttribute("data-latex")).toBe("e^{i\\pi} + 1 = 0");
    expect(rendered[0].querySelector(".katex")).not.toBeNull();

    const links = tweet.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe("@euler");
    expect(links[1].textContent).toBe("$$do-not-touch-links$$");
    expect(tweet.querySelector("img")?.getAttribute("alt")).toBe("🔥");
  });

  it("never mutates contenteditable composers or <code>/<pre> blocks", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText" contenteditable="true"><span>$$x^2$$</span></div>
      <div data-testid="tweetText"><code>$$y^2$$</code><pre>\\(z^2\\)</pre></div>
    `;

    expect(processAllTweets(document)).toBe(0);
    expect(document.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
  });

  it("is idempotent: running twice does not duplicate or alter formulas", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText"><span>Formula: $$a^2 + b^2 = c^2$$</span></div>
    `;
    const tweet = document.querySelector('[data-testid="tweetText"]')!;

    expect(processTweetElement(tweet)).toBe(1);
    const htmlAfterFirst = tweet.innerHTML;

    expect(processTweetElement(tweet)).toBe(0);
    expect(tweet.innerHTML).toBe(htmlAfterFirst);
  });

  it("keeps raw HTML/XSS payloads as inert TextNodes", () => {
    document.body.innerHTML = `<div data-testid="tweetText"><span></span></div>`;
    const span = document.querySelector("span")!;
    span.textContent = `<img src="x" onerror="alert(1)"> and \\(x^2\\)`;

    const tweet = document.querySelector('[data-testid="tweetText"]')!;
    expect(processTweetElement(tweet)).toBe(1);

    expect(tweet.querySelector("img")).toBeNull();
    expect(tweet.textContent).toContain('<img src="x" onerror="alert(1)">');
  });

  it("gracefully falls back to original text for security-rejected formulas", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText"><span>Test $$\\def\\a{\\a}\\a$$ and \\(x\\)</span></div>
    `;
    const tweet = document.querySelector('[data-testid="tweetText"]')!;

    expect(processTweetElement(tweet)).toBe(1);
    expect(tweet.textContent).toContain("$$\\def\\a{\\a}\\a$$");
  });

  it("restores exact original post text when restoreAllMath is called", () => {
    const original = "If \\(x^2\\) then $$E = mc^2$$ and $50";
    document.body.innerHTML = `<div data-testid="tweetText"><span></span></div>`;
    const tweet = document.querySelector('[data-testid="tweetText"]')!;
    tweet.querySelector("span")!.textContent = original;

    expect(processTweetElement(tweet)).toBe(2);
    expect(tweet.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(2);

    expect(restoreAllMath(document)).toBe(2);
    expect(tweet.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(tweet.textContent).toBe(original);
  });

  it("copies original LaTeX source on click and updates localized labels live", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    document.body.innerHTML = `
      <div data-testid="tweetText"><span>$$E = mc^2$$</span></div>
    `;
    processAllTweets(document, "en");

    const uninstall = installCopyHandler(document);
    const formula = document.querySelector('[data-latex-on-x="rendered"]') as HTMLElement;
    expect(formula.getAttribute(COPIED_LABEL_ATTR)).toBe("LaTeX copied ✓");

    updateRenderedLabels("zh", document);
    expect(formula.getAttribute(COPIED_LABEL_ATTR)).toBe("已复制 LaTeX ✓");

    formula.click();
    expect(writeText).toHaveBeenCalledWith("E = mc^2");
    expect(formula.classList.contains("latex-on-x-copied")).toBe(true);
    const toast = document.querySelector('[data-latex-on-x-toast="true"]');
    expect(toast).not.toBeNull();
    expect(toast?.parentNode).toBe(document.body);
    expect(toast?.textContent).toBe("已复制 LaTeX ✓");
    uninstall();
    expect(document.querySelector('[data-latex-on-x-toast="true"]')).toBeNull();
  });

  it("complies with strict Trusted Types CSP on x.com (never assigns .innerHTML)", () => {
    const tweet = document.createElement("div");
    tweet.setAttribute("data-testid", "tweetText");
    const span = document.createElement("span");
    span.textContent = "\\(e^x + 5\\)";
    tweet.appendChild(span);
    document.body.appendChild(tweet);

    const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "innerHTML"
    );
    const spySetter = vi.fn(() => {
      throw new TypeError(
        "Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment."
      );
    });
    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: true,
      get: innerHtmlDescriptor?.get,
      set: spySetter,
    });

    try {
      expect(processTweetElement(tweet)).toBe(1);
      expect(spySetter).not.toHaveBeenCalled();
      const rendered = tweet.querySelector('[data-latex-on-x="rendered"]');
      expect(rendered).not.toBeNull();
      expect(rendered?.getAttribute("data-latex")).toBe("e^x + 5");
      expect(rendered?.querySelector(".katex")).not.toBeNull();
    } finally {
      if (innerHtmlDescriptor) {
        Object.defineProperty(Element.prototype, "innerHTML", innerHtmlDescriptor);
      }
    }
  });

  it("supports X's modern <article> DOM without data-testid while skipping .sr-only and buttons", () => {
    document.body.innerHTML = `
      <main>
        <div class="sr-only">user on X: "\\(e^x + 5\\)" / X</div>
        <article>
          <a href="/user"><span>Author</span></a>
          <div><span>\\(e^x + 5\\)</span></div>
          <time>2:26 AM · Nov 21, 2026</time>
          <button><span>$$do-not-render-in-button$$</span></button>
        </article>
      </main>
    `;

    expect(processAllTweets(document)).toBe(1);
    const rendered = document.querySelectorAll('[data-latex-on-x="rendered"]');
    expect(rendered).toHaveLength(1);
    expect(rendered[0].getAttribute("data-latex")).toBe("e^x + 5");

    expect(document.querySelector(".sr-only")?.querySelector(".katex")).toBeNull();
    expect(document.querySelector("button")?.textContent).toBe(
      "$$do-not-render-in-button$$"
    );
  });

  it("attaches a discrete opt-in button for undelimited LaTeX, renders on click, and restores on second click", () => {
    const rawText = "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}";
    document.body.innerHTML = `
      <main>
        <article>
          <div><span></span></div>
        </article>
      </main>
    `;
    const article = document.querySelector("article")!;
    article.querySelector("span")!.textContent = rawText;

    // Auto-pass does NOT render undelimited LaTeX automatically, but attaches 1 discrete button
    expect(processAllTweets(document, { locale: "en", enableBareLatexButton: true })).toBe(0);
    expect(article.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);

    const btn = article.querySelector('[data-latex-on-x-bare-toggle]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("∑ Render LaTeX");

    // Live i18n update translates the button before clicking
    updateRenderedLabels("es", document);
    expect(btn.textContent).toBe("∑ Renderizar LaTeX");

    const uninstall = installCopyHandler(document);

    // Click #1 -> renders undelimited formula and switches button to Show raw
    btn.click();
    expect(article.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(1);
    expect(article.querySelector(".katex")).not.toBeNull();
    expect(btn.getAttribute("data-latex-on-x-bare-toggle")).toBe("restore");

    // Click #2 -> restores exact original text without leaving artifacts
    btn.click();
    expect(article.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(article.querySelector("span")!.textContent).toBe(rawText);
    expect(btn.getAttribute("data-latex-on-x-bare-toggle")).toBe("render");

    uninstall();
  });

  it("renders undelimited chemistry reactions via opt-in button and respects enableChemistry=false", () => {
    document.body.innerHTML = `
      <main>
        <article id="chem-bare"><div><span>Water: \\ce{2H2 + O2 -> 2H2O}</span></div></article>
        <article id="chem-delim"><div><span>$$\\ce{H2O}$$</span></div></article>
      </main>
    `;

    // When chemistry is disabled, neither delimited nor bare chemistry renders or gets a button
    expect(
      processAllTweets(document, { enableChemistry: false, enableBareLatexButton: true })
    ).toBe(0);
    expect(document.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-latex-on-x-bar="true"]')).toHaveLength(0);

    // When chemistry is enabled, delimited renders automatically and bare gets the discrete button
    expect(
      processAllTweets(document, { enableChemistry: true, enableBareLatexButton: true })
    ).toBe(1);
    expect(
      document.querySelector('#chem-delim [data-latex-on-x="rendered"]')
    ).not.toBeNull();
    expect(
      document.querySelector('#chem-bare [data-latex-on-x-bare-toggle]')
    ).not.toBeNull();
  });

  it("does not attach opt-in buttons when enableBareLatexButton is false", () => {
    document.body.innerHTML = `<article><div><span>\\frac{1}{2}</span></div></article>`;
    expect(
      processAllTweets(document, { enableBareLatexButton: false })
    ).toBe(0);
    expect(document.querySelectorAll('[data-latex-on-x-bar="true"]')).toHaveLength(0);
  });

  it("detects and renders Unicode/plain-math tweets on click and restores exact original text", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const rawText = [
      "For the zeta function, analytic continuation to 0<Re(s)<1 is actually pretty easy.",
      "ζ(s) = (1 − 1/2^s + 1/3^s − 1/4^s + ...) / (1 − 2^(1−s))",
      "The alternating series converges for Re(s)>0, so this formula defines ζ(s) in the critical strip!",
    ].join("\n");

    document.body.innerHTML = `<main><article><div><span></span></div></article></main>`;
    const article = document.querySelector("article")!;
    article.querySelector("span")!.textContent = rawText;

    // Default opt-in mode attaches button without auto-rendering
    expect(
      processAllTweets(document, {
        locale: "en",
        enableBareLatexButton: true,
        autoRenderBareLatex: false,
      })
    ).toBe(0);
    const btn = article.querySelector('[data-latex-on-x-bare-toggle]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("data-latex-on-x-bare-toggle")).toBe("render");

    const uninstall = installCopyHandler(document);

    // Click -> renders all 4 Unicode/plain-math expressions
    btn.click();
    const rendered = article.querySelectorAll('[data-latex-on-x="rendered"]');
    expect(rendered).toHaveLength(4);
    expect(rendered[1].classList.contains("latex-on-x-display")).toBe(true);
    expect(rendered[1].getAttribute("data-latex")).toBe(
      "\\zeta(s) = \\frac{1 - \\frac{1}{2^s} + \\frac{1}{3^s} - \\frac{1}{4^s} + \\cdots}{1 - 2^{1 - s}}"
    );
    expect(btn.getAttribute("data-latex-on-x-bare-toggle")).toBe("restore");

    // Clicking the rendered Unicode formula copies compiled LaTeX
    (rendered[1] as HTMLElement).click();
    expect(writeText).toHaveBeenCalledWith(
      "\\zeta(s) = \\frac{1 - \\frac{1}{2^s} + \\frac{1}{3^s} - \\frac{1}{4^s} + \\cdots}{1 - 2^{1 - s}}"
    );

    // Click Show raw -> restores exact original Unicode text
    btn.click();
    expect(article.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(article.querySelector("span")!.textContent).toBe(rawText);
    expect(btn.getAttribute("data-latex-on-x-bare-toggle")).toBe("render");

    uninstall();
  });

  it("auto-renders undelimited LaTeX and Unicode math when autoRenderBareLatex is enabled while keeping Show raw revert", () => {
    const bareRaw = "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}";
    const unicodeRaw = "Euler: e^(iπ) + 1 = 0";

    document.body.innerHTML = `
      <main>
        <article id="bare-post"><div><span></span></div></article>
        <article id="unicode-post"><div><span></span></div></article>
      </main>
    `;
    const barePost = document.getElementById("bare-post")!;
    const unicodePost = document.getElementById("unicode-post")!;
    barePost.querySelector("span")!.textContent = bareRaw;
    unicodePost.querySelector("span")!.textContent = unicodeRaw;

    const opts = {
      locale: "es" as const,
      enableBareLatexButton: true,
      autoRenderBareLatex: true,
    };

    const count = processAllTweets(document, opts);
    expect(count).toBe(2);

    // Both posts rendered immediately and show the localized "Ver original" revert button
    const bareBtn = barePost.querySelector('[data-latex-on-x-bare-toggle]') as HTMLButtonElement;
    const unicodeBtn = unicodePost.querySelector('[data-latex-on-x-bare-toggle]') as HTMLButtonElement;
    expect(bareBtn.getAttribute("data-latex-on-x-bare-toggle")).toBe("restore");
    expect(bareBtn.textContent).toBe("↺ Ver original");
    expect(bareBtn.classList.contains("is-active")).toBe(true);
    expect(unicodeBtn.getAttribute("data-latex-on-x-bare-toggle")).toBe("restore");
    expect(unicodeBtn.textContent).toBe("↺ Ver original");
    expect(unicodePost.querySelector('[data-latex-on-x="rendered"]')?.getAttribute("data-latex")).toBe(
      "e^{i\\pi} + 1 = 0"
    );

    const uninstall = installCopyHandler(document);

    // User clicks "Ver original" on the Unicode post -> reverts to raw text
    unicodeBtn.click();
    expect(unicodePost.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(unicodePost.querySelector("span")!.textContent).toBe(unicodeRaw);
    expect(unicodeBtn.getAttribute("data-latex-on-x-bare-toggle")).toBe("render");

    // Subsequent MutationObserver / processTweetElement pass MUST NOT re-auto-render a manually reverted post
    expect(processTweetElement(unicodePost, opts)).toBe(0);
    expect(unicodePost.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(unicodePost.querySelector("span")!.textContent).toBe(unicodeRaw);

    uninstall();
  });

  it("never assigns .innerHTML when auto-rendering Unicode/plain-math posts (Trusted Types safe)", () => {
    const article = document.createElement("article");
    const div = document.createElement("div");
    const span = document.createElement("span");
    span.textContent = "ζ(s) = (1 − 1/2^s + 1/3^s − 1/4^s + ...) / (1 − 2^(1−s))";
    div.appendChild(span);
    article.appendChild(div);
    document.body.appendChild(article);

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
      expect(
        processTweetElement(article, {
          enableBareLatexButton: true,
          autoRenderBareLatex: true,
        })
      ).toBe(1);
      expect(spySetter).not.toHaveBeenCalled();
      expect(article.querySelector(".katex")).not.toBeNull();
      expect(
        article.querySelector('[data-latex-on-x-bare-toggle]')?.getAttribute("data-latex-on-x-bare-toggle")
      ).toBe("restore");
    } finally {
      if (innerHtmlDescriptor) {
        Object.defineProperty(Element.prototype, "innerHTML", innerHtmlDescriptor);
      }
    }
  });
});
