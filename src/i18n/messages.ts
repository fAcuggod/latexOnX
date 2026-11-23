export type Locale = "en" | "es" | "zh";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es", "zh"];

export interface Messages {
  subtitle: string;
  toggleLabel: string;
  statusActive: string;
  statusPaused: string;
  optionsTitle: string;
  chemistryLabel: string;
  bareLatexLabel: string;
  syntaxTitle: string;
  modeInline: string;
  modeDisplay: string;
  modeChemistry: string;
  hint: string;
  copyTooltipPrefix: string;
  copiedBadge: string;
  renderBareBtn: string;
  showRawBtn: string;
  renderBareTooltip: string;
  showRawTooltip: string;
  languageLabel: string;
}

export const MESSAGES: Readonly<Record<Locale, Messages>> = {
  en: {
    subtitle: "Math & chemistry on x.com",
    toggleLabel: "Auto-render",
    statusActive: "Active on x.com",
    statusPaused: "Paused",
    optionsTitle: "Features",
    chemistryLabel: "Chemistry (\\ce, \\pu)",
    bareLatexLabel: "Undelimited LaTeX button",
    syntaxTitle: "Supported syntax",
    modeInline: "Inline",
    modeDisplay: "Display block",
    modeChemistry: "Chemistry (mhchem)",
    hint: "Currency notation and cashtags are never altered. Click any formula to copy its LaTeX source.",
    copyTooltipPrefix: "Click to copy LaTeX",
    copiedBadge: "LaTeX copied ✓",
    renderBareBtn: "∑ Render LaTeX",
    showRawBtn: "↺ Show raw",
    renderBareTooltip: "Render detected undelimited LaTeX in this post",
    showRawTooltip: "Restore original raw LaTeX text",
    languageLabel: "Language",
  },
  es: {
    subtitle: "Matemática y química en x.com",
    toggleLabel: "Renderizado automático",
    statusActive: "Activo en x.com",
    statusPaused: "Pausado",
    optionsTitle: "Funciones",
    chemistryLabel: "Química (\\ce, \\pu)",
    bareLatexLabel: "Botón LaTeX sin delimitadores",
    syntaxTitle: "Sintaxis soportada",
    modeInline: "En línea (inline)",
    modeDisplay: "En bloque (display)",
    modeChemistry: "Química (mhchem)",
    hint: "Los precios y cashtags nunca se alteran. Hacé clic en cualquier fórmula para copiar su LaTeX.",
    copyTooltipPrefix: "Clic para copiar LaTeX",
    copiedBadge: "LaTeX copiado ✓",
    renderBareBtn: "∑ Renderizar LaTeX",
    showRawBtn: "↺ Ver original",
    renderBareTooltip: "Renderizar fórmulas LaTeX detectadas sin delimitadores",
    showRawTooltip: "Restaurar el texto LaTeX original",
    languageLabel: "Idioma",
  },
  zh: {
    subtitle: "在 x.com 上渲染数学与化学公式",
    toggleLabel: "自动渲染",
    statusActive: "已在 x.com 启用",
    statusPaused: "已暂停",
    optionsTitle: "功能选项",
    chemistryLabel: "化学公式 (\\ce, \\pu)",
    bareLatexLabel: "无定界符 LaTeX 按钮",
    syntaxTitle: "支持的语法",
    modeInline: "行内公式 (inline)",
    modeDisplay: "块级公式 (display)",
    modeChemistry: "化学反应式 (mhchem)",
    hint: "不会干扰货币价格与金融标签（cashtags）。点击任意公式即可复制其 LaTeX 源码。",
    copyTooltipPrefix: "点击复制 LaTeX",
    copiedBadge: "已复制 LaTeX ✓",
    renderBareBtn: "∑ 渲染 LaTeX",
    showRawBtn: "↺ 显示原文",
    renderBareTooltip: "渲染此帖中检测到的无定界符 LaTeX 公式",
    showRawTooltip: "恢复原始 LaTeX 文本",
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
