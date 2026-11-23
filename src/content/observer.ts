import { PREVIEW_PANEL_ATTR } from "./composerOverlay.js";
import {
  BARE_BAR_ATTR,
  processAllTweets,
  RENDERED_ATTR,
  TWEET_TEXT_SELECTOR,
} from "./domProcessor.js";

export interface TimelineObserverController {
  start(target?: Node): void;
  stop(): void;
  isRunning(): boolean;
}

/**
 * Creates a MutationObserver optimized for X's infinite scroll and React SPA navigation.
 *
 * Instead of rescanning the entire document on every DOM mutation, added or updated
 * candidates are deduplicated in a `Set` and flushed once per animation frame
 * (`requestAnimationFrame`), preserving 60-120 FPS scrolling.
 */
export function createTimelineObserver(
  processScope: (scope: ParentNode) => number = processAllTweets
): TimelineObserverController {
  let observer: MutationObserver | null = null;
  let scheduledFrame: number | null = null;
  const pendingRoots = new Set<Element>();

  const scheduleFlush = (): void => {
    if (scheduledFrame !== null) return;

    const raf =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback) =>
            setTimeout(() => cb(Date.now()), 16) as unknown as number;

    scheduledFrame = raf(() => {
      scheduledFrame = null;
      const batch = Array.from(pendingRoots);
      pendingRoots.clear();

      for (const root of batch) {
        if (root.isConnected) {
          processScope(root);
        }
      }
    });
  };

  const enqueueCandidate = (node: Node): boolean => {
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;

    if (!el) return false;

    // Ignore mutations originating from our own rendered math nodes, opt-in bars, or preview portal
    if (
      el.getAttribute(RENDERED_ATTR) === "rendered" ||
      el.getAttribute(BARE_BAR_ATTR) === "true" ||
      el.getAttribute(PREVIEW_PANEL_ATTR) === "true" ||
      el.closest(`[${RENDERED_ATTR}="rendered"]`) !== null ||
      el.closest(`[${BARE_BAR_ATTR}="true"]`) !== null ||
      el.closest(`[${PREVIEW_PANEL_ATTR}="true"]`) !== null ||
      el.classList.contains("katex")
    ) {
      return false;
    }

    // If React inserts a child <span> or TextNode inside an existing post container,
    // enqueue that enclosing post container directly.
    const ancestorTweet = el.closest(TWEET_TEXT_SELECTOR);
    if (ancestorTweet) {
      pendingRoots.add(ancestorTweet);
      return true;
    }

    pendingRoots.add(el);
    return true;
  };

  const handleMutations = (mutations: MutationRecord[]): void => {
    let hasNewCandidates = false;

    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        if (enqueueCandidate(mutation.target)) {
          hasNewCandidates = true;
        }
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (enqueueCandidate(node)) {
          hasNewCandidates = true;
        }
      }
    }

    if (hasNewCandidates) {
      scheduleFlush();
    }
  };

  return {
    start(target: Node = document.body): void {
      if (observer !== null || !target) return;

      // Process posts already mounted when the observer starts
      if (target instanceof Element || target instanceof Document) {
        processScope(target);
      }

      observer = new MutationObserver(handleMutations);
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    },

    stop(): void {
      if (observer !== null) {
        observer.disconnect();
        observer = null;
      }
      if (scheduledFrame !== null) {
        if (
          typeof window !== "undefined" &&
          typeof window.cancelAnimationFrame === "function"
        ) {
          window.cancelAnimationFrame(scheduledFrame);
        } else {
          clearTimeout(scheduledFrame);
        }
        scheduledFrame = null;
      }
      pendingRoots.clear();
    },

    isRunning(): boolean {
      return observer !== null;
    },
  };
}
