import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";

const ROOT = process.cwd();
const POST_COUNT = 10_000;
const WARMUP_RUNS = 3;
const MEASURED_RUNS = 9;

// Bundle TS modules in-memory to run directly on Node without needing tsx/ts-node
async function loadCompiledModules() {
  const result = await build({
    stdin: {
      contents: `
        export { parseMathSegments } from "./src/core/parser.ts";
        export { validateLatex } from "./src/core/validator.ts";
        export { loadWasmCore } from "./src/wasm/wasmCore.ts";
      `,
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });

  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(dataUrl);
}

function buildDataset(count) {
  const templates = [
    "Just scrolling X today. Great thread on systems engineering and compilers.",
    "Markets update: spent $50 on $BTC and watched $TSLA move between $180 and $210.",
    "Euler's identity \\(e^{i\\pi} + 1 = 0\\) links five fundamental constants in math.",
    "Riemann zeta function: $$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}$$ for \\(\\operatorname{Re}(s) > 1\\).",
    "Gaussian integral \\[\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}\\] is pure beauty.",
    "Chemistry equilibrium: $$\\ce{CO2 + C <=> 2 CO}$$ at \\(\\pu{1000 K}\\).",
    "Draft with unclosed $$\\frac{a}{b} and valid inline \\(x^2 + y^2 = r^2\\).",
    "Broken brace test $$\\frac{1}{2$$ and disallowed macro $$\\def\\x{1}\\x$$.",
    "Fórmula en español y 公式 en chino: \\(\\forall \\epsilon > 0, \\exists \\delta > 0\\).",
    "Regular post mentioning C:\\Users\\dev\\notes and newline \\n escapes without math.",
  ];

  const posts = new Array(count);
  for (let i = 0; i < count; i += 1) {
    posts[i] = templates[i % templates.length];
  }
  return posts;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function benchmark(label, fn) {
  let lastCount = 0;
  for (let i = 0; i < WARMUP_RUNS; i += 1) {
    lastCount = fn();
  }

  const samples = [];
  for (let i = 0; i < MEASURED_RUNS; i += 1) {
    const t0 = performance.now();
    lastCount = fn();
    samples.push(performance.now() - t0);
  }

  const medMs = median(samples);
  const minMs = Math.min(...samples);
  const postsPerSec = Math.round((POST_COUNT / medMs) * 1000);
  return { label, medMs, minMs, postsPerSec, validFormulas: lastCount };
}

const { parseMathSegments, validateLatex, loadWasmCore } =
  await loadCompiledModules();
const wasmPath = path.join(ROOT, "src", "wasm", "latex_core.wasm");
const wasmBytes = await readFile(wasmPath);
const wasm = await loadWasmCore(wasmBytes);

const posts = buildDataset(POST_COUNT);
const packedBatch = new TextEncoder().encode(posts.join("\0"));

const tsRes = benchmark("TypeScript (V8 JIT, 10k posts)", () => {
  let valid = 0;
  for (let i = 0; i < posts.length; i += 1) {
    const segs = parseMathSegments(posts[i]);
    for (let j = 0; j < segs.length; j += 1) {
      if (segs[j].type === "math" && validateLatex(segs[j].content).ok) {
        valid += 1;
      }
    }
  }
  return valid;
});

const wasmPerPostRes = benchmark("Rust/WASM (per-post FFI, 10k calls)", () => {
  let valid = 0;
  for (let i = 0; i < posts.length; i += 1) {
    const segs = wasm.parseMathSegments(posts[i]);
    for (let j = 0; j < segs.length; j += 1) {
      if (segs[j].type === "math" && wasm.validateLatex(segs[j].content).ok) {
        valid += 1;
      }
    }
  }
  return valid;
});

const wasmBatchRes = benchmark("Rust/WASM (batched linear memory, 1 call)", () => {
  return wasm.processBatch(packedBatch);
});

wasm.dispose();

if (
  tsRes.validFormulas !== wasmPerPostRes.validFormulas ||
  tsRes.validFormulas !== wasmBatchRes.validFormulas
) {
  throw new Error(
    `Result mismatch! TS=${tsRes.validFormulas}, WASM_FFI=${wasmPerPostRes.validFormulas}, WASM_BATCH=${wasmBatchRes.validFormulas}`
  );
}

console.log(
  `\nLaTeX on X Benchmark: ${POST_COUNT.toLocaleString()} mixed X posts (${tsRes.validFormulas.toLocaleString()} valid formulas)`
);
console.log(
  `WASM binary size: ${(wasmBytes.byteLength / 1024).toFixed(1)} KB | Node ${process.version}\n`
);

for (const r of [tsRes, wasmPerPostRes, wasmBatchRes]) {
  const ratio = (tsRes.medMs / r.medMs).toFixed(2);
  console.log(
    `${r.label.padEnd(44)} | median: ${r.medMs.toFixed(2).padStart(6)} ms | min: ${r.minMs.toFixed(2).padStart(6)} ms | ${r.postsPerSec.toLocaleString().padStart(10)} posts/s | ${ratio}x vs TS`
  );
}
console.log("");
