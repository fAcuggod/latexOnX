import { parseMathSegments } from "../core/parser.js";
import { getMessages, type Locale } from "../i18n/messages.js";
import { renderFormulaToElement } from "../renderer/katexRenderer.js";

export const TWEET_TEXT_SELECTOR =
  '[data-testid="tweetText"], article, [role="article"]';
export const RENDERED_ATTR = "data-latex-on-x";
export const RAW_ATTR = "data-latex-raw";
export const LATEX_ATTR = "data-latex";
export const COPIED_LABEL_ATTR = "data-copied-label";

const SKIPPED_TAGS = new Set([
  "A",
  "CODE",
  "PRE",
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
  "INPUT",
  "NOSCRIPT",
  "BUTTON",
  "TIME",
  "SVG",
]);

/**
 * Fast O(n) zero-allocation pre-check:
 * ~99% of posts on X contain no math delimiters and are skipped immediately
 * to preserve 60-120 FPS infinite scrolling.
 */
export function mightContainMath(text: string): boolean {
  return text.includes("$$") || text.includes("\\(") || text.includes("\\[");
}

/**
 * Checks whether a text node sits inside an element we must never mutate
 * (links, buttons, timestamps, code blocks, screen-reader-only labels,
 * editable composers, or already-rendered formulas).
 */
function shouldSkipNode(node: Node, boundary: Element): boolean {
  let current: Node | null = node.parentNode;

  while (current && current !== boundary.parentNode) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (SKIPPED_TAGS.has(el.tagName)) {
        return true;
      }
      if (
        el.getAttribute("contenteditable") === "true" ||
        el.getAttribute("aria-hidden") === "true" ||
        el.getAttribute(RENDERED_ATTR) === "rendered" ||
        el.classList.contains("katex") ||
        el.classList.contains("sr-only")
      ) {
        return true;
      }
    }
    current = current.parentNode;
  }

  return false;
}

/**
 * Safely walks a post container, renders valid formulas via `katex.render()`
 * inside a single `DocumentFragment` per text node (zero `.innerHTML`, fully
 * compliant with x.com's Trusted Types CSP), and preserves links, mentions,
 * hashtags, emojis, and plain text intact.
 *
 * Idempotent: running multiple times on the same element never duplicates math.
 * Returns the number of newly rendered formulas.
 */
export function processTweetElement(
  root: Element,
  locale: Locale = "en"
): number {
  const doc = root.ownerDocument;
  if (!doc || root.getAttribute("contenteditable") === "true") {
    return 0;
  }

  const msg = getMessages(locale);

  // 1. Collect candidate text nodes first (never mutate while TreeWalker traverses)
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const candidates: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    const value = textNode.nodeValue ?? "";

    if (mightContainMath(value) && !shouldSkipNode(textNode, root)) {
      candidates.push(textNode);
    }

    current = walker.nextNode();
  }

  // 2. Replace each candidate node via a single off-screen DocumentFragment (1 reflow)
  let renderedCount = 0;

  for (const textNode of candidates) {
    const parent = textNode.parentNode;
    if (!parent) continue;

    const segments = parseMathSegments(textNode.nodeValue ?? "");
    const hasMathCandidate = segments.some((seg) => seg.type === "math");
    if (!hasMathCandidate) continue;

    const fragment = doc.createDocumentFragment();
    let nodeRenderedCount = 0;

    for (const seg of segments) {
      if (seg.type === "text") {
        // Pure TextNode: browser never parses HTML/scripts -> XSS-safe
        fragment.appendChild(doc.createTextNode(seg.content));
      } else {
        const wrapper = doc.createElement("span");
        // Render directly into DOM nodes via katex.render() (no .innerHTML -> Trusted Types safe)
        const result = renderFormulaToElement(seg.content, seg.mode, wrapper);

        if (!result.ok) {
          // Graceful fallback: keep original raw text untouched
          fragment.appendChild(doc.createTextNode(seg.raw));
        } else {
          wrapper.className =
            seg.mode === "display"
              ? "latex-on-x-formula latex-on-x-display"
              : "latex-on-x-formula latex-on-x-inline";
          wrapper.setAttribute(RENDERED_ATTR, "rendered");
          wrapper.setAttribute(LATEX_ATTR, seg.content);
          wrapper.setAttribute(RAW_ATTR, seg.raw);
          wrapper.setAttribute(COPIED_LABEL_ATTR, msg.copiedBadge);
          wrapper.setAttribute("role", "button");
          wrapper.setAttribute("tabindex", "0");
          wrapper.setAttribute(
            "title",
            `${msg.copyTooltipPrefix}: ${seg.content}`
          );
          fragment.appendChild(wrapper);
          nodeRenderedCount += 1;
        }
      }
    }

    if (nodeRenderedCount > 0) {
      parent.replaceChild(fragment, textNode);
      renderedCount += nodeRenderedCount;
    }
  }

  return renderedCount;
}

