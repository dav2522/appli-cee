// tests/claude.test.js — SDK vendu et client Claude (fetch simule, jamais d'appel reel)
import test from "node:test";
import assert from "node:assert/strict";

test("SDK vendu : export par défaut et classes d'erreur", async () => {
  const { default: Anthropic } = await import("../vendor/anthropic-sdk.min.mjs");
  assert.equal(typeof Anthropic, "function");
  for (const k of ["APIError", "APIConnectionError", "APIUserAbortError", "AuthenticationError", "PermissionDeniedError", "RateLimitError", "BadRequestError", "InternalServerError"]) assert.equal(typeof Anthropic[k], "function", k);
  const e = Anthropic.APIError.generate(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }, undefined, new Headers());
  assert.ok(e instanceof Anthropic.AuthenticationError);
});
