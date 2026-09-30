// js/pdf.js — texte d'un PDF (pdf.js vendu)
let lib;
async function pdfjs() {
  if (!lib) { lib = await import("../vendor/pdf.min.mjs"); lib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href; }
  return lib;
}
export async function texteDuPdf(file, maxPages = 60) {
  const p = await pdfjs();
  const doc = await p.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    let ligne = [], y = null, out = [];
    for (const it of c.items) { if (y !== null && Math.abs(it.transform[5] - y) > 3) { out.push(ligne.join(" ")); ligne = []; } y = it.transform[5]; if (it.str) ligne.push(it.str); }
    out.push(ligne.join(" ")); pages.push(out.join("\n"));
  }
  return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
}
export function fichiersVersEntrees(files) { return [...files].map((f) => ({ nom: f.name, type: f.type, taille: f.size })); }
