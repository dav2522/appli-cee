import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliser, filtrer, trier, grouper, FILTRES_DEFAUT } from "../js/fiches.js";
const F = JSON.parse(readFileSync(new URL("./fixtures/fiches-mini.json", import.meta.url))).fiches;
const avis = { "BAT-TH-127": { avis: "up" }, "BAR-TH-137": { avis: "up" }, "BAT-TH-163": { avis: "down" } };

test("normaliser", () => { assert.equal(normaliser("Pompe à chaleur d’Été"), "pompe a chaleur d'ete"); });
test("filtres", () => {
  const actives = F.filter((f) => f.statut === "active");
  assert.equal(filtrer(F, FILTRES_DEFAUT, avis).length, actives.filter((f) => !f.fin_proche).length);
  assert.equal(filtrer(F, { ...FILTRES_DEFAUT, masquerFins: false }, avis).length, actives.length);
  assert.deepEqual(filtrer(F, { ...FILTRES_DEFAUT, avis: "up" }, avis).map((f) => f.code).sort(), ["BAR-TH-137", "BAT-TH-127"]);
  assert.ok(!filtrer(F, { ...FILTRES_DEFAUT, avis: "nodown" }, avis).some((f) => f.code === "BAT-TH-163"));
  assert.ok(filtrer(F, { ...FILTRES_DEFAUT, cp: "avec" }, avis).every((f) => f.cdp.cp > 1));
  assert.ok(filtrer(F, { ...FILTRES_DEFAUT, difficulte: "rouge" }, avis).every((f) => f.carte.difficulte === "rouge"));
  assert.ok(filtrer(F, { ...FILTRES_DEFAUT, intensite: "dossiers" }, avis).every((f) => f.carte.intensite === "dossiers"));
  const rech = filtrer(F, { ...FILTRES_DEFAUT, q: "pac air" }, avis);
  assert.ok(rech.some((f) => f.code === "BAT-TH-163"));
  const term = F.find((f) => f.statut === "terminee");
  assert.ok(filtrer(F, { ...FILTRES_DEFAUT, q: term.code.toLowerCase() }, avis).some((f) => f.code === term.code));
  assert.ok(!filtrer(F, FILTRES_DEFAUT, avis).some((f) => f.statut === "terminee"));
});
test("tris et groupes", () => {
  const a = F.filter((f) => f.statut === "active");
  const pot = trier(a, "potentiel"); assert.ok(pot.every((f, i) => i === 0 || pot[i - 1].ordre <= f.ordre));
  const vol = trier(a, "volume"); assert.ok(vol.every((f, i) => i === 0 || (vol[i - 1].marche?.kwh || 0) >= (f.marche?.kwh || 0)));
  const par = trier(a, "parution"); assert.ok(par.every((f, i) => i === 0 || par[i - 1].parution.cle >= f.parution.cle));
  const g = grouper(pot, ["A", "B", "C"]); assert.equal(g.reduce((s, x) => s + x.fiches.length, 0), a.length);
  assert.ok(g.every((x, i) => i === 0 || g[i - 1].groupe < x.groupe));
});
