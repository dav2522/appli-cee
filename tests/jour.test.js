import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rubriquesDuJour, nettoyerTelegram } from "../js/jour.js";
const jour = JSON.parse(readFileSync(new URL("./fixtures/jour-2026-09-29.json", import.meta.url)));

test("rubriques du 29/09 dans l'ordre du daily", () => {
  const r = rubriquesDuJour(jour.delta);
  assert.deepEqual(r.map((x) => x.cle), ["suppressions", "ademe_retirees", "consultations"]);
  assert.equal(r[0].items[0].texte.includes("27 fiches"), true);
  assert.equal(r[1].items.map((i) => i.code).join(","), "AGRI-EQ-110,TRA-SE-104");
  assert.equal(r[2].items.length, 3);
});
test("delta vide -> aucune rubrique ; JO et CdP", () => {
  assert.deepEqual(rubriquesDuJour({}), []);
  const r = rubriquesDuJour({ coup_de_pouce: { perdu: [{ code: "BAR-TH-112", nom: "Bois", programmes: ["Chauffage"] }], gagne: [] },
    reglementaire: { jo: [{ cle: "X", titre: "Arrêté du 18/09/2026", date_publication: "2026-09-23", date_application: "2026-09-24", fiches: { "AGRI-EQ-110": "abrogée" }, url: "https://legifrance.gouv.fr/x" }] } });
  assert.deepEqual(r.map((x) => x.cle), ["arretees", "jo", "cdp_perdu"]);
  assert.equal(r[0].items[0].code, "AGRI-EQ-110");
});
test("nettoyerTelegram", () => {
  assert.equal(nettoyerTelegram("<b>⚡ Veille</b>\n<script>x</script><a href=\"https://a.fr\">lien</a> <u>u</u>"), "<b>⚡ Veille</b><br><a href=\"https://a.fr\">lien</a> u");
});
