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
    uninstall();
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
});
