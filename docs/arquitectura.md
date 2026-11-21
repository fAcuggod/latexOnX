# Arquitectura y Decisiones Técnicas de `LaTeX on X`

Este documento resume **cómo funciona cada capa del proyecto y por qué se tomó cada decisión de ingeniería**.

---

## 1. Arquitectura por capas: Núcleo Puro + Capa de Efectos

El proyecto separa estrictamente la lógica pura de los efectos secundarios del navegador (el mismo principio que en Haskell separa funciones puras de `IO`):

```text
src/content/   (Capa impura: DOM de x.com, MutationObserver, chrome.storage)
     │
     ▼
src/renderer/  (Puente con KaTeX: HTML + MathML accesible, try/catch defensivo)
     │
     ▼
src/core/      (Núcleo 100% puro: parser y validador, cero dependencias externas)
```

**Ventaja clave:** `src/core/` se puede testear en pocos milisegundos sin abrir ningún navegador y reutilizar tal cual en la extensión de Chrome, en la demo web o incluso en un backend futuro.

---

## 2. Flujo completo de un tweet (de texto plano a fórmula en pantalla)

1. **Detección de cambios en el timeline (`src/content/observer.ts`):**
   - Un `MutationObserver` vigila `document.body` (`childList: true, subtree: true, characterData: true`) para capturar tanto tweets nuevos al hacer scroll infinito como inserciones parciales de React dentro de un `[data-testid="tweetText"]` existente (resolviendo su ancestro con `closest()`).
   - Ignora nodos inyectados por la propia extensión (`data-latex-on-x="rendered"` / `.katex`) para no provocar ciclos infinitos.
   - Acumula nodos añadidos en un `Set` y los procesa en un **único lote dentro de `requestAnimationFrame`**, evitando degradar los 60–120 FPS de X.

2. **Filtrado rápido y recorrido seguro del DOM (`src/content/domProcessor.ts`):**
   - **Fast-path (`mightContainMath`):** si un nodo de texto no contiene `$$`, `\(` ni `\[`, se descarta en $O(n)$ sin crear objetos ni invocar al parser. Para el ~99% de tweets sin matemáticas, el costo es prácticamente nulo.
   - **`TreeWalker` seguro:** solo visita nodos de texto fuera de `<a>` (enlaces, `@menciones`, `#hashtags`), `<code>`, `<pre>`, `[contenteditable="true"]` (el compositor de tweets) y fórmulas ya renderizadas (idempotencia).
   - **Recolección previa + `DocumentFragment`:** recolecta todos los nodos candidatos antes de mutar el árbol, y reemplaza cada nodo con un único `DocumentFragment` (1 solo *reflow* del navegador).

3. **Análisis léxico (`src/core/parser.ts`):**
   - Scanner lineal con cursor `i` y slicing semiabierto `[a, b)`.
   - Usa delimitadores explícitos (`$$...$$`, `\[...\]`, `\(...\)`) para evitar ambigüedades y colisiones con precios (`$50`) o cashtags (`$BTC`).
   - Cumple la **invariante sin pérdida**: concatenar `text.content` y `math.raw` reconstruye siempre exactamente el string original.

4. **Validación de seguridad (`src/core/validator.ts`):**
   - **Longitud máxima** (500 caracteres por defecto) verificada antes de escanear el contenido (defensa contra DoS).
   - **Balanceo y profundidad máxima de llaves `{...}`** (15 niveles por defecto), ignorando escapes `\{`, `\}` y manejando saltos de línea `\\`.
   - **Bloqueo de comandos peligrosos** (`\def`, `\let`, `\newcommand`, `\href`, `\htmlStyle`, etc.) mediante tokenización de letras ASCII con dos punteros (`i`, `j`) para no confundir `\let` con comandos legítimos como `\leftarrow`.

5. **Renderizado con KaTeX (`src/renderer/katexRenderer.ts`):**
   - Segunda capa de seguridad (*defense in depth*): `trust: false`, `maxSize: 10`, `maxExpand: 100`.
   - **Compatible con Trusted Types CSP en `x.com`:** usa `katex.render()` (`renderFormulaToElement`), que crea nodos DOM reales con `createElement`/`appendChild` y **cero `.innerHTML`**, evitando el bloqueo `TrustedHTML` de X.
   - **Accesibilidad:** `output: "htmlAndMathml"` genera tanto el dibujo visual en HTML+CSS como `<math>` MathML nativo para lectores de pantalla.
   - **Degradación elegante:** si KaTeX detecta un error de sintaxis, `try/catch` captura la excepción y se conserva el texto original del tweet intacto.
   - **Anti-XSS:** el texto plano y las fórmulas rechazadas siempre se insertan con `document.createTextNode(...)`, jamás como HTML.

6. **Empaquetado Chrome Manifest V3 (`public/manifest.json` y `scripts/build.mjs`):**
   - **Principio de mínimo privilegio:** la extensión solo solicita el permiso `"storage"` (para recordar el interruptor On/Off del popup) y solo se inyecta en `https://x.com/*` y `https://twitter.com/*`. Sin *service worker* en segundo plano.
   - **Delegación de eventos:** un único listener global en `document` permite hacer clic (o presionar Enter/Espacio) sobre cualquier fórmula para copiar su LaTeX original.
   - **Fuentes optimizadas:** `scripts/build.mjs` conserva únicamente `.woff2` de KaTeX (~250 KB frente a ~1.3 MB) y reescribe las rutas CSS a `chrome-extension://__MSG_@@extension_id__/fonts/` declaradas en `web_accessible_resources`, evitando cualquier bloqueo por la política CSP de X.
