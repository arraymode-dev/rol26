import C from "clipper-lib";
import { smoothRoute } from "./route-curves.mjs";
// Integer millimetres make adjoining edges stable when offsetting and clipping.
const SCALE = 1000;
const integer = (ps) =>
  ps.map(([x, z]) => ({ X: Math.round(x * SCALE), Y: Math.round(z * SCALE) }));
const decimal = (ps) => {
  const ring = ps.map((p) => [p.X / SCALE, p.Y / SCALE]);
  return [...ring, ring[0]];
};
export const pathKinds = new Set([
  "footway",
  "path",
  "pedestrian",
  "cycleway",
  "steps",
]);
export const bounds = (ps) => [
  Math.min(...ps.map((p) => p[0])),
  Math.min(...ps.map((p) => p[1])),
  Math.max(...ps.map((p) => p[0])),
  Math.max(...ps.map((p) => p[1])),
];
const overlaps = (a, b, pad = 0) =>
  a[0] - pad <= b[2] &&
  a[2] + pad >= b[0] &&
  a[1] - pad <= b[3] &&
  a[3] + pad >= b[1];
const outer = (ps) => {
  const ring = integer(ps);
  if (!C.Clipper.Orientation(ring)) ring.reverse();
  return ring;
};
function offset(points, width) {
  const path = integer(points),
    closed = path[0].X === path.at(-1).X && path[0].Y === path.at(-1).Y;
  const co = new C.ClipperOffset(2, 20),
    solution = [];
  co.AddPath(
    path,
    C.JoinType.jtRound,
    closed ? C.EndType.etClosedLine : C.EndType.etOpenRound,
  );
  co.Execute(solution, (width * SCALE) / 2);
  return solution;
}
function clip(subject, obstacles, type = C.ClipType.ctDifference) {
  const c = new C.Clipper(),
    result = new C.PolyTree();
  c.AddPaths(subject, C.PolyType.ptSubject, true);
  let clips = obstacles.map((x) => outer(x.points));
  if (type === C.ClipType.ctDifference && clips.length) {
    // A 1cm clearance prevents millimetre rounding slivers along building edges.
    const offsetter = new C.ClipperOffset(2, 2),
      expanded = [];
    offsetter.AddPaths(clips, C.JoinType.jtMiter, C.EndType.etClosedPolygon);
    offsetter.Execute(expanded, 10);
    clips = expanded;
  }
  c.AddPaths(clips, C.PolyType.ptClip, true);
  c.Execute(type, result, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return C.JS.PolyTreeToExPolygons(result).map((p) => [
    decimal(p.outer),
    ...p.holes.map(decimal),
  ]);
}
export function inside(p, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function displayRoad(road, parks) {
  if (!road.public || road.indoor) return false;
  if (road.area) return road.walkable;
  if (!pathKinds.has(road.kind))
    return (
      road.kind !== "service" ||
      (!!road.name &&
        !["driveway", "parking_aisle", "drive-through"].includes(road.service))
    );
  if (!road.walkable) return false;
  // Sidewalks and crossings are implicit in the continuous paved ground. Keep
  // their full topology for routing, not as competing lines on the basemap.
  if (["sidewalk", "crossing", "traffic_island"].includes(road.footway))
    return false;
  if (road.bridge) return true;
  if (road.kind === "pedestrian" && road.name) return true;
  // The two concentric paths define the user-requested Derby Square plaza.
  if (["1201194501", "659560487"].includes(road.id)) return true;
  return road.points.some((p) => parks.some((park) => inside(p, park.points)));
}
export function prepareSurfaces(data) {
  const buildings = data.buildings.map((b) => ({
    points: b.points,
    bounds: bounds(b.points),
  }));
  const water = data.water.map((b) => ({
    points: b.points,
    bounds: bounds(b.points),
  }));
  const surfaces = { roads: [], paths: [], plazas: [] };
  for (const road of data.roads) {
    if (!displayRoad(road, data.parks)) continue;
    const path = pathKinds.has(road.kind);
    if (path && !road.walkable) continue;
    const width = path
      ? 2.2
      : [
            "primary",
            "secondary",
            "trunk",
            "primary_link",
            "trunk_link",
          ].includes(road.kind)
        ? 9
        : road.kind === "service"
          ? 3.5
          : 5;
    const box = bounds(road.points),
      subject = road.area ? [outer(road.points)] : offset(road.points, width);
    const obstacles = [...buildings, ...(road.bridge ? [] : water)].filter(
      (b) => overlaps(box, b.bounds, width),
    );
    const shape = clip(subject, obstacles);
    surfaces[road.area ? "plazas" : path ? "paths" : "roads"].push(...shape);
  }
  return surfaces;
}
export function crossesBuilding(a, b, buildings) {
  const box = bounds([a, b]),
    nearby = buildings.filter((x) => overlaps(box, x.bounds));
  return (
    nearby.length > 0 &&
    clip(offset([a, b], 0.04), nearby, C.ClipType.ctIntersection).length > 0
  );
}

export const roundRoute = smoothRoute;
export function trailSurface(route, data, width = 4) {
  const bridgeSegments = data.roads
    .filter((r) => r.bridge)
    .flatMap((r) => r.points.slice(1).map((b, i) => [r.points[i], b]));
  const onBridge = (p) =>
    bridgeSegments.some(([a, b]) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        l2 = dx * dx + dz * dz;
      if (!l2) return false;
      const t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2),
      );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < 1.1;
    });
  const buildings = data.buildings.map((b) => ({
    ...b,
    bounds: bounds(b.points),
  }));
  const water = data.water.map((b) => ({ ...b, bounds: bounds(b.points) }));
  // Never round a crossing onto the carriageway or across a traffic island.
  const crossingNodes = new Set(
    data.roads
      .filter((r) => ["crossing", "traffic_island"].includes(r.footway))
      .flatMap((r) => r.points.map((p) => p.join(","))),
  );
  const points = smoothRoute(
    route,
    (a, b) =>
      !crossesBuilding(a, b, buildings) &&
      ((onBridge(a) && onBridge(b)) || !crossesBuilding(a, b, water)),
    2.5,
    crossingNodes,
  );
  if (points.length < 2) return [];
  const half = width / 2;
  const normals = points.slice(1).map((b, i) => {
    const a = points[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  });
  const offsets = points.map((p, i) => {
    // A ribbon wider than a tight bend folds over itself. Taper locally to
    // remain inside the curve radius instead of drawing overlapping triangles.
    let localHalf = half;
    if (i > 0 && i < points.length - 1) {
      const a = points[i - 1],
        b = points[i + 1];
      const ab = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const bc = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const ac = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const cross = Math.abs(
        (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]),
      );
      if (cross > 1e-8)
        localHalf = Math.min(half, ((ab * bc * ac) / (2 * cross)) * 0.7);
    }
    const a = normals[Math.max(0, i - 1)],
      b = normals[Math.min(normals.length - 1, i)];
    const sx = a[0] + b[0],
      sz = a[1] + b[1],
      l = Math.hypot(sx, sz);
    if (l < 0.01) return a.map((v) => v * localHalf);
    const n = [sx / l, sz / l],
      length = Math.min(
        localHalf * 2,
        localHalf / Math.max(0.01, n[0] * b[0] + n[1] * b[1]),
      );
    return n.map((v) => v * length);
  });
  const sides = points.map((p, i) => [
    p.map((v, j) => v + offsets[i][j]),
    p.map((v, j) => v - offsets[i][j]),
  ]);
  let distance = 0;
  return points.slice(1).map((b, i) => {
    const a = points[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const corners = [
      sides[i][0],
      sides[i + 1][0],
      sides[i + 1][1],
      sides[i][1],
    ];
    const box = bounds(corners),
      bridge = onBridge([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]),
      obstacles = [...data.buildings, ...(bridge ? [] : data.water)].filter(
        (b) => overlaps(box, bounds(b.points)),
      );
    const piece = {
      polygons: clip([outer(corners)], obstacles),
      corners,
      start: distance,
      length,
    };
    distance += length;
    return piece;
  });
}
