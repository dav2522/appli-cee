import test from "node:test";
import assert from "node:assert/strict";
import { analyserRoute, chemin } from "../js/routeur.js";

test("routes", () => {
  assert.deepEqual(analyserRoute(""), { vue: "aujourdhui", params: {} });
  assert.deepEqual(analyserRoute("#/"), { vue: "aujourdhui", params: {} });
  assert.deepEqual(analyserRoute("#/fiches"), { vue: "fiches", params: {} });
  assert.deepEqual(analyserRoute("#/fiche/BAT-TH-163"), { vue: "fiche", params: { code: "BAT-TH-163" } });
  assert.deepEqual(analyserRoute("#/dossier/nouveau?partage=1"), { vue: "dossier", params: { id: "nouveau", partage: "1" } });
  assert.deepEqual(analyserRoute("#/inconnue/x"), { vue: "aujourdhui", params: {} });
  assert.equal(chemin("fiche", { code: "BAR-TH-137" }), "#/fiche/BAR-TH-137");
  assert.equal(chemin("fiches"), "#/fiches");
});
