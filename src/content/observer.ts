import { processAllTweets, RENDERED_ATTR } from "./domProcessor.js";

export interface TimelineObserverController {
  start(target?: Node): void;
  stop(): void;
  isRunning(): boolean;
}

/**
 * Crea un observador de mutaciones optimizado para el scroll infinito de X.
 *
 * En lugar de re-escanear toda la página en cada cambio del DOM, acumula los
 * nodos recién insertados en un `Set` y los procesa en un único lote durante
 * el próximo frame de animación (`requestAnimationFrame`), evitando trabar
 * el scroll a 60–120 FPS.
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

  const handleMutations = (mutations: MutationRecord[]): void => {
    let hasNewCandidates = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;

        // Ignoramos nodos creados por nuestra propia extensión para no re-dispararnos
        if (
          el.getAttribute(RENDERED_ATTR) === "rendered" ||
          el.classList.contains("katex")
        ) {
          continue;
        }

        pendingRoots.add(el);
        hasNewCandidates = true;
      }
    }

    if (hasNewCandidates) {
      scheduleFlush();
    }
  };

  return {
    start(target: Node = document.body): void {
      if (observer !== null || !target) return;

      // Procesamos los tweets que ya estaban presentes al iniciar
      if (target instanceof Element || target instanceof Document) {
        processScope(target);
      }

      observer = new MutationObserver(handleMutations);
      observer.observe(target, {
        childList: true,
        subtree: true,
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
