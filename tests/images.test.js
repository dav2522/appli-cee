// tests/images.test.js — dimensions de reduction des photos (partie pure)
import test from "node:test";
import assert from "node:assert/strict";
import { dimensionsReduites, COTE_MAX } from "../js/images.js";
test("dimensions réduites : côté long à 2000, proportions gardées, petites images intactes", () => {
  assert.equal(COTE_MAX, 2000);
  assert.deepEqual(dimensionsReduites(4000, 3000), { l: 2000, h: 1500, reduit: true });
  assert.deepEqual(dimensionsReduites(1200, 1600), { l: 1200, h: 1600, reduit: false });
  assert.deepEqual(dimensionsReduites(3000, 4000, 1000), { l: 750, h: 1000, reduit: true });
});
