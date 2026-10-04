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

test("crossing corners use gentle bounded curves while retaining the straight crossing", () => {
  const points = [
    [0, 0],
    [10, 1],
    [10, 10],
    [30, 10],
    [30, 40],
  ];
  const result = smoothRoute(points, () => true, 2.5);
  assert.ok(result.length > 30, "crossing corners are curved too");
  const straight = result.filter(
    ([x, y]: number[]) => Math.abs(x - 10) < 1e-6 && y >= 3 && y <= 8,
  );
  assert.ok(
    straight.length >= 2,
    "central crossing stays on its mapped alignment",
  );
  for (const [x, y] of result as number[][]) {
    if (y > 1 && y < 10)
      assert.ok(
        Math.min(Math.abs(x - 10), Math.abs(y - 10), Math.abs(y - 1)) <= 2.5,
        "fillet stays within crossing and pavement corridor",
      );
  }
});

test("the entire generated trail retains smoothly sampled bends", async () => {
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(
    readFileSync(new URL("../public/data/trail.json", import.meta.url), "utf8"),
  );
  for (const run of data.ribbons) {
    const points = run.map(({ corners }: { corners: number[][] }) => [
      (corners[0][0] + corners[3][0]) / 2,
      (corners[0][1] + corners[3][1]) / 2,
    ]);
    for (let i = 1; i < points.length - 1; i++) {
      const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
      const u = [b[0] - a[0], b[1] - a[1]],
        v = [c[0] - b[0], c[1] - b[1]];
      const cosine =
        (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
      assert.ok(
        cosine >= Math.cos(Math.PI / 12),
        `sharp corner in full trail at ${b}`,
      );
    }
  }
});
