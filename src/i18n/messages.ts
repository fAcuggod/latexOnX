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
  composerPreviewLabel: string;
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
  previewTitle: string;
  previewCloseTooltip: string;
  previewReadySingular: string;
  previewReadyPlural: string;
  previewIssueSingular: string;
  previewIssuePlural: string;
  diagUnclosed: string;
  diagChemDisabled: string;
  diagFormulaPrefix: string;
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
    composerPreviewLabel: "Live composer preview",
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
    previewTitle: "LaTeX Preview",
    previewCloseTooltip: "Hide preview",
    previewReadySingular: "1 formula ready",
    previewReadyPlural: "{n} formulas ready",
    previewIssueSingular: "1 issue",
    previewIssuePlural: "{n} issues",
    diagUnclosed: "Unclosed {open} delimiter — add closing {close}",
    diagChemDisabled: "Chemistry commands (\\ce, \\pu) are disabled in settings.",
    diagFormulaPrefix: "Formula #{n}:",
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
    composerPreviewLabel: "Vista previa al redactar",
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
    previewTitle: "Vista previa LaTeX",
    previewCloseTooltip: "Ocultar vista previa",
    previewReadySingular: "1 fórmula lista",
    previewReadyPlural: "{n} fórmulas listas",
    previewIssueSingular: "1 aviso",
    previewIssuePlural: "{n} avisos",
    diagUnclosed: "Delimitador {open} sin cerrar — agregá {close}",
    diagChemDisabled: "Química (\\ce, \\pu) está desactivada en la configuración.",
    diagFormulaPrefix: "Fórmula #{n}:",
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
    composerPreviewLabel: "发帖实时预览",
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
    previewTitle: "LaTeX 实时预览",
    previewCloseTooltip: "隐藏预览",
    previewReadySingular: "1 个公式就绪",
    previewReadyPlural: "{n} 个公式就绪",
    previewIssueSingular: "1 个提示",
    previewIssuePlural: "{n} 个提示",
    diagUnclosed: "未闭合的 {open} 定界符 — 请补充 {close}",
    diagChemDisabled: "化学公式（\\ce, \\pu）已在设置中关闭。",
    diagFormulaPrefix: "公式 #{n}：",
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
