import test from "node:test";
import assert from "node:assert/strict";
import {
  BATCHED_SCULPTURES,
  buildSculpture,
} from "../src/lib/sculpture-models.ts";
import { artworkDetail } from "../src/lib/artwork-detail.ts";
test("all photo-informed sculptures stay finite, bounded, and within a two-draw-call budget", () => {
  for (const id of BATCHED_SCULPTURES)
    for (const detailed of [false, true]) {
      const batches = buildSculpture(id, detailed);
      assert.equal(batches.length, 2);
      let vertices = 0;
      for (const g of batches) {
        const p = g.getAttribute("position");
        if (!p) continue;
        vertices += p.count;
        assert.equal(g.getAttribute("color").count, p.count);
        for (const value of p.array) assert.ok(Number.isFinite(value), id);
        g.computeBoundingBox();
        assert.ok(g.boundingBox!.min.y >= -0.05, id);
        assert.ok(g.boundingBox!.max.y < 25, id);
        g.dispose();
      }
      assert.ok(vertices > 0 && vertices < 100000, `${id}: ${vertices}`);
    }
});
test("overview geometry reduces vertices while retaining each sculpture", () => {
  for (const id of BATCHED_SCULPTURES.filter(
    (id) => id !== "today-i-love-you",
  )) {
    const low = buildSculpture(id, false),
      high = buildSculpture(id, true);
    const count = (b: typeof low) =>
      b.reduce((n, g) => n + (g.getAttribute("position")?.count ?? 0), 0);
    assert.ok(count(low) < count(high), id);
    [...low, ...high].forEach((g) => g.dispose());
  }
});
test("detail distance has hysteresis to avoid rebuilding during small camera moves", () => {
  assert.equal(artworkDetail(340, "overview"), "near");
  assert.equal(artworkDetail(390, "near"), "near");
  assert.equal(artworkDetail(390, "overview"), "overview");
  assert.equal(artworkDetail(430, "near"), "overview");
});
