// js/visionneuse.js — affichage d'un document conserve (PDF page par page via pdf.js, image, texte)
import { ech } from "./format.js";
let lib;
async function pdfjs() { if (!lib) { lib = await import("../vendor/pdf.min.mjs"); lib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href; } return lib; }
// Rend une fonction de demontage (revoque l'URL du blob, libere le PDF)
export async function monterVisionneuse(el, { blob, type, nom }) {
  const url = URL.createObjectURL(blob);
  const ouvrir = `<a class="btn sec" href="${url}" target="_blank" rel="noopener">Ouvrir</a>`;
  el.hidden = false;
  if (type.startsWith("image/")) { el.innerHTML = `<img src="${url}" alt="${ech(nom)}"><div class="barre"><span>${ech(nom)}</span>${ouvrir}</div>`; return () => URL.revokeObjectURL(url); }
  if (type.startsWith("text/")) { el.innerHTML = `<div class="texte-officiel" style="padding:8px">${ech(await blob.text())}</div><div class="barre"><span>${ech(nom)}</span>${ouvrir}</div>`; return () => URL.revokeObjectURL(url); }
  if (type !== "application/pdf") { el.innerHTML = `<div class="barre"><span>${ech(nom)} : aperçu indisponible</span>${ouvrir}</div>`; return () => URL.revokeObjectURL(url); }
  el.innerHTML = `<canvas></canvas><div class="barre"><button type="button" data-page="-1" aria-label="Page précédente">‹</button><span class="num">…</span><button type="button" data-page="1" aria-label="Page suivante">›</button>${ouvrir}</div>`;
  let doc, page = 1, vivant = true;
  try { doc = await (await pdfjs()).getDocument({ data: await blob.arrayBuffer() }).promise; } catch { el.querySelector(".num").textContent = "PDF illisible"; return () => URL.revokeObjectURL(url); }
  const canvas = el.querySelector("canvas"), num = el.querySelector(".num");
  async function afficher() {
    const p = await doc.getPage(page); const base = p.getViewport({ scale: 1 });
    const largeur = Math.max(200, el.clientWidth || 360); const echelle = largeur / base.width; const vp = p.getViewport({ scale: echelle * (window.devicePixelRatio || 1) });
    canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = "100%";
    await p.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    if (vivant) num.textContent = `${nom} — page ${page} / ${doc.numPages}`;
  }
  for (const b of el.querySelectorAll("[data-page]")) b.addEventListener("click", () => { const n = page + Number(b.dataset.page); if (n >= 1 && n <= doc.numPages) { page = n; afficher(); } });
  await afficher();
  return () => { vivant = false; URL.revokeObjectURL(url); doc.destroy?.(); };
}
