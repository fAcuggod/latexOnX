import { installCopyHandler } from "../content/domProcessor.js";
import { createTimelineObserver } from "../content/observer.js";

interface SampleTweet {
  author: string;
  handle: string;
  initials: string;
  text: string;
  link?: string;
}

const INITIAL_TWEETS: SampleTweet[] = [
  {
    author: "Euler Bot",
    handle: "@math_on_x",
    initials: "EB",
    text: "La identidad más elegante de las matemáticas es \\(e^{i\\pi} + 1 = 0\\) y la serie de Basilea converge a:\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$",
  },
  {
    author: "Mercado & Cálculo",
    handle: "@quant_notes",
    initials: "MC",
    text: "Hoy $BTC tocó $95 y $TSLA subió 4%, sin romper la fórmula de Black-Scholes ni esta integral:\n\\[\\int_0^1 x^2\\,dx = \\frac{1}{3}\\]",
    link: "#LaTeXOnX",
  },
  {
    author: "Seguridad CS",
    handle: "@sec_demo",
    initials: "SC",
    text: "Defensa contra DoS activa: $$\\def\\a{\\a}\\a$$ se bloquea y queda como texto literal, mientras \\(x \\leftarrow 0\\) sí renderiza perfecto.",
  },
];

const feedEl = document.getElementById("feed");
const inputEl = document.getElementById("composer-input") as HTMLTextAreaElement | null;
const publishBtn = document.getElementById("publish-btn");

function appendTweet(tweet: SampleTweet, prepend = false): void {
  if (!feedEl) return;

  const article = document.createElement("article");
  article.className = "tweet";

  const head = document.createElement("div");
  head.className = "tweet-head";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = tweet.initials;

  const meta = document.createElement("div");
  const author = document.createElement("div");
  author.className = "author";
  author.textContent = tweet.author;

  const handle = document.createElement("div");
  handle.className = "handle";
  handle.textContent = tweet.handle;

  meta.appendChild(author);
  meta.appendChild(handle);
  head.appendChild(avatar);
  head.appendChild(meta);

  const body = document.createElement("div");
  body.setAttribute("data-testid", "tweetText");
  const textSpan = document.createElement("span");
  textSpan.textContent = tweet.text;
  body.appendChild(textSpan);

  if (tweet.link) {
    body.appendChild(document.createTextNode(" "));
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = tweet.link;
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

// Activamos el MISMO MutationObserver y click-to-copy que usa la extensión real en x.com
installCopyHandler(document);
const observer = createTimelineObserver();
observer.start(feedEl ?? document.body);

for (const tweet of INITIAL_TWEETS) {
  appendTweet(tweet);
}

publishBtn?.addEventListener("click", () => {
  const value = inputEl?.value.trim();
  if (!value) return;
  appendTweet(
    {
      author: "Vos",
      handle: "@latexOnX · recién",
      initials: "TU",
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
