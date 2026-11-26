import {
  hasUndelimitedMath,
  parseUndelimitedMathSegments,
} from "../core/detector.js";
import { parseMathSegments } from "../core/parser.js";
import type { Segment } from "../core/types.js";
import { getMessages, type Locale } from "../i18n/messages.js";
import { renderFormulaToElement } from "../renderer/katexRenderer.js";

export const TWEET_TEXT_SELECTOR =
  '[data-testid="tweetText"], article, [role="article"]';
export const RENDERED_ATTR = "data-latex-on-x";
export const SOURCE_ATTR = "data-latex-source";
export const RAW_ATTR = "data-latex-raw";
export const LATEX_ATTR = "data-latex";
export const COPIED_LABEL_ATTR = "data-copied-label";
export const COPY_TOAST_ATTR = "data-latex-on-x-toast";
export const BARE_BAR_ATTR = "data-latex-on-x-bar";
export const BARE_BTN_ATTR = "data-latex-on-x-bare-toggle";

export type RenderSource = "delimited" | "bare";

export interface ProcessOptions {
  locale?: Locale;
  enableChemistry?: boolean;
  enableBareLatexButton?: boolean;
  autoRenderBareLatex?: boolean;
}

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

function normalizeOptions(
  input?: Locale | ProcessOptions
): Required<ProcessOptions> {
  if (typeof input === "string") {
    return {
      locale: input,
      enableChemistry: true,
      enableBareLatexButton: true,
      autoRenderBareLatex: false,
    };
  }
  return {
    locale: input?.locale ?? "en",
    enableChemistry: input?.enableChemistry ?? true,
    enableBareLatexButton: input?.enableBareLatexButton ?? true,
    autoRenderBareLatex: input?.autoRenderBareLatex ?? false,
  };
}

/**
 * Fast O(n) zero-allocation pre-check:
 * ~99% of posts on X contain no explicit math delimiters and are skipped immediately
 * to preserve 60-120 FPS infinite scrolling.
 */
export function mightContainMath(text: string): boolean {
  return text.includes("$$") || text.includes("\\(") || text.includes("\\[");
}

