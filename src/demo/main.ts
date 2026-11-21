import { installCopyHandler } from "../content/domProcessor.js";
import { createTimelineObserver } from "../content/observer.js";

interface SamplePost {
  author: string;
  handle: string;
  initials: string;
  text: string;
  link?: string;
}

const INITIAL_POSTS: SamplePost[] = [
  {
    author: "Euler Notes",
    handle: "@math_on_x",
    initials: "EN",
    text: "Euler's identity \\(e^{i\\pi} + 1 = 0\\) and the Basel problem:\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$",
  },
  {
    author: "Analysis & Finance",
    handle: "@quant_notes",
    initials: "AF",
    text: "Single-dollar currency notation and cashtags stay untouched, while display blocks render cleanly:\n\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]",
    link: "#LaTeXOnX",
  },
  {
    author: "Security Demo",
    handle: "@sec_demo",
    initials: "SD",
    text: "Anti-DoS validator in action: $$\\def\\a{\\a}\\a$$ is blocked and falls back to literal text, while \\(x \\leftarrow 0\\) renders normally.",
  },
];

const feedEl = document.getElementById("feed");
const inputEl = document.getElementById("composer-input") as HTMLTextAreaElement | null;
const publishBtn = document.getElementById("publish-btn");

function appendPost(post: SamplePost, prepend = false): void {
  if (!feedEl) return;

  const article = document.createElement("article");
  article.className = "tweet";

  const head = document.createElement("div");
  head.className = "tweet-head";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = post.initials;

  const meta = document.createElement("div");
  const author = document.createElement("div");
  author.className = "author";
  author.textContent = post.author;

  const handle = document.createElement("div");
  handle.className = "handle";
  handle.textContent = post.handle;

  meta.appendChild(author);
  meta.appendChild(handle);
  head.appendChild(avatar);
  head.appendChild(meta);

  const body = document.createElement("div");
  body.className = "post-body";
  const textSpan = document.createElement("span");
  textSpan.textContent = post.text;
  body.appendChild(textSpan);

  if (post.link) {
    body.appendChild(document.createTextNode(" "));
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = post.link;
    body.appendChild(a);
  }

  article.appendChild(head);
  article.appendChild(body);

  if (prepend) {
    feedEl.prepend(article);
  } else {
    feedEl.appendChild(article);
  }
}

// Uses the exact same MutationObserver and delegated copy handler as the real Chrome extension
installCopyHandler(document);
const observer = createTimelineObserver();
observer.start(feedEl ?? document.body);

for (const post of INITIAL_POSTS) {
  appendPost(post);
}

publishBtn?.addEventListener("click", () => {
  const value = inputEl?.value.trim();
  if (!value) return;
  appendPost(
    {
      author: "You",
      handle: "@latexOnX · just now",
      initials: "YO",
      text: value,
    },
    true
  );
});

document.querySelectorAll<HTMLButtonElement>("[data-set-theme]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.setTheme ?? "dark";
    document.body.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-set-theme]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
