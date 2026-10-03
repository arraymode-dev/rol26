import test from "node:test";
import assert from "node:assert/strict";
import { buildParadigm, PARADIGM } from "../src/lib/paradigm.ts";
test("Paradigm forms a grounded six-metre radial globe from merged geometry", () => {
  const parts = buildParadigm();
  assert.equal(parts.glows.getAttribute("position").count, PARADIGM.rays);
  const tips = parts.glows.getAttribute("position");
  for (let i = 0; i < tips.count; i++) {
    const r = Math.hypot(
      tips.getX(i),
      tips.getY(i) - PARADIGM.centreY,
      tips.getZ(i),
    );
    assert.ok(r > 2.8 && r <= 3.00001);
  }
  for (const geometry of Object.values(parts)) {
    assert.ok(
      [...geometry.getAttribute("position").array].every(Number.isFinite),
    );
    geometry.computeBoundingBox();
    assert.ok(
      geometry.boundingBox!.min.y >= 0.15,
      "Sculpture intersects paving",
    );
    assert.ok(geometry.boundingBox!.max.y < 6.5);
    geometry.dispose();
  }
});
