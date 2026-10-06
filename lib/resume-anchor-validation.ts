import { anchorMatchesText, type ResumeAnchor } from "@/lib/resume-anchors";
import { Worker } from "node:worker_threads";

// Resolve PDF.js in a native worker, outside Next/Webpack's module rewriting.
const workerCode = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { createRequire } = require('node:module');
  const { dirname, join } = require('node:path');
  const { pathToFileURL } = require('node:url');
  const runtimeRequire = createRequire(workerData.packagePath);
  const root = dirname(runtimeRequire.resolve('pdfjs-dist/package.json'));
  const { getDocument } = await import(pathToFileURL(runtimeRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  const assetPath = folder => join(root, folder).replaceAll('\\\\', '/') + '/';
  const task = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false,
    useSystemFonts: true, useWorkerFetch: false, cMapUrl: assetPath('cmaps'),
    standardFontDataUrl: assetPath('standard_fonts'), verbosity: 0 });
  try {
    const pdf = await task.promise;
    if (workerData.page > pdf.numPages) throw Error('PAGE');
    const content = await (await pdf.getPage(workerData.page)).getTextContent();
    const text = content.items.map(item => 'str' in item ? item.str : '').join('');
    parentPort.postMessage({ text, pageCount: pdf.numPages });
  } finally { await task.destroy(); }
})().catch(() => parentPort.postMessage({ error: true }));
`;
let activeWorkers = 0;
/** Called only after document/panel authorization, on immutable database bytes. No URL ingestion. */
export async function validateResumeAnchor(bytes: Uint8Array, anchor: ResumeAnchor) {
  if (activeWorkers >= 2) throw new Error("Highlight validation is busy. Please retry.");
  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(workerCode, { eval: true, workerData: {
      bytes, page: anchor.page, packagePath: `${process.cwd()}/package.json`,
    }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } });
    activeWorkers++;
    let settled = false;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      void worker.terminate().catch(() => {}).then(() => {
        activeWorkers--;
        if (error) reject(new Error(error)); else resolve();
      });
    };
    const timer = setTimeout(() => finish("Highlight validation timed out. Retry or use general notes."), 8000);
    worker.once("message", result => finish(
      typeof result.text === "string" && anchorMatchesText(anchor, result.text, result.pageCount)
        ? undefined : "Highlight does not match the saved document.",
    ));
    worker.once("error", () => finish("Highlight validation failed. Retry or use general notes."));
    worker.once("exit", () => { if (!settled) finish("Highlight validation failed. Retry or use general notes."); });
  });
}
