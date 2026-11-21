// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createTimelineObserver } from "../src/content/observer.js";

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createTimelineObserver", () => {
  it("processes existing posts on start and newly appended posts during infinite scroll", async () => {
    document.body.innerHTML = `
      <main id="timeline">
        <article><span>Initial: \\(a + b\\)</span></article>
      </main>
    `;

    const timeline = document.getElementById("timeline")!;
    const observer = createTimelineObserver();
    observer.start(timeline);

    expect(observer.isRunning()).toBe(true);
    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(1);

    const newPost = document.createElement("article");
    newPost.innerHTML = `<div><span>New: $$\\frac{1}{2}$$</span></div>`;
    timeline.appendChild(newPost);

    await waitForFrame();

    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(2);
    observer.stop();
    expect(observer.isRunning()).toBe(false);
  });

  it("stops processing new posts after stop() is called", async () => {
    document.body.innerHTML = `<main id="timeline"></main>`;
    const timeline = document.getElementById("timeline")!;

    const observer = createTimelineObserver();
    observer.start(timeline);
    observer.stop();

    const laterPost = document.createElement("article");
    laterPost.textContent = "Paused: $$x^2$$";
    timeline.appendChild(laterPost);

    await waitForFrame();

    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(0);
  });

  it("handles nested spans inserted inside an existing post container (React hydration)", async () => {
    document.body.innerHTML = `<main id="timeline"><article></article></main>`;
    const timeline = document.getElementById("timeline")!;
    const article = timeline.querySelector("article")!;

    const observer = createTimelineObserver();
    observer.start(timeline);

    const span = document.createElement("span");
    span.textContent = "\\(e^x + 5\\)";
    article.appendChild(span);

    await waitForFrame();

    expect(article.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(1);
    observer.stop();
  });

  it("handles characterData mutations inside an existing post container", async () => {
    document.body.innerHTML = `<main id="timeline"><article><span>loading...</span></article></main>`;
    const timeline = document.getElementById("timeline")!;
    const textNode = timeline.querySelector("span")!.firstChild as Text;

    const observer = createTimelineObserver();
    observer.start(timeline);

    textNode.nodeValue = "Result: \\(e^x + 5\\)";

    await waitForFrame();

    expect(timeline.querySelectorAll('[data-latex-on-x="rendered"]')).toHaveLength(1);
    observer.stop();
  });
});
