// tests/manifeste.test.js — icônes du manifeste (logo CEE) : fichiers présents, dimensions conformes, références valides
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const racine = new URL("../", import.meta.url);
const m = JSON.parse(readFileSync(new URL("manifest.webmanifest", racine)));
const dims = (p) => { const b = readFileSync(new URL(p, racine)); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };   // en-tête IHDR du PNG

test("manifeste : icônes du logo CEE aux bonnes dimensions, dont une maskable", () => {
  assert.ok(m.icons.length >= 3);
  for (const i of m.icons) { assert.ok(i.src.startsWith("icons/logo-"), i.src); assert.equal(dims(i.src), i.sizes, i.src); }
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
});
test("index.html et sw.js pointent vers des icônes existantes", () => {
  const html = readFileSync(new URL("index.html", racine), "utf8"), sw = readFileSync(new URL("sw.js", racine), "utf8");
  const refs = [...html.matchAll(/href="(icons\/[^"]+)"/g), ...sw.matchAll(/"\.\/(icons\/[^"]+)"/g)].map((x) => x[1]);
  assert.ok(refs.length >= 3);
  for (const s of refs) assert.ok(existsSync(new URL(s, racine)), s);
});
