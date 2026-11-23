<div align="center">
  <img src="public/icons/icon.svg" alt="Logo de LaTeX on X" width="84" height="84" />
  <h1>LaTeX on X</h1>
  <p><strong>Renderizá fórmulas matemáticas en LaTeX directamente en X (<code>x.com</code>) en tiempo real usando KaTeX.</strong></p>

  <p>
    <a href="README.md">English</a> · <strong>Español</strong> · <a href="README.zh-CN.md">简体中文</a>
  </p>

  <p>
    <a href="https://github.com/fAcuggod/latexOnX/actions/workflows/ci.yml">
      <img src="https://github.com/fAcuggod/latexOnX/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript Strict" />
    <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3" />
    <img src="https://img.shields.io/badge/Renderer-KaTeX-329894" alt="KaTeX" />
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="Licencia MIT" />
    </a>
  </p>
</div>

---

## ¿Por qué LaTeX on X?

Compartir matemáticas en **X** (`x.com`) suele obligar a subir capturas borrosas o escribir fórmulas en texto plano difíciles de leer. A diferencia de los delimitadores de un solo signo dólar (`$...$`), que colisionan con precios y *cashtags* financieros, **LaTeX on X** adopta delimitadores matemáticos sin ambigüedades, valida cada expresión contra ataques DoS y renderiza las fórmulas en menos de 1 ms con **KaTeX** (HTML visual + MathML accesible).

### Características principales

- **Sintaxis sin colisiones:** soporta `\(...\)` en línea y `$$...$$` / `\[...\]` en bloque, dejando completamente intactos precios y *cashtags*.
- **Vista previa en vivo al redactar:** panel flotante con *debounce* debajo del compositor de X que renderiza tus fórmulas en tiempo real, avisa antes de publicar si faltan delimitadores o llaves, y ofrece un botón rápido `Pasar a en línea \(...\)` cuando un bloque `$$...$$` aparece en medio de una oración.
- **Barra rápida de símbolos (`Quick Symbol Bar`):** paleta compacta (`\(x\)`, `$$`, `a/b`, `√`, `x²`, `∑`, `∫`, `π`, `∞`, `≤`, `→`, `\ce`) en el panel del compositor que envuelve texto seleccionado o inserta plantillas LaTeX ubicando el cursor en el primer espacio editable.
- **Autocompletado inteligente y catálogo por nombre natural:** escribí nombres de fórmulas en español, inglés o chino (ej. `funcion zeta de riemann`, `formula cuadratica`, `teorema de pitagoras`), buscá con `:consulta` o completá comandos `\frac` / `\sum` presionando `Tab` o con un clic.
- **Compilador de matemática natural con AST (`f(x) = 5x + 2` -> LaTeX):** parser recursivo descendente puro (`Lexer -> AST -> LaTeX`) que previsualiza expresiones cotidianas como `f(x) = 5x + 2`, `(a+b)/(c-d)`, `sqrt(a^2+b^2)`, `det(A) = ad - bc` o `Av = lambda v` en vivo con botón `Convertir a LaTeX` (`Tab`) o exportación directa a `PNG` 3x, ignorando fechas, puntajes y texto común.
- **Exportación PNG 3x HiDPI en un clic:** botón `PNG` en la cabecera de la vista previa que copia una tarjeta nítida 3x adaptada al tema activo de X directo al portapapeles (pegás con `Ctrl+V` en X, con descarga `.png` automática como respaldo).
- **Química y unidades físicas (`mhchem`):** renderiza fórmulas químicas, cargas iónicas, flechas de reacción y unidades (`\ce{...}`, `\pu{...}`), activable desde el popup.
- **Botón opt-in para LaTeX sin delimitadores:** detecta publicaciones con comandos LaTeX/químicos inequívocos (ignorando escapes de código y rutas Windows) y muestra un botón discreto `∑ Renderizar LaTeX` / `↺ Ver original`.
- **Diseñada para el frontend actual de X:** utiliza etiquetas semánticas estándar (`<article>` / `[role="article"]`) y construye nodos DOM directamente con `katex.render()` (**cero `.innerHTML`**), 100% compatible con la política *Trusted Types* de X.
- **Scroll infinito a 60-120 FPS:** *fast-path* `O(n)` sin asignaciones de memoria que descarta publicaciones sin fórmulas al instante, junto con un `MutationObserver` agrupado en `requestAnimationFrame`.
- **Núcleo en Rust/WebAssembly sin dependencias:** parser y validador anti-DoS portados a Rust *zero-copy* (`crates/latex-core/`), compilados a un binario `.wasm` de **37.5 KB** y validados con tests de equivalencia diferencial contra TypeScript.
- **Seguridad por diseño:** validador previo que impone límites de longitud, profundidad de llaves y bloquea comandos peligrosos (`\def`, `\let`, `\newcommand`, `\href`, `\htmlStyle`, etc.) antes de ejecutar KaTeX; el texto plano siempre se inserta como `TextNode` (anti-XSS).
- **Accesible y adaptable:** genera HTML + MathML nativo para lectores de pantalla y se integra con los temas **Claro**, **Noche clara (Dim)** y **Oscuro (Lights Out)** de X.
- **Clic para copiar y On/Off instantáneo:** hacé clic (o presioná Enter/Espacio) en cualquier fórmula para copiar su LaTeX original; activá o pausá funciones desde el popup sin recargar la pestaña.
- **Interfaz multilingüe:** soporte integrado en **English**, **Español** y **简体中文** (detección automática + selector manual en el popup).
- **Permisos mínimos:** solicita únicamente `"storage"`, sin *service worker* en segundo plano y con fuentes `.woff2` empaquetadas localmente (cero CDNs externos).

