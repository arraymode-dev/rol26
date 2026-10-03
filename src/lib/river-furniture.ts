import { insideRing } from "./attraction-boundary.ts";
import type { MapData } from "../types.ts";
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
  const clear = (p: Point) =>
    insideRing(p, land) &&
    !data.water.some((w) => insideRing(p, w.points)) &&
    !data.buildings.some((b) => insideRing(p, b.points)) &&
    !bridges.some(([a, b]) => distance(p, a, b) < 3);
  const chains: [Point, Point][] = [];
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
        clear(lamp) &&
        clear(bin) &&
        clear(ring)
      )
        groups.push({ lamp, bin, ring, angle: Math.atan2(dz, dx) });
      nextGroup += 22;
    }
    travelled += length;
  }
  return { chains, groups };
}
