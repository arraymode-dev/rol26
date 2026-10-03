import { test } from "node:test";
import assert from "node:assert/strict";
import { anookiPose } from "../src/lib/anooki-pose.ts";

test("Anooki stay behind the portico pillars in close views and throughout daytime", () => {
  for (const side of [-1, 1]) {
    const near = anookiPose(side, 150, true, 10, false);
    assert.ok(near.z + 2.15 < 27.3, "face behind the pillar centreline");
    assert.ok(near.z - 1.8 >= 23, "head remains outside the facade");
    assert.equal(near.floating, false);
    assert.deepEqual(
      anookiPose(side, 150, false, 0, false),
      anookiPose(side, 1800, false, 30, false),
    );
  }
});
test("night overview lifts Anooki above the roof with continuous transition and reduced-motion stability", () => {
  const close = anookiPose(1, 219, true, 0, false);
  const transition = anookiPose(1, 221, true, 0, false);
  assert.ok(Math.abs(close.y - transition.y) < 0.01);
  const far = anookiPose(1, 1000, true, 0, false);
  assert.ok(far.y > 40);
  assert.notEqual(far.y, anookiPose(1, 1000, true, 3, false).y);
  assert.deepEqual(
    anookiPose(1, 1000, true, 0, true),
    anookiPose(1, 1000, true, 30, true),
  );
});

test("flight hold keeps the pair on the columns before easing into a larger overview pose", () => {
  assert.deepEqual(
    anookiPose(1, 1000, true, 0, false, 0),
    anookiPose(1, 150, true, 0, false),
  );
  assert.ok(anookiPose(1, 1000, true, 0, false, 1).scale >= 3);
  for (let t = 0; t < 60; t += 0.25) {
    const a = anookiPose(1, 1000, true, t, false),
      b = anookiPose(1, 1000, true, t + 0.01, false);
    assert.ok(Math.abs(a.y - b.y) < 0.1, "arc has no abrupt loop reset");
    assert.ok(a.y >= 90 && a.y <= 104, "flight stays above the roof");
  }
});