---

## Sintaxis soportada

| Modo | Delimitadores / Comando | Ejemplo |
| :--- | :--- | :--- |
| **En línea (`inline`)** | `\(...\)` | `Identidad de Euler \(e^{i\pi} + 1 = 0\)` |
| **En bloque (`display`)** | `$$...$$` | `$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$` |
| **En bloque (`display`)** | `\[...\]` | `\[\int_0^1 x^2\,dx = \frac{1}{3}\]` |
| **Química (`mhchem`)** | `\ce{...}`, `\pu{...}` | `$$\ce{CO2 + C <=> 2 CO}$$`, `\(\pu{9.8 m/s^2}\)` |
| **Autocompletado** | Nombres naturales, `:consulta`, `\cmd` + `Tab` | `funcion zeta de riemann`, `:cuad`, `\frac` |
| **Matemática natural** | Sintaxis algebraica + `Tab` / `Convertir` | `f(x) = 5x + 2`, `(a+b)/(c-d)`, `sqrt(a^2+b^2)` |
| **Sin delimitadores (opt-in)** | Botón `∑ Renderizar LaTeX` | `\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s}` |
| **Ignorado** | `$` simple | Precios y *cashtags* *(nunca se alteran)* |

---

## Instalación (Chrome / Brave / Edge / Arc)

> Requiere [Node.js 18+](https://nodejs.org/). (Opcional: [Rust](https://rustup.rs/) con el target `wasm32-unknown-unknown` si querés recompilar el núcleo WASM desde cero.)

1. **Cloná e instalá dependencias:**
   ```bash
   git clone https://github.com/fAcuggod/latexOnX.git
   cd latexOnX
   npm install
   ```

2. **Compilá la extensión Manifest V3:**
   ```bash
   npm run build
   ```
   Esto genera la extensión lista para cargar en la carpeta `dist/`.

3. **Cargala en tu navegador Chromium:**
   - Abrí `chrome://extensions` (o `brave://extensions`, `edge://extensions`).
   - Activá el **Modo de desarrollador**.
   - Hacé clic en **Cargar descomprimida** y seleccioná la carpeta `dist/`.
   - Abrí [x.com](https://x.com) (o recargá la pestaña si ya estaba abierta).

### Sandbox local con KaTeX real

```bash
npm run build:demo
```
Abrí `dist-demo/index.html` en tu navegador para probar fórmulas en los 3 temas de X (**Claro**, **Noche clara** y **Oscuro**).

---

## Benchmarks (TypeScript vs. Rust/WASM)

Medidos con `npm run bench` sobre **10.000 publicaciones mixtas de X** (8.000 fórmulas válidas, texto plano, precios y *cashtags*, química, Unicode y payloads DoS) en Node v24.22.2:

| Implementación | Mediana (10k posts) | Rendimiento | Mejora vs. TS |
| :--- | ---: | ---: | ---: |
| **TypeScript (V8 JIT)** | 20.56 ms | 486,369 posts/s | 1.00x |
| **Rust/WASM (FFI por post, 10k llamadas)** | 12.45 ms | 803,227 posts/s | **1.65x** |
| **Rust/WASM (lote en memoria lineal, 1 llamada)** | 2.56 ms | 3,898,838 posts/s | **8.02x** |

---

## Scripts de desarrollo

```bash
npm run typecheck   # Verifica tipos estrictos con TypeScript (tsc --noEmit)
npm test            # Ejecuta los 120 tests unitarios, de DOM y equivalencia WASM
npm run test:rust   # Ejecuta los 21 tests nativos en Rust (cargo test)
npm run build:wasm  # Recompila crates/latex-core -> src/wasm/latex_core.wasm
npm run bench       # Corre el benchmark TypeScript vs. Rust/WASM (10.000 posts)
npm run build       # Compila la extensión Chrome MV3 en dist/
npm run build:demo  # Compila el sandbox local en dist-demo/
npm run check       # Ejecuta typecheck + tests + build completo
```

Más detalles técnicos en [docs/architecture.md](docs/architecture.md) y [docs/rust-wasm-guide.md](docs/rust-wasm-guide.md).

---

## Licencia

Distribuido bajo licencia [MIT](LICENSE).