/**
 * Checks whether a text node sits inside an element we must never mutate
 * (links, buttons, timestamps, code blocks, screen-reader-only labels,
 * editable composers, our opt-in button bar, or already-rendered formulas).
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
        el.getAttribute(BARE_BAR_ATTR) === "true" ||
        el.getAttribute(COPY_TOAST_ATTR) === "true" ||
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

function collectEligibleTextNodes(
  root: Element,
  predicate: (value: string) => boolean
): Text[] {
  const doc = root.ownerDocument;
  if (!doc) return [];

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const candidates: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    const value = textNode.nodeValue ?? "";

    if (predicate(value) && !shouldSkipNode(textNode, root)) {
      candidates.push(textNode);
    }

    current = walker.nextNode();
  }

  return candidates;
}

function replaceTextNodeWithSegments(
  textNode: Text,
  segments: Segment[],
  source: RenderSource,
  opts: Required<ProcessOptions>
): number {
  const parent = textNode.parentNode;
  const doc = textNode.ownerDocument;
  if (!parent || !doc) return 0;

  const hasMathCandidate = segments.some((seg) => seg.type === "math");
  if (!hasMathCandidate) return 0;

  const msg = getMessages(opts.locale);
  const fragment = doc.createDocumentFragment();
  let renderedCount = 0;

  for (const seg of segments) {
    if (seg.type === "text") {
      // Pure TextNode: browser never parses HTML/scripts -> XSS-safe
      fragment.appendChild(doc.createTextNode(seg.content));
    } else {
      const wrapper = doc.createElement("span");
      // Direct DOM rendering via katex.render() (zero .innerHTML -> Trusted Types safe)
      const result = renderFormulaToElement(seg.content, seg.mode, wrapper, {
        enableChemistry: opts.enableChemistry,
      });

      if (!result.ok) {
        fragment.appendChild(doc.createTextNode(seg.raw));
      } else {
        wrapper.className =
          seg.mode === "display"
            ? "latex-on-x-formula latex-on-x-display"
            : "latex-on-x-formula latex-on-x-inline";
        wrapper.setAttribute(RENDERED_ATTR, "rendered");
        wrapper.setAttribute(SOURCE_ATTR, source);
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
        renderedCount += 1;
      }
    }
  }

  if (renderedCount > 0) {
    parent.replaceChild(fragment, textNode);
  }

  return renderedCount;
}

function attachBareLatexButton(
  root: Element,
  anchorNode: Text,
  locale: Locale,
  initialState: "render" | "restore" = "render"
): HTMLButtonElement | null {
  const doc = root.ownerDocument;
  if (!doc) return null;
  if (root.querySelector(`[${BARE_BAR_ATTR}="true"]`)) return null;

  const msg = getMessages(locale);
  const bar = doc.createElement("div");
  bar.className = "latex-on-x-bare-bar";
  bar.setAttribute(BARE_BAR_ATTR, "true");

  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className =
    initialState === "restore"
      ? "latex-on-x-bare-btn is-active"
      : "latex-on-x-bare-btn";
  btn.setAttribute(BARE_BTN_ATTR, initialState);
  btn.setAttribute(
    "title",
    initialState === "restore" ? msg.showRawTooltip : msg.renderBareTooltip
  );
  btn.textContent =
    initialState === "restore" ? msg.showRawBtn : msg.renderBareBtn;

  bar.appendChild(btn);

  const anchorEl = anchorNode.parentElement;
  if (
    anchorEl &&
    anchorEl !== root &&
    anchorEl.parentNode &&
    root.contains(anchorEl.parentNode)
  ) {
    anchorEl.parentNode.insertBefore(bar, anchorEl.nextSibling);
  } else {
    root.appendChild(bar);
  }

  return btn;
}

/**
 * Renders undelimited LaTeX, chemistry, and Unicode/plain-math expressions inside `root`.
 * Returns the number of newly rendered formulas.
 */
export function renderBareLatexInElement(
  root: Element,
  options?: Locale | ProcessOptions
): number {
  const opts = normalizeOptions(options);
  const candidates = collectEligibleTextNodes(root, (value) =>
    hasUndelimitedMath(value, { includeChemistry: opts.enableChemistry })
  );

  let renderedCount = 0;
  for (const textNode of candidates) {
    const segments = parseUndelimitedMathSegments(textNode.nodeValue ?? "", {
      includeChemistry: opts.enableChemistry,
    });
    renderedCount += replaceTextNodeWithSegments(
      textNode,
      segments,
      "bare",
      opts
    );
  }

  return renderedCount;
}

/**
 * Safely walks a post container, renders explicitly delimited formulas via `katex.render()`
 * inside a single `DocumentFragment` per text node (zero `.innerHTML`, fully compliant with
 * x.com's Trusted Types CSP), and either attaches a discrete opt-in button or auto-renders
 * (with a `Show raw` revert toggle) when undelimited LaTeX, chemistry, or Unicode/plain math
 * is detected.
 *
 * Idempotent: running multiple times on the same element never duplicates math or buttons.
 */
export function processTweetElement(
  root: Element,
  options?: Locale | ProcessOptions
): number {
  const doc = root.ownerDocument;
  if (!doc || root.getAttribute("contenteditable") === "true") {
    return 0;
  }

  const opts = normalizeOptions(options);

  // 1. Auto-render explicitly delimited math ($$...$$, \(...\), \[...\])
  const delimitedCandidates = collectEligibleTextNodes(root, mightContainMath);
  let renderedCount = 0;

  for (const textNode of delimitedCandidates) {
    const segments = parseMathSegments(textNode.nodeValue ?? "");
    renderedCount += replaceTextNodeWithSegments(
      textNode,
      segments,
      "delimited",
      opts
    );
  }

  // 2. Handle undelimited LaTeX, chemistry, and Unicode/plain-math posts
  if (
    opts.enableBareLatexButton &&
    renderedCount === 0 &&
    !root.querySelector(`[${RENDERED_ATTR}="rendered"]`) &&
    !root.querySelector(`[${BARE_BAR_ATTR}="true"]`)
  ) {
    const bareCandidates = collectEligibleTextNodes(root, (value) =>
      hasUndelimitedMath(value, { includeChemistry: opts.enableChemistry })
    );
    if (bareCandidates.length > 0) {
      const anchor = bareCandidates[bareCandidates.length - 1];
      if (opts.autoRenderBareLatex) {
        // Attach the revert button before replacing text nodes so anchor stays in DOM
        const btn = attachBareLatexButton(root, anchor, opts.locale, "restore");
        const bareCount = renderBareLatexInElement(root, opts);
        if (bareCount > 0) {
          renderedCount += bareCount;
        } else if (btn) {
          btn.closest(`[${BARE_BAR_ATTR}="true"]`)?.remove();
        }
      } else {
        attachBareLatexButton(root, anchor, opts.locale, "render");
      }
    }
  }

  return renderedCount;
}

