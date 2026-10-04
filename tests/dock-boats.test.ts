import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dockBoatLayout,
  boatFootprint,
  buildDockBoats,
} from "../src/lib/dock-boats.ts";
import { insideRing } from "../src/lib/attraction-boundary.ts";
const data = JSON.parse(
  readFileSync(new URL("../public/data/map.json", import.meta.url), "utf8"),
);
test("boats stay within dock water, remain spaced, and include all three vessel types", () => {
  const boats = dockBoatLayout(data);
  assert.ok(boats.filter((b) => b.dock === "155196199").length >= 8);
  assert.equal(new Set(boats.map((b) => b.kind)).size, 3);
  for (const [i, b] of boats.entries()) {
    const dock = data.water.find((w: { id: string }) => w.id === b.dock);
    assert.ok(boatFootprint(b).every((p) => insideRing(p, dock.points)));
    assert.ok(
      boats.slice(i + 1).every((a) => Math.hypot(a.x - b.x, a.z - b.z) >= 23),
    );
  }
  assert.deepEqual(dockBoatLayout(data), boats);
});
test("boat fleet has finite geometry batched into one monochrome draw", () => {
  const batches = buildDockBoats(dockBoatLayout(data));
  assert.equal(batches.length, 1);
  let vertices = 0;
  for (const { geometry } of batches) {
    const positions = geometry.getAttribute("position");
    vertices += positions.count;
    assert.ok([...positions.array].every(Number.isFinite));
    geometry.dispose();
  }
  assert.ok(vertices < 150000);
});
