<div align="center">
  <img src="public/icons/icon.svg" alt="LaTeX on X 图标" width="84" height="84" />
  <h1>LaTeX on X</h1>
  <p><strong>使用 KaTeX 在 X (<code>x.com</code>) 上实时原生渲染 LaTeX 数学公式。</strong></p>

  <p>
    <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <strong>简体中文</strong>
  </p>

  <p>
    <a href="https://github.com/fAcuggod/latexOnX/actions/workflows/ci.yml">
      <img src="https://github.com/fAcuggod/latexOnX/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript Strict" />
    <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3" />
    <img src="https://img.shields.io/badge/Renderer-KaTeX-329894" alt="KaTeX" />
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" />
    </a>
  </p>
</div>

---

## 为什么开发 LaTeX on X？

在 **X**（`x.com`）上分享数学推导，通常只能上传模糊截图或难以阅读的纯文本公式。与容易和货币价格或金融标签（cashtags）发生冲突的单美元符（`$...$`）方案不同，**LaTeX on X** 采用无歧义的数学定界符，在渲染前对每个公式执行防 DoS 安全校验，并通过 **KaTeX** 在 1 ms 内完成渲染（HTML 视觉排版 + 无障碍 MathML）。

### 核心特性

- **无冲突定界符：** 支持行内 `\(...\)` 以及块级 `$$...$$` / `\[...\]`，完全不干扰货币价格与金融标签。
- **发帖实时预览与诊断：** 在 X 发帖/回复框下方浮动显示防抖（debounced）KaTeX 实时预览，发布前即时提示未闭合定界符、花括号不匹配及语法错误，并在句中误用 `$$...$$` 块级公式时提供一键 `改为行内 \(...\)` 提示。
- **随时可用的公式浏览器与符号栏（`∑`）：** 聚焦任意发帖框（即使内容为空）时显示简洁的 `∑` 按钮，点击即可打开按分类（`基础`、`微积分`、`代数`、`物理`、`概率`、`化学`）浏览和实时搜索的公式面板与常用符号栏（`\(x\)`、`$$`、`a/b`、`√`、`x²`、`∑`、`∫`、`π`、`∞`、`≤`、`→`、`\ce`）。
- **发帖输入补全：** 在发帖框输入中/英/西公式名（如 `欧拉恒等式`、`riemann zeta`、`funcion zeta`）、使用 `:关键词` 搜索，或输入 `\frac` / `\sum` 按 `Tab` 或点击即可插入 LaTeX。
- **自然数学 AST 编译器（`f(x) = 5x + 2` -> LaTeX）：** 纯递归下降解析器（`Lexer -> AST -> LaTeX`），将 `f(x) = 5x + 2`、`(a+b)/(c-d)`、`sqrt(a^2+b^2)`、`det(A) = ad - bc` 等日常数学式实时预览为 KaTeX，支持一键转为 LaTeX（`Tab`）或直接导出 3x `PNG`，并自动排除日期、比分与普通文本。
- **一键导出 3x 高清 PNG：** 点击预览栏中的 `PNG` 按钮即可复制匹配 X 当前主题的高清公式卡片到剪贴板（在发帖框按 `Ctrl+V` 直接附带图片，不支持时自动下载 `.png`）。
- **化学公式与物理单位（`mhchem`）：** 原生支持化学式、离子电荷、反应箭头与物理单位（`\ce{...}`、`\pu{...}`），可在弹窗中随时开关。
- **无定界符 LaTeX 按需渲染按钮：** 精准识别未写定界符的 LaTeX/化学公式帖子（自动忽略代码转义与 Windows 路径），并在帖子下方显示简洁的 `∑ 渲染 LaTeX` / `↺ 显示原文` 按钮。
- **适配 X 现代前端：** 基于稳定的 HTML5 语义化标签（`<article>` / `[role="article"]`），通过 `katex.render()` 直接构建 DOM 节点（**零 `.innerHTML`**），全面兼容 X 严格的 *Trusted Types* CSP 安全策略。
- **60-120 FPS 无限滚动：** `O(n)` 零分配快速路径即时跳过不含公式的帖子，并结合 `requestAnimationFrame` 批量调度 `MutationObserver`。
- **零依赖 Rust/WASM 核心：** 将解析器与防 DoS 校验器移植为零拷贝 Rust（`crates/latex-core/`），编译为仅 **37.5 KB** 的 `.wasm` 模块并通过与 TypeScript 的差分等价测试。
- **纵深防御安全模型：** 渲染前校验最大长度、花括号嵌套深度，并拦截危险宏与 HTML 命令（`\def`、`\let`、`\newcommand`、`\href`、`\htmlStyle` 等）；纯文本始终以 `TextNode` 写入，杜绝 XSS。
- **无障碍与主题自适应：** 同时生成 HTML 与原生 MathML，自动适配 X 的**浅色**、**暗蓝（Dim）**与**纯黑（Lights Out）**主题。
- **点击复制与即时开关：** 点击（或按 Enter/Space）任意公式即可复制 LaTeX 源码；在弹窗中随时切换总开关、化学支持或无定界符按钮，无需刷新页面。
- **多语言界面：** 内置 **English**、**Español** 与 **简体中文**（自动检测浏览器语言并支持手动切换）。
- **最小权限原则：** 仅申请 `"storage"` 权限，无后台常驻 Service Worker，所有 `.woff2` 数学字体本地打包（无外部 CDN 依赖）。

