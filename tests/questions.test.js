// tests/questions.test.js — construction de la requete a Claude, historique, couts, libelles (module pur)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { construireRequete, verifierTaille, estimerCout, formaterCout, nouvelleQuestion, messageErreur, normaliserQuestions, contexteFiche, HISTORIQUE_MAX, SUGGESTIONS, SYSTEME } from "../js/questions.js";
const F = JSON.parse(readFileSync(new URL("./fixtures/fiches-mini.json", import.meta.url))).fiches;
const fiche = F.find((f) => f.code === "BAT-TH-163");
const pdf = { nom: "devis.pdf", type: "application/pdf", base64: "JVBERi0=" };
const photo = { nom: "photo.jpg", type: "image/jpeg", base64: "/9j/4AAQ" };
const txt = { nom: "notes.txt", type: "text/plain", texte: "PAC 160 kW" };

test("requête : documents étiquetés, cache sur le dernier document, question en dernier", () => {
  const r = construireRequete({ fichiers: [pdf, photo, txt], question: "Ce devis est-il conforme ?" });
  assert.equal(r.messages.length, 1);
  const c = r.messages[0].content;
  assert.deepEqual(c.map((b) => b.type), ["text", "document", "text", "image", "text", "text"]);
  assert.equal(c[0].text, "Document 1 : devis.pdf");
  assert.equal(c[1].source.media_type, "application/pdf");
  assert.equal(c[3].source.media_type, "image/jpeg");
  assert.deepEqual(c[3].cache_control, { type: "ephemeral" });
  assert.equal(c[1].cache_control, undefined);
  assert.ok(c[4].text.startsWith("Document 3 : notes.txt"));
  assert.equal(c[5].text, "Ce devis est-il conforme ?");
  assert.equal(r.system[0].text, SYSTEME);
  assert.deepEqual(r.system[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(r.ignores, []);
});
test("requête : type inconnu ignoré et signalé", () => {
  const r = construireRequete({ fichiers: [{ nom: "x.heic", type: "image/heic", base64: "AA==" }], question: "?" });
  assert.deepEqual(r.ignores, ["x.heic"]);
  assert.deepEqual(r.messages[0].content.map((b) => b.type), ["text"]);
});
test("requête : sans fichier, le texte extrait précède la question", () => {
  const r = construireRequete({ fichiers: [], texteExtrait: "Devis n° 12", question: "Résume." });
  const c = r.messages[0].content;
  assert.equal(c.length, 2);
  assert.ok(c[0].text.includes("Devis n° 12"));
  assert.equal(c[1].text, "Résume.");
});
test("requête : historique limité aux 8 derniers échanges ok, alternance, cache sur la dernière réponse", () => {
  const questions = [];
  for (let i = 1; i <= 10; i++) questions.push({ question: "Q" + i, reponse: "R" + i, etat: "ok" });
  questions.push({ question: "Qerr", reponse: "", etat: "erreur" });
  const r = construireRequete({ fichiers: [pdf], questions, question: "Qnouvelle" });
  assert.equal(r.messages.length, 2 * HISTORIQUE_MAX + 1);
  assert.equal(r.messages[0].content.at(-1).text, "Q3");
  assert.equal(r.messages[1].role, "assistant");
  assert.equal(r.messages[1].content[0].text, "R3");
  assert.deepEqual(r.messages.at(-2).content[0].cache_control, { type: "ephemeral" });
  assert.equal(r.messages.at(-1).role, "user");
  assert.equal(r.messages.at(-1).content[0].text, "Qnouvelle");
  assert.ok(!JSON.stringify(r.messages).includes("Qerr"));
});
test("requête : fiche choisie → second bloc système avec le code et les conditions", () => {
  const texte = "1. Secteur\n2. Conditions pour la délivrance de certificats\nLa pompe...\n3. Durée de vie conventionnelle\n15 ans\n4. Montant de certificats en kWh cumac\nTableau\nAnnexe 1";
  const r = construireRequete({ fichiers: [], question: "?", fiche, texteOfficiel: texte, avis: { commentaire: "à surveiller" } });
  assert.equal(r.system.length, 2);
  assert.ok(r.system[1].text.includes("BAT-TH-163") && r.system[1].text.includes("La pompe...") && r.system[1].text.includes("Tableau") && r.system[1].text.includes("à surveiller"));
  assert.ok(!r.system[1].text.includes("15 ans"));
  assert.equal(contexteFiche(null), "");
});
test("taille : > 30 Mo de base64 ou > 20 images refusé", () => {
  assert.equal(verifierTaille([pdf, photo]), null);
  assert.equal(verifierTaille([{ nom: "gros.pdf", type: "application/pdf", base64: "x".repeat(31 * 1048576) }]), "trop_volumineux");
  assert.equal(verifierTaille(Array.from({ length: 21 }, () => photo)), "trop_images");
});
test("coût : tarif Opus 5, cache lu à 10 %", () => {
  const u = { entree: 1_000_000, cache_lu: 1_000_000, cache_ecrit: 0, sortie: 100_000 };
  assert.equal(estimerCout(u).toFixed(2), "8.00");
  assert.equal(formaterCout({ entree: 500, cache_lu: 11800, cache_ecrit: 0, sortie: 850 }), "12 300 jetons en entrée dont 11 800 lus en cache · 850 en sortie · ≈ 0,03 $");
});
test("nouvelle question, messages d'erreur, suggestions", () => {
  const q = nouvelleQuestion("  Bonjour ? ");
  assert.equal(q.question, "Bonjour ?"); assert.equal(q.etat, "en_cours"); assert.ok(q.id && q.le);
  assert.ok(messageErreur("cle").includes("Réglages"));
  assert.ok(messageErreur("requete", "prompt is too long").includes("prompt is too long"));
  assert.ok(messageErreur("inexistant").length > 0);
  assert.equal(SUGGESTIONS.length, 3);
  assert.ok(SUGGESTIONS[1].texte.includes("COFRAC"));
});
test("normaliser : une question restée en cours devient une erreur « interrompue »", () => {
  const [a, b] = normaliserQuestions([{ question: "Q", reponse: "partiel", etat: "en_cours" }, { question: "Q2", reponse: "R", etat: "ok" }]);
  assert.equal(a.etat, "erreur"); assert.equal(a.erreur, "interrompue"); assert.equal(a.reponse, "partiel"); assert.equal(b.etat, "ok");
});
