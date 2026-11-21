// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createTimelineObserver } from "../src/content/observer.js";

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createTimelineObserver (Fase 4)", () => {
  it("procesa tweets existentes al iniciar y nuevos tweets agregados al hacer scroll", async () => {
    document.body.innerHTML = `
      <main id="timeline">
        <div data-testid="tweetText"><span>Inicial: \\(a + b\\)</span></div>
      </main>
    `;

    const timeline = document.getElementById("timeline")!;
    const observer = createTimelineObserver();
    observer.start(timeline);

    expect(observer.isRunning()).toBe(true);
    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(1);

    // Simulamos scroll infinito: X inyecta un nuevo tweet en el DOM
    const newTweet = document.createElement("article");
    newTweet.innerHTML = `<div data-testid="tweetText"><span>Nuevo: $$\\frac{1}{2}$$</span></div>`;
    timeline.appendChild(newTweet);

    await waitForFrame();

    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(2);
    observer.stop();
    expect(observer.isRunning()).toBe(false);
  });

  it("deja de procesar tweets nuevos después de llamar a stop()", async () => {
    document.body.innerHTML = `<main id="timeline"></main>`;
    const timeline = document.getElementById("timeline")!;

    const observer = createTimelineObserver();
    observer.start(timeline);
    observer.stop();

    const laterTweet = document.createElement("div");
    laterTweet.setAttribute("data-testid", "tweetText");
    laterTweet.textContent = "Pausado: $$x^2$$";
    timeline.appendChild(laterTweet);

    await waitForFrame();

    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
  });
});
