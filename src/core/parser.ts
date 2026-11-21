import type { MathDisplayMode, Segment } from "./types.js";

/**
 * Especificación de cada par de delimitadores que reconoce el parser.
 */
export interface DelimiterSpec {
  open: string;
  close: string;
  mode: MathDisplayMode;
}

/**
 * Delimitadores soportados en orden de evaluación.
 * Nota: No incluimos `$` simple para evitar colisiones con precios ($50) o cashtags ($BTC).
 */
export const DELIMITERS: readonly DelimiterSpec[] = [
  { open: "$$", close: "$$", mode: "display" },
  { open: "\\[", close: "\\]", mode: "display" },
  { open: "\\(", close: "\\)", mode: "inline" },
];

/**
 * Agrega un fragmento de texto plano a `segments`, fusionándolo con el último
 * segmento si ya era de tipo `"text"` (garantiza que no haya textos vacíos ni
 * dos segmentos `"text"` consecutivos).
 */
function pushText(segments: Segment[], chunk: string): void {
  if (chunk.length === 0) return;

  const last = segments[segments.length - 1];
  if (last && last.type === "text") {
    last.content += chunk;
  } else {
    segments.push({ type: "text", content: chunk });
  }
}

/**
 * Divide el texto plano de un tweet en una lista ordenada de segmentos
 * (`Segment[]`), alternando texto normal (`type: "text"`) y fórmulas
 * matemáticas (`type: "math"`).
 *
 * Delimitadores válidos:
 * - `$$...$$` -> mode: "display"
 * - `\[...\]` -> mode: "display"
 * - `\(...\)` -> mode: "inline"
 *
 * Garantiza que:
 * - `$` simple (precios/cashtags) nunca se interpreta como fórmula.
 * - Delimitadores sin cierre o fórmulas vacías se conservan como texto literal.
 * - No se generan segmentos `"text"` vacíos ni consecutivos, y la salida es sin pérdida.
 */
export function parseMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < text.length) {
    let matched: DelimiterSpec | null = null;
    for (const delim of DELIMITERS) {
      if (text.startsWith(delim.open, i)) {
        matched = delim;
        break;
      }
    }

    if (matched === null) {
      pushText(segments, text[i]);
      i += 1;
    } else {
      const closeIdx = text.indexOf(matched.close, i + matched.open.length);

      if (closeIdx === -1) {
        pushText(segments, matched.open);
        i += matched.open.length;
      } else {
        const endIdx = closeIdx + matched.close.length;
        const raw = text.slice(i, endIdx);
        const inner = text.slice(i + matched.open.length, closeIdx).trim();

        if (inner === "") {
          pushText(segments, raw);
        } else {
          segments.push({
            type: "math",
            content: inner,
            mode: matched.mode,
            raw,
          });
        }

        i = endIdx;
      }
    }
  }

  return segments;
}
