# Rust & WebAssembly Core Guide (From Haskell, Python, and TypeScript)

This guide explains how [`crates/latex-core/`](../crates/latex-core) ports the pure parser and anti-DoS validator to Rust and compiles them into a **37.5 KB, zero-dependency WebAssembly binary** (`src/wasm/latex_core.wasm`).

---

## 1. Concept Mapping: Haskell / TypeScript -> Rust

If you know Haskell and TypeScript, Rust's type system will feel remarkably familiar:

| Concept | Haskell | TypeScript (`src/core/`) | Rust (`crates/latex-core/`) |
| :--- | :--- | :--- | :--- |
| Sum type (ADT) | `data Segment = Text String \| Math ...` | Discriminated union (`type: "text" \| "math"`) | `enum Segment<'a> { Text(&'a str), Math { ... } }` |
| Optional value | `Maybe a` (`Just x`, `Nothing`) | `T \| null` | `Option<T>` (`Some(x)`, `None`) |
| Error result | `Either Error ()` | `{ ok: true } \| { ok: false, ... }` | `Result<(), ValidationError<'a>>` (`Ok(())`, `Err(e)`) |
| Pattern matching | `case seg of ...` | `if (seg.type === ...)` / `switch` | `match seg { Segment::Text(s) => ..., ... }` |
| Immutable by default | Always immutable | `const` / `readonly` | `let x` (mutable requires explicit `let mut x`) |

---

## 2. Zero-Copy Slicing (`&'a str` vs `String`)

In Python and JavaScript, slicing a string (`text[i:j]` or `text.slice(i, j)`) allocates a brand-new string object on the heap.

In Rust, `&'a str` is a **borrowed fat pointer** (`(ptr, byte_len)`) pointing straight into the original input text with lifetime `'a`:

```rust
pub enum Segment<'a> {
    Text(&'a str),
    Math {
        content: &'a str,
        mode: MathDisplayMode,
        raw: &'a str,
    },
}
```

Because every literal text chunk and every trimmed formula inside `parse_math_segments` is a contiguous sub-slice of `text`, the Rust parser performs **zero heap string copies**. Even coalescing adjacent text spans (`push_text_span`) simply extends the slice end index in `O(1)`.

---

## 3. Why the Byte Fast-Path Is Mathematically UTF-8 Safe

Inside `crates/latex-core/src/parser.rs`, the scanner skips plain text directly over raw UTF-8 bytes:

```rust
if bytes[i] != b'$' && bytes[i] != b'\\' {
    let start = i;
    i += 1;
    while i < len && bytes[i] != b'$' && bytes[i] != b'\\' {
        i += 1;
    }
    push_text_span(&mut segments, text, start, i);
    continue;
}
```

Why can this never split a multi-byte character (such as `á`, `π`, `公式`, or emoji)?
- UTF-8 is self-synchronizing: every ASCII byte (`0x00..=0x7F`) only ever represents itself.
- Multi-byte UTF-8 sequences exclusively use bytes `0x80..=0xF4` (leading bytes `0xC2..=0xF4`, continuation bytes `0x80..=0xBF`).
- Therefore `b'$'` (`0x24`) and `b'\\'` (`0x5C`) can never appear inside a multi-byte character, guaranteeing that `i` always stops on a valid UTF-8 character boundary.

---

## 4. Zero-Dependency WebAssembly Linear Memory ABI

Instead of pulling dozens of crates via `wasm-bindgen` + `serde`, `crates/latex-core/src/wasm.rs` talks directly to JavaScript through WebAssembly's shared linear memory (`WebAssembly.Memory`):

1. **JS -> WASM:** `src/wasm/wasmCore.ts` encodes UTF-8 text into a reusable scratch buffer allocated once with `wasm_alloc`.
2. **Rust computes:** `parse_math_segments_wasm` writes a flat `u32` offset table (`[count, tag, mode, content_start, content_end, raw_start, raw_end, ...]`) using simple pointer arithmetic (`slice.as_ptr() - base_ptr`).
3. **WASM -> JS:** JavaScript reads the `Uint32Array` view and decodes only the final slice boundaries with `TextDecoder`.

### Why Batched WASM Beats Per-Call FFI

Running `npm run bench` over 10,000 mixed X posts reveals a classic systems lesson:
- **Per-post FFI (10,000 JS <-> WASM crossings):** `1.65x` faster than TypeScript, because each call still pays UTF-8 encoding and `TextDecoder` overhead across the boundary.
- **Batched linear memory (1 crossing for all 10,000 posts):** `8.02x` faster than TypeScript (~3.9 million posts/second), because the FFI cost is amortized once and LLVM's tight byte loop runs at near-native speed.
