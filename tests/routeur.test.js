import test from "node:test";
import assert from "node:assert/strict";
import { analyserRoute, chemin } from "../js/routeur.js";

test("routes", () => {
  assert.deepEqual(analyserRoute(""), { vue: "accueil", params: {} });
  assert.deepEqual(analyserRoute("#/"), { vue: "accueil", params: {} });
  assert.deepEqual(analyserRoute("#/aujourdhui"), { vue: "aujourdhui", params: {} });     // ancienne adresse conservée
  assert.deepEqual(analyserRoute("#/fiches"), { vue: "fiches", params: {} });
  assert.deepEqual(analyserRoute("#/fiche/BAT-TH-163"), { vue: "fiche", params: { code: "BAT-TH-163" } });
  assert.deepEqual(analyserRoute("#/dossier/nouveau?partage=1"), { vue: "dossier", params: { id: "nouveau", partage: "1" } });
  assert.deepEqual(analyserRoute("#/video/12"), { vue: "video", params: { id: "12" } });
  assert.deepEqual(analyserRoute("#/video"), { vue: "videos", params: {} });
  assert.deepEqual(analyserRoute("#/videos?lien=https%3A%2F%2Fyoutu.be%2Fx"), { vue: "videos", params: { lien: "https://youtu.be/x" } });
  assert.deepEqual(analyserRoute("#/inconnue/x"), { vue: "accueil", params: {} });
  assert.equal(chemin("fiche", { code: "BAR-TH-137" }), "#/fiche/BAR-TH-137");
  assert.equal(chemin("video", { id: 3 }), "#/video/3");
  assert.equal(chemin("fiches"), "#/fiches");
});
