import { createComposerPreviewController } from "../content/composerOverlay.js";
import {
  installInteractionHandlers,
  processAllTweets,
  removeBareLatexBars,
  restoreAllMath,
  type ProcessOptions,
} from "../content/domProcessor.js";
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
    author: "Chem Lab",
    handle: "@chem_on_x",
    initials: "CL",
    text: "Ionic precipitation with mhchem: \\(\\ce{Fe^{2+} + 2OH- -> Fe(OH)2}\\) and Boudouard equilibrium:\n$$\\ce{CO2 + C <=> 2 CO}$$",
  },
  {
    author: "Unicode Zeta Post",
    handle: "@unicode_math",
    initials: "UZ",
    text: "For the zeta function, analytic continuation to 0<Re(s)<1 is actually pretty easy.\nζ(s) = (1 − 1/2^s + 1/3^s − 1/4^s + ...) / (1 − 2^(1−s))\nThe alternating series converges for Re(s)>0, so this formula defines ζ(s) in the critical strip!",
  },
  {
    author: "Undelimited Post",
    handle: "@opt_in_demo",
    initials: "UD",
    text: "Forgot delimiters on this one (try the discrete button below or Auto-render undelimited):\n\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}",
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
const autoBareBtn = document.getElementById("toggle-auto-bare-demo");

let autoRenderBare = false;

function getOptions(): ProcessOptions {
  return {
    locale: "en",
    enableChemistry: true,
    enableBareLatexButton: true,
    autoRenderBareLatex: autoRenderBare,
  };
}

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

// Uses the exact same MutationObserver, composer preview, and interaction handlers as the real extension
installInteractionHandlers(document, getOptions);
const observer = createTimelineObserver((scope) =>
  processAllTweets(scope, getOptions())
);
observer.start(feedEl ?? document.body);
const composerPreview = createComposerPreviewController(document);
composerPreview.start();

for (const post of INITIAL_POSTS) {
  appendPost(post);
}

autoBareBtn?.addEventListener("click", () => {
  autoRenderBare = !autoRenderBare;
  autoBareBtn.classList.toggle("active", autoRenderBare);
  autoBareBtn.textContent = autoRenderBare
    ? "Auto-render undelimited: ON"
    : "Auto-render undelimited: OFF";
  if (feedEl) {
    restoreAllMath(feedEl, "bare");
    removeBareLatexBars(feedEl);
    processAllTweets(feedEl, getOptions());
  }
});

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
    composerPreview.refresh();
  });
});
