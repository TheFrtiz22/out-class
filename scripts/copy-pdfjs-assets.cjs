const fs = require("node:fs");
const path = require("node:path");
// Compare content, not timestamps: missing or damaged assets must be repaired.
function changed(source, target) {
  if (fs.statSync(source).isDirectory()) return true;
  try { return !fs.readFileSync(source).equals(fs.readFileSync(target)); }
  catch (error) { if (error.code === "ENOENT") return true; throw error; }
}
function copyAssets(root, output) {
  // Only library assets are public. Applicant PDFs never enter this directory.
  fs.mkdirSync(output, { recursive: true });
  for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
    fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true, filter: changed });
  }
  for (const [source, target] of [["build/pdf.worker.min.mjs", "pdf.worker.min.mjs"], ["LICENSE", "LICENSE"]]) {
    if (changed(path.join(root, source), path.join(output, target))) fs.copyFileSync(path.join(root, source), path.join(output, target));
  }
  const version = JSON.stringify({ version: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version });
  const versionPath = path.join(output, "version.json");
  if (!fs.existsSync(versionPath) || fs.readFileSync(versionPath, "utf8") !== version) fs.writeFileSync(versionPath, version);
}
if (require.main === module) copyAssets(path.dirname(require.resolve("pdfjs-dist/package.json")), path.resolve(__dirname, "../public/pdfjs"));
module.exports = { copyAssets };
