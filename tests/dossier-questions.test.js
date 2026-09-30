// tests/dossier-questions.test.js — rendu HTML de la section Documents & questions (pur)
import test from "node:test";
import assert from "node:assert/strict";
import { rendreDocuments, rendreQuestions, libellePoser, rendreHistorique } from "../js/vues/dossier-questions.js";
const etatCle = { reglages: { cle_api: "sk-x" }, ui: {} }, etatSans = { reglages: { cle_api: "" }, ui: {} };
const d = { id: "d1", fichiers: [{ nom: "devis.pdf", type: "application/pdf", taille: 2048, cle: "d1/a" }, { nom: "ancien.pdf", type: "application/pdf", taille: 10 }], questions: [] };
test("documents : liste, taille, non conservé, onglets et zone de visionneuse", () => {
  const h = rendreDocuments(d, { fichierVu: 0 });
  assert.ok(h.includes("devis.pdf") && h.includes("2 Ko") && h.includes("non conservé"));
  assert.ok(h.includes('data-voir="0"') && h.includes('aria-pressed="true"') && h.includes('id="v-zone"') && h.includes('data-retirer="1"') && h.includes('id="d-plus"'));
  assert.ok(rendreDocuments({ ...d, fichiers: [] }, {}).includes("Aucun document"));
});
test("questions : libellé selon la clé, suggestions, réponse courante en streaming", () => {
  assert.equal(libellePoser(etatCle), "Poser la question"); assert.equal(libellePoser(etatSans), "Partager la question vers Claude");
  const h = rendreQuestions({ ...etatCle, ui: { reponseCourante: { question: "Q ?", texte: "Le devis est **conforme**.", etat: "en_cours" }, enCours: true } }, d);
  assert.ok(h.includes('data-sugg="0"') && h.includes('id="q-texte"') && h.includes("Poser la question"));
  assert.ok(h.includes("<b>conforme</b>") && !h.includes('id="q-arreter" hidden'));
  const h2 = rendreQuestions({ ...etatSans, ui: {} }, d);
  assert.ok(h2.includes("Partager la question vers Claude") && h2.includes('id="q-arreter" hidden'));
});
test("historique : compte, ordre inverse, réponse dépliable, partage → zone à coller, erreur affichée", () => {
  const dd = { ...d, questions: [
    { id: "a", le: "2026-09-30T08:00:00.000Z", question: "Q1", reponse: "R1", etat: "ok", usage: { entree: 10, cache_lu: 0, cache_ecrit: 0, sortie: 5 } },
    { id: "b", le: "2026-09-30T09:00:00.000Z", question: "Q2", reponse: "", etat: "partage" },
    { id: "c", le: "2026-09-30T10:00:00.000Z", question: "Q3", reponse: "partiel", etat: "erreur", erreur: "interrompue" }] };
  const h = rendreHistorique(dd);
  assert.ok(h.includes("Historique — 3 questions"));
  assert.ok(h.indexOf("Q3") < h.indexOf("Q2") && h.indexOf("Q2") < h.indexOf("Q1"));
  assert.ok(h.includes('data-coller="b"') && h.includes('data-supprimer-q="a"') && h.includes('data-reprendre="a"'));
  assert.ok(h.includes("interrompue") && h.includes("R1") && h.includes("jetons"));
  assert.ok(rendreHistorique(d).includes("Historique — 0 question"));
});
