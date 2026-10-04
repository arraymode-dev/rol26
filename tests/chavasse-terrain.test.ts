import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chavasseHeight, inChavassePark } from "../src/lib/chavasse-terrain.ts";
const terrain = JSON.parse(readFileSync("src/data/chavasse-park.json", "utf8"));
test("Chavasse starts at road level, rises continuously and has a flat upper lawn", () => {
  assert.equal(chavasseHeight(157, 158), 0);
  let previous = 0;
  for (let t = 0; t <= 150; t += 0.5) {
    const h = chavasseHeight(155 + 0.72 * t, 160 - 0.694 * t);
    assert.ok(h >= previous - 1e-8 && h <= 10);
    assert.ok(
      h - previous < 0.1,
      "no steps or sharp height jumps in the approach",
    );
    previous = h;
  }
  for (const [x, z] of [
    [224, 50],
    [244, 42],
    [251, 66],
  ]) {
    assert.ok(inChavassePark(x, z));
    assert.equal(chavasseHeight(x, z), 10);
  }
  assert.equal(
    inChavassePark(182.4, 154.8),
    false,
    "keep the lower fountain and Paradigm at street level",
  );
});
test("park paving preserves a compact mesh and stays on the same slope bands as the lawn", () => {
  const rings = [...terrain.grass, ...terrain.paving].flat();
  assert.ok(
    rings.flat().length < 1000,
    "do not introduce a dense terrain grid",
  );
  for (const ring of rings) {
    const heights = ring.map(([x, z]: number[]) => chavasseHeight(x, z));
    assert.ok(heights.every(Number.isFinite));
    // Every polygon belongs to a single planar section, so path triangles cannot bridge the slope changes.
    const low = Math.min(...heights),
      high = Math.max(...heights);
    assert.ok(![2.4, 7].some((h) => h > low + 0.001 && h < high - 0.001));
  }
});
