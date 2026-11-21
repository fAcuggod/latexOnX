import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST_EXT = path.join(ROOT, "dist");
const DIST_DEMO = path.join(ROOT, "dist-demo");
const KATEX_DIST = path.join(ROOT, "node_modules", "katex", "dist");

/**
 * Optimizes katex.min.css for modern Chromium:
 * 1. Strips legacy `.woff` and `.ttf` fallbacks (Chromium natively supports `.woff2`),
 *    cutting font bundle size from ~1.3 MB down to ~250 KB.
 * 2. Rewrites `url(fonts/...)` for the target context (MV3 extension or web demo).
 */
async function writeOptimizedKatexCss(outFile, fontUrlPrefix) {
  const rawCss = await readFile(path.join(KATEX_DIST, "katex.min.css"), "utf8");

  const woff2OnlyCss = rawCss.replace(
    /url\(fonts\/([^)]+\.woff2)\)\s*format\("woff2"\),url\(fonts\/[^)]+\.woff\)\s*format\("woff"\),url\(fonts\/[^)]+\.ttf\)\s*format\("truetype"\)/g,
    `url("${fontUrlPrefix}$1") format("woff2")`
  );

  await writeFile(outFile, woff2OnlyCss, "utf8");
}

/**
 * Copies only KaTeX `.woff2` font files into `targetFontsDir`.
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
 * Bundles the Chrome Manifest V3 extension into `dist/`.
 * Uses `iife` output format because classic MV3 content scripts declared in
 * `manifest.json` do not directly load ES module imports.
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

  // Static extension assets and Chrome i18n locales
  await cp(path.join(ROOT, "public", "manifest.json"), path.join(DIST_EXT, "manifest.json"));
  await cp(path.join(ROOT, "public", "icons"), path.join(DIST_EXT, "icons"), { recursive: true });
  await cp(path.join(ROOT, "public", "_locales"), path.join(DIST_EXT, "_locales"), {
    recursive: true,
  });
  await cp(path.join(ROOT, "src", "content", "styles.css"), path.join(DIST_EXT, "styles.css"));
  await cp(path.join(ROOT, "src", "popup", "popup.html"), path.join(DIST_EXT, "popup.html"));
  await cp(path.join(ROOT, "src", "popup", "popup.css"), path.join(DIST_EXT, "popup.css"));

  // KaTeX stylesheet & .woff2 fonts exposed to x.com via web_accessible_resources
  await writeOptimizedKatexCss(
    path.join(DIST_EXT, "katex.min.css"),
    "chrome-extension://__MSG_@@extension_id__/fonts/"
  );
  await copyWoff2Fonts(path.join(DIST_EXT, "fonts"));

  console.log("✓ Chrome MV3 extension built in dist/");
}

/**
 * Bundles the interactive web demo with full KaTeX into `dist-demo/`.
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

  console.log("✓ Interactive KaTeX demo built in dist-demo/");
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