/**
 * Processes all visible posts inside `scope` (or the enclosing post container if `scope` is nested).
 */
export function processAllTweets(
  scope: ParentNode = document,
  options?: Locale | ProcessOptions
): number {
  if (scope instanceof Element) {
    if (scope.matches(TWEET_TEXT_SELECTOR)) {
      return processTweetElement(scope, options);
    }
    const ancestorTweet = scope.closest(TWEET_TEXT_SELECTOR);
    if (ancestorTweet) {
      return processTweetElement(ancestorTweet, options);
    }
  }

  let total = 0;
  const tweetNodes = scope.querySelectorAll(TWEET_TEXT_SELECTOR);
  for (const tweetNode of tweetNodes) {
    total += processTweetElement(tweetNode, options);
  }

  return total;
}

/**
 * Updates localized tooltip, copy-badge, and opt-in button labels live
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

  const bareButtons = scope.querySelectorAll(`[${BARE_BTN_ATTR}]`);
  for (const btn of bareButtons) {
    const state = btn.getAttribute(BARE_BTN_ATTR);
    if (state === "restore") {
      btn.textContent = msg.showRawBtn;
      btn.setAttribute("title", msg.showRawTooltip);
    } else {
      btn.textContent = msg.renderBareBtn;
      btn.setAttribute("title", msg.renderBareTooltip);
    }
  }
}

/**
 * Removes all discrete opt-in bare-LaTeX button bars from `scope`.
 */
export function removeBareLatexBars(scope: ParentNode = document): number {
  const bars = scope.querySelectorAll(`[${BARE_BAR_ATTR}="true"]`);
  for (const bar of bars) {
    bar.remove();
  }
  return bars.length;
}

/**
 * Restores rendered formulas back to their original raw LaTeX text (`data-latex-raw`).
 * If `sourceFilter` is provided (`"delimited"` or `"bare"`), only restores formulas
 * from that source.
 */
