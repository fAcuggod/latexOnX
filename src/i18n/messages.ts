export type Locale = "en" | "es" | "zh";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es", "zh"];

export interface Messages {
  subtitle: string;
  toggleLabel: string;
  statusActive: string;
  statusPaused: string;
  syntaxTitle: string;
  modeInline: string;
  modeDisplay: string;
  hint: string;
  copyTooltipPrefix: string;
  copiedBadge: string;
  languageLabel: string;
}

export const MESSAGES: Readonly<Record<Locale, Messages>> = {
  en: {
    subtitle: "Math formulas on x.com",
    toggleLabel: "Auto-render",
    statusActive: "Active on x.com",
    statusPaused: "Paused",
    syntaxTitle: "Supported syntax",
    modeInline: "Inline",
    modeDisplay: "Display block",
    hint: "Currency notation and cashtags are never altered. Click any formula to copy its LaTeX source.",
    copyTooltipPrefix: "Click to copy LaTeX",
    copiedBadge: "LaTeX copied ✓",
    languageLabel: "Language",
  },
  es: {
    subtitle: "Fórmulas matemáticas en x.com",
    toggleLabel: "Renderizado automático",
    statusActive: "Activo en x.com",
    statusPaused: "Pausado",
    syntaxTitle: "Sintaxis soportada",
    modeInline: "En línea (inline)",
    modeDisplay: "En bloque (display)",
    hint: "Los precios y cashtags nunca se alteran. Hacé clic en cualquier fórmula para copiar su LaTeX.",
    copyTooltipPrefix: "Clic para copiar LaTeX",
    copiedBadge: "LaTeX copiado ✓",
    languageLabel: "Idioma",
  },
  zh: {
    subtitle: "在 x.com 上实时渲染数学公式",
    toggleLabel: "自动渲染",
    statusActive: "已在 x.com 启用",
    statusPaused: "已暂停",
    syntaxTitle: "支持的语法",
    modeInline: "行内公式 (inline)",
    modeDisplay: "块级公式 (display)",
    hint: "不会干扰货币价格与金融标签（cashtags）。点击任意公式即可复制其 LaTeX 源码。",
    copyTooltipPrefix: "点击复制 LaTeX",
    copiedBadge: "已复制 LaTeX ✓",
    languageLabel: "语言",
  },
};

/**
 * Detects the best matching supported locale from a BCP 47 language tag
 * (e.g., "es-AR" -> "es", "zh-CN" -> "zh", anything else -> "en").
 */
export function detectDefaultLocale(language?: string): Locale {
  const raw = (
    language ??
    (typeof navigator !== "undefined" ? navigator.language : "en")
  ).toLowerCase();

  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("es")) return "es";
  return "en";
}

/**
 * Safely validates a persisted locale value, falling back to browser detection.
 */
export function normalizeLocale(value: unknown, fallbackLang?: string): Locale {
  if (value === "en" || value === "es" || value === "zh") {
    return value;
  }
  return detectDefaultLocale(fallbackLang);
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
