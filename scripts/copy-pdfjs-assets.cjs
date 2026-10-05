const fs = require("node:fs");
const path = require("node:path");
// Only library assets are public. Applicant PDFs never enter this directory.
const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
const output = path.resolve(__dirname, "../public/pdfjs");
fs.mkdirSync(output, { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
}
for (const [source, target] of [["build/pdf.worker.min.mjs", "pdf.worker.min.mjs"], ["LICENSE", "LICENSE"]]) {
  fs.copyFileSync(path.join(root, source), path.join(output, target));
}
fs.writeFileSync(path.join(output, "version.json"), JSON.stringify({ version: require("pdfjs-dist/package.json").version }));
