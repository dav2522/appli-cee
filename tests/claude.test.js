// tests/claude.test.js — SDK vendu et client Claude (fetch simule, jamais d'appel reel)
import test from "node:test";
import assert from "node:assert/strict";
import { demander, classerErreur, testerCle, chargerSdk } from "../js/claude.js";

test("SDK vendu : export par défaut et classes d'erreur", async () => {
  const { default: Anthropic } = await import("../vendor/anthropic-sdk.min.mjs");
  assert.equal(typeof Anthropic, "function");
  for (const k of ["APIError", "APIConnectionError", "APIUserAbortError", "AuthenticationError", "PermissionDeniedError", "RateLimitError", "BadRequestError", "InternalServerError"]) assert.equal(typeof Anthropic[k], "function", k);
  const e = Anthropic.APIError.generate(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }, undefined, new Headers());
  assert.ok(e instanceof Anthropic.AuthenticationError);
});

const SSE = (textes, stop = "end_turn") => [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":120,"cache_read_input_tokens":1000,"cache_creation_input_tokens":0,"output_tokens":0}}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  ...textes.map((t) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })}\n\n`),
  'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
  `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${stop}","stop_sequence":null},"usage":{"output_tokens":7}}\n\n`,
  'event: message_stop\ndata: {"type":"message_stop"}\n\n'];
// fetch simule : consomme la liste des reponses ; honore init.signal comme un vrai fetch
function fauxFetch(reponses, vu) {
  return async (url, init) => {
    vu.push({ url: String(url), headers: init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers, corps: init.body ? JSON.parse(init.body) : null });
    const r = reponses.shift();
    if (r.sse) {
      let ctrl; const body = new ReadableStream({ start(c) { ctrl = c; for (const s of r.sse) c.enqueue(new TextEncoder().encode(s)); if (!r.ouvert) c.close(); } });
      init.signal?.addEventListener("abort", () => { try { ctrl.error(new DOMException("aborted", "AbortError")); } catch { /* deja ferme */ } });
      return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    return new Response(JSON.stringify(r.json), { status: r.status || 200, headers: { "content-type": "application/json" } });
  };
}
const requete = { system: [{ type: "text", text: "sys" }], messages: [{ role: "user", content: [{ type: "text", text: "Q" }] }] };

test("demander : flux texte, usage, en-têtes navigateur, beta fallbacks", async () => {
  const vu = []; const morceaux = [];
  const r = await demander({ cle: "sk-test", requete, surTexte: (t) => morceaux.push(t), options: { fetch: fauxFetch([{ sse: SSE(["Bon", "jour"]) }], vu), maxRetries: 0 } });
  assert.equal(r.texte, "Bonjour"); assert.deepEqual(morceaux, ["Bon", "jour"]); assert.equal(r.stop, "end_turn"); assert.equal(r.modele, "claude-opus-5");
  assert.deepEqual(r.usage, { entree: 120, cache_lu: 1000, cache_ecrit: 0, sortie: 7 });
  const { headers, corps, url } = vu[0];
  assert.ok(url.startsWith("https://api.anthropic.com/v1/messages"));
  assert.equal(headers["anthropic-dangerous-direct-browser-access"], "true"); assert.equal(headers["x-api-key"], "sk-test");
  assert.ok(headers["anthropic-beta"].includes("server-side-fallback-2026-07-01"));
  assert.equal(corps.model, "claude-opus-5"); assert.equal(corps.fallbacks, "default"); assert.deepEqual(corps.thinking, { type: "adaptive" }); assert.equal(corps.max_tokens, 16000); assert.equal(corps.stream, true);
  assert.deepEqual(corps.system, requete.system);
});
test("demander : arrêt par signal → code arret", async () => {
  const ac = new AbortController(); const vu = [];
  const p = demander({ cle: "sk-test", requete, signal: ac.signal, options: { fetch: fauxFetch([{ sse: SSE([]).slice(0, 1), ouvert: true }], vu), maxRetries: 0 } });
  setTimeout(() => ac.abort(), 30);
  await assert.rejects(p);
  try { await p; } catch (e) { assert.equal(classerErreur(e), "arret"); }
});
test("classerErreur : classes du SDK → codes", async () => {
  const A = await chargerSdk();
  const g = (s, type) => A.APIError.generate(s, { error: { type, message: "m" } }, undefined, new Headers());
  assert.equal(classerErreur(g(401, "authentication_error")), "cle");
  assert.equal(classerErreur(g(403, "permission_error")), "interdit");
  assert.equal(classerErreur(g(429, "rate_limit_error")), "limite");
  assert.equal(classerErreur(g(400, "invalid_request_error")), "requete");
  assert.equal(classerErreur(g(529, "overloaded_error")), "surcharge");
  assert.equal(classerErreur(A.APIError.generate(undefined, undefined, "conn", undefined)), "reseau");
  assert.equal(classerErreur(new Error("x")), "inconnue");
});
test("testerCle : GET /v1/models/claude-opus-5 ; 401 → cle", async () => {
  const vu = [];
  assert.deepEqual(await testerCle("sk-ok", { fetch: fauxFetch([{ json: { id: "claude-opus-5", type: "model", display_name: "Claude Opus 5", created_at: "2026-01-01T00:00:00Z" } }], vu), maxRetries: 0 }), { ok: true, modele: "Claude Opus 5" });
  assert.ok(vu[0].url.endsWith("/v1/models/claude-opus-5"));
  const r = await testerCle("sk-bad", { fetch: fauxFetch([{ status: 401, json: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } }], []), maxRetries: 0 });
  assert.equal(r.ok, false); assert.equal(r.code, "cle");
});
