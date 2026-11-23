import type {
  MathDisplayMode,
  Segment,
  ValidationResult,
} from "../core/types.js";
import {
  DEFAULT_VALIDATION_LIMITS,
  type ValidationLimits,
} from "../core/validator.js";

interface LatexCoreWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  wasm_alloc(len: number): number;
  wasm_dealloc(ptr: number, len: number): void;
  parse_math_segments_wasm(ptr: number, len: number): number;
  validate_latex_wasm(
    ptr: number,
    len: number,
    maxLength: number,
    maxBraceDepth: number
  ): number;
  last_forbidden_start(): number;
  last_forbidden_end(): number;
  process_batch_wasm(
    ptr: number,
    len: number,
    maxLength: number,
    maxBraceDepth: number
  ): number;
}

export interface WasmCore {
  parseMathSegments(text: string): Segment[];
  validateLatex(
    formula: string,
    limits?: Partial<ValidationLimits>
  ): ValidationResult;
  processBatch(
    packedUtf8: Uint8Array,
    limits?: Partial<ValidationLimits>
  ): number;
  dispose(): void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Instantiates the zero-dependency Rust/WebAssembly core (`latex_core.wasm`)
 * from raw WASM bytes, exposing an API identical to `src/core/parser.ts` and
 * `src/core/validator.ts`.
 *
 * Uses a reusable linear-memory scratch buffer to minimize per-call allocator
 * traffic across the JS/WASM boundary.
 */
export async function loadWasmCore(wasmBytes: BufferSource): Promise<WasmCore> {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const exports = instance.exports as LatexCoreWasmExports;

  let scratchPtr = 0;
  let scratchCap = 0;

  const ensureScratch = (needed: number): number => {
    if (needed === 0) return 0;
    if (needed <= scratchCap && scratchPtr !== 0) {
      return scratchPtr;
    }
    if (scratchPtr !== 0) {
      exports.wasm_dealloc(scratchPtr, scratchCap);
    }
    const nextCap = Math.max(needed, scratchCap * 2, 1024);
    scratchPtr = exports.wasm_alloc(nextCap);
    scratchCap = nextCap;
    return scratchPtr;
  };

  const writeUtf8 = (text: string): { ptr: number; len: number } => {
    if (text.length === 0) return { ptr: 0, len: 0 };
    // Worst-case UTF-8 byte expansion is 3x UTF-16 code units
    const maxBytes = text.length * 3;
    const ptr = ensureScratch(maxBytes);
    const dest = new Uint8Array(exports.memory.buffer, ptr, maxBytes);
    const { written } = encoder.encodeInto(text, dest);
    return { ptr, len: written };
  };

  return {
    parseMathSegments(text: string): Segment[] {
      if (text.length === 0) return [];

      const { ptr, len } = writeUtf8(text);
      const outPtr = exports.parse_math_segments_wasm(ptr, len);

      // Re-acquire views after WASM call in case linear memory grew
      const memoryBuffer = exports.memory.buffer;
      const header = new Uint32Array(memoryBuffer, outPtr, 1);
      const count = header[0];
      if (count === 0) return [];

      const table = new Uint32Array(memoryBuffer, outPtr + 4, count * 6);
      const inputBytes = new Uint8Array(memoryBuffer, ptr, len);
      const segments: Segment[] = new Array(count);

      for (let k = 0; k < count; k += 1) {
        const base = k * 6;
        const tag = table[base];
        const modeNum = table[base + 1];
        const contentStart = table[base + 2];
        const contentEnd = table[base + 3];
        const rawStart = table[base + 4];
        const rawEnd = table[base + 5];

        if (tag === 0) {
          segments[k] = {
            type: "text",
            content: decoder.decode(inputBytes.subarray(contentStart, contentEnd)),
          };
        } else {
          const mode: MathDisplayMode = modeNum === 1 ? "display" : "inline";
          segments[k] = {
            type: "math",
            content: decoder.decode(inputBytes.subarray(contentStart, contentEnd)),
            mode,
            raw: decoder.decode(inputBytes.subarray(rawStart, rawEnd)),
          };
        }
      }

      return segments;
    },

    validateLatex(
      formula: string,
      limits?: Partial<ValidationLimits>
    ): ValidationResult {
      const maxLength = limits?.maxLength ?? DEFAULT_VALIDATION_LIMITS.maxLength;
      const maxBraceDepth =
        limits?.maxBraceDepth ?? DEFAULT_VALIDATION_LIMITS.maxBraceDepth;

      const { ptr, len } = writeUtf8(formula);
      const status = exports.validate_latex_wasm(
        ptr,
        len,
        maxLength,
        maxBraceDepth
      );

      switch (status) {
        case 0:
          return { ok: true };
        case 1:
          return { ok: false, reason: "empty", message: "Formula is empty." };
        case 2:
          return {
            ok: false,
            reason: "too_long",
            message: `Formula exceeds the maximum length of ${maxLength} characters.`,
          };
        case 3:
          return {
            ok: false,
            reason: "too_deep",
            message: `Formula exceeds the maximum brace nesting depth of ${maxBraceDepth}.`,
          };
        case 4:
          return {
            ok: false,
            reason: "unbalanced_braces",
            message: "Formula contains unbalanced braces.",
          };
        case 5: {
          const start = exports.last_forbidden_start();
          const end = exports.last_forbidden_end();
          const inputBytes = new Uint8Array(exports.memory.buffer, ptr, len);
          const cmd = decoder.decode(inputBytes.subarray(start, end));
          return {
            ok: false,
            reason: "forbidden_command",
            message: `Formula contains disallowed command ${cmd}.`,
          };
        }
        default:
          return {
            ok: false,
            reason: "empty",
            message: "Unknown validation error.",
          };
      }
    },

    processBatch(
      packedUtf8: Uint8Array,
      limits?: Partial<ValidationLimits>
    ): number {
      if (packedUtf8.byteLength === 0) return 0;
      const maxLength = limits?.maxLength ?? DEFAULT_VALIDATION_LIMITS.maxLength;
      const maxBraceDepth =
        limits?.maxBraceDepth ?? DEFAULT_VALIDATION_LIMITS.maxBraceDepth;

      const ptr = ensureScratch(packedUtf8.byteLength);
      new Uint8Array(exports.memory.buffer, ptr, packedUtf8.byteLength).set(
        packedUtf8
      );
      return exports.process_batch_wasm(
        ptr,
        packedUtf8.byteLength,
        maxLength,
        maxBraceDepth
      );
    },

    dispose(): void {
      if (scratchPtr !== 0) {
        exports.wasm_dealloc(scratchPtr, scratchCap);
        scratchPtr = 0;
        scratchCap = 0;
      }
    },
  };
}
