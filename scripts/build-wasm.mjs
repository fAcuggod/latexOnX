import { execFileSync } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CRATE_MANIFEST = path.join(ROOT, "crates", "latex-core", "Cargo.toml");
const BUILT_WASM = path.join(
  ROOT,
  "crates",
  "latex-core",
  "target",
  "wasm32-unknown-unknown",
  "release",
  "latex_core.wasm"
);
const OUT_DIR = path.join(ROOT, "src", "wasm");
const OUT_WASM = path.join(OUT_DIR, "latex_core.wasm");

execFileSync(
  "cargo",
  [
    "build",
    "--manifest-path",
    CRATE_MANIFEST,
    "--target",
    "wasm32-unknown-unknown",
    "--release",
  ],
  { stdio: "inherit" }
);

await mkdir(OUT_DIR, { recursive: true });
await copyFile(BUILT_WASM, OUT_WASM);

const info = await stat(OUT_WASM);
const kb = (info.size / 1024).toFixed(1);
console.log(`✓ Rust/WASM core built in src/wasm/latex_core.wasm (${kb} KB)`);
