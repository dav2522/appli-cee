// tests/questions.test.js — questions envoyées à l'appli Claude (texte partagé, historique, libellés)
import test from "node:test";
import assert from "node:assert/strict";
import { SUGGESTIONS, nouvelleQuestion, texteAPartager, MESSAGES_PARTAGE } from "../js/questions.js";

test("texte partagé : question, fiche, documents joints et rappel du connecteur", () => {
  const t = texteAPartager({ question: "Ce devis est-il conforme ?", fiche: { code: "BAT-TH-163", titre: "PAC air/eau (tertiaire)" }, fichiers: [{ nom: "devis.pdf" }, { nom: "photo.jpg" }] });
  assert.ok(t.startsWith("Ce devis est-il conforme ?"));
  assert.ok(t.includes("BAT-TH-163 — PAC air/eau (tertiaire)"));
  assert.ok(t.includes("devis.pdf, photo.jpg"));
  assert.ok(t.includes("connecteur « Appli CEE »"));
});
test("texte partagé : sans document conservé, le texte extrait est joint et tronqué", () => {
  const t = texteAPartager({ question: "Résume.", texteExtrait: "x".repeat(20000) });
  assert.ok(t.includes("Texte extrait du document"));
  assert.ok(t.length < 13000);
  assert.ok(!texteAPartager({ question: "Q", fichiers: [{ nom: "a.pdf" }], texteExtrait: "abc" }).includes("Texte extrait"));
});
test("nouvelle question, suggestions et messages de partage", () => {
  const q = nouvelleQuestion("  Q ? ");
  assert.equal(q.question, "Q ?"); assert.equal(q.etat, "partage"); assert.equal(q.reponse, ""); assert.ok(q.id && q.le);
  assert.equal(SUGGESTIONS.length, 3);
  assert.ok(SUGGESTIONS[1].texte.includes("COFRAC"));
  for (const k of ["partage", "copie", "annule", "echec"]) assert.ok(MESSAGES_PARTAGE[k], k);
});
