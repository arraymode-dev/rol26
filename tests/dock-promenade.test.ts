import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import C from "clipper-lib";
import { inside } from "../scripts/lib/map-surfaces.mjs";
const paving = JSON.parse(readFileSync("src/data/dock-promenade.json", "utf8"));
const map = JSON.parse(readFileSync("public/data/map.json", "utf8"));
const inPaving = (p: number[]) =>
  paving.polygons.some(
    ([outer, ...holes]: number[][][]) =>
      inside(p, outer) && !holes.some((h) => inside(p, h)),
  );
test("dock paving reaches both docks without covering water, buildings or carriageways", () => {
  const ring = (ps: number[][]) =>
    ps.map(([x, z]) => ({ X: Math.round(x * 1000), Y: Math.round(z * 1000) }));
  const c = new C.Clipper(),
    out: any[] = [];
  c.AddPaths(
    paving.polygons.flatMap((p: number[][][]) => p.map(ring)),
    C.PolyType.ptSubject,
    true,
  );
  const obstacles = [...map.water, ...map.buildings]
    .map((o) => o.points)
    .concat(map.surfaces.roads.flat());
  c.AddPaths(
    obstacles.map((p: number[][]) => {
      const r = ring(p);
      if (!C.Clipper.Orientation(r)) r.reverse();
      return r;
    }),
    C.PolyType.ptClip,
    true,
  );
  c.Execute(
    C.ClipType.ctIntersection,
    out,
    C.PolyFillType.pftNonZero,
    C.PolyFillType.pftNonZero,
  );
  assert.ok(
    Math.abs(out.reduce((n, p) => n + C.Clipper.Area(p), 0)) / 1e6 < 0.01,
  );
  for (const p of [
    [165, 286],
    [193, 350],
    [240, 437],
    [282, 550],
    [349, 680],
    [399, 800],
  ])
    assert.ok(inPaving(p), `missing dock walkway at ${p}`);
  assert.ok(
    paving.polygons.flat(2).length < 500,
    "paving stays a small triangulated surface",
  );
});
test("northern trees sit in the land verge clear of the cobbled path and road", () => {
  assert.ok(paving.treeMoves.length >= 15);
  for (const { to } of paving.treeMoves) {
    assert.ok(!inPaving(to));
    assert.ok(!map.water.some((o) => inside(to, o.points)));
    assert.ok(
      !map.surfaces.roads.some(
        ([outer, ...holes]: number[][][]) =>
          inside(to, outer) && !holes.some((h) => inside(to, h)),
      ),
    );
  }
});
