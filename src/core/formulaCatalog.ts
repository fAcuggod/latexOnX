import { SUPPORTED_LOCALES, type Locale } from "../i18n/messages.js";
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
  /** Accent-free lowercase keywords/aliases scoped by locale (EN / ES / ZH). */
  keywords: Readonly<Record<Locale, readonly string[]>>;
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
  // --- Named Formulas & Templates (locale-scoped EN / ES / ZH) ---
  {
    id: "riemann-zeta",
    labels: {
      en: "Riemann zeta function",
      es: "Función zeta de Riemann",
      zh: "黎曼 Zeta 函数",
    },
    keywords: {
      en: ["riemann zeta function", "riemann zeta", "zeta function", "riemann"],
      es: ["funcion zeta de riemann", "funcion zeta", "zeta de riemann", "riemann"],
      zh: ["黎曼zeta函数", "黎曼zeta", "黎曼函数", "zeta函数"],
    },
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
    keywords: {
      en: ["euler identity", "eulers identity", "euler"],
      es: ["identidad de euler", "euler"],
      zh: ["欧拉恒等式", "欧拉"],
    },
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
    keywords: {
      en: ["euler formula", "eulers formula"],
      es: ["formula de euler"],
      zh: ["欧拉公式"],
    },
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
    keywords: {
      en: ["quadratic formula", "quadratic equation"],
      es: ["formula cuadratica", "ecuacion cuadratica", "resolvente", "bhaskara"],
      zh: ["一元二次求根公式", "求根公式", "二次方程"],
    },
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
    keywords: {
      en: ["pythagorean theorem", "pythagoras"],
      es: ["teorema de pitagoras", "pitagoras"],
      zh: ["勾股定理", "毕达哥拉斯定理"],
    },
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
    keywords: {
      en: ["basel problem", "basel"],
      es: ["problema de basilea", "basilea"],
      zh: ["巴塞尔问题"],
    },
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
    keywords: {
      en: ["gaussian integral", "gauss integral"],
      es: ["integral gaussiana", "integral de gauss"],
      zh: ["高斯积分"],
    },
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
    keywords: {
      en: ["derivative definition", "definition of derivative"],
      es: ["definicion de derivada", "derivada por definicion"],
      zh: ["导数定义"],
    },
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
    keywords: {
      en: ["fundamental theorem of calculus", "fundamental theorem"],
      es: ["teorema fundamental del calculo", "teorema fundamental"],
      zh: ["微积分基本定理"],
    },
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
    keywords: {
      en: ["taylor series", "taylor polynomial", "taylor"],
      es: ["serie de taylor", "polinomio de taylor", "taylor"],
      zh: ["泰勒级数", "泰勒展开"],
    },
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
    keywords: {
      en: ["fourier transform", "fourier"],
      es: ["transformada de fourier", "fourier"],
      zh: ["傅里叶变换"],
    },
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
    keywords: {
      en: ["normal distribution", "gaussian distribution"],
      es: ["distribucion normal", "campana de gauss"],
      zh: ["正态分布", "高斯分布"],
    },
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
    keywords: {
      en: ["bayes theorem", "bayes rule"],
      es: ["teorema de bayes", "regla de bayes"],
      zh: ["贝叶斯定理", "贝叶斯公式"],
    },
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
    keywords: {
      en: ["binomial theorem", "binomial expansion"],
      es: ["binomio de newton", "teorema del binomio"],
      zh: ["二项式定理"],
    },
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
    keywords: {
      en: ["cauchy schwarz inequality", "cauchy schwarz"],
      es: ["desigualdad de cauchy schwarz", "cauchy schwarz"],
      zh: ["柯西施瓦茨不等式", "柯西不等式"],
    },
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
    keywords: {
      en: ["shannon entropy", "information entropy"],
      es: ["entropia de shannon", "entropia"],
      zh: ["香农熵", "信息熵"],
    },
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
    keywords: {
      en: ["softmax function", "softmax"],
      es: ["funcion softmax", "softmax"],
      zh: ["softmax函数", "归一化指数函数"],
    },
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
    keywords: {
      en: ["schrodinger equation", "schrodinger"],
      es: ["ecuacion de schrodinger", "schrodinger"],
      zh: ["薛定谔方程"],
    },
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
    keywords: {
      en: ["heisenberg uncertainty", "uncertainty principle", "heisenberg"],
      es: ["principio de incertidumbre", "incertidumbre de heisenberg", "heisenberg"],
      zh: ["海森堡不确定性原理", "不确定性原理"],
    },
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
    keywords: {
      en: ["mass energy equivalence", "mass energy", "einstein"],
      es: ["equivalencia masa energia", "masa energia", "einstein"],
      zh: ["质能方程", "爱因斯坦质能方程"],
    },
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
    keywords: {
      en: ["ideal gas law", "ideal gas"],
      es: ["ley de gases ideales", "gases ideales"],
      zh: ["理想气体状态方程", "理想气体方程"],
    },
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
    keywords: {
      en: ["gauss law", "maxwell equations", "maxwell"],
      es: ["ley de gauss", "ecuaciones de maxwell", "maxwell"],
      zh: ["高斯定律", "麦克斯韦方程"],
    },
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
    keywords: {
      en: ["navier stokes equation", "navier stokes"],
      es: ["ecuacion de navier stokes", "navier stokes"],
      zh: ["纳维斯托克斯方程"],
    },
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
    keywords: {
      en: ["matrix 2x2", "2x2 matrix"],
      es: ["matriz 2x2"],
      zh: ["二阶矩阵", "矩阵模板", "矩阵"],
    },
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
    keywords: {
      en: ["piecewise function", "piecewise"],
      es: ["funcion por partes", "funcion a trozos"],
      zh: ["分段函数"],
    },
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
    keywords: {
      en: ["photosynthesis reaction", "photosynthesis"],
      es: ["reaccion de fotosintesis", "fotosintesis"],
      zh: ["光合作用反应式", "光合作用"],
    },
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
    keywords: {
      en: ["chemical equilibrium", "reversible reaction"],
      es: ["equilibrio quimico", "reaccion reversible"],
      zh: ["化学平衡反应", "化学平衡"],
    },
    snippet: "$$\\ce{CO2 + C <=> 2 CO}$$",
    previewLatex: "\\ce{CO2 + C <=> 2 CO}",
    previewMode: "inline",
    category: "chemistry",
    ambientEligible: true,
  },

  // --- LaTeX Command Templates (triggered via `\...`, `:...`, or Explorer) ---
  {
    id: "cmd-frac",
    labels: { en: "Fraction", es: "Fracción", zh: "分数" },
    keywords: {
      en: ["\\frac", "frac", "fraction"],
      es: ["\\frac", "frac", "fraccion"],
      zh: ["\\frac", "frac", "分数"],
    },
    snippet: "\\frac{}{}",
    previewLatex: "\\frac{a}{b}",
    previewMode: "inline",
    cursorOffset: 6,
    category: "command",
  },
  {
    id: "cmd-sqrt",
    labels: { en: "Square root", es: "Raíz cuadrada", zh: "平方根" },
    keywords: {
      en: ["\\sqrt", "sqrt", "square root", "root"],
      es: ["\\sqrt", "sqrt", "raiz cuadrada", "raiz"],
      zh: ["\\sqrt", "sqrt", "平方根", "根号"],
    },
    snippet: "\\sqrt{}",
    previewLatex: "\\sqrt{x}",
    previewMode: "inline",
    cursorOffset: 6,
    category: "command",
  },
  {
    id: "cmd-sum",
    labels: { en: "Summation", es: "Sumatoria", zh: "求和" },
    keywords: {
      en: ["\\sum", "sum", "summation"],
      es: ["\\sum", "sum", "sumatoria"],
      zh: ["\\sum", "sum", "求和"],
    },
    snippet: "\\sum_{n=1}^{\\infty} ",
    previewLatex: "\\sum_{n=1}^{\\infty}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-int",
    labels: { en: "Definite integral", es: "Integral definida", zh: "定积分" },
    keywords: {
      en: ["\\int", "int", "integral", "definite integral"],
      es: ["\\int", "int", "integral", "integral definida"],
      zh: ["\\int", "int", "定积分", "积分"],
    },
    snippet: "\\int_{a}^{b} \\,dx",
    previewLatex: "\\int_a^b f(x)\\,dx",
    previewMode: "inline",
    cursorOffset: 13,
    category: "command",
  },
  {
    id: "cmd-int-indef",
    labels: { en: "Indefinite integral", es: "Integral indefinida", zh: "不定积分" },
    keywords: {
      en: ["\\int", "int", "integral", "indefinite integral"],
      es: ["\\int", "int", "integral", "integral indefinida"],
      zh: ["\\int", "int", "不定积分", "积分"],
    },
    snippet: "\\int \\,dx",
    previewLatex: "\\int f(x)\\,dx",
    previewMode: "inline",
    cursorOffset: 5,
    category: "command",
  },
  {
    id: "cmd-deriv",
    labels: { en: "Derivative", es: "Derivada", zh: "导数" },
    keywords: {
      en: ["deriv", "derivative", "d/dx"],
      es: ["deriv", "derivada", "d/dx"],
      zh: ["deriv", "导数", "d/dx"],
    },
    snippet: "\\frac{d}{dx} ",
    previewLatex: "\\frac{d}{dx} f(x)",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-lim",
    labels: { en: "Limit", es: "Límite", zh: "极限" },
    keywords: {
      en: ["\\lim", "lim", "limit"],
      es: ["\\lim", "lim", "limite"],
      zh: ["\\lim", "lim", "极限"],
    },
    snippet: "\\lim_{x \\to 0} ",
    previewLatex: "\\lim_{x \\to 0}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-prod",
    labels: { en: "Product", es: "Productoria", zh: "连乘" },
    keywords: {
      en: ["\\prod", "prod", "product"],
      es: ["\\prod", "prod", "productoria"],
      zh: ["\\prod", "prod", "连乘"],
    },
    snippet: "\\prod_{i=1}^{n} ",
    previewLatex: "\\prod_{i=1}^{n}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-binom",
    labels: { en: "Binomial coefficient", es: "Coeficiente binomial", zh: "二项式系数" },
    keywords: {
      en: ["\\binom", "binom", "binomial", "choose"],
      es: ["\\binom", "binom", "combinatoria", "binomial"],
      zh: ["\\binom", "binom", "二项式系数", "组合数"],
    },
    snippet: "\\binom{}{}",
    previewLatex: "\\binom{n}{k}",
    previewMode: "inline",
    cursorOffset: 7,
    category: "command",
  },
  {
    id: "cmd-ce",
    labels: { en: "Chemistry formula (mhchem)", es: "Fórmula química (mhchem)", zh: "化学式 (mhchem)" },
    keywords: {
      en: ["\\ce", "ce", "chemistry", "water"],
      es: ["\\ce", "ce", "quimica", "agua"],
      zh: ["\\ce", "ce", "化学式", "化学"],
    },
    snippet: "\\ce{}",
    previewLatex: "\\ce{H2O}",
    previewMode: "inline",
    cursorOffset: 4,
    category: "chemistry",
  },
  {
    id: "cmd-pu",
    labels: { en: "Physical unit (mhchem)", es: "Unidad física (mhchem)", zh: "物理单位 (mhchem)" },
    keywords: {
      en: ["\\pu", "pu", "unit"],
      es: ["\\pu", "pu", "unidad"],
      zh: ["\\pu", "pu", "物理单位", "单位"],
    },
    snippet: "\\pu{}",
    previewLatex: "\\pu{9.8 m/s^2}",
    previewMode: "inline",
    cursorOffset: 4,
    category: "chemistry",
  },
  {
    id: "cmd-infty",
    labels: { en: "Infinity", es: "Infinito", zh: "无穷大" },
    keywords: {
      en: ["\\infty", "infty", "infinity"],
      es: ["\\infty", "infty", "infinito"],
      zh: ["\\infty", "infty", "无穷", "无穷大"],
    },
    snippet: "\\infty",
    previewLatex: "\\infty",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-alpha",
    labels: { en: "Greek alpha", es: "Alfa griega", zh: "希腊字母 α" },
    keywords: {
      en: ["\\alpha", "alpha"],
      es: ["\\alpha", "alpha", "alfa"],
      zh: ["\\alpha", "alpha", "阿尔法"],
    },
    snippet: "\\alpha",
    previewLatex: "\\alpha",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-beta",
    labels: { en: "Greek beta", es: "Beta griega", zh: "希腊字母 β" },
    keywords: {
      en: ["\\beta", "beta"],
      es: ["\\beta", "beta"],
      zh: ["\\beta", "beta", "贝塔"],
    },
    snippet: "\\beta",
    previewLatex: "\\beta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-gamma",
    labels: { en: "Greek gamma", es: "Gamma griega", zh: "希腊字母 γ" },
    keywords: {
      en: ["\\gamma", "gamma"],
      es: ["\\gamma", "gamma"],
      zh: ["\\gamma", "gamma", "伽马"],
    },
    snippet: "\\gamma",
    previewLatex: "\\gamma",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-delta",
    labels: { en: "Greek delta", es: "Delta griega", zh: "希腊字母 Δ" },
    keywords: {
      en: ["\\delta", "\\Delta", "delta"],
      es: ["\\delta", "\\Delta", "delta"],
      zh: ["\\delta", "\\Delta", "delta", "德尔塔"],
    },
    snippet: "\\Delta",
    previewLatex: "\\Delta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-theta",
    labels: { en: "Greek theta", es: "Theta griega", zh: "希腊字母 θ" },
    keywords: {
      en: ["\\theta", "theta"],
      es: ["\\theta", "theta", "tita"],
      zh: ["\\theta", "theta", "西塔"],
    },
    snippet: "\\theta",
    previewLatex: "\\theta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-lambda",
    labels: { en: "Greek lambda", es: "Lambda griega", zh: "希腊字母 λ" },
    keywords: {
      en: ["\\lambda", "lambda"],
      es: ["\\lambda", "lambda"],
      zh: ["\\lambda", "lambda", "兰姆达"],
    },
    snippet: "\\lambda",
    previewLatex: "\\lambda",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-pi",
    labels: { en: "Pi constant", es: "Constante Pi", zh: "圆周率 π" },
    keywords: {
      en: ["\\pi", "pi"],
      es: ["\\pi", "pi"],
      zh: ["\\pi", "pi", "圆周率"],
    },
    snippet: "\\pi",
    previewLatex: "\\pi",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-sigma",
    labels: { en: "Greek sigma", es: "Sigma griega", zh: "希腊字母 σ" },
    keywords: {
      en: ["\\sigma", "sigma"],
      es: ["\\sigma", "sigma"],
      zh: ["\\sigma", "sigma", "西格玛"],
    },
    snippet: "\\sigma",
    previewLatex: "\\sigma",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-omega",
    labels: { en: "Greek omega", es: "Omega griega", zh: "希腊字母 ω" },
    keywords: {
      en: ["\\omega", "omega"],
      es: ["\\omega", "omega"],
      zh: ["\\omega", "omega", "欧米茄"],
    },
    snippet: "\\omega",
    previewLatex: "\\omega",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-zeta",
    labels: { en: "Greek zeta", es: "Zeta griega", zh: "希腊字母 ζ" },
    keywords: {
      en: ["\\zeta", "zeta"],
      es: ["\\zeta", "zeta"],
      zh: ["\\zeta", "zeta", "泽塔"],
    },
    snippet: "\\zeta",
    previewLatex: "\\zeta",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-partial",
    labels: { en: "Partial derivative", es: "Derivada parcial", zh: "偏导符号" },
    keywords: {
      en: ["\\partial", "partial"],
      es: ["\\partial", "partial", "parcial"],
      zh: ["\\partial", "partial", "偏导"],
    },
    snippet: "\\partial",
    previewLatex: "\\partial",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-nabla",
    labels: { en: "Nabla / Gradient", es: "Nabla / Gradiente", zh: "梯度算子" },
    keywords: {
      en: ["\\nabla", "nabla", "gradient"],
      es: ["\\nabla", "nabla", "gradiente"],
      zh: ["\\nabla", "nabla", "梯度"],
    },
    snippet: "\\nabla",
    previewLatex: "\\nabla",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-forall",
    labels: { en: "For all", es: "Para todo", zh: "全称量词" },
    keywords: {
      en: ["\\forall", "forall", "for all"],
      es: ["\\forall", "forall", "para todo"],
      zh: ["\\forall", "forall", "全称量词", "任意"],
    },
    snippet: "\\forall ",
    previewLatex: "\\forall x",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-exists",
    labels: { en: "There exists", es: "Existe", zh: "存在量词" },
    keywords: {
      en: ["\\exists", "exists", "there exists"],
      es: ["\\exists", "exists", "existe"],
      zh: ["\\exists", "exists", "存在量词", "存在"],
    },
    snippet: "\\exists ",
    previewLatex: "\\exists x",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-mathbb-r",
    labels: { en: "Real numbers R", es: "Números reales R", zh: "实数集 R" },
    keywords: {
      en: ["\\mathbb", "mathbb", "reals", "real numbers"],
      es: ["\\mathbb", "mathbb", "reales", "numeros reales"],
      zh: ["\\mathbb", "mathbb", "实数", "实数集"],
    },
    snippet: "\\mathbb{R}",
    previewLatex: "\\mathbb{R}",
    previewMode: "inline",
    category: "command",
  },
  {
    id: "cmd-vec",
    labels: { en: "Vector arrow", es: "Vector", zh: "向量" },
    keywords: {
      en: ["\\vec", "vec", "vector"],
      es: ["\\vec", "vec", "vector"],
      zh: ["\\vec", "vec", "向量"],
    },
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
    // Accepts >= 2 chars when CJK characters are present (e.g. "函数", "欧拉") or >= 4 chars for Latin scripts.
    const clauseMatch = before.match(
      /([^\n.!?,;()[\]{}$\\。，！？；（）]{2,50})$/
    );
    if (clauseMatch) {
      const rawClause = clauseMatch[1];
      const normalized = normalizeQuery(rawClause);
      const hasCjk = /[\u4e00-\u9fff]/.test(normalized);
      if (normalized.length >= 4 || (hasCjk && normalized.length >= 2)) {
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

const CJK_CHAR_RE = /[\u4e00-\u9fff]/;

/**
 * Common non-mathematical words that may appear inside multi-word formula titles
 * (e.g. "Basel problem", "Normal distribution") and must not trigger ambient
 * suggestions when typed alone.
 */
const AMBIENT_STOPWORDS = new Set([
  "problem",
  "problema",
  "normal",
  "definition",
  "definicion",
  "principle",
  "principio",
  "partes",
  "trozos",
  "campana",
  "ideales",
  "fundamental",
  "reversible",
  "chemical",
  "quimico",
  "energy",
  "energia",
  "reaction",
  "reaccion",
  "information",
  "定义",
  "原理",
  "作用",
  "状态",
  "信息",
  "理想",
]);

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
 * Extracts trailing phrase candidates for ambient matching:
 * - For whitespace-delimited languages (EN/ES): trailing 1..5 words.
 * - For CJK clauses ending in Chinese characters (ZH): also trailing 2..10 char suffixes
 *   so phrases like `"看看函数"` or `"看看黎曼函数"` match without requiring spaces.
 */
function extractAmbientCandidates(
  rawClause: string,
  clauseOffset: number
): Array<{ phraseNorm: string; startInText: number }> {
  const candidates: Array<{ phraseNorm: string; startInText: number }> = [];
  const seen = new Set<string>();

  const pushCandidate = (rawSlice: string, startInText: number): void => {
    if (/\s$/.test(rawSlice)) return;
    const phraseNorm = normalizeQuery(rawSlice);
    const hasCjk = CJK_CHAR_RE.test(phraseNorm);
    if (phraseNorm.length < 4 && !(hasCjk && phraseNorm.length >= 2)) {
      return;
    }
    const key = `${startInText}:${phraseNorm}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ phraseNorm, startInText });
  };

  for (let wordCount = 5; wordCount >= 1; wordCount -= 1) {
    const relStart = findTrailingPhraseStart(rawClause, wordCount);
    if (relStart === -1) continue;
    pushCandidate(rawClause.slice(relStart), clauseOffset + relStart);
  }

  if (rawClause.length >= 2 && CJK_CHAR_RE.test(rawClause[rawClause.length - 1])) {
    const maxLen = Math.min(rawClause.length, 10);
    for (let len = maxLen; len >= 2; len -= 1) {
      const relStart = rawClause.length - len;
      const slice = rawClause.slice(relStart);
      if (/\s/.test(slice)) continue;
      pushCandidate(slice, clauseOffset + relStart);
    }
  }

  return candidates;
}

function scoreExplicitKeywords(
  entry: FormulaEntry,
  q: string,
  tokens: string[],
  labelNorm: string,
  locale: Locale
): number {
  let score = 0;

  for (const loc of SUPPORTED_LOCALES) {
    const penalty = loc === locale ? 0 : 15;
    for (const kw of entry.keywords[loc]) {
      const kwNorm = normalizeQuery(kw);
      if (kwNorm === q) {
        score = Math.max(score, 125 - penalty);
      } else if (kwNorm.startsWith(q)) {
        score = Math.max(score, 100 - penalty);
      } else if (kwNorm.split(" ").some((w) => w.startsWith(q))) {
        score = Math.max(score, 90 - penalty);
      } else if (kwNorm.includes(q)) {
        score = Math.max(score, 75 - penalty);
      } else if (
        tokens.length > 1 &&
        tokens.every((tok) => kwNorm.includes(tok) || labelNorm.includes(tok))
      ) {
        score = Math.max(score, 70 - penalty);
      }
    }
  }

  return score;
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
      for (const kw of entry.keywords[locale]) {
        const kwLower = kw.toLowerCase();
        if (kwLower === q) {
          score = Math.max(score, 120);
        } else if (kwLower.startsWith(q)) {
          score = Math.max(score, 105);
        }
      }
      if (score === 0 && snipLower.startsWith(q)) {
        score = snipLower === q ? 120 : 95;
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

      score = Math.max(
        score,
        scoreExplicitKeywords(entry, q, tokens, labelNorm, locale)
      );

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
    // Ambient mode: strictly scoped to the active UI locale (EN / ES / ZH)
    const candidates = extractAmbientCandidates(
      context.query,
      context.replaceStart
    );

    for (const entry of FORMULA_CATALOG) {
      if (!entry.ambientEligible) continue;

      const localeKeywords = entry.keywords[locale];
      let bestScore = 0;
      let bestStart = context.replaceStart;

      for (const cand of candidates) {
        const p = cand.phraseNorm;
        const isCjk = CJK_CHAR_RE.test(p);
        const isGenericStopword = AMBIENT_STOPWORDS.has(p);

        for (const kw of localeKeywords) {
          const kwNorm = normalizeQuery(kw);
          if (kwNorm === p) {
            const s = 140 + p.length;
            if (s > bestScore) {
              bestScore = s;
              bestStart = cand.startInText;
            }
          } else if (
            !isGenericStopword &&
            ((isCjk && p.length >= 2) || (!isCjk && p.length >= 6)) &&
            kwNorm.startsWith(p)
          ) {
            const s = 105 + p.length;
            if (s > bestScore) {
              bestScore = s;
              bestStart = cand.startInText;
            }
          } else if (
            !isGenericStopword &&
            ((!isCjk && p.length >= 6 && kwNorm.split(" ").includes(p)) ||
              (isCjk && p.length >= 2 && kwNorm.includes(p)))
          ) {
            const s = 85 + p.length;
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

/**
 * Ordered category tabs displayed in the composer Formula Explorer palette.
 * `"command"` (Basics) comes first so beginners see integrals, fractions,
 * roots, limits, and Greek letters immediately without knowing LaTeX syntax.
 */
export const CATALOG_CATEGORIES: readonly FormulaCategory[] = [
  "command",
  "calculus",
  "algebra",
  "physics",
  "probability",
  "chemistry",
];

export interface CatalogFilterOptions {
  /** Free-text search query (accent-insensitive across EN/ES/ZH and LaTeX commands). */
  query?: string;
  /** Active category tab used when `query` is empty. Defaults to `"command"`. */
  category?: FormulaCategory | "all";
  /** Active UI locale used to prioritize matching localized titles. */
  locale?: Locale;
  /** Whether `mhchem` chemistry entries (`\ce`, `\pu`) should be included. Defaults to `true`. */
  enableChemistry?: boolean;
  /** Maximum number of entries returned. Defaults to `12` when searching or `30` per tab. */
  maxResults?: number;
}

/**
 * Pure filtering and ranking engine for the Formula Explorer palette (v1.4).
 *
 * - When `query` is non-empty, searches across all enabled categories and ranks by match quality.
 * - When `query` is empty, returns entries belonging to `category` (or all enabled entries).
 */
export function filterCatalogEntries(
  options: CatalogFilterOptions = {}
): FormulaEntry[] {
  const locale: Locale = options.locale ?? "en";
  const enableChemistry = options.enableChemistry ?? true;
  const rawQuery = (options.query ?? "").trim();
  const q = normalizeQuery(rawQuery);
  const category = options.category ?? "command";

  const enabled = FORMULA_CATALOG.filter(
    (entry) => enableChemistry || entry.category !== "chemistry"
  );

  if (q.length === 0) {
    const limit = options.maxResults ?? 30;
    const list =
      category === "all"
        ? enabled
        : enabled.filter((entry) => entry.category === category);
    return list.slice(0, limit);
  }

  const limit = options.maxResults ?? 12;
  const tokens = q.split(" ").filter(Boolean);
  const qLower = rawQuery.toLowerCase();
  const scored: Array<{ entry: FormulaEntry; score: number }> = [];

  for (const entry of enabled) {
    const labelNorm = normalizeQuery(entry.labels[locale]);
    const snippetLower = entry.snippet.toLowerCase();
    let score = 0;

    if (labelNorm === q || snippetLower === qLower) {
      score = 130;
    } else if (labelNorm.startsWith(q) || snippetLower.startsWith(qLower)) {
      score = 108;
    } else if (labelNorm.split(" ").some((w) => w.startsWith(q))) {
      score = 94;
    } else if (labelNorm.includes(q) || snippetLower.includes(qLower)) {
      score = 80;
    }

    score = Math.max(
      score,
      scoreExplicitKeywords(entry, q, tokens, labelNorm, locale)
    );

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, limit).map((item) => item.entry);
}

/**
 * Inserts a catalog entry chosen from the Formula Explorer palette at `[selectionStart, selectionEnd]`.
 *
 * - Automatically wraps bare LaTeX commands in inline `\(...\)` when the caret is outside math.
 * - If text is highlighted and the entry's `cursorOffset` points inside an empty `{}` pair
 *   (e.g. `\sqrt{}`, `\frac{}{}`, `\ce{}`, `\vec{}`), places the selected text inside those braces.
 */
export function insertCatalogEntryAtSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  entry: FormulaEntry
): { text: string; cursorPos: number; inserted: string } {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const selected = text.slice(start, end);
  const insideMath = isCursorInsideMath(text, start);

  // If the user highlighted text and picked a brace template (`\sqrt{}`, `\frac{}{}`, etc.),
  // inject the selection cleanly inside the first `{}` slot.
  if (
    selected.length > 0 &&
    entry.cursorOffset !== undefined &&
    entry.snippet.slice(entry.cursorOffset - 1, entry.cursorOffset + 1) === "{}"
  ) {
    const isBareCommand =
      (entry.category === "command" ||
        (entry.category === "chemistry" && entry.snippet.startsWith("\\"))) &&
      !entry.snippet.startsWith("$$") &&
      !entry.snippet.startsWith("\\(") &&
      !entry.snippet.startsWith("\\[");

    const openWrap = isBareCommand && !insideMath ? "\\(" : "";
    const closeWrap = isBareCommand && !insideMath ? "\\)" : "";
    const filledSnippet =
      entry.snippet.slice(0, entry.cursorOffset) +
      selected +
      entry.snippet.slice(entry.cursorOffset);
    const inserted = `${openWrap}${filledSnippet}${closeWrap}`;
    const nextText = text.slice(0, start) + inserted + text.slice(end);

    // For `\frac{sel}{}` move caret into the denominator `{}` slot; otherwise place after insertion.
    const nextEmptyBraces = filledSnippet.indexOf(
      "{}",
      entry.cursorOffset + selected.length
    );
    const cursorPos =
      nextEmptyBraces !== -1
        ? start + openWrap.length + nextEmptyBraces + 1
        : start + inserted.length;

    return { text: nextText, cursorPos, inserted };
  }

  return applyFormulaInsertion(text, {
    entry,
    score: 100,
    replaceStart: start,
    replaceEnd: end,
    mode: "explicit",
    insideMath,
  });
}

