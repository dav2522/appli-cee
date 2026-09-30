import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preparerDossier } from "../js/vues/dossiers.js";
const F = JSON.parse(readFileSync(new URL("./fixtures/fiches-mini.json", import.meta.url))).fiches;
test("pdf sans texte : dossier partageable, choix manuel", () => {
  const d = preparerDossier({ fiches: F, textes: {}, texteExtrait: "", fichiers: [{ nom: "scan.pdf", type: "application/pdf", taille: 500 }], fiche: "BAT-TH-163", parametres: {} });
  assert.equal(d.suggestions.length, 0);
  assert.ok(d.dossier.includes("BAT-TH-163") && d.dossier.includes("scan.pdf") && d.dossier.includes("lire le fichier joint"));
});
