import { insideRing } from "./attraction-boundary.ts";
import type { MapData } from "../types.ts";
import { waterfrontRailings } from "./waterfront-railings.ts";
import waterfront from "../data/waterfront-links.json" with { type: "json" };
import wapping from "../data/wapping-gate.json" with { type: "json" };
type Point = [number, number];
const distance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    d = dx * dx + dz * dz;
  const t = d
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d))
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
export function riverFurnitureLayout(data: MapData) {
  const land: Point[] = [
    [data.coast[0][0], -8000],
    ...data.coast,
    [data.coast.at(-1)![0], 8000],
    [10000, 8000],
    [10000, -8000],
  ];
  const bridges = data.roads
    .filter((r) => r.bridge)
    .flatMap((r) => r.points.slice(1).map((b, i) => [r.points[i], b] as const));
  // Bounds reject almost all polygons before the more expensive point-in-ring
  // test. Layout is built once, including the full inland dock perimeter.
  const obstacles = [...data.water, ...data.buildings].map(({ points }) => ({
    points,
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minZ: Math.min(...points.map((p) => p[1])),
    maxZ: Math.max(...points.map((p) => p[1])),
  }));
  const clear = (p: Point) =>
    insideRing(p, land) &&
    !obstacles.some(
      (b) =>
        p[0] >= b.minX &&
        p[0] <= b.maxX &&
        p[1] >= b.minZ &&
        p[1] <= b.maxZ &&
        insideRing(p, b.points),
    ) &&
    !bridges.some(([a, b]) => distance(p, a, b) < 3);
  const shoreEdges = [data.coast, ...data.water.map((w) => w.points)].flatMap(
    (ps) => ps.slice(1).map((b, i) => [ps[i], b] as const),
  );
  // At concave corners, the normal of one segment can place the lamp beyond
  // the neighbouring railing. Check the entire shoreline, including its base.
  const clearLamp = (p: Point) =>
    clear(p) && shoreEdges.every(([a, b]) => distance(p, a, b) >= 1.1 - 1e-6);
  const chains: [Point, Point][] = [];
  const dockLamps: Point[] = [];
  const groups: { lamp: Point; bin: Point; ring: Point; angle: number }[] = [];
  let travelled = 0,
    nextGroup = 10;
  for (let i = 1; i < data.coast.length; i++) {
    const a = data.coast[i - 1],
      b = data.coast[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (!length) continue;
    const point = (t: number, inset: number): Point => [
      a[0] + dx * t + (dz / length) * inset,
      a[1] + dz * t - (dx / length) * inset,
    ];
    const inExtent = (p: Point) => p[1] >= data.coast[0][1] && p[1] <= 650;
    // Existing iron rails wrap the small north kiosk; don't double that barrier.
    const kiosk = (p: Point) => p[1] >= 221 && p[1] <= 250;
    const n = Math.ceil(length / 2.3);
    for (let j = 0; j < n; j++) {
      const p = point(j / n, 0.12),
        q = point((j + 1) / n, 0.12),
        mid = point((j + 0.5) / n, 0.12);
      if (inExtent(mid) && !kiosk(mid) && clear(p) && clear(q) && clear(mid))
        chains.push([p, q]);
    }
    while (nextGroup < travelled + length) {
      const t = (nextGroup - travelled) / length;
      const lamp = point(t, 1.1),
        bin = point(t + 1.4 / length, 1.15),
        ring = point(t, 0.2);
      if (
        inExtent(lamp) &&
        !(lamp[1] > 210 && lamp[1] < 275) &&
        clearLamp(lamp) &&
        clear(bin) &&
        clear(ring)
      )
        groups.push({ lamp, bin, ring, angle: Math.atan2(dz, dx) });
      nextGroup += 22;
    }
    travelled += length;
  }
  // Extend the same furniture around each enclosed dock, offset away from the
  // water regardless of polygon winding. Existing curated quay rails stay put.
  const pumpEdge: Point[] = [
    [0.7, 225.2],
    [20.5, 235.6],
    [27.5, 240.4],
    [32.2, 247.2],
  ];
  const reserved = [
    ...waterfrontRailings(data, waterfront.bridge.points),
    ...pumpEdge.slice(1).map((b, i) => [pumpEdge[i], b] as [Point, Point]),
    ...wapping.chains.points.slice(1).map(
      (b, i) =>
        [
          [wapping.chains.points[i][0] + 0.35, wapping.chains.points[i][1]],
          [b[0] + 0.35, b[1]],
        ] as [Point, Point],
    ),
  ];
  const existingLamps: Point[] = [
    [20, 249],
    [-16, 255],
    [32, 281],
    [-200, 217],
    [-205.6, 231],
    [-217.4, 245],
    [-204.3, 251],
    [-197, 271],
    ...[
      [-4, -1.2],
      [-10, -23],
      [-10, -44],
    ].map(
      ([u, v]) =>
        [
          wapping.center[0] +
            Math.cos(wapping.angle) * u +
            Math.sin(wapping.angle) * v,
          wapping.center[1] -
            Math.sin(wapping.angle) * u +
            Math.cos(wapping.angle) * v,
        ] as Point,
    ),
  ];
  const nearExistingRail = (p: Point) =>
    reserved.some(([a, b]) => distance(p, a, b) < 0.8);
  for (const dock of data.water.filter((w) => /dock|basin/i.test(w.name))) {
    const outline = [...dock.points];
    if (
      outline[0][0] !== outline.at(-1)![0] ||
      outline[0][1] !== outline.at(-1)![1]
    )
      outline.push(outline[0]);
    const signed = outline
      .slice(1)
      .reduce(
        (sum, b, i) => sum + outline[i][0] * b[1] - b[0] * outline[i][1],
        0,
      );
    const side = signed > 0 ? 1 : -1;
    let walked = 0,
      nextLamp = 10;
    for (let i = 1; i < outline.length; i++) {
      const a = outline[i - 1],
        b = outline[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      if (!length) continue;
      const point = (t: number, inset: number): Point => [
        a[0] + dx * t + ((side * dz) / length) * inset,
        a[1] + dz * t - ((side * dx) / length) * inset,
      ];
      const n = Math.ceil(length / 2.3);
      for (let j = 0; j < n; j++) {
        const p = point(j / n, 0.18),
          q = point((j + 1) / n, 0.18),
          mid = point((j + 0.5) / n, 0.18);
        if (!nearExistingRail(mid) && clear(p) && clear(q) && clear(mid))
          chains.push([p, q]);
      }
      while (nextLamp < walked + length) {
        const lamp = [1.25, 1.75, 2.25, 3]
          .map((inset) => point((nextLamp - walked) / length, inset))
          .find(clearLamp);
        if (
          lamp &&
          ![...existingLamps, ...dockLamps].some(
            (p) => Math.hypot(p[0] - lamp[0], p[1] - lamp[1]) < 8,
          )
        )
          dockLamps.push(lamp);
        nextLamp += 22;
      }
      walked += length;
    }
  }
  return { chains, groups, dockLamps };
}
