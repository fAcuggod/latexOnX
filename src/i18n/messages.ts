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
  autoBareLatexLabel: string;
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
  diagEmpty: string;
  diagTooLong: string;
  diagTooDeep: string;
  diagUnbalancedBraces: string;
  diagForbiddenCommand: string;
  diagFormulaPrefix: string;
  exportPngBtn: string;
  exportPngTooltip: string;
  exportPngBusy: string;
  exportPngCopied: string;
  exportPngSaved: string;
  exportPngError: string;
  suggestionsTitle: string;
  suggestionsHint: string;
  suggestionInsertBtn: string;
  plainMathBadge: string;
  convertLatexBtn: string;
  convertLatexTooltip: string;
  inlineDisplayTip: string;
  switchToInlineBtn: string;
  symbolBarLabel: string;
  launcherTooltip: string;
  catalogToggleBtn: string;
  catalogToggleTooltip: string;
  catalogTitle: string;
  catalogSearchPlaceholder: string;
  catalogEmpty: string;
  catBasics: string;
  catCalculus: string;
  catAlgebra: string;
  catPhysics: string;
  catProbability: string;
  catChemistry: string;
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
    bareLatexLabel: "Undelimited formulas",
    autoBareLatexLabel: "Auto-render undelimited",
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
    renderBareTooltip: "Render detected undelimited math or LaTeX in this post",
    showRawTooltip: "Restore original text",
    previewTitle: "LaTeX Preview",
    previewCloseTooltip: "Hide preview",
    previewReadySingular: "1 formula ready",
    previewReadyPlural: "{n} formulas ready",
    previewIssueSingular: "1 issue",
    previewIssuePlural: "{n} issues",
    diagUnclosed: "Unclosed {open} delimiter (missing {close}).",
    diagChemDisabled: "Chemistry commands (\\ce, \\pu) are disabled in settings.",
    diagEmpty: "Empty expression.",
    diagTooLong: "Exceeds the maximum allowed length.",
    diagTooDeep: "Brace nesting is too deep.",
    diagUnbalancedBraces: "Unbalanced braces.",
    diagForbiddenCommand: "Disallowed command: {cmd}.",
    diagFormulaPrefix: "Formula #{n}:",
    exportPngBtn: "PNG",
    exportPngTooltip: "Copy 3x PNG image to clipboard",
    exportPngBusy: "Exporting...",
    exportPngCopied: "PNG copied ✓",
    exportPngSaved: "PNG saved ✓",
    exportPngError: "Export failed",
    suggestionsTitle: "Formula suggestions",
    suggestionsHint: "Tab or click to insert",
    suggestionInsertBtn: "Insert",
    plainMathBadge: "Plain math",
    convertLatexBtn: "Convert to LaTeX",
    convertLatexTooltip: "Convert plain math to LaTeX (Tab)",
    inlineDisplayTip: "{raw} is in block mode (new line).",
    switchToInlineBtn: "Use inline \\(...\\)",
    symbolBarLabel: "Quick LaTeX symbols",
    launcherTooltip: "Open LaTeX formulas and symbols",
    catalogToggleBtn: "Catalog",
    catalogToggleTooltip: "Browse formulas and symbols",
    catalogTitle: "Formulas & Symbols",
    catalogSearchPlaceholder: "Search integral, fraction, limit, zeta...",
    catalogEmpty: "No matching formulas found.",
    catBasics: "Basics",
    catCalculus: "Calculus",
    catAlgebra: "Algebra",
    catPhysics: "Physics",
    catProbability: "Probability",
    catChemistry: "Chemistry",
    languageLabel: "Language",
  },
  es: {
    subtitle: "Matemática y química en x.com",
    toggleLabel: "Renderizado automático",
    statusActive: "Activo en x.com",
    statusPaused: "Pausado",
    optionsTitle: "Funciones",
    chemistryLabel: "Química (\\ce, \\pu)",
    bareLatexLabel: "Fórmulas sin delimitadores",
    autoBareLatexLabel: "Auto-renderizar sin delimitadores",
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
    renderBareTooltip: "Renderizar fórmulas matemáticas o LaTeX detectadas sin delimitadores",
    showRawTooltip: "Restaurar el texto original",
    previewTitle: "Vista previa LaTeX",
    previewCloseTooltip: "Ocultar vista previa",
    previewReadySingular: "1 fórmula lista",
    previewReadyPlural: "{n} fórmulas listas",
    previewIssueSingular: "1 aviso",
    previewIssuePlural: "{n} avisos",
    diagUnclosed: "Delimitador {open} sin cerrar (falta {close}).",
    diagChemDisabled: "Química (\\ce, \\pu) está desactivada en la configuración.",
    diagEmpty: "Expresión vacía.",
    diagTooLong: "Supera la longitud máxima permitida.",
    diagTooDeep: "Demasiados niveles de llaves anidadas.",
    diagUnbalancedBraces: "Llaves desbalanceadas.",
    diagForbiddenCommand: "Comando no permitido: {cmd}.",
    diagFormulaPrefix: "Fórmula #{n}:",
    exportPngBtn: "PNG",
    exportPngTooltip: "Copiar imagen PNG 3x al portapapeles",
    exportPngBusy: "Exportando...",
    exportPngCopied: "PNG copiado ✓",
    exportPngSaved: "PNG guardado ✓",
    exportPngError: "Error al exportar",
    suggestionsTitle: "Sugerencias de fórmulas",
    suggestionsHint: "Tab o clic para insertar",
    suggestionInsertBtn: "Insertar",
    plainMathBadge: "Matemática natural",
    convertLatexBtn: "Convertir a LaTeX",
    convertLatexTooltip: "Convertir a LaTeX (Tab)",
    inlineDisplayTip: "{raw} está en modo bloque (salta de línea).",
    switchToInlineBtn: "Pasar a en línea \\(...\\)",
    symbolBarLabel: "Símbolos rápidos de LaTeX",
    launcherTooltip: "Abrir fórmulas y símbolos LaTeX",
    catalogToggleBtn: "Catálogo",
    catalogToggleTooltip: "Explorar fórmulas y símbolos",
    catalogTitle: "Fórmulas y símbolos",
    catalogSearchPlaceholder: "Buscar integral, fracción, límite, zeta...",
    catalogEmpty: "No se encontraron fórmulas.",
    catBasics: "Básicos",
    catCalculus: "Cálculo",
    catAlgebra: "Álgebra",
    catPhysics: "Física",
    catProbability: "Probabilidad",
    catChemistry: "Química",
    languageLabel: "Idioma",
  },
  zh: {
    subtitle: "在 x.com 上渲染数学与化学公式",
    toggleLabel: "自动渲染",
    statusActive: "已在 x.com 启用",
    statusPaused: "已暂停",
    optionsTitle: "功能选项",
    chemistryLabel: "化学公式 (\\ce, \\pu)",
    bareLatexLabel: "无定界符公式",
    autoBareLatexLabel: "自动渲染无定界符公式",
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
    renderBareTooltip: "渲染此帖中检测到的无定界符数学或 LaTeX 公式",
    showRawTooltip: "恢复原始文本",
    previewTitle: "LaTeX 实时预览",
    previewCloseTooltip: "隐藏预览",
    previewReadySingular: "1 个公式就绪",
    previewReadyPlural: "{n} 个公式就绪",
    previewIssueSingular: "1 个提示",
    previewIssuePlural: "{n} 个提示",
    diagUnclosed: "未闭合的 {open} 定界符（缺少 {close}）。",
    diagChemDisabled: "化学公式（\\ce, \\pu）已在设置中关闭。",
    diagEmpty: "公式内容为空。",
    diagTooLong: "超出最大长度限制。",
    diagTooDeep: "大括号嵌套层级过深。",
    diagUnbalancedBraces: "大括号不匹配。",
    diagForbiddenCommand: "不允许使用的命令：{cmd}。",
    diagFormulaPrefix: "公式 #{n}：",
    exportPngBtn: "PNG",
    exportPngTooltip: "复制 3x 高清 PNG 图片到剪贴板",
    exportPngBusy: "导出中...",
    exportPngCopied: "已复制 PNG ✓",
    exportPngSaved: "已保存 PNG ✓",
    exportPngError: "导出失败",
    suggestionsTitle: "公式建议",
    suggestionsHint: "按 Tab 或点击插入",
    suggestionInsertBtn: "插入",
    plainMathBadge: "自然数学",
    convertLatexBtn: "转为 LaTeX",
    convertLatexTooltip: "转为 LaTeX 格式 (Tab)",
    inlineDisplayTip: "{raw} 为块级公式（会自动换行）。",
    switchToInlineBtn: "改为行内 \\(...\\)",
    symbolBarLabel: "常用 LaTeX 符号",
    launcherTooltip: "打开 LaTeX 公式与符号",
    catalogToggleBtn: "公式库",
    catalogToggleTooltip: "浏览公式与符号",
    catalogTitle: "公式与符号",
    catalogSearchPlaceholder: "搜索积分、分数、极限、欧拉...",
    catalogEmpty: "未找到匹配的公式。",
    catBasics: "基础",
    catCalculus: "微积分",
    catAlgebra: "代数",
    catPhysics: "物理",
    catProbability: "概率",
    catChemistry: "化学",
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
