import type { Locale } from "../i18n/messages.js";
import { isCursorInsideMath } from "./formulaCatalog.js";

export interface QuickSymbol {
  id: string;
  /** Compact glyph/label displayed on the button. */
  label: string;
  /** Localized tooltip shown on hover and read by screen readers. */
  tooltips: Readonly<Record<Locale, string>>;
  /** Opening text inserted before selection (or before caret when empty). */
  before: string;
  /** Closing text inserted after selection (or after caret when empty). */
  after: string;
  /** True for outer math delimiter wrappers (`\(...\)`, `$$...$$`) that should never be double-wrapped. */
  isWrapper?: boolean;
  /** True when the symbol requires mhchem chemistry support to be enabled. */
  requiresChemistry?: boolean;
}

export const QUICK_SYMBOLS: readonly QuickSymbol[] = [
  {
    id: "inline-wrap",
    label: "\\(x\\)",
    tooltips: {
      en: "Inline math \\(...\\)",
      es: "Fórmula en línea \\(...\\)",
      zh: "行内公式 \\(...\\)",
    },
    before: "\\(",
    after: "\\)",
    isWrapper: true,
  },
  {
    id: "display-wrap",
    label: "$$",
    tooltips: {
      en: "Display block $$...$$",
      es: "Fórmula en bloque $$...$$",
      zh: "块级公式 $$...$$",
    },
    before: "$$",
    after: "$$",
    isWrapper: true,
  },
  {
    id: "frac",
    label: "a/b",
    tooltips: {
      en: "Fraction \\frac{}{}",
      es: "Fracción \\frac{}{}",
      zh: "分数 \\frac{}{}",
    },
    before: "\\frac{",
    after: "}{}",
  },
  {
    id: "sqrt",
    label: "√",
    tooltips: {
      en: "Square root \\sqrt{}",
      es: "Raíz cuadrada \\sqrt{}",
      zh: "平方根 \\sqrt{}",
    },
    before: "\\sqrt{",
    after: "}",
  },
  {
    id: "power",
    label: "x²",
    tooltips: {
      en: "Superscript / exponent ^{}",
      es: "Exponente / potencia ^{}",
      zh: "上标 / 幂 ^{}",
    },
    before: "^{",
    after: "}",
  },
  {
    id: "sum",
    label: "∑",
    tooltips: {
      en: "Summation \\sum_{n=1}^{\\infty}",
      es: "Sumatoria \\sum_{n=1}^{\\infty}",
      zh: "求和 \\sum_{n=1}^{\\infty}",
    },
    before: "\\sum_{n=1}^{\\infty} ",
    after: "",
  },
  {
    id: "int",
    label: "∫",
    tooltips: {
      en: "Definite integral \\int_{a}^{b}",
      es: "Integral definida \\int_{a}^{b}",
      zh: "定积分 \\int_{a}^{b}",
    },
    before: "\\int_{a}^{b} ",
    after: "\\,dx",
  },
  {
    id: "pi",
    label: "π",
    tooltips: {
      en: "Pi \\pi",
      es: "Constante Pi \\pi",
      zh: "圆周率 \\pi",
    },
    before: "\\pi",
    after: "",
  },
  {
    id: "infty",
    label: "∞",
    tooltips: {
      en: "Infinity \\infty",
      es: "Infinito \\infty",
      zh: "无穷大 \\infty",
    },
    before: "\\infty",
    after: "",
  },
  {
    id: "le",
    label: "≤",
    tooltips: {
      en: "Less than or equal \\le",
      es: "Menor o igual \\le",
      zh: "小于等于 \\le",
    },
    before: "\\le ",
    after: "",
  },
  {
    id: "to",
    label: "→",
    tooltips: {
      en: "Arrow \\to",
      es: "Flecha \\to",
      zh: "箭头 \\to",
    },
    before: "\\to ",
    after: "",
  },
  {
    id: "ce",
    label: "\\ce",
    tooltips: {
      en: "Chemistry formula \\ce{}",
      es: "Fórmula química \\ce{}",
      zh: "化学式 \\ce{}",
    },
    before: "\\ce{",
    after: "}",
    requiresChemistry: true,
  },
];

/**
 * Inserts a quick symbol at `[selectionStart, selectionEnd]`:
 * - Wraps any selected text between `before` and `after` (e.g., selecting `x+1`
 *   and clicking `√` produces `\sqrt{x+1}`).
 * - Automatically wraps non-delimiter math commands in inline `\(...\)` when the
 *   caret is currently outside math delimiters, placing the caret inside the
 *   first editable slot.
 */
export function applyQuickSymbol(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  symbol: QuickSymbol
): { text: string; cursorPos: number; inserted: string } {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const selected = text.slice(start, end);

  const insideMath = isCursorInsideMath(text, start);
  const shouldWrapInline = !symbol.isWrapper && !insideMath;

  const openWrap = shouldWrapInline ? "\\(" : "";
  const closeWrap = shouldWrapInline ? "\\)" : "";

  const inserted = `${openWrap}${symbol.before}${selected}${symbol.after}${closeWrap}`;
  const nextText = text.slice(0, start) + inserted + text.slice(end);

  // If user selected text, place cursor right after the wrapped inner construct (before outer `\)` if empty after)
  // If nothing was selected, place cursor right between `before` and `after` (e.g. `\frac{|}{}`)
  let cursorPos: number;
  if (selected.length > 0) {
    if (symbol.id === "frac") {
      // Selected text became numerator `\frac{sel}{|}` -> move caret into denominator braces
      cursorPos =
        start + openWrap.length + symbol.before.length + selected.length + 2;
    } else {
      cursorPos = start + inserted.length;
    }
  } else {
    cursorPos = start + openWrap.length + symbol.before.length;
  }

  return { text: nextText, cursorPos, inserted };
}
