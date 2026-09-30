// js/images.js — reduction des photos avant stockage et envoi (cote long <= 2000 px, JPEG)
export const COTE_MAX = 2000;
export function dimensionsReduites(l, h, max = COTE_MAX) {
  const k = Math.min(1, max / Math.max(l, h, 1));
  return { l: Math.max(1, Math.round(l * k)), h: Math.max(1, Math.round(h * k)), reduit: k < 1 };
}
export async function reduireImage(file, max = COTE_MAX, qualite = 0.85) {
  if (!file.type.startsWith("image/")) return file;
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return file; }   // format non decodable : original conserve
  const { l, h, reduit } = dimensionsReduites(bitmap.width, bitmap.height, max);
  if (!reduit && file.type === "image/jpeg" && file.size <= 3 * 1048576) { bitmap.close(); return file; }
  const canvas = document.createElement("canvas"); canvas.width = l; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, l, h); bitmap.close();
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualite));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}
