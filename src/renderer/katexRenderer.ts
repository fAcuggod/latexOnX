import katex, { type KatexOptions } from "katex";
import { parseMathSegments } from "../core/parser.js";
import type { MathDisplayMode, ValidationReason } from "../core/types.js";
import { validateLatex, type ValidationLimits } from "../core/validator.js";

/**
 * Resultado de procesar cada segmento del texto de un tweet a través de
 * todo el pipeline: parser -> validador -> KaTeX.
 *
 * - `"text"`: texto normal del tweet (se insertará como TextNode, nunca como HTML -> seguro contra XSS).
 * - `"math"`: fórmula validada y compilada por KaTeX a HTML + MathML accesible.
 * - `"rejected"`: fórmula rechazada por seguridad o por sintaxis LaTeX inválida;
 *   guardamos `raw` para mostrar el texto original del tweet sin romper nada.
 */
export type RenderedSegment =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "math";
      /** HTML + MathML generado por KaTeX con `trust: false`. */
      html: string;
      /** Código LaTeX limpio original (útil para tooltips o copiar al portapapeles). */
      latex: string;
      mode: MathDisplayMode;
      raw: string;
    }
  | {
      type: "rejected";
      reason: ValidationReason | "katex_error";
      message: string;
      raw: string;
    };

/**
 * Opciones defensivas de KaTeX (segunda capa de defensa en profundidad):
 * - `output: "htmlAndMathml"` -> dibujo visual nítido + MathML nativo para lectores de pantalla.
 * - `trust: false` -> prohíbe HTML crudo, links y estilos arbitrarios dentro de KaTeX.
 * - `maxSize` y `maxExpand` -> limitan tamaños gigantes y expansiones de macros (anti-DoS).
 * - `throwOnError: true` -> nos permite capturar errores de sintaxis con `try/catch`
 *   y degradar elegantemente al texto original del tweet en lugar de mostrar texto rojo.
 */
const KATEX_SAFE_BASE_OPTIONS: Readonly<KatexOptions> = {
  output: "htmlAndMathml",
  throwOnError: true,
  strict: "ignore",
  trust: false,
  maxSize: 10,
  maxExpand: 100,
};

/**
 * Valida una fórmula individual con `validateLatex` y, si pasa seguridad,
 * la renderiza a HTML + MathML usando KaTeX.
 */
export function renderFormula(
  latex: string,
  mode: MathDisplayMode,
  raw: string,
  limits?: Partial<ValidationLimits>
): RenderedSegment {
  const validation = validateLatex(latex, limits);
  if (!validation.ok) {
    return {
      type: "rejected",
      reason: validation.reason,
      message: validation.message,
      raw,
    };
  }

  try {
    const html = katex.renderToString(latex, {
      ...KATEX_SAFE_BASE_OPTIONS,
      displayMode: mode === "display",
    });

    return {
      type: "math",
      html,
      latex,
      mode,
      raw,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error de sintaxis LaTeX al renderizar con KaTeX.";

    return {
      type: "rejected",
      reason: "katex_error",
      message,
      raw,
    };
  }
}

/**
 * Pipeline completo de texto de tweet:
 *   texto plano -> parseMathSegments -> validateLatex -> KaTeX
 *
 * No toca el DOM; devuelve una estructura lista para que la capa del navegador
 * (o un simulador/test) la dibuje de forma segura.
 */
export function renderTweetText(
  text: string,
  limits?: Partial<ValidationLimits>
): RenderedSegment[] {
  const segments = parseMathSegments(text);

  return segments.map((segment) => {
    if (segment.type === "text") {
      return segment;
    }

    return renderFormula(segment.content, segment.mode, segment.raw, limits);
  });
}
