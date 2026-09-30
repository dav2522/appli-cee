// tests/dossier-questions.test.js — rendu HTML de la section Documents & questions (pur)
import test from "node:test";
import assert from "node:assert/strict";
import { rendreDocuments, rendreQuestions, rendreHistorique } from "../js/vues/dossier-questions.js";
const d = { id: "d1", fichiers: [{ nom: "devis.pdf", type: "application/pdf", taille: 2048, cle: "d1/a" }, { nom: "ancien.pdf", type: "application/pdf", taille: 10 }], questions: [] };
test("documents : liste, taille, non conservé, onglets et zone de visionneuse", () => {
  const h = rendreDocuments(d, { fichierVu: 0 });
  assert.ok(h.includes("devis.pdf") && h.includes("2 Ko") && h.includes("non conservé"));
  assert.ok(h.includes('data-voir="0"') && h.includes('aria-pressed="true"') && h.includes('id="v-zone"') && h.includes('data-retirer="1"') && h.includes('id="d-plus"'));
  assert.ok(rendreDocuments({ ...d, fichiers: [] }, {}).includes("Aucun document"));
});
test("questions : bouton « Ouvrir dans Claude », suggestions, ni clé ni coût", () => {
  const h = rendreQuestions({ reglages: {}, ui: { brouillonQuestion: "Brouillon" } }, d);
  assert.ok(h.includes('id="q-ouvrir"') && h.includes("Ouvrir dans Claude") && h.includes('data-sugg="0"') && h.includes('id="q-texte"') && h.includes("Brouillon"));
  assert.ok(!/clé|jetons|\$/.test(h));
});
test("historique : ordre inverse, réponse collée dépliable, sinon zone à coller", () => {
  const dd = { ...d, questions: [
    { id: "a", le: "2026-09-30T08:00:00.000Z", question: "Q1", reponse: "R **1**", etat: "ok" },
    { id: "b", le: "2026-09-30T09:00:00.000Z", question: "Q2", reponse: "", etat: "partage" }] };
  const h = rendreHistorique(dd);
  assert.ok(h.includes("Historique — 2 questions"));
  assert.ok(h.indexOf("Q2") < h.indexOf("Q1"));
  assert.ok(h.includes('data-coller="b"') && !h.includes('data-coller="a"'));
  assert.ok(h.includes("<b>1</b>") && h.includes('data-supprimer-q="a"') && h.includes('data-reprendre="a"'));
  assert.ok(rendreHistorique(d).includes("Historique — 0 question"));
});
