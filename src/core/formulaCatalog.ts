import type { Locale } from "../i18n/messages.js";
import type { MathDisplayMode } from "./types.js";

export type FormulaCategory =
  | "calculus"
  | "algebra"
  | "physics"
  | "probability"
  | "chemistry"
  | "command";

export interface FormulaEntry {
  id: string;
  labels: Readonly<Record<Locale, string>>;
  /** Accent-free lowercase keywords/aliases across EN, ES, ZH, and LaTeX triggers. */
  keywords: readonly string[];
  /** Snippet inserted into the composer. */
  snippet: string;
  /** Clean KaTeX source rendered as a live miniature preview inside the suggestion row. */
  previewLatex: string;
  previewMode: MathDisplayMode;
  /** Optional cursor offset inside `snippet` (e.g., inside first `{}` placeholder). */
  cursorOffset?: number;
  category: FormulaCategory;
  /** True for named formulas eligible for ambient natural-phrase recognition (no `:` prefix). */
  ambientEligible?: boolean;
}

export interface AutocompleteContext {
  mode: "command" | "explicit" | "ambient";
  /** Normalized search query text. */
  query: string;
  /** Exact raw start index in `text` to replace when inserting. */
  replaceStart: number;
  /** Exact raw end index in `text` (usually `cursorPos`). */
  replaceEnd: number;
  /** True when the cursor is currently inside an unclosed math delimiter (`$$`, `\(`, `\[`). */
  insideMath: boolean;
}

export interface FormulaMatch {
  entry: FormulaEntry;
  score: number;
  replaceStart: number;
  replaceEnd: number;
  mode: AutocompleteContext["mode"];
  insideMath: boolean;
}

