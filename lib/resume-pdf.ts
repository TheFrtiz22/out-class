import { Worker } from "node:worker_threads"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { MAX_RESUME_TEXT } from "@/lib/resume-import"

const requirePdf = createRequire(`${process.cwd()}/package.json`)
export const PDF_TIMEOUT_MS = 8_000
// Keep PDF.js outside the Next bundle. The worker has no browser rendering or URL input.
const workerCode = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { getDocument } = await import(workerData.moduleUrl);
  const loading = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false,
    disableFontFace: true, useSystemFonts: false, useWorkerFetch: false, stopAtErrors: true, verbosity: 0 });
  try {
    const doc = await loading.promise;
    if (doc.numPages > 10) throw Error('PAGES');
    let text = '';
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const stream = page.streamTextContent(); const reader = stream.getReader();
      let lastY = null;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        for (const item of value.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y-lastY) > 2) text += '\\n';
          text += item.str + (item.hasEOL ? '\\n' : ' '); lastY = item.hasEOL ? null : y;
          if (text.length > workerData.maxText) throw Error('TEXT');
        }
      }
      text += '\\n'; page.cleanup();
    }
    parentPort.postMessage({ text });
  } finally { await loading.destroy(); }
})().catch(e => parentPort.postMessage({ error: e.message === 'PAGES' ? 'Choose a résumé with no more than 10 pages.' : e.message === 'TEXT' ? 'The PDF contains too much text. Choose a shorter résumé.' : e.name === 'PasswordException' ? 'Password-protected PDFs are unsupported. Upload an unlocked PDF.' : 'This PDF is malformed or unreadable. Export a new text-based PDF and try again.' }));
`
let activeWorkers = 0
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (activeWorkers >= 2) throw Error("PDF processing is busy. Please try again shortly.")
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerCode, { eval: true, workerData: {
      bytes, maxText: MAX_RESUME_TEXT,
      moduleUrl: pathToFileURL(requirePdf.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href,
    }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } })
    activeWorkers++
    let settled = false
    const finish = (error?: string, text?: string) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      void worker.terminate().catch(() => {}).then(() => {
        activeWorkers--
        if (error) reject(Error(error)); else resolve(text!)
      })
    }
    const timer = setTimeout(() => finish("PDF processing took too long. Choose a smaller text-based PDF."), PDF_TIMEOUT_MS)
    worker.once("message", result => {
      if (typeof result.text === "string" && result.text.length <= MAX_RESUME_TEXT) finish(undefined, result.text)
      else finish(typeof result.error === "string" ? result.error : "PDF extraction failed. Try another PDF.")
    })
    worker.once("error", () => finish("PDF processing exceeded its resources or failed. Try a smaller PDF."))
    worker.once("exit", () => { if (!settled) finish("PDF extraction failed. Try another PDF.") })
  })
}
