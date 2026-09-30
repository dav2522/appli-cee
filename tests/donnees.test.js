import test from "node:test";
import assert from "node:assert/strict";
import { decisionSynchro, creerClient, synchroniser, enregistrerAvis, viderFile, avisGagnant, FICHIERS_PRINCIPAUX } from "../js/donnees.js";

function memoire() {
  const m = new Map();
  const k = (s, c) => s + "\u0000" + c;
  return {
    lire: async (s, c) => m.get(k(s, c)) ?? null, ecrire: async (s, c, v) => { m.set(k(s, c), v); },
    supprimer: async (s, c) => { m.delete(k(s, c)); },
    tout: async (s) => [...m.entries()].filter(([x]) => x.startsWith(s + "\u0000")).map(([x, v]) => ({ cle: x.split("\u0000")[1], val: v })),
  };
}
function depot(fichiers, options = {}) {            // faux fetch de l'API contents
  const f = new Map(Object.entries(fichiers));
  const appels = [];
  const fetchImpl = async (url, init = {}) => {
    if (options.panne) throw new TypeError("Failed to fetch");
    const chemin = decodeURIComponent(url.split("/contents/")[1].split("?")[0]);
    appels.push((init.method || "GET") + " " + chemin);
    if (options.statut) return { status: options.statut, text: async () => "{}" };
    if ((init.method || "GET") === "GET") {
      if (!f.has(chemin)) return { status: 404, text: async () => '{"message":"Not Found"}' };
      const brut = (init.headers?.Accept || "").includes("raw");
      return { status: 200, text: async () => brut ? f.get(chemin) : JSON.stringify({ sha: "sha-" + chemin, content: "" }) };
    }
    const corps = JSON.parse(init.body);
    if (f.has(chemin) && corps.sha !== "sha-" + chemin) return { status: 409, text: async () => "{}" };
    const existait = f.has(chemin);
    f.set(chemin, Buffer.from(corps.content, "base64").toString("utf8"));
    return { status: existait ? 200 : 201, text: async () => "{}" };
  };
  return { fetchImpl, appels, fichiers: f };
}
const META = (d) => JSON.stringify({ schema: 1, genere_le: d, donnees_du: d.slice(0, 10), fichiers: Object.fromEntries(FICHIERS_PRINCIPAUX.map((n) => [n, 10])) });
const DONNEES = (d) => Object.fromEntries([["app/meta.json", META(d)], ...FICHIERS_PRINCIPAUX.map((n) => ["app/" + n, JSON.stringify({ schema: 1, nom: n })])]);

test("decisionSynchro", () => {
  assert.equal(decisionSynchro(null, { schema: 1, genere_le: "2026-09-29T08:00:00", fichiers: { "fiches.json": 1 } }).action, "telecharger");
  assert.equal(decisionSynchro({ genere_le: "2026-09-29T08:00:00" }, { schema: 1, genere_le: "2026-09-29T08:00:00" }).action, "a_jour");
  assert.equal(decisionSynchro({ genere_le: "2026-09-28T08:00:00" }, { schema: 1, genere_le: "2026-09-29T08:00:00" }).action, "telecharger");
  assert.equal(decisionSynchro({ genere_le: "2026-09-29T08:00:00" }, { schema: 2, genere_le: "2026-09-30T08:00:00" }).action, "schema_appli");
  assert.equal(decisionSynchro({ genere_le: "2026-09-29T08:00:00" }, { schema: 1, genere_le: "2026-09-29T08:00:00" }, true).action, "telecharger");
});

test("synchroniser : premier passage puis a jour", async () => {
  const d = depot(DONNEES("2026-09-29T08:00:00")); const st = memoire();
  const client = creerClient(d.fetchImpl, "jeton");
  const r1 = await synchroniser({ client, stockage: st });
  assert.equal(r1.ok, true); assert.equal(r1.telecharges, FICHIERS_PRINCIPAUX.length);
  assert.equal((await st.lire("donnees", "fiches")).nom, "fiches.json");
  const r2 = await synchroniser({ client, stockage: st });
  assert.equal(r2.ok, true); assert.equal(r2.telecharges, 0);
});

test("synchroniser : 401 conserve le cache, schema inconnu signale", async () => {
  const st = memoire(); await st.ecrire("donnees", "meta", { schema: 1, genere_le: "2026-09-28T08:00:00" });
  await st.ecrire("donnees", "fiches", { nom: "ancien" });
  const r = await synchroniser({ client: creerClient(depot({}, { statut: 401 }).fetchImpl, "x"), stockage: st });
  assert.equal(r.ok, false); assert.equal(r.erreur, "jeton"); assert.equal((await st.lire("donnees", "fiches")).nom, "ancien");
  const d = depot({ "app/meta.json": JSON.stringify({ schema: 9, genere_le: "2026-09-30T08:00:00", fichiers: {} }) });
  const r2 = await synchroniser({ client: creerClient(d.fetchImpl, "x"), stockage: st });
  assert.equal(r2.erreur, "schema_appli"); assert.equal((await st.lire("donnees", "meta")).genere_le, "2026-09-28T08:00:00");
  const r3 = await synchroniser({ client: creerClient(depot({}, { panne: true }).fetchImpl, "x"), stockage: st });
  assert.equal(r3.erreur, "reseau");
});

test("file d'avis : hors ligne puis en ligne, le plus recent gagne", async () => {
  const st = memoire();
  const panne = creerClient(depot({}, { panne: true }).fetchImpl, "x");
  const r1 = await enregistrerAvis({ stockage: st, client: panne, code: "BAT-TH-163", avis: "up", commentaire: " à chiffrer " });
  assert.equal(r1.restants, 1);
  assert.equal((await st.lire("donnees", "avis")).fiches["BAT-TH-163"].commentaire, "à chiffrer");
  const d = depot({ "avis/BAR-TH-137.json": JSON.stringify({ avis: "down", commentaire: "", le: "2099-01-01T00:00:00" }) });
  const client = creerClient(d.fetchImpl, "x");
  await st.ecrire("file", "BAR-TH-137", { avis: "up", commentaire: "", le: "2026-09-29T10:00:00" });
  const r2 = await viderFile({ stockage: st, client });
  assert.equal(r2.envoyes, 2); assert.equal(r2.restants, 0);
  assert.equal(JSON.parse(d.fichiers.get("avis/BAT-TH-163.json")).avis, "up");
  assert.equal(JSON.parse(d.fichiers.get("avis/BAR-TH-137.json")).avis, "down");        // distant plus recent conserve
  assert.equal((await st.lire("donnees", "avis")).fiches["BAR-TH-137"].avis, "down");   // et repris en local
  assert.equal((await st.tout("file")).length, 0);
  assert.equal(avisGagnant({ le: "2026-01-01T00:00:00" }, null).le, "2026-01-01T00:00:00");
});