export const FORMULA_CATALOG: readonly FormulaEntry[] = [
  // --- Famous Named Formulas & Templates (EN / ES / ZH searchable) ---
  {
    id: "riemann-zeta",
    labels: {
      en: "Riemann zeta function",
      es: "Función zeta de Riemann",
      zh: "黎曼 Zeta 函数",
    },
    keywords: [
      "riemann zeta function",
      "riemann zeta",
      "funcion zeta de riemann",
      "funcion zeta",
      "zeta de riemann",
      "riemann",
      "黎曼zeta",
      "黎曼函数",
    ],
    snippet: "$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$",
    previewLatex: "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "euler-identity",
    labels: {
      en: "Euler's identity",
      es: "Identidad de Euler",
      zh: "欧拉恒等式",
    },
    keywords: [
      "euler identity",
      "eulers identity",
      "identidad de euler",
      "euler",
      "欧拉恒等式",
    ],
    snippet: "\\(e^{i\\pi} + 1 = 0\\)",
    previewLatex: "e^{i\\pi} + 1 = 0",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "euler-formula",
    labels: {
      en: "Euler's formula",
      es: "Fórmula de Euler",
      zh: "欧拉公式",
    },
    keywords: [
      "euler formula",
      "eulers formula",
      "formula de euler",
      "欧拉公式",
    ],
    snippet: "\\(e^{ix} = \\cos x + i\\sin x\\)",
    previewLatex: "e^{ix} = \\cos x + i\\sin x",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "quadratic-formula",
    labels: {
      en: "Quadratic formula",
      es: "Fórmula cuadrática (resolvente)",
      zh: "一元二次求根公式",
    },
    keywords: [
      "quadratic formula",
      "formula cuadratica",
      "ecuacion cuadratica",
      "resolvente",
      "bhaskara",
      "求根公式",
    ],
    snippet: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$",
    previewLatex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "pythagorean-theorem",
    labels: {
      en: "Pythagorean theorem",
      es: "Teorema de Pitágoras",
      zh: "勾股定理",
    },
    keywords: [
      "pythagorean theorem",
      "pythagoras",
      "teorema de pitagoras",
      "pitagoras",
      "勾股定理",
    ],
    snippet: "\\(a^2 + b^2 = c^2\\)",
    previewLatex: "a^2 + b^2 = c^2",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "basel-problem",
    labels: {
      en: "Basel problem",
      es: "Problema de Basilea",
      zh: "巴塞尔问题",
    },
    keywords: [
      "basel problem",
      "problema de basilea",
      "basilea",
      "巴塞尔问题",
    ],
    snippet: "$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$",
    previewLatex: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "gaussian-integral",
    labels: {
      en: "Gaussian integral",
      es: "Integral gaussiana",
      zh: "高斯积分",
    },
    keywords: [
      "gaussian integral",
      "integral gaussiana",
      "integral de gauss",
      "高斯积分",
    ],
    snippet: "$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}$$",
    previewLatex: "\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "derivative-definition",
    labels: {
      en: "Derivative definition",
      es: "Definición de derivada",
      zh: "导数定义",
    },
    keywords: [
      "derivative definition",
      "definicion de derivada",
      "derivada por definicion",
      "导数定义",
    ],
    snippet: "$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$",
    previewLatex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "fundamental-theorem-calculus",
    labels: {
      en: "Fundamental theorem of calculus",
      es: "Teorema fundamental del cálculo",
      zh: "微积分基本定理",
    },
    keywords: [
      "fundamental theorem of calculus",
      "teorema fundamental del calculo",
      "微积分基本定理",
    ],
    snippet: "$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$",
    previewLatex: "\\int_a^b f(x)\\,dx = F(b) - F(a)",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "taylor-series",
    labels: {
      en: "Taylor series",
      es: "Serie de Taylor",
      zh: "泰勒级数",
    },
    keywords: ["taylor series", "serie de taylor", "polinomio de taylor", "泰勒级数"],
    snippet: "$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x - a)^n$$",
    previewLatex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "fourier-transform",
    labels: {
      en: "Fourier transform",
      es: "Transformada de Fourier",
      zh: "傅里叶变换",
    },
    keywords: [
      "fourier transform",
      "transformada de fourier",
      "fourier",
      "傅里叶变换",
    ],
    snippet: "$$\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi i x \\xi}\\,dx$$",
    previewLatex: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)e^{-2\\pi i x \\xi}dx",
    previewMode: "inline",
    category: "calculus",
    ambientEligible: true,
  },
  {
    id: "normal-distribution",
    labels: {
      en: "Normal distribution",
      es: "Distribución normal",
      zh: "正态分布",
    },
    keywords: [
      "normal distribution",
      "gaussian distribution",
      "distribucion normal",
      "campana de gauss",
      "正态分布",
    ],
    snippet:
      "$$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}$$",
    previewLatex:
      "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}",
    previewMode: "inline",
    category: "probability",
    ambientEligible: true,
  },
  {
    id: "bayes-theorem",
    labels: {
      en: "Bayes' theorem",
      es: "Teorema de Bayes",
      zh: "贝叶斯定理",
    },
    keywords: [
      "bayes theorem",
      "teorema de bayes",
      "regla de bayes",
      "贝叶斯定理",
    ],
    snippet: "$$P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}$$",
    previewLatex: "P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}",
    previewMode: "inline",
    category: "probability",
    ambientEligible: true,
  },
  {
    id: "binomial-theorem",
    labels: {
      en: "Binomial theorem",
      es: "Binomio de Newton",
      zh: "二项式定理",
    },
    keywords: [
      "binomial theorem",
      "binomio de newton",
      "teorema del binomio",
      "二项式定理",
    ],
    snippet: "$$(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k$$",
    previewLatex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "cauchy-schwarz",
    labels: {
      en: "Cauchy-Schwarz inequality",
      es: "Desigualdad de Cauchy-Schwarz",
      zh: "柯西-施瓦茨不等式",
    },
    keywords: [
      "cauchy schwarz",
      "cauchy schwarz inequality",
      "desigualdad de cauchy schwarz",
      "柯西施瓦茨不等式",
    ],
    snippet: "$$|\\langle u, v \\rangle| \\le \\|u\\|\\,\\|v\\|$$",
    previewLatex: "|\\langle u, v \\rangle| \\le \\|u\\|\\|v\\|",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "shannon-entropy",
    labels: {
      en: "Shannon entropy",
      es: "Entropía de Shannon",
      zh: "香农熵",
    },
    keywords: ["shannon entropy", "entropia de shannon", "香农熵"],
    snippet: "$$H(X) = -\\sum_{i} p(x_i) \\log_2 p(x_i)$$",
    previewLatex: "H(X) = -\\sum_i p(x_i)\\log_2 p(x_i)",
    previewMode: "inline",
    category: "probability",
    ambientEligible: true,
  },
  {
    id: "softmax-function",
    labels: {
      en: "Softmax function",
      es: "Función Softmax",
      zh: "Softmax 函数",
    },
    keywords: ["softmax function", "funcion softmax", "softmax", "归一化指数函数"],
    snippet: "$$\\operatorname{softmax}(z_i) = \\frac{e^{z_i}}{\\sum_{j} e^{z_j}}$$",
    previewLatex: "\\operatorname{softmax}(z_i) = \\frac{e^{z_i}}{\\sum_j e^{z_j}}",
    previewMode: "inline",
    category: "probability",
    ambientEligible: true,
  },
  {
    id: "schrodinger-equation",
    labels: {
      en: "Schrodinger equation",
      es: "Ecuación de Schrödinger",
      zh: "薛定谔方程",
    },
    keywords: [
      "schrodinger equation",
      "ecuacion de schrodinger",
      "schrodinger",
      "薛定谔方程",
    ],
    snippet: "$$i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi$$",
    previewLatex: "i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi",
    previewMode: "inline",
    category: "physics",
    ambientEligible: true,
  },
  {
    id: "heisenberg-uncertainty",
    labels: {
      en: "Heisenberg uncertainty principle",
      es: "Principio de incertidumbre",
      zh: "海森堡不确定性原理",
    },
    keywords: [
      "heisenberg uncertainty",
      "uncertainty principle",
      "principio de incertidumbre",
      "heisenberg",
      "不确定性原理",
    ],
    snippet: "$$\\Delta x\\,\\Delta p \\ge \\frac{\\hbar}{2}$$",
    previewLatex: "\\Delta x\\,\\Delta p \\ge \\frac{\\hbar}{2}",
    previewMode: "inline",
    category: "physics",
    ambientEligible: true,
  },
  {
    id: "mass-energy",
    labels: {
      en: "Mass-energy equivalence",
      es: "Equivalencia masa-energía",
      zh: "质能方程",
    },
    keywords: [
      "mass energy equivalence",
      "equivalencia masa energia",
      "einstein",
      "质能方程",
    ],
    snippet: "\\(E = mc^2\\)",
    previewLatex: "E = mc^2",
    previewMode: "inline",
    category: "physics",
    ambientEligible: true,
  },
  {
    id: "ideal-gas-law",
    labels: {
      en: "Ideal gas law",
      es: "Ley de gases ideales",
      zh: "理想气体状态方程",
    },
    keywords: [
      "ideal gas law",
      "ley de gases ideales",
      "gases ideales",
      "理想气体状态方程",
    ],
    snippet: "\\(PV = nRT\\)",
    previewLatex: "PV = nRT",
    previewMode: "inline",
    category: "physics",
    ambientEligible: true,
  },
  {
    id: "maxwell-gauss",
    labels: {
      en: "Gauss's law (Maxwell)",
      es: "Ley de Gauss (Maxwell)",
      zh: "高斯定律（麦克斯韦）",
    },
    keywords: ["gauss law", "ley de gauss", "maxwell", "麦克斯韦方程", "高斯定律"],
    snippet: "$$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$$",
    previewLatex: "\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}",
    previewMode: "inline",
    category: "physics",
    ambientEligible: true,
  },
  {
    id: "navier-stokes",
    labels: {
      en: "Navier-Stokes equation",
      es: "Ecuación de Navier-Stokes",
      zh: "纳维-斯托克斯方程",
    },
    keywords: [
      "navier stokes",
      "ecuacion de navier stokes",
      "navier stokes equation",
      "纳维斯托克斯方程",
    ],
    snippet:
      "$$\\rho\\left(\\frac{\\partial \\mathbf{u}}{\\partial t} + \\mathbf{u}\\cdot\\nabla\\mathbf{u}\\right) = -\\nabla p + \\mu\\nabla^2\\mathbf{u} + \\mathbf{f}$$",
    previewLatex:
      "\\rho(\\partial_t \\mathbf{u} + \\mathbf{u}\\cdot\\nabla\\mathbf{u}) = -\\nabla p + \\mu\\nabla^2\\mathbf{u}",
    previewMode: "inline",
    category: "physics",
    ambientEligible: true,
  },
  {
    id: "matrix-2x2",
    labels: {
      en: "2x2 Matrix template",
      es: "Matriz 2x2",
      zh: "2x2 矩阵模板",
    },
    keywords: ["matrix 2x2", "2x2 matrix", "matriz 2x2", "二阶矩阵", "矩阵"],
    snippet: "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$",
    previewLatex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "piecewise-function",
    labels: {
      en: "Piecewise function",
      es: "Función por partes",
      zh: "分段函数",
    },
    keywords: [
      "piecewise function",
      "funcion por partes",
      "funcion a trozos",
      "分段函数",
    ],
    snippet:
      "$$f(x) = \\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}$$",
    previewLatex:
      "f(x) = \\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}",
    previewMode: "inline",
    category: "algebra",
    ambientEligible: true,
  },
  {
    id: "photosynthesis",
    labels: {
      en: "Photosynthesis reaction",
      es: "Reacción de fotosíntesis",
      zh: "光合作用反应式",
    },
    keywords: ["photosynthesis", "fotosintesis", "光合作用"],
    snippet: "$$\\ce{6 CO2 + 6 H2O -> C6H12O6 + 6 O2}$$",
    previewLatex: "\\ce{6 CO2 + 6 H2O -> C6H12O6 + 6 O2}",
    previewMode: "inline",
    category: "chemistry",
    ambientEligible: true,
  },
  {
    id: "boudouard-equilibrium",
    labels: {
      en: "Chemical equilibrium",
      es: "Equilibrio químico",
      zh: "化学平衡反应",
    },
    keywords: [
      "chemical equilibrium",
      "equilibrio quimico",
      "reaccion reversible",
      "化学平衡",
    ],
    snippet: "$$\\ce{CO2 + C <=> 2 CO}$$",
    previewLatex: "\\ce{CO2 + C <=> 2 CO}",
    previewMode: "inline",
    category: "chemistry",
    ambientEligible: true,
  },

  // --- LaTeX Command Templates (triggered via `\...` or `:...`) ---
  {
    id: "cmd-frac",
    labels: { en: "Fraction", es: "Fracción", zh: "分数" },
    keywords: ["\\frac", "frac", "fraction", "fraccion", "分数"],
    snippet: "\\frac{}{}",
    previewLatex: "\\frac{a}{b}",
    previewMode: "inline",
    cursorOffset: 6,
    category: "command",
  },
  {
    id: "cmd-sqrt",
    labels: { en: "Square root", es: "Raíz cuadrada", zh: "平方根" },
    keywords: ["\\sqrt", "sqrt", "square root", "raiz", "平方根"],
    snippet: "\\sqrt{}",
    previewLatex: "\\sqrt{x}",
    previewMode: "inline",
    cursorOffset: 6,
    category: "command",
  },
  {
    id: "cmd-sum",
    labels: { en: "Summation", es: "Sumatoria", zh: "求和" },
    keywords: ["\\sum", "sum", "summation", "sumatoria", "求和"],
    snippet: "\\sum_{n=1}^{\\infty} ",
    previewLatex: "\\sum_{n=1}^{\\infty}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-int",
    labels: { en: "Definite integral", es: "Integral definida", zh: "定积分" },
    keywords: ["\\int", "int", "integral", "积分"],
    snippet: "\\int_{a}^{b} \\,dx",
    previewLatex: "\\int_a^b f(x)\\,dx",
    previewMode: "inline",
    cursorOffset: 13,
    category: "command",
  },
  {
    id: "cmd-lim",
    labels: { en: "Limit", es: "Límite", zh: "极限" },
    keywords: ["\\lim", "lim", "limit", "limite", "极限"],
    snippet: "\\lim_{x \\to 0} ",
    previewLatex: "\\lim_{x \\to 0}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-prod",
    labels: { en: "Product", es: "Productoria", zh: "连乘" },
    keywords: ["\\prod", "prod", "product", "productoria", "连乘"],
    snippet: "\\prod_{i=1}^{n} ",
    previewLatex: "\\prod_{i=1}^{n}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-binom",
    labels: { en: "Binomial coefficient", es: "Coeficiente binomial", zh: "二项式系数" },
    keywords: ["\\binom", "binom", "combinatoria", "二项式系数"],
    snippet: "\\binom{}{}",
    previewLatex: "\\binom{n}{k}",
    previewMode: "inline",
    cursorOffset: 7,
    category: "command",
  },
  {
    id: "cmd-ce",
    labels: { en: "Chemistry formula (mhchem)", es: "Fórmula química (mhchem)", zh: "化学式 (mhchem)" },
    keywords: ["\\ce", "ce", "chemistry", "quimica", "agua", "water", "化学式"],
    snippet: "\\ce{}",
    previewLatex: "\\ce{H2O}",
    previewMode: "inline",
    cursorOffset: 4,
    category: "chemistry",
  },
  {
    id: "cmd-pu",
    labels: { en: "Physical unit (mhchem)", es: "Unidad física (mhchem)", zh: "物理单位 (mhchem)" },
    keywords: ["\\pu", "pu", "unit", "unidad", "物理单位"],
    snippet: "\\pu{}",
    previewLatex: "\\pu{9.8 m/s^2}",
    previewMode: "inline",
    cursorOffset: 4,
    category: "chemistry",
  },
  {
    id: "cmd-infty",
    labels: { en: "Infinity", es: "Infinito", zh: "无穷大" },
    keywords: ["\\infty", "infty", "infinity", "infinito", "无穷"],
    snippet: "\\infty",
    previewLatex: "\\infty",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-alpha",
    labels: { en: "Greek alpha", es: "Alfa griega", zh: "希腊字母 α" },
    keywords: ["\\alpha", "alpha", "alfa"],
    snippet: "\\alpha",
    previewLatex: "\\alpha",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-beta",
    labels: { en: "Greek beta", es: "Beta griega", zh: "希腊字母 β" },
    keywords: ["\\beta", "beta"],
    snippet: "\\beta",
    previewLatex: "\\beta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-gamma",
    labels: { en: "Greek gamma", es: "Gamma griega", zh: "希腊字母 γ" },
    keywords: ["\\gamma", "gamma"],
    snippet: "\\gamma",
    previewLatex: "\\gamma",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-delta",
    labels: { en: "Greek delta", es: "Delta griega", zh: "希腊字母 Δ" },
    keywords: ["\\delta", "\\Delta", "delta"],
    snippet: "\\Delta",
    previewLatex: "\\Delta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-theta",
    labels: { en: "Greek theta", es: "Theta griega", zh: "希腊字母 θ" },
    keywords: ["\\theta", "theta", "tita"],
    snippet: "\\theta",
    previewLatex: "\\theta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-lambda",
    labels: { en: "Greek lambda", es: "Lambda griega", zh: "希腊字母 λ" },
    keywords: ["\\lambda", "lambda"],
    snippet: "\\lambda",
    previewLatex: "\\lambda",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-pi",
    labels: { en: "Pi constant", es: "Constante Pi", zh: "圆周率 π" },
    keywords: ["\\pi", "pi"],
    snippet: "\\pi",
    previewLatex: "\\pi",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-sigma",
    labels: { en: "Greek sigma", es: "Sigma griega", zh: "希腊字母 σ" },
    keywords: ["\\sigma", "sigma"],
    snippet: "\\sigma",
    previewLatex: "\\sigma",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-omega",
    labels: { en: "Greek omega", es: "Omega griega", zh: "希腊字母 ω" },
    keywords: ["\\omega", "omega"],
    snippet: "\\omega",
    previewLatex: "\\omega",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-zeta",
    labels: { en: "Greek zeta", es: "Zeta griega", zh: "希腊字母 ζ" },
    keywords: ["\\zeta", "zeta"],
    snippet: "\\zeta",
    previewLatex: "\\zeta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-partial",
    labels: { en: "Partial derivative", es: "Derivada parcial", zh: "偏导符号" },
    keywords: ["\\partial", "partial", "parcial"],
    snippet: "\\partial",
    previewLatex: "\\partial",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-nabla",
    labels: { en: "Nabla / Gradient", es: "Nabla / Gradiente", zh: "梯度算子" },
    keywords: ["\\nabla", "nabla", "gradient", "gradiente"],
    snippet: "\\nabla",
    previewLatex: "\\nabla",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-forall",
    labels: { en: "For all", es: "Para todo", zh: "全称量词" },
    keywords: ["\\forall", "forall", "para todo"],
    snippet: "\\forall ",
    previewLatex: "\\forall x",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-exists",
    labels: { en: "There exists", es: "Existe", zh: "存在量词" },
    keywords: ["\\exists", "exists", "existe"],
    snippet: "\\exists ",
    previewLatex: "\\exists x",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-mathbb-r",
    labels: { en: "Real numbers R", es: "Números reales R", zh: "实数集 R" },
    keywords: ["\\mathbb", "mathbb", "reals", "reales", "实数"],
    snippet: "\\mathbb{R}",
    previewLatex: "\\mathbb{R}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-vec",
    labels: { en: "Vector arrow", es: "Vector", zh: "向量" },
    keywords: ["\\vec", "vec", "vector", "向量"],
    snippet: "\\vec{}",
    previewLatex: "\\vec{v}",
    previewMode: "inline",
    cursorOffset: 5,
    category: "command",
  },
];

