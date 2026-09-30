import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggererFiches, extraireParametres, construireDossier, DEVIS_MAX, nouveauDossier } from "../js/dossier.js";
const F = JSON.parse(readFileSync(new URL("./fixtures/fiches-mini.json", import.meta.url))).fiches;
const DEVIS = `DEVIS n° 2026-118 — SAS Thermoclim
Client : EHPAD Les Tilleuls, 5 000 m² chauffés, Lyon (69)
Fourniture et pose d'une pompe à chaleur air/eau collective 160 kW, Etas 178 %, en remplacement de la chaudière fioul 400 kW (dépose et évacuation de la cuve comprises)
Chaudière gaz à condensation 240 kW en appoint
Montant total HT : 148 500,00 € — TVA 20 % — TTC 178 200,00 €`;

test("suggestion : code cite, mots-cles, secteur", () => {
  const s = suggererFiches("Devis BAT-TH-163 pompe à chaleur", F);
  assert.equal(s[0].code, "BAT-TH-163"); assert.ok(s[0].score >= 100); assert.ok(s[0].raisons[0].includes("cité"));
  const s2 = suggererFiches(DEVIS, F);
  assert.ok(s2.length <= 5 && s2.length > 0);
  assert.ok(s2.slice(0, 3).some((x) => x.code === "BAT-TH-163"), JSON.stringify(s2));
  assert.deepEqual(suggererFiches("", F), []);
  assert.ok(suggererFiches(DEVIS, F).every((x) => F.find((f) => f.code === x.code).statut === "active"));
});
test("parametres", () => {
  const p = extraireParametres(DEVIS);
  assert.equal(p.puissance_kw, 160); assert.equal(p.surface_m2, 5000); assert.equal(p.etas, 178);
  assert.equal(p.montant_ht, 148500); assert.equal(p.energie, "fioul"); assert.equal(p.secteur, "tertiaire");
  assert.equal(extraireParametres("rien").puissance_kw, null);
  assert.equal(extraireParametres("COP 4,2 · SCOP 3.9 · zone H2").cop, 4.2);
  assert.equal(extraireParametres("zone climatique H2").zone, "H2");
});
test("dossier : contenu, troncature", () => {
  const fiche = F.find((f) => f.code === "BAT-TH-163");
  const texteOfficiel = "1. Secteur\nTertiaire\n3. Conditions pour la délivrance de certificats\nLa PAC…\n4. Durée de vie conventionnelle\n17 ans\n5. Montant de certificats en kWh cumac\nTableau…\n";
  const d = construireDossier({ fiche, texteOfficiel, parametres: extraireParametres(DEVIS), devisTexte: DEVIS, fichiers: [{ nom: "devis.pdf", type: "application/pdf", taille: 1234 }], avis: { avis: "up", commentaire: "" }, aujourdhui: "2026-09-30" });
  for (const attendu of ["# Expertise CEE", "BAT-TH-163", "PAC air/eau (tertiaire)", "7 €/MWh", "0 €", "Conditions pour la délivrance", "Montant de certificats", "148 500", "devis.pdf", "160 kW", "Coup de pouce"]) assert.ok(d.includes(attendu), attendu);
  assert.ok(d.indexOf("# Expertise CEE") < d.indexOf("## Fiche") && d.indexOf("## Fiche") < d.indexOf("## Devis"));
  const long = construireDossier({ fiche, texteOfficiel, parametres: {}, devisTexte: "x".repeat(DEVIS_MAX + 500), fichiers: [], aujourdhui: "2026-09-30" });
  assert.ok(long.includes("tronqué")); assert.ok(long.length < DEVIS_MAX + 9000);
  const sans = construireDossier({ fiche, texteOfficiel: "", parametres: {}, devisTexte: "", fichiers: [{ nom: "photo.jpg", type: "image/jpeg", taille: 10 }], aujourdhui: "2026-09-30" });
  assert.ok(sans.includes("photo.jpg") && sans.includes("joint"));
});
test("nouveauDossier", () => {
  const d = nouveauDossier({ fiche: "BAT-TH-163" });
  assert.ok(d.id && d.cree_le && d.etat === "brouillon" && d.fiche === "BAT-TH-163" && Array.isArray(d.fichiers));
});
