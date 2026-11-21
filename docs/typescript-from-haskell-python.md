# TypeScript Quick Reference (from Haskell & Python)

A compact cheat sheet mapping the TypeScript constructs used in `latexOnX` to familiar Haskell and Python concepts.

---

## 1. Bindings & Functions

| Python | TypeScript |
| :--- | :--- |
| `x = 10` (reassigned) | `let x = 10;` |
| `MAX = 500` (constant) | `const MAX = 500;` *(prefer `const` by default)* |
| `def f(s: str) -> int:` | `function f(s: string): number { ... }` |
| `lambda x: x + 1` | `(x: number) => x + 1` |

---

## 2. Algebraic Data Types (Haskell) = Discriminated Unions (TypeScript)

In **Haskell**:
```haskell
data MathDisplayMode = Inline | Display

data Segment
  = TextSegment String
  | MathSegment MathDisplayMode String String
```

In **TypeScript** (`src/core/types.ts`):
```ts
export type MathDisplayMode = "inline" | "display";

export type Segment =
  | { type: "text"; content: string }
  | { type: "math"; content: string; mode: MathDisplayMode; raw: string };
```

Type narrowing plays the role of pattern matching:
```ts
if (segment.type === "math") {
  // TypeScript narrows `segment` to the math variant here
  console.log(segment.mode, segment.content);
} else {
  console.log(segment.content);
}
```

---

## 3. Common String Operations

| Operation | Python | TypeScript |
| :--- | :--- | :--- |
| Length | `len(text)` | `text.length` |
| Character at `i` | `text[i]` | `text[i]` |
| Prefix check at `i` | `text.startswith("$$", i)` | `text.startsWith("$$", i)` |
| Find substring from `start` | `text.find("$$", start)` | `text.indexOf("$$", start)` *(returns `-1` if absent)* |
| Half-open slice `[a, b)` | `text[a:b]` | `text.slice(a, b)` |
| Trim whitespace | `s.strip()` | `s.trim()` |

---

## 4. Collections

| Operation | Python | TypeScript |
| :--- | :--- | :--- |
| Typed empty list | `segments: list[Segment] = []` | `const segments: Segment[] = [];` |
| Append | `segments.append(item)` | `segments.push(item);` |
| Last element | `segments[-1]` | `segments[segments.length - 1]` |
| Iterate | `for d in DELIMITERS:` | `for (const d of DELIMITERS) { ... }` |
| `O(1)` membership set | `cmd in FORBIDDEN` | `FORBIDDEN_SET.has(cmd)` |
