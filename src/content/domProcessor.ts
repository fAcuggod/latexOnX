import { parseMathSegments } from "../core/parser.js";
import { renderFormulaToElement } from "../renderer/katexRenderer.js";

export const TWEET_TEXT_SELECTOR = '[data-testid="tweetText"]';
export const RENDERED_ATTR = "data-latex-on-x";
export const RAW_ATTR = "data-latex-raw";
export const LATEX_ATTR = "data-latex";

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
]);

/**
 * Comprobación rápida O(n) sin asignaciones de memoria:
 * el 99% de los tweets no contienen delimitadores matemáticos, así que los
 * descartamos al instante para mantener el scroll a 60–120 FPS.
 */
export function mightContainMath(text: string): boolean {
  return text.includes("$$") || text.includes("\\(") || text.includes("\\[");
}

/**
 * Determina si un nodo de texto está dentro de un elemento que NO debemos tocar
 * (enlaces, menciones, hashtags, código, editores de texto o fórmulas ya renderizadas).
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
        el.getAttribute(RENDERED_ATTR) === "rendered" ||
        el.classList.contains("katex")
      ) {
        return true;
      }
    }
    current = current.parentNode;
  }

  return false;
}

/**
 * Recorre de forma segura un contenedor de texto de tweet (`[data-testid="tweetText"]`),
 * reemplaza las fórmulas válidas usando un único `DocumentFragment` por nodo de texto
 * sin usar `.innerHTML` (100% compatible con Trusted Types CSP en x.com) y deja intactos
 * los enlaces, menciones, hashtags, emojis y texto normal.
 *
 * Es idempotente: ejecutarla varias veces sobre el mismo tweet no duplica fórmulas.
 * Devuelve la cantidad de fórmulas renderizadas en esta pasada.
 */
export function processTweetElement(root: Element): number {
  const doc = root.ownerDocument;
  if (!doc || root.getAttribute("contenteditable") === "true") {
    return 0;
  }

  // 1. Recolectamos primero los nodos de texto candidatos (nunca mutar mientras camina TreeWalker)
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

  // 2. Transformamos cada nodo candidato en un único DocumentFragment (1 solo reflow)
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
        // TextNode puro: el navegador jamás interpreta HTML/scripts -> 100% seguro contra XSS
        fragment.appendChild(doc.createTextNode(seg.content));
      } else {
        const wrapper = doc.createElement("span");
        // Renderizamos con katex.render() directo al DOM (sin .innerHTML -> compatible con Trusted Types)
        const result = renderFormulaToElement(seg.content, seg.mode, wrapper);

        if (!result.ok) {
          // Degradación elegante: mostramos el texto original sin romper el tweet
          fragment.appendChild(doc.createTextNode(seg.raw));
        } else {
          wrapper.className =
            seg.mode === "display"
              ? "latex-on-x-formula latex-on-x-display"
              : "latex-on-x-formula latex-on-x-inline";
          wrapper.setAttribute(RENDERED_ATTR, "rendered");
          wrapper.setAttribute(LATEX_ATTR, seg.content);
          wrapper.setAttribute(RAW_ATTR, seg.raw);
          wrapper.setAttribute("role", "button");
          wrapper.setAttribute("tabindex", "0");
          wrapper.setAttribute(
            "title",
            `Clic para copiar LaTeX: ${seg.content}`
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
 * Procesa todos los tweets visibles dentro de `scope` (o el tweetText contenedor si `scope` está adentro).
 */
export function processAllTweets(scope: ParentNode = document): number {
  if (scope instanceof Element) {
    if (scope.matches(TWEET_TEXT_SELECTOR)) {
      return processTweetElement(scope);
    }
    const ancestorTweet = scope.closest(TWEET_TEXT_SELECTOR);
    if (ancestorTweet) {
      return processTweetElement(ancestorTweet);
    }
  }

  let total = 0;
  const tweetNodes = scope.querySelectorAll(TWEET_TEXT_SELECTOR);
  for (const tweetNode of tweetNodes) {
    total += processTweetElement(tweetNode);
  }

  return total;
}

/**
 * Restaura todas las fórmulas renderizadas a su texto LaTeX original (`data-latex-raw`).
 * Permite apagar la extensión desde el popup al instante sin recargar la página.
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

  // Unimos TextNodes adyacentes para dejar el DOM exactamente como estaba antes
  for (const parent of touchedParents) {
    parent.normalize();
  }

  return restoredCount;
}

/**
 * Instala UN único listener delegado en `doc` (en lugar de cientos de listeners por fórmula)
 * para copiar el código LaTeX original al portapapeles al hacer clic o presionar Enter/Espacio.
 * Devuelve una función de limpieza para desinstalar los listeners.
 */
export function installCopyHandler(doc: Document = document): () => void {
  const copyFromTarget = (target: EventTarget | null, event: Event): void => {
    if (!(target instanceof Element)) return;
    const formulaEl = target.closest(`[${RENDERED_ATTR}="rendered"]`);
    if (!formulaEl) return;

    const latex = formulaEl.getAttribute(LATEX_ATTR);
    if (!latex) return;

    // Evitamos que hacer clic en la fórmula abra el detalle del tweet en X
    event.stopPropagation();

    navigator.clipboard?.writeText(latex).catch(() => {
      // Silencioso si el navegador bloquea el portapapeles
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
