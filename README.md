# LaTeX on X (`latexOnX`)

Extensión de navegador para Chromium (Chrome, Brave, Edge, Arc) que detecta y renderiza fórmulas matemáticas en **LaTeX** dentro de `x.com` usando **KaTeX**, construida paso a paso con foco en arquitectura limpia y aprendizaje práctico.

## Sintaxis soportada (sin colisiones con `$50` o `$BTC`)

- **En línea (`inline`):** `\(...\)` — ej. `Si \(a^2 + b^2 = c^2\) entonces...`
- **En bloque (`display`):** `$$...$$` o `\[...\]` — ej. `$$E = mc^2$$`

El símbolo `$` simple se ignora intencionalmente para no interferir con precios ni *cashtags* financieros en X.

## Arquitectura: Núcleo Puro + Capa de Efectos

Separamos el proyecto en dos grandes capas (el mismo principio que en programación funcional separa funciones puras de `IO`):

```text
src/
├── core/        # Núcleo puro (sin DOM ni APIs del navegador): parser, tipos, validador
├── renderer/    # (Fase 3) Puente con KaTeX (HTML + MathML accesible)
└── content/     # (Fase 4) Capa del navegador: DOM de x.com y MutationObserver
tests/           # Tests automatizados con Vitest
```

## Roadmap de construcción

- [x] **Fase 0 — Cimientos:** Configuración de TypeScript + Vitest, tipos algebraicos (`src/core/types.ts`) y suite de tests del parser.
- [x] **Fase 1 — Reto #1 (Parser):** Implementar `parseMathSegments` en `src/core/parser.ts`.
- [ ] **Fase 2 — Reto #2 (Validador / Seguridad):** Proteger el renderizado contra fórmulas abusivas o ataques DoS (longitud máxima, profundidad de llaves `{...}`, comandos prohibidos).
- [ ] **Fase 3 — Motor KaTeX + Sandbox local:** Conectar el núcleo puro con KaTeX y probarlo visualmente en un simulador de tweets (modo claro y oscuro).
- [ ] **Fase 4 — Extensión real en Chrome (Manifest V3):** Recorrido seguro del DOM de `x.com` + `MutationObserver` eficiente + empaquetado listo para cargar en `chrome://extensions`.
- [ ] **Fase 5 — Mejoras extra:** Popup on/off, copiar LaTeX al hacer clic, vista previa en el compositor de tweets.

## Comandos útiles

```bash
npm install         # Instala dependencias
npm test            # Ejecuta los tests una vez
npm run test:watch  # Ejecuta los tests automáticamente al guardar cambios
npm run typecheck   # Verifica tipos de TypeScript
```
