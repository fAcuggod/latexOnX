<div align="center">
  <img src="public/icons/icon.svg" alt="LaTeX on X logo" width="84" height="84" />
  <h1>LaTeX on X</h1>
  <p><strong>Renderizá fórmulas matemáticas en LaTeX directamente en X (<code>x.com</code>) en tiempo real usando KaTeX.</strong></p>

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

## ¿Por qué existe este proyecto?

En **X** (`x.com`), compartir matemáticas suele implicar subir capturas borrosas o fórmulas en texto plano difíciles de leer. A diferencia de usar `$x^2$` (que colisiona con precios como `$50` y *cashtags* como `$BTC` o `$TSLA`), **LaTeX on X** adopta delimitadores seguros, valida cada expresión contra ataques DoS y renderiza las fórmulas en menos de 1 ms con **KaTeX** (HTML + MathML accesible).

### Características principales

- **Sintaxis sin colisiones:** soporta `\(...\)` en línea y `$$...$$` / `\[...\]` en bloque, ignorando `$` simple (`$50`, `$BTC`, `$TSLA`).
- **Rápida en scroll infinito:** *fast-path* para descartar tweets sin fórmulas al instante y `MutationObserver` agrupado con `requestAnimationFrame` para mantener 60–120 FPS.
- **Segura por diseño:** defensa en profundidad contra DoS (límite de longitud, profundidad de llaves `{...}` y bloqueo de macros peligrosas como `\def`, `\let`, `\href`), `trust: false` en KaTeX y texto plano siempre en `TextNode` (anti-XSS).
- **Compatible con los 3 temas de X:** se adapta automáticamente a modo **Claro**, **Noche clara (Dim)** y **Oscuro (Lights Out)**.
- **Clic para copiar LaTeX:** hacé clic (o presioná Enter/Espacio) en cualquier fórmula renderizada para copiar su código LaTeX original.
- **Activar / pausar al instante:** popup con interruptor On/Off que restaura el texto original sin recargar la pestaña y solicita solo el permiso mínimo (`storage`).

---

## Sintaxis soportada

| Modo | Sintaxis | Ejemplo |
| :--- | :--- | :--- |
| **En línea (`inline`)** | `\(...\)` | `La identidad \(e^{i\pi} + 1 = 0\) es clásica.` |
| **En bloque (`display`)** | `$$...$$` | `$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$` |
| **En bloque (`display`)** | `\[...\]` | `\[\int_0^1 x^2\,dx = \frac{1}{3}\]` |
| **Texto ignorado** | `$` simple | `Compré $BTC a $50` *(intacto)* |

---

## Instalación en Chrome / Brave / Edge / Arc (1 minuto)

> Requiere [Node.js 18+](https://nodejs.org/).

1. **Cloná e instalá dependencias:**
   ```bash
   git clone https://github.com/fAcuggod/latexOnX.git
   cd latexOnX
   npm install
   ```

2. **Compilá la extensión:**
   ```bash
   npm run build
   ```
   Esto genera la extensión lista para cargar en la carpeta `dist/`.

3. **Cargala en tu navegador Chromium:**
   - Abrí `chrome://extensions` (o `brave://extensions`, `edge://extensions`).
   - Activá el **Modo de desarrollador** (*Developer mode*) arriba a la derecha.
   - Hacé clic en **Cargar descomprimida** (*Load unpacked*) y elegí la carpeta `dist/`.
   - Abrí [x.com](https://x.com) y probá con cualquier tweet que incluya `\(x^2\)` o `$$E = mc^2$$`.

### Probar el Sandbox local con KaTeX real (sin entrar a X)

```bash
npm run build:demo
```
Luego abrí `dist-demo/index.html` en tu navegador (o servilo con `npx serve dist-demo`) para probar tweets en vivo en los 3 temas de X (**Claro**, **Noche clara** y **Oscuro**).

---

## Arquitectura

El proyecto sigue el principio de **Núcleo Puro + Capa de Efectos** (*Functional Core, Imperative Shell*):

```text
latexOnX/
├── src/
│   ├── core/            # Núcleo 100% puro (sin DOM ni APIs del navegador)
│   │   ├── types.ts     # Tipos algebraicos (uniones discriminadas)
│   │   ├── parser.ts    # Scanner lineal sin pérdida para delimitadores seguros
│   │   └── validator.ts # Validador anti-DoS (longitud, llaves, comandos prohibidos)
│   ├── renderer/
│   │   └── katexRenderer.ts # Pipeline seguro con KaTeX (HTML + MathML accesible)
│   ├── content/         # Capa del navegador (Chrome Manifest V3)
│   │   ├── domProcessor.ts  # TreeWalker seguro, DocumentFragment, restore y copy
│   │   ├── observer.ts      # MutationObserver agrupado en requestAnimationFrame
│   │   ├── index.ts         # Entrada del content script + sincronización On/Off
│   │   └── styles.css       # Estilos adaptables a los temas de X
│   ├── popup/           # Interfaz del popup On/Off de la extensión
│   └── demo/            # Sandbox web interactivo con KaTeX real
├── public/              # manifest.json (MV3) e íconos (16/48/128 px + SVG)
├── scripts/build.mjs    # Empaquetado transparente con esbuild + fuentes .woff2
├── tests/               # 37 tests automatizados (Vitest + happy-dom)
└── docs/                # Documentación de arquitectura y guía de TypeScript
```

Más detalles técnicos en [docs/arquitectura.md](docs/arquitectura.md).

---

## Scripts de desarrollo

```bash
npm run typecheck   # Verifica tipos estrictos con TypeScript (tsc --noEmit)
npm test            # Ejecuta los 37 tests unitarios y de DOM (Vitest + happy-dom)
npm run test:watch  # Modo watch para TDD
npm run build       # Compila la extensión Chrome MV3 en dist/
npm run build:demo  # Compila el sandbox local con KaTeX real en dist-demo/
npm run check       # Ejecuta typecheck + tests + build completo
```

---

## Roadmap

- [x] **Fase 0 — Cimientos:** TypeScript estricto + Vitest + tipos algebraicos.
- [x] **Fase 1 — Parser de delimitadores:** `parseMathSegments` con invariante sin pérdida y cero colisiones con `$50`/`$BTC`.
- [x] **Fase 2 — Validador de seguridad:** límites anti-DoS, balanceo de llaves con escapes y tokenización de comandos prohibidos.
- [x] **Fase 3 — Motor KaTeX:** pipeline seguro con salida accesible `htmlAndMathml` y degradación elegante.
- [x] **Fase 4 — Extensión Chrome MV3:** `TreeWalker`, `MutationObserver` con batching, popup On/Off, clic para copiar LaTeX y demo web.
- [ ] **Próximas ideas (v0.2):** vista previa en vivo dentro del compositor de X y soporte para Firefox.

---

## Licencia

Distribuido bajo licencia [MIT](LICENSE).