export function restoreAllMath(
  scope: ParentNode = document,
  sourceFilter?: RenderSource
): number {
  const selector = sourceFilter
    ? `[${RENDERED_ATTR}="rendered"][${SOURCE_ATTR}="${sourceFilter}"]`
    : `[${RENDERED_ATTR}="rendered"]`;

  const renderedNodes = scope.querySelectorAll(selector);
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
 * Installs a single delegated listener on `doc` handling:
 * 1. Clicking / pressing Enter or Space on any rendered formula to copy its LaTeX source.
 * 2. Clicking any discrete opt-in `∑ Render LaTeX` / `↺ Show raw` button to toggle bare rendering.
 *
 * Returns a cleanup function that removes the listeners.
 */
export function installInteractionHandlers(
  doc: Document = document,
  getOptions: () => ProcessOptions = () => ({})
): () => void {
  type PopoverToastEl = HTMLElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
  };

  let toastEl: PopoverToastEl | null = null;
  let toastTimer: number | null = null;

  const hideCopyToast = (): void => {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastEl) {
      try {
        toastEl.hidePopover?.();
      } catch {
        // Ignore if popover is already closed or unsupported
      }
      toastEl.remove();
      toastEl = null;
    }
  };

  const showCopyToast = (formulaEl: Element): void => {
    const opts = normalizeOptions(getOptions());
    const label =
      formulaEl.getAttribute(COPIED_LABEL_ATTR) ??
      getMessages(opts.locale).copiedBadge;

    const host = formulaEl.closest("dialog") ?? doc.body;
    if (!host) return;

    if (!toastEl) {
      toastEl = doc.createElement("div") as PopoverToastEl;
      toastEl.className = "latex-on-x-copy-toast";
      toastEl.setAttribute(COPY_TOAST_ATTR, "true");
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      if (typeof toastEl.showPopover === "function") {
        toastEl.setAttribute("popover", "manual");
      }
    }

    toastEl.textContent = label;
    if (toastEl.parentNode !== host) {
      host.appendChild(toastEl);
    }

    const rect = formulaEl.getBoundingClientRect();
    const viewportWidth = doc.defaultView?.innerWidth || 1024;
    const centerX = Math.max(
      64,
      Math.min(viewportWidth - 64, rect.left + rect.width / 2)
    );
    const placeAbove = rect.top >= 36;
    const top = placeAbove ? rect.top - 6 : rect.bottom + 6;

    toastEl.style.left = `${Math.round(centerX)}px`;
    toastEl.style.top = `${Math.round(top)}px`;
    toastEl.style.transform = placeAbove
      ? "translate(-50%, -100%)"
      : "translateX(-50%)";

    try {
      toastEl.showPopover?.();
    } catch {
      // Fall back cleanly to fixed z-index positioning
    }

    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      hideCopyToast();
    }, 1200);
  };

  const copyFromFormula = (formulaEl: Element, event: Event): void => {
    const latex = formulaEl.getAttribute(LATEX_ATTR);
    if (!latex) return;

    // Prevent clicking a formula from triggering X's post-navigation click handler
    event.stopPropagation();

    navigator.clipboard?.writeText(latex).catch(() => {
      // Silently ignore if clipboard access is blocked
    });

    formulaEl.classList.add("latex-on-x-copied");
    showCopyToast(formulaEl);
    window.setTimeout(() => {
      formulaEl.classList.remove("latex-on-x-copied");
    }, 1200);
  };

  const toggleBareButton = (btn: Element, event: Event): void => {
    event.stopPropagation();
    event.preventDefault();

    const post = btn.closest(TWEET_TEXT_SELECTOR);
    if (!post) return;

    const opts = normalizeOptions(getOptions());
    const msg = getMessages(opts.locale);
    const state = btn.getAttribute(BARE_BTN_ATTR);

    if (state === "restore") {
      restoreAllMath(post, "bare");
      btn.setAttribute(BARE_BTN_ATTR, "render");
      btn.textContent = msg.renderBareBtn;
      btn.setAttribute("title", msg.renderBareTooltip);
      btn.classList.remove("is-active");
    } else {
      const count = renderBareLatexInElement(post, opts);
      if (count > 0) {
        btn.setAttribute(BARE_BTN_ATTR, "restore");
        btn.textContent = msg.showRawBtn;
        btn.setAttribute("title", msg.showRawTooltip);
        btn.classList.add("is-active");
      }
    }
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const bareBtn = target.closest(`[${BARE_BTN_ATTR}]`);
    if (bareBtn) {
      toggleBareButton(bareBtn, event);
      return;
    }

    const formulaEl = target.closest(`[${RENDERED_ATTR}="rendered"]`);
    if (formulaEl) {
      copyFromFormula(formulaEl, event);
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const formulaEl = target.closest(`[${RENDERED_ATTR}="rendered"]`);
      if (formulaEl) {
        event.preventDefault();
        copyFromFormula(formulaEl, event);
      }
    }
  };

  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKeyDown);

  return () => {
    hideCopyToast();
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("keydown", onKeyDown);
  };
}

/**
 * Backwards-compatible alias for `installInteractionHandlers`.
 */
export function installCopyHandler(doc: Document = document): () => void {
  return installInteractionHandlers(doc);
}
