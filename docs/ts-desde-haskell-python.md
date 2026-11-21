# Guía rápida de TypeScript (viniendo de Haskell y Python)

Esta mini-guía mapea los conceptos de **TypeScript** que usamos en `latexOnX` a cosas que ya conocés de **Haskell** y **Python**.

---

## 1. Variables y funciones

| Python | TypeScript |
| :--- | :--- |
| `x = 10` (reasignable) | `let x = 10;` |
| `MAX = 500` (constante) | `const MAX = 500;` *(usá `const` por defecto)* |
| `def f(s: str) -> int:` | `function f(s: string): number { ... }` |
| `lambda x: x + 1` | `(x: number) => x + 1` |

---

## 2. Tipos algebraicos (Haskell) = Uniones discriminadas (TypeScript)

En **Haskell**:
```haskell
data MathDisplayMode = Inline | Display

data Segment
  = TextSegment String
  | MathSegment MathDisplayMode String String
```

En **TypeScript** (`src/core/types.ts`):
```ts
export type MathDisplayMode = "inline" | "display";

export type Segment =
  | { type: "text"; content: string }
  | { type: "math"; content: string; mode: MathDisplayMode; raw: string };
```

Y el *pattern matching* de Haskell se hace con `if` o `switch` sobre `segment.type`:
```ts
if (segment.type === "math") {
  // Aquí TypeScript SABE que `segment` tiene `mode` y `raw`
  console.log(segment.mode, segment.content);
} else {
  // Aquí SABE que es `{ type: "text"; content: string }`
  console.log(segment.content);
}
```

---

## 3. Operaciones de strings útiles para el Reto #1

| Qué querés hacer | Python | TypeScript |
| :--- | :--- | :--- |
| Largo del string | `len(text)` | `text.length` |
| Carácter en posición `i` | `text[i]` | `text[i]` |
| ¿Empieza con `"$$"` desde índice `i`? | `text.startswith("$$", i)` | `text.startsWith("$$", i)` |
| Buscar `"$$"` a partir del índice `start` | `text.find("$$", start)` | `text.indexOf("$$", start)` *(devuelve `-1` si no está)* |
| Substring entre `a` y `b` (sin incluir `b`) | `text[a:b]` | `text.slice(a, b)` |
| Sacar espacios/saltos en los bordes | `s.strip()` | `s.trim()` |

---

## 4. Listas (`Array`)

| Qué querés hacer | Python | TypeScript |
| :--- | :--- | :--- |
| Lista vacía tipada | `segments: list[Segment] = []` | `const segments: Segment[] = [];` |
| Agregar al final | `segments.append(item)` | `segments.push(item);` |
| Último elemento | `segments[-1]` | `segments[segments.length - 1]` |
| Recorrer una lista | `for d in DELIMITERS:` | `for (const d of DELIMITERS) { ... }` |

---

## 5. Bucles y comparaciones

- Usá siempre `===` y `!==` (comparación estricta, sin conversiones raras de JavaScript).
- Bucle `while` clásico para recorrer un string con índice manual:
  ```ts
  let i = 0;
  while (i < text.length) {
    // ... avanzás `i` según cuántos caracteres consumiste
  }
  ```

---

## 6. Ojo con las barras invertidas (`\`) en strings de código

En TypeScript (igual que en Python):
- Para representar el delimitador literal `\(` dentro de un string en código se escribe `"\\("`.
- Su largo (`"\\(".length`) es **2** caracteres: `\` y `(`.
- Lo mismo para `"\\)"`, `"\\["`, `"\\]"`, y `"$$"` (todos tienen largo 2).