---

## 支持的语法

| 模式 | 定界符 / 命令 | 示例 |
| :--- | :--- | :--- |
| **行内公式（Inline）** | `\(...\)` | `欧拉恒等式 \(e^{i\pi} + 1 = 0\)` |
| **块级公式（Display）** | `$$...$$` | `$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$` |
| **块级公式（Display）** | `\[...\]` | `\[\int_0^1 x^2\,dx = \frac{1}{3}\]` |
| **化学反应式（`mhchem`）** | `\ce{...}`, `\pu{...}` | `$$\ce{CO2 + C <=> 2 CO}$$`, `\(\pu{9.8 m/s^2}\)` |
| **发帖智能补全** | 公式名、`:关键词`、`\命令` + `Tab` | `欧拉恒等式`、`:riemann`、`\frac` |
| **自然数学编译** | 日常代数式 + `Tab` / `转为 LaTeX` | `f(x) = 5x + 2`, `(a+b)/(c-d)`, `sqrt(a^2+b^2)` |
| **无定界符（按需开启）** | `∑ 渲染 LaTeX` 按钮 | `\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s}` |
| **自动忽略** | 单个 `$` | 货币价格与金融标签（*绝不被修改*） |

---

## 安装指南（Chrome / Brave / Edge / Arc）

> 需要 [Node.js 18+](https://nodejs.org/)。（可选：如需从源码重新编译 WASM 核心，请安装 [Rust](https://rustup.rs/) 与 `wasm32-unknown-unknown` 目标。）

1. **克隆仓库并安装依赖：**
   ```bash
   git clone https://github.com/fAcuggod/latexOnX.git
   cd latexOnX
   npm install
   ```

2. **构建 Manifest V3 扩展：**
   ```bash
   npm run build
   ```
   构建产物位于 `dist/` 目录。

3. **在 Chromium 浏览器中加载：**
   - 打开 `chrome://extensions`（或 `brave://extensions`、`edge://extensions`）。
   - 开启右上角的 **开发者模式（Developer mode）**。
   - 点击 **加载已解压的扩展程序（Load unpacked）** 并选择 `dist/` 目录。
   - 打开 [x.com](https://x.com)（如页面已打开，请刷新一次）。

### 本地 KaTeX 沙盒测试

```bash
npm run build:demo
```
在浏览器中打开 `dist-demo/index.html`，即可在 X 的三种主题下实时体验渲染效果。

---

## 性能基准测试（TypeScript vs. Rust/WASM）

在 Node v24.22.2 上通过 `npm run bench` 对 **10,000 条混合 X 帖子**（含 8,000 个有效公式、纯文本、价格/金融标签、化学式、Unicode 与 DoS 样本）进行测试：

| 实现方式 | 中位耗时（10k 帖子） | 吞吐量 | 相对 TS 加速比 |
| :--- | ---: | ---: | ---: |
| **TypeScript（V8 JIT）** | 20.56 ms | 486,369 posts/s | 1.00x |
| **Rust/WASM（逐条 FFI，10k 次调用）** | 12.45 ms | 803,227 posts/s | **1.65x** |
| **Rust/WASM（线性内存批处理，单次调用）** | 2.56 ms | 3,898,838 posts/s | **8.02x** |

---

## 开发命令

```bash
npm run typecheck   # 严格 TypeScript 类型检查（tsc --noEmit）
npm test            # 运行全部 124 个单元测试、DOM 测试与 WASM 等价测试
npm run test:rust   # 运行全部 21 个原生 Rust 单元测试（cargo test）
npm run build:wasm  # 重新编译 crates/latex-core -> src/wasm/latex_core.wasm
npm run bench       # 运行 10,000 条帖子的 TypeScript vs. Rust/WASM 基准测试
npm run build       # 构建 Chrome MV3 扩展至 dist/
npm run build:demo  # 构建本地 KaTeX 沙盒至 dist-demo/
npm run check       # 一键运行类型检查 + 测试 + 扩展构建
```

完整架构解析请参阅 [docs/architecture.md](docs/architecture.md) 与 [docs/rust-wasm-guide.md](docs/rust-wasm-guide.md)。

---

## 开源协议

基于 [MIT License](LICENSE) 开源。
