import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Offline build module is also used by the route generator.
import { smoothRoute } from "../scripts/lib/route-curves.mjs";
test("small zigzags become a straight run without changing endpoints", () => {
  assert.deepEqual(
    smoothRoute([
      [0, 0],
      [10, 1],
      [20, -1],
      [30, 0],
    ]),
    [
      [0, 0],
      [30, 0],
    ],
  );
});
test("right-angle bends use dense local curves with straight approaches", () => {
  const p = smoothRoute([
    [0, 0],
    [30, 0],
    [30, 30],
  ]);
  assert.deepEqual(p[0], [0, 0]);
  assert.deepEqual(p.at(-1), [30, 30]);
  assert.ok(p.length >= 14);
  assert.ok(
    p.every(([x, z]: number[]) => x >= 0 && x <= 30 && z >= 0 && z <= 30),
  );
  assert.ok(p[1][0] >= 20 && p[1][1] === 0);
});
test("obstacle guard keeps necessary detours and rejects corner shortcuts", () => {
  const clear = (a: number[], b: number[]) =>
    !(a[0] < 9 && b[0] > 11 && a[1] < 5 && b[1] < 5);
  const p = smoothRoute(
    [
      [0, 0],
      [8, 6],
      [12, 6],
      [20, 0],
    ],
    clear,
    8,
  );
  assert.ok(p.some((q: number[]) => q[1] > 4));
  assert.ok(p.slice(1).every((q: number[], i: number) => clear(p[i], q)));
});

test("generated ribbons have no folded quadrilaterals at tight corners", async () => {
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(
    readFileSync(new URL("../public/data/trail.json", import.meta.url), "utf8"),
  );
  const turn = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const crosses = (a: number[], b: number[], c: number[], d: number[]) =>
    turn(a, b, c) * turn(a, b, d) < -1e-8 &&
    turn(c, d, a) * turn(c, d, b) < -1e-8;
  for (const {
    corners: [a, b, c, d],
  } of data.ribbons.flat()) {
    assert.ok(!crosses(a, b, c, d) && !crosses(b, c, d, a));
  }
});
