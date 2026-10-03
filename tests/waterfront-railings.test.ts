import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  waterfrontRailings,
  waterfrontPromenadeEdge,
  promenadePoint,
} from "../src/lib/waterfront-railings.ts";
import type { MapData } from "../src/types.ts";
import { riverFurnitureLayout } from "../src/lib/river-furniture.ts";
import { insideRing } from "../src/lib/attraction-boundary.ts";
const map: MapData = JSON.parse(
  readFileSync(new URL("../public/data/map.json", import.meta.url), "utf8"),
);
const site = JSON.parse(
  readFileSync(
    new URL("../src/data/waterfront-links.json", import.meta.url),
    "utf8",
  ),
);
const shorelines = [map.coast, ...map.water.map((w) => w.points)];
test("repeated river furniture covers the waterfront without water, building or bridge collisions", () => {
  const { groups, chains } = riverFurnitureLayout(map);
  assert.ok(groups.length > 100 && groups.length < 180);
  assert.ok(chains.length > 1000 && chains.length < 1800);
  assert.ok(groups[0].lamp[1] < -1700);
  assert.ok(groups.at(-1)!.lamp[1] > 600);
  const bridges = map.roads
    .filter((r) => r.bridge)
    .flatMap((r) => r.points.slice(1).map((b, i) => [r.points[i], b]));
  const points = [
    ...groups.flatMap((g) => [g.lamp, g.bin, g.ring]),
    ...chains.flat(),
  ];
  for (const point of points) {
    assert.ok(
      !map.water.some((w) => insideRing(point, w.points)),
      "Furniture over water",
    );
    assert.ok(
      !map.buildings.some((b) => insideRing(point, b.points)),
      "Furniture inside building",
    );
    assert.ok(
      !bridges.some(([a, b]) => distance(point, a, b) < 3),
      "Furniture obstructs crossing",
    );
  }
});
function distance(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz;
  const t = l
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l))
    : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
test("quay railings follow rendered shorelines and keep the bridge corridor open", () => {
  const rails = waterfrontRailings(map, site.bridge.points);
  assert.ok(rails.length > 20);
  const [a, b] = site.bridge.points,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  for (const [p, q] of rails)
    for (let i = 0; i <= 10; i++) {
      const point = [
        p[0] + ((q[0] - p[0]) * i) / 10,
        p[1] + ((q[1] - p[1]) * i) / 10,
      ];
      const closest = Math.min(
        ...shorelines.flatMap((ps) =>
          ps.slice(1).map((b, j) => distance(point, ps[j], b)),
        ),
      );
      assert.ok(closest < 1e-7, "Railing cuts through paving or water");
      const u = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / len;
      const v = (-(point[0] - a[0]) * dz + (point[1] - a[1]) * dx) / len;
      assert.ok(
        u <= -2 + 1e-7 || u >= len + 2 - 1e-7 || Math.abs(v) >= 2.5 - 1e-7,
        "Blocked bridge entrance",
      );
    }
  const edge = waterfrontPromenadeEdge(map.coast);
  assert.ok(edge.length >= 8);
  for (const p of edge) assert.ok(map.coast.includes(p));
  for (const d of [9, 23, 37, 51, 65]) {
    const p = promenadePoint(map.coast, d, 1.2);
    const closest = Math.min(
      ...edge.slice(1).map((b, i) => distance(p, edge[i], b)),
    );
    assert.ok(
      Math.abs(closest - 1.2) < 0.01,
      "Lamp must remain inset from the waterfront",
    );
  }
});