/**
 * Strips Unicode combining accents/diacritics, lowercases, and collapses whitespace
 * so `"Función Zeta de Riemann"` matches `"funcion zeta de riemann"`.
 */
export function normalizeQuery(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether the cursor offset `cursorPos` lies inside an open math delimiter
 * (`$$...`, `\(...`, `\[...`).
 */
export function isCursorInsideMath(text: string, cursorPos: number): boolean {
  const prefix = text.slice(0, Math.max(0, Math.min(cursorPos, text.length)));
  let i = 0;

  while (i < prefix.length) {
    let closeDelim: string | null = null;
    if (prefix.startsWith("$$", i)) {
      closeDelim = "$$";
      i += 2;
    } else if (prefix.startsWith("\\[", i)) {
      closeDelim = "\\]";
      i += 2;
    } else if (prefix.startsWith("\\(", i)) {
      closeDelim = "\\)";
      i += 2;
    } else {
      i += 1;
      continue;
    }

    const closeIdx = prefix.indexOf(closeDelim, i);
    if (closeIdx === -1) {
      return true;
    }
    i = closeIdx + closeDelim.length;
  }

  return false;
}

/**
 * Inspects the draft text immediately before `cursorPos` and extracts an active
 * autocomplete context (`command` for `\...`, `explicit` for `:query`, or `ambient`
 * for trailing natural-language formula phrases).
 */
export function extractAutocompleteContext(
  text: string,
  cursorPos: number
): AutocompleteContext | null {
  const safeCursor = Math.max(0, Math.min(cursorPos, text.length));
  if (safeCursor === 0) return null;

  const before = text.slice(0, safeCursor);
  const insideMath = isCursorInsideMath(text, safeCursor);

  // 1. LaTeX command trigger: `\fr`, `\sum`, `\ce` (ignoring `\\cmd` line breaks)
  const cmdMatch = before.match(/(^|[^\\])(\\[a-zA-Z]{1,20})$/);
  if (cmdMatch) {
    const rawCmd = cmdMatch[2];
    const replaceStart = safeCursor - rawCmd.length;
    return {
      mode: "command",
      query: rawCmd.toLowerCase(),
      replaceStart,
      replaceEnd: safeCursor,
      insideMath,
    };
  }

  // 2. Explicit natural trigger: `:riemann`, `:cuadratica`, `:matriz`
  if (!insideMath) {
    const explicitMatch = before.match(/(?:^|[\s(\n])(:([^\s:][^:\n]{1,36}))$/);
    if (explicitMatch) {
      const fullToken = explicitMatch[1];
      const rawQuery = explicitMatch[2];
      const normalized = normalizeQuery(rawQuery);
      if (normalized.length >= 2) {
        return {
          mode: "explicit",
          query: normalized,
          replaceStart: safeCursor - fullToken.length,
          replaceEnd: safeCursor,
          insideMath: false,
        };
      }
    }

    // 3. Ambient natural phrase right before cursor (outside math delimiters)
    const clauseMatch = before.match(/([^\n.!?,;()[\]{}$\\]{4,50})$/);
    if (clauseMatch) {
      const rawClause = clauseMatch[1];
      const normalized = normalizeQuery(rawClause);
      if (normalized.length >= 4) {
        return {
          mode: "ambient",
          query: rawClause,
          replaceStart: safeCursor - rawClause.length,
          replaceEnd: safeCursor,
          insideMath: false,
        };
      }
    }
  }

  return null;
}

/**
 * Returns the start index in `rawClause` corresponding to the trailing `wordCount`
 * whitespace-separated words (preserving exact indices even with accents/spaces).
 */
function findTrailingPhraseStart(rawClause: string, wordCount: number): number {
  let end = rawClause.length;
  while (end > 0 && /\s/.test(rawClause[end - 1])) {
    end -= 1;
  }
  if (end === 0) return -1;

  let wordsSeen = 0;
  let i = end;
  while (i > 0) {
    while (i > 0 && !/\s/.test(rawClause[i - 1])) {
      i -= 1;
    }
    wordsSeen += 1;
    if (wordsSeen === wordCount) {
      return i;
    }
    while (i > 0 && /\s/.test(rawClause[i - 1])) {
      i -= 1;
    }
  }

  return -1;
}

/**
 * Searches `FORMULA_CATALOG` for the given `AutocompleteContext` and returns
 * ranked suggestions with exact replacement spans.
 */
export function searchFormulaCatalog(
  context: AutocompleteContext,
  locale: Locale = "en",
  maxResults = 5
): FormulaMatch[] {
  const results: FormulaMatch[] = [];

  if (context.mode === "command") {
    const q = context.query;
    for (const entry of FORMULA_CATALOG) {
      if (entry.category !== "command" && entry.category !== "chemistry") {
        continue;
      }
      let score = 0;
      const snipLower = entry.snippet.toLowerCase();
      if (snipLower.startsWith(q)) {
        score = snipLower === q ? 120 : 100;
      } else {
        for (const kw of entry.keywords) {
          const kwLower = kw.toLowerCase();
          if (kwLower === q) {
            score = Math.max(score, 120);
          } else if (kwLower.startsWith(q)) {
            score = Math.max(score, 95);
          }
        }
      }

      if (score > 0) {
        results.push({
          entry,
          score,
          replaceStart: context.replaceStart,
          replaceEnd: context.replaceEnd,
          mode: "command",
          insideMath: context.insideMath,
        });
      }
    }
  } else if (context.mode === "explicit") {
    const q = context.query;
    const tokens = q.split(" ").filter(Boolean);

    for (const entry of FORMULA_CATALOG) {
      const labelNorm = normalizeQuery(entry.labels[locale]);
      let score = 0;

      if (labelNorm === q) {
        score = 130;
      } else if (labelNorm.startsWith(q)) {
        score = 105;
      } else if (labelNorm.split(" ").some((w) => w.startsWith(q))) {
        score = 92;
      } else if (labelNorm.includes(q)) {
        score = 80;
      }

      for (const kw of entry.keywords) {
        const kwNorm = normalizeQuery(kw);
        if (kwNorm === q) {
          score = Math.max(score, 125);
        } else if (kwNorm.startsWith(q)) {
          score = Math.max(score, 100);
        } else if (kwNorm.split(" ").some((w) => w.startsWith(q))) {
          score = Math.max(score, 90);
        } else if (kwNorm.includes(q)) {
          score = Math.max(score, 75);
        } else if (
          tokens.length > 1 &&
          tokens.every((tok) => kwNorm.includes(tok) || labelNorm.includes(tok))
        ) {
          score = Math.max(score, 70);
        }
      }

      if (score > 0) {
        // Slightly prefer full named formulas over raw command templates on ties in `:query` mode
        const tieBoost = entry.ambientEligible ? 2 : 0;
        results.push({
          entry,
          score: score + tieBoost,
          replaceStart: context.replaceStart,
          replaceEnd: context.replaceEnd,
          mode: "explicit",
          insideMath: false,
        });
      }
    }
  } else {
    // Ambient mode: high-precision match on the trailing 1..5 words (zero prose spam)
    const rawClause = context.query;
    const clauseOffset = context.replaceStart;

    // Evaluate longest trailing phrase first (5 words down to 1 word)
    const candidates: Array<{ phraseNorm: string; startInText: number }> = [];
    for (let wordCount = 5; wordCount >= 1; wordCount -= 1) {
      const relStart = findTrailingPhraseStart(rawClause, wordCount);
      if (relStart === -1) continue;
      const rawSlice = rawClause.slice(relStart);
      // Do not trigger while user already moved past the phrase with trailing spaces
      if (/\s$/.test(rawSlice)) continue;
      const phraseNorm = normalizeQuery(rawSlice);
      if (phraseNorm.length >= 4) {
        candidates.push({ phraseNorm, startInText: clauseOffset + relStart });
      }
    }

    for (const entry of FORMULA_CATALOG) {
      if (!entry.ambientEligible) continue;

      let bestScore = 0;
      let bestStart = context.replaceStart;

      for (const cand of candidates) {
        const p = cand.phraseNorm;
        for (const kw of entry.keywords) {
          const kwNorm = normalizeQuery(kw);
          // Exact keyword match (works for CJK >= 3 chars or Latin >= 5 chars, e.g. "riemann", "欧拉公式")
          if (kwNorm === p) {
            const s = 130 + p.length;
            if (s > bestScore) {
              bestScore = s;
              bestStart = cand.startInText;
            }
          } else if (p.length >= 6 && kwNorm.startsWith(p)) {
            // High-specificity prefix match (e.g. "funcion zeta", "teorema de pita", "formula cuad")
            const s = 90 + p.length;
            if (s > bestScore) {
              bestScore = s;
              bestStart = cand.startInText;
            }
          }
        }
      }

      if (bestScore > 0) {
        results.push({
          entry,
          score: bestScore,
          replaceStart: bestStart,
          replaceEnd: context.replaceEnd,
          mode: "ambient",
          insideMath: false,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return results.slice(0, maxResults);
}

/**
 * Pure text replacement helper: inserts the selected catalog entry at
 * `[match.replaceStart, match.replaceEnd]` and computes the ideal next cursor position.
 *
 * When inserting a bare LaTeX command (e.g., `\frac{}{}`) outside math delimiters,
 * automatically wraps it in inline `\(...\)` so X renders it cleanly.
 */
export function applyFormulaInsertion(
  text: string,
  match: FormulaMatch
): { text: string; cursorPos: number; inserted: string } {
  const { entry, replaceStart, replaceEnd, mode, insideMath } = match;

  let inserted = entry.snippet;
  let relativeCursor = entry.cursorOffset ?? inserted.length;

  const isBareCommand =
    (entry.category === "command" ||
      (entry.category === "chemistry" && entry.snippet.startsWith("\\"))) &&
    !inserted.startsWith("$$") &&
    !inserted.startsWith("\\(") &&
    !inserted.startsWith("\\[");

  if ((mode === "command" || mode === "explicit") && isBareCommand && !insideMath) {
    inserted = `\\(${inserted}\\)`;
    relativeCursor =
      entry.cursorOffset !== undefined ? 2 + entry.cursorOffset : inserted.length;
  }

  const nextText =
    text.slice(0, replaceStart) + inserted + text.slice(replaceEnd);
  const cursorPos = replaceStart + relativeCursor;

  return { text: nextText, cursorPos, inserted };
}
