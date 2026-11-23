import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const RELEASE_DIR = path.join(ROOT, "release");

/**
 * Standard IEEE 802.3 CRC-32 lookup table for PKZIP archives.
 */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Recursively collects all files inside `dir` sorted lexicographically,
 * returning paths relative to `baseDir` with POSIX forward slashes.
 */
async function collectFiles(dir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === "Thumbs.db") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, baseDir)));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).split(path.sep).join("/");
      files.push({ fullPath, relPath });
    }
  }
  return files;
}

/**
 * Builds a deterministic, Chrome-Web-Store-compliant PKZIP buffer using only
 * Node.js built-ins (forward-slash paths, UTF-8 flag, deflate compression).
 */
async function buildZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { fullPath, relPath } of files) {
    const raw = await readFile(fullPath);
    const compressed = deflateRawSync(raw, { level: 9 });
    const useDeflate = compressed.length < raw.length;
    const payload = useDeflate ? compressed : raw;
    const method = useDeflate ? 8 : 0;
    const checksum = crc32(raw);
    const nameBuf = Buffer.from(relPath, "utf8");

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8); // compression method
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0x5421, 12); // fixed mod date (deterministic)
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuf, payload);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 filename flag
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir start disk
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDir, eocd]);
}

async function main() {
  // 1. Always produce a fresh production build in dist/
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], {
    stdio: "inherit",
  });

  // 2. Verify package.json and dist/manifest.json versions match
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const manifest = JSON.parse(
    await readFile(path.join(DIST_DIR, "manifest.json"), "utf8")
  );
  if (pkg.version !== manifest.version) {
    throw new Error(
      `Version mismatch: package.json (${pkg.version}) != manifest.json (${manifest.version})`
    );
  }

  // 3. Collect dist/ files and write release/latex-on-x-v<version>.zip
  const files = await collectFiles(DIST_DIR);
  if (!files.some((f) => f.relPath === "manifest.json")) {
    throw new Error("Missing manifest.json at the root of dist/");
  }

  await mkdir(RELEASE_DIR, { recursive: true });
  const zipName = `latex-on-x-v${manifest.version}.zip`;
  const zipPath = path.join(RELEASE_DIR, zipName);
  const zipBuf = await buildZipBuffer(files);
  await writeFile(zipPath, zipBuf);

  const info = await stat(zipPath);
  const sizeKb = (info.size / 1024).toFixed(1);
  console.log(
    `✓ Packaged ${files.length} files into release/${zipName} (${sizeKb} KB)`
  );
}

await main();
