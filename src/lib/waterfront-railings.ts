import type { MapData } from "../types.ts";

type Point = [number, number];
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const arc = (points: Point[], start: Point, end: Point) => {
  const a = points.findIndex((p) => same(p, start));
  const b = points.findIndex((p) => same(p, end));
  return a < 0 || b < a ? [] : points.slice(a, b + 1);
};

export const waterfrontPromenadeEdge = (coast: Point[]) =>
  arc(coast, [-189.5, 262.9], [-210, 330.5]);

/** Sample the river boundary, offset onto land (east of the coast). */
export function promenadePoint(
  coast: Point[],
  distance: number,
  inset: number,
): Point {
  const edge = waterfrontPromenadeEdge(coast);
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1],
      b = edge[i];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (distance <= length || i === edge.length - 1) {
      const t = Math.min(distance / length, 1);
      return [
        a[0] + dx * t + (dz / length) * inset,
        a[1] + dz * t - (dx / length) * inset,
      ];
    }
    distance -= length;
  }
  throw new Error("Missing waterfront promenade shoreline");
}

/** The north bridge landing follows the rendered river and dock boundaries.
 * Remove the full bridge approach width rather than drawing a fence across it. */
export function waterfrontRailings(
  map: Pick<MapData, "coast" | "water">,
  bridge: readonly number[][],
): [Point, Point][] {
  const dock = map.water.find((w) => w.id === "155196192");
  if (!dock) return [];
  const outlines = [
    arc(map.coast, [-210.7, 223.5], [-193.4, 249.3]),
    arc(dock.points, [-201.2, 221.4], [-193.4, 249.3]),
  ];
  const [a, b] = bridge;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length,
    tz = (b[1] - a[1]) / length;
  const local = (p: Point) => [
    (p[0] - a[0]) * tx + (p[1] - a[1]) * tz,
    -(p[0] - a[0]) * tz + (p[1] - a[1]) * tx,
  ];
  const result: [Point, Point][] = [];
  for (const outline of outlines) {
    for (let i = 1; i < outline.length; i++) {
      const p = outline[i - 1],
        q = outline[i];
      const u = local(p),
        v = local(q);
      // Clip the shoreline segment against the bridge/approach rectangle.
      let enter = 0,
        leave = 1;
      for (const [axis, min, max] of [
        [0, -2, length + 2],
        [1, -2.5, 2.5],
      ]) {
        const d = v[axis] - u[axis];
        if (Math.abs(d) < 1e-9) {
          if (u[axis] < min || u[axis] > max) enter = 2;
        } else {
          const t1 = (min - u[axis]) / d,
            t2 = (max - u[axis]) / d;
          enter = Math.max(enter, Math.min(t1, t2));
          leave = Math.min(leave, Math.max(t1, t2));
        }
      }
      const at = (t: number): Point => [
        p[0] + (q[0] - p[0]) * t,
        p[1] + (q[1] - p[1]) * t,
      ];
      if (enter >= leave) result.push([p, q]);
      else {
        if (enter > 0) result.push([p, at(enter)]);
        if (leave < 1) result.push([at(leave), q]);
      }
    }
  }
  return result;
}
