import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST_EXT = path.join(ROOT, "dist");
const DIST_DEMO = path.join(ROOT, "dist-demo");
const KATEX_DIST = path.join(ROOT, "node_modules", "katex", "dist");

/**
 * Optimiza katex.min.css para Chromium moderno:
 * 1. Elimina los fallbacks legacy `.woff` y `.ttf` (Chrome soporta `.woff2` nativamente),
 *    reduciendo el peso de fuentes de ~1.3 MB a ~250 KB.
 * 2. Reescribe `url(fonts/...)` según el destino (extensión MV3 o demo web).
 */
async function writeOptimizedKatexCss(outFile, fontUrlPrefix) {
  const rawCss = await readFile(path.join(KATEX_DIST, "katex.min.css"), "utf8");

  const woff2OnlyCss = rawCss
    .replace(
      /url\(fonts\/([^)]+\.woff2)\)\s*format\("woff2"\),url\(fonts\/[^)]+\.woff\)\s*format\("woff"\),url\(fonts\/[^)]+\.ttf\)\s*format\("truetype"\)/g,
      `url("${fontUrlPrefix}$1") format("woff2")`
    );

  await writeFile(outFile, woff2OnlyCss, "utf8");
}

/**
 * Copia únicamente las fuentes `.woff2` de KaTeX al directorio indicado.
 */
async function copyWoff2Fonts(targetFontsDir) {
  await mkdir(targetFontsDir, { recursive: true });
  const sourceFontsDir = path.join(KATEX_DIST, "fonts");
  const files = await readdir(sourceFontsDir);

  for (const file of files) {
    if (file.endsWith(".woff2")) {
      await cp(path.join(sourceFontsDir, file), path.join(targetFontsDir, file));
    }
  }
}

/**
 * Empaqueta la extensión de Chrome (Manifest V3) en `dist/`.
 * Nota: Usamos formato `iife` porque los content scripts clásicos en Chrome MV3
 * no cargan módulos ES con `import` directamente desde `manifest.json`.
 */
async function buildExtension() {
  await rm(DIST_EXT, { recursive: true, force: true });
  await mkdir(DIST_EXT, { recursive: true });

  await build({
    entryPoints: {
      content: path.join(ROOT, "src", "content", "index.ts"),
      popup: path.join(ROOT, "src", "popup", "popup.ts"),
    },
    bundle: true,
    format: "iife",
    target: ["chrome114"],
    minify: true,
    outdir: DIST_EXT,
  });

  // Assets estáticos de la extensión
  await cp(path.join(ROOT, "public", "manifest.json"), path.join(DIST_EXT, "manifest.json"));
  await cp(path.join(ROOT, "public", "icons"), path.join(DIST_EXT, "icons"), { recursive: true });
  await cp(path.join(ROOT, "src", "content", "styles.css"), path.join(DIST_EXT, "styles.css"));
  await cp(path.join(ROOT, "src", "popup", "popup.html"), path.join(DIST_EXT, "popup.html"));
  await cp(path.join(ROOT, "src", "popup", "popup.css"), path.join(DIST_EXT, "popup.css"));

  // CSS y fuentes .woff2 de KaTeX accesibles desde x.com vía web_accessible_resources
  await writeOptimizedKatexCss(
    path.join(DIST_EXT, "katex.min.css"),
    "chrome-extension://__MSG_@@extension_id__/fonts/"
  );
  await copyWoff2Fonts(path.join(DIST_EXT, "fonts"));

  console.log("✓ Extensión Chrome MV3 compilada en dist/");
}

/**
 * Empaqueta la demo web interactiva con KaTeX real en `dist-demo/`.
 */
async function buildDemo() {
  await rm(DIST_DEMO, { recursive: true, force: true });
  await mkdir(DIST_DEMO, { recursive: true });

  await build({
    entryPoints: [path.join(ROOT, "src", "demo", "main.ts")],
    bundle: true,
    format: "iife",
    target: ["es2022"],
    minify: true,
    outfile: path.join(DIST_DEMO, "demo.js"),
  });

  await cp(path.join(ROOT, "src", "demo", "index.html"), path.join(DIST_DEMO, "index.html"));
  await cp(path.join(ROOT, "src", "content", "styles.css"), path.join(DIST_DEMO, "styles.css"));
  await writeOptimizedKatexCss(path.join(DIST_DEMO, "katex.min.css"), "fonts/");
  await copyWoff2Fonts(path.join(DIST_DEMO, "fonts"));

  console.log("✓ Demo interactiva con KaTeX real compilada en dist-demo/");
}

const args = new Set(process.argv.slice(2));
if (args.has("--demo")) {
  await buildDemo();
} else if (args.has("--all")) {
  await buildExtension();
  await buildDemo();
} else {
  await buildExtension();
}
