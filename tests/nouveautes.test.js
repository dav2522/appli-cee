import test from "node:test";
import assert from "node:assert/strict";
import { versOctets, versB64url, optionsCreation, jsonConnexion } from "../js/webauthn.js";
import { identifiantYoutube, lienDansTexte, enCours, depuis } from "../js/videos.js";
import { parColonne, cetteSemaine, nouveauProjet, avancement, MAX_EN_COURS } from "../js/projets.js";

test("webauthn : aller-retour base64url et options", () => {
  const o = new Uint8Array([0, 255, 62, 63, 1]).buffer;
  assert.equal(versB64url(o), "AP8-PwE");
  assert.deepEqual(new Uint8Array(versOctets("AP8-PwE")), new Uint8Array(o));
  const c = optionsCreation({ challenge: "AP8-PwE", user: { id: "ZGF2aWQ", name: "david" }, excludeCredentials: [{ id: "AP8", type: "public-key" }] });
  assert.equal(new TextDecoder().decode(c.user.id), "david");
  assert.equal(c.excludeCredentials[0].id.byteLength, 2);
  const j = jsonConnexion({ id: "x", rawId: o, type: "public-key", response: { clientDataJSON: o, authenticatorData: o, signature: o, userHandle: null } });
  assert.equal(j.response.signature, "AP8-PwE"); assert.equal(j.response.userHandle, null);
});

test("vidéos : liens, texte partagé, états", () => {
  for (const l of ["https://www.youtube.com/watch?v=_p4FRkFRxjY", "https://youtu.be/_p4FRkFRxjY?si=a", "https://m.youtube.com/watch?pp=x&v=_p4FRkFRxjY", "https://www.youtube.com/shorts/_p4FRkFRxjY"])
    assert.equal(identifiantYoutube(l), "_p4FRkFRxjY", l);
  for (const l of ["", "https://vimeo.com/1", "https://youtube.com.evil.com/watch?v=_p4FRkFRxjY", "javascript:alert(1)"]) assert.equal(identifiantYoutube(l), null, l);
  assert.equal(lienDansTexte("Regarde ça : https://youtu.be/_p4FRkFRxjY !"), "https://youtu.be/_p4FRkFRxjY");
  assert.equal(lienDansTexte("rien ici https://exemple.fr"), null);
  assert.equal(enCours([{ etat: "terminee" }, { etat: "transcription" }]), true);
  assert.equal(enCours([{ etat: "terminee" }, { etat: "echec" }]), false);
  assert.equal(depuis("2026-10-05T10:00:00Z", Date.parse("2026-10-05T10:05:00Z")), "il y a 5 min");
});

test("projets : colonnes, cette semaine, ajout, avancement", () => {
  const p = [{ id: 1, titre: "A", statut: "en_cours", prochaine: "x", attente: "" }, { id: 2, titre: "B", statut: "a_faire", attente: "David : jeton" }, { id: 4, titre: "E", statut: "a_faire", attente: "Hermes immo" },
    { id: 3, titre: "C", statut: "fait", attente: "Y" }];
  assert.deepEqual(parColonne(p).en_cours.map((x) => x.id), [1]);
  assert.deepEqual(cetteSemaine(p).map((x) => x.id), [1, 2]);
  const n = nouveauProjet(p, "  D ");
  assert.equal(n.at(-1).id, 5); assert.equal(n.at(-1).titre, "D"); assert.equal(n.at(-1).statut, "a_faire");
  assert.equal(avancement({ taches: [{ fait: true }, { fait: false }] }), 50); assert.equal(avancement({ taches: [] }), null);
  assert.equal(MAX_EN_COURS, 3);
});
