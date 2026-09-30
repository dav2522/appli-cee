// js/partage.js — partage sortant (Web Share) avec repli presse-papiers
export async function partager({ titre, texte, fichiers = [] }) {
  const donnees = { title: titre, text: texte };
  try {
    if (navigator.share) {
      if (fichiers.length && navigator.canShare && navigator.canShare({ files: fichiers })) { await navigator.share({ ...donnees, files: fichiers }); return "partage"; }
      await navigator.share(donnees); return "partage";
    }
  } catch (e) { if (e && e.name === "AbortError") return "annule"; }
  try { await navigator.clipboard.writeText(texte); return "copie"; } catch { return "echec"; }
}
export async function copier(texte) { try { await navigator.clipboard.writeText(texte); return true; } catch { return false; } }
