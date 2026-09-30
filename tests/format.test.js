import test from "node:test";
import assert from "node:assert/strict";
import { giga, volume, dateFr, jours, md, ech, fourchette, totalCout, ico, mdBloc } from "../js/format.js";

test("giga et volume (regles du rapport)", () => {
  assert.equal(giga(23.4), "23 gigas"); assert.equal(giga(1.7), "1,7 giga"); assert.equal(giga(2), "2 gigas");
  assert.equal(giga(0.29), "0,29 giga"); assert.equal(giga(0.005), "0,005 giga");
  assert.equal(volume(8874735333), "8,9 TWh"); assert.equal(volume(350e6), "350 GWh"); assert.equal(volume(4.2e6), "4,2 GWh");
  assert.equal(volume(28000), "28 MWh"); assert.equal(volume(10), "1 MWh");
});
test("dates", () => {
  assert.equal(dateFr("2026-09-29"), "29/09/2026"); assert.equal(dateFr(null), "");
  assert.equal(jours("2026-10-12", "2026-09-29"), 13); assert.equal(jours("2026-09-29", "2026-09-29"), 0);
});
test("texte", () => {
  assert.equal(md("**PAC à 40 %** : prime <entière>"), "<b>PAC à 40 %</b> : prime &lt;entière&gt;");
  assert.equal(ech("a&b<c>"), "a&amp;b&lt;c&gt;");
  assert.equal(fourchette(450, 950), "450 – 950 €"); assert.equal(fourchette(115000, 170000), "115 – 170 k€");
  assert.equal(fourchette(1.6e6, 2.4e6), "1,6 – 2,4 M€"); assert.equal(fourchette(2000, 2000), "2 000 €");   // < 10 k€ : en euros, comme _fourchette_euros
  assert.deepEqual(totalCout({ postes: [["a", 1, 2], ["b", 3, 4]] }), { min: 4, max: 6 });
  assert.equal(totalCout(null), null);
  assert.equal(ico("up"), '<svg class="ico" aria-hidden="true"><use href="#i-up"/></svg>');
});
test("mdBloc : paragraphes, titres, listes, gras, code", () => {
  const h = mdBloc("## Conformité\n\nLe devis est **conforme**.\nSuite.\n\n- point `un`\n- point deux\n\n1. premier\n2. second");
  assert.equal(h, "<h3>Conformité</h3><p>Le devis est <b>conforme</b>.<br>Suite.</p><ul><li>point <code>un</code></li><li>point deux</li></ul><ol><li>premier</li><li>second</li></ol>");
  assert.equal(mdBloc("<script>"), "<p>&lt;script&gt;</p>");
});
