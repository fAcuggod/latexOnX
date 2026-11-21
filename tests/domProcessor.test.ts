// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installCopyHandler,
  mightContainMath,
  processAllTweets,
  processTweetElement,
  restoreAllMath,
} from "../src/content/domProcessor.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("domProcessor (Fase 4)", () => {
  it("descarta rápido tweets sin delimitadores mediante mightContainMath", () => {
    expect(mightContainMath("Hola $BTC a $50")).toBe(false);
    expect(mightContainMath("Texto normal sin fórmulas")).toBe(false);
    expect(mightContainMath("Hola \\(x^2\\)")).toBe(true);
    expect(mightContainMath("Bloque $$E=mc^2$$")).toBe(true);
    expect(mightContainMath("Bloque \\[x\\]")).toBe(true);
  });

  it("renderiza fórmulas dentro de tweetText preservando links, menciones y emojis", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText">
        <span>Mirá esto </span>
        <a href="/user">@euler</a>
        <span>: \\(e^{i\\pi} + 1 = 0\\) y </span>
        <img alt="🔥" src="emoji.png" />
        <a href="/search">$$no-tocar-links$$</a>
      </div>
    `;

    const tweet = document.querySelector('[data-testid="tweetText"]')!;
    const count = processTweetElement(tweet);

    expect(count).toBe(1);
    const rendered = tweet.querySelectorAll('[data-latex-on-x="rendered"]');
    expect(rendered).toHaveLength(1);
    expect(rendered[0].getAttribute("data-latex")).toBe("e^{i\\pi} + 1 = 0");
    expect(rendered[0].querySelector(".katex")).not.toBeNull();

    // Enlaces y emojis intactos
    const links = tweet.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe("@euler");
    expect(links[1].textContent).toBe("$$no-tocar-links$$");
    expect(tweet.querySelector("img")?.getAttribute("alt")).toBe("🔥");
  });

  it("no toca editores contenteditable ni bloques <code>/<pre>", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText" contenteditable="true"><span>$$x^2$$</span></div>
      <div data-testid="tweetText"><code>$$y^2$$</code><pre>\\(z^2\\)</pre></div>
    `;

    expect(processAllTweets(document)).toBe(0);
    expect(document.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
  });

  it("es idempotente: procesarlo dos veces no duplica ni altera las fórmulas", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText"><span>Fórmula: $$a^2 + b^2 = c^2$$</span></div>
    `;
    const tweet = document.querySelector('[data-testid="tweetText"]')!;

    expect(processTweetElement(tweet)).toBe(1);
    const htmlAfterFirst = tweet.innerHTML;

    expect(processTweetElement(tweet)).toBe(0);
    expect(tweet.innerHTML).toBe(htmlAfterFirst);
  });

  it("mantiene seguro el texto malicioso (anti-XSS) como TextNode", () => {
    document.body.innerHTML = `<div data-testid="tweetText"><span></span></div>`;
    const span = document.querySelector("span")!;
    span.textContent = `<img src="x" onerror="alert(1)"> y \\(x^2\\)`;

    const tweet = document.querySelector('[data-testid="tweetText"]')!;
    expect(processTweetElement(tweet)).toBe(1);

    // Nunca debe crearse un nodo <img> real a partir de texto plano
    expect(tweet.querySelector("img")).toBeNull();
    expect(tweet.textContent).toContain('<img src="x" onerror="alert(1)">');
  });

  it("degrada elegantemente fórmulas bloqueadas por seguridad dejando el texto original", () => {
    document.body.innerHTML = `
      <div data-testid="tweetText"><span>Test $$\\def\\a{\\a}\\a$$ y \\(x\\)</span></div>
    `;
    const tweet = document.querySelector('[data-testid="tweetText"]')!;

    expect(processTweetElement(tweet)).toBe(1);
    expect(tweet.textContent).toContain("$$\\def\\a{\\a}\\a$$");
  });

  it("restaura exactamente el texto original al llamar a restoreAllMath", () => {
    const original = "Si \\(x^2\\) entonces $$E = mc^2$$ y $50";
    document.body.innerHTML = `<div data-testid="tweetText"><span></span></div>`;
    const tweet = document.querySelector('[data-testid="tweetText"]')!;
    tweet.querySelector("span")!.textContent = original;

    expect(processTweetElement(tweet)).toBe(2);
    expect(tweet.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(2);

    expect(restoreAllMath(document)).toBe(2);
    expect(tweet.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
    expect(tweet.textContent).toBe(original);
  });

  it("copia el LaTeX original al portapapeles al hacer clic en una fórmula", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    document.body.innerHTML = `
      <div data-testid="tweetText"><span>$$E = mc^2$$</span></div>
    `;
    processAllTweets(document);

    const uninstall = installCopyHandler(document);
    const formula = document.querySelector('[data-latex-on-x="rendered"]') as HTMLElement;
    formula.click();

    expect(writeText).toHaveBeenCalledWith("E = mc^2");
    expect(formula.classList.contains("latex-on-x-copied")).toBe(true);
    uninstall();
  });

  it("funciona bajo política estricta de Trusted Types en x.com (sin usar .innerHTML)", () => {
    const tweet = document.createElement("div");
    tweet.setAttribute("data-testid", "tweetText");
    const span = document.createElement("span");
    span.textContent = "\\(e^x + 5\\)";
    tweet.appendChild(span);
    document.body.appendChild(tweet);

    // Simulamos la política Trusted Types de x.com que bloquea cualquier asignación a .innerHTML
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
});