/**
 * Processes all visible posts inside `scope` (or the enclosing post container if `scope` is nested).
 */
export function processAllTweets(
  scope: ParentNode = document,
  locale: Locale = "en"
): number {
  if (scope instanceof Element) {
    if (scope.matches(TWEET_TEXT_SELECTOR)) {
      return processTweetElement(scope, locale);
    }
    const ancestorTweet = scope.closest(TWEET_TEXT_SELECTOR);
    if (ancestorTweet) {
      return processTweetElement(ancestorTweet, locale);
    }
  }

  let total = 0;
  const tweetNodes = scope.querySelectorAll(TWEET_TEXT_SELECTOR);
  for (const tweetNode of tweetNodes) {
    total += processTweetElement(tweetNode, locale);
  }

  return total;
}

/**
 * Updates localized tooltip and copy-badge attributes on already-rendered formulas
 * when the user switches languages from the popup.
 */
export function updateRenderedLabels(
  locale: Locale,
  scope: ParentNode = document
): void {
  const msg = getMessages(locale);
  const renderedNodes = scope.querySelectorAll(
    `[${RENDERED_ATTR}="rendered"]`
  );

  for (const node of renderedNodes) {
    const latex = node.getAttribute(LATEX_ATTR) ?? "";
    node.setAttribute(COPIED_LABEL_ATTR, msg.copiedBadge);
    node.setAttribute("title", `${msg.copyTooltipPrefix}: ${latex}`);
  }
}

/**
 * Restores all rendered formulas back to their original raw LaTeX text (`data-latex-raw`).
 * Enables instant On/Off toggling from the popup without reloading the tab.
 */
export function restoreAllMath(scope: ParentNode = document): number {
  const renderedNodes = scope.querySelectorAll(
    `[${RENDERED_ATTR}="rendered"]`
  );
  let restoredCount = 0;
  const touchedParents = new Set<Node>();

  for (const node of renderedNodes) {
    const parent = node.parentNode;
    const doc = node.ownerDocument;
    if (!parent || !doc) continue;

    const raw = node.getAttribute(RAW_ATTR) ?? "";
    parent.replaceChild(doc.createTextNode(raw), node);
    touchedParents.add(parent);
    restoredCount += 1;
  }

  // Merge adjacent TextNodes to restore the DOM to its original structure
  for (const parent of touchedParents) {
    parent.normalize();
  }

  return restoredCount;
}

/**
 * Installs a single delegated listener on `doc` (instead of hundreds of per-formula listeners)
 * to copy original LaTeX source to the clipboard on click or Enter/Space.
 * Returns a cleanup function that removes the listeners.
 */
export function installCopyHandler(doc: Document = document): () => void {
  const copyFromTarget = (target: EventTarget | null, event: Event): void => {
    if (!(target instanceof Element)) return;
    const formulaEl = target.closest(`[${RENDERED_ATTR}="rendered"]`);
    if (!formulaEl) return;

    const latex = formulaEl.getAttribute(LATEX_ATTR);
    if (!latex) return;

    // Prevent clicking a formula from triggering X's post-navigation click handler
    event.stopPropagation();

    navigator.clipboard?.writeText(latex).catch(() => {
      // Silently ignore if clipboard access is blocked
    });

    formulaEl.classList.add("latex-on-x-copied");
    window.setTimeout(() => {
      formulaEl.classList.remove("latex-on-x-copied");
    }, 1200);
  };

  const onClick = (event: MouseEvent): void => {
    copyFromTarget(event.target, event);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(`[${RENDERED_ATTR}="rendered"]`)
      ) {
        event.preventDefault();
        copyFromTarget(target, event);
      }
    }
  };

  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKeyDown);

  return () => {
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("keydown", onKeyDown);
  };
}
