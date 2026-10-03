import { bounds, crossesBuilding, trailSurface } from "./lib/map-surfaces.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { installations } from "../src/data/installations.ts";
const data = JSON.parse(readFileSync("public/data/map.json", "utf8"));
const authoredLinks = JSON.parse(
  readFileSync("src/data/trail-links.json", "utf8"),
);
const allowed = new Set([
  "footway",
  "pedestrian",
  "path",
  "steps",
  "living_street",
  "residential",
]);
const buildings = data.buildings.map((b) => ({
  ...b,
  bounds: bounds(b.points),
}));
const water = data.water.map((b) => ({ ...b, bounds: bounds(b.points) }));
const graph = new Map();
const pointMap = new Map();
const key = (p) => p.join(",");
// Public waterfront access and the short Lord Street connection join the
// walking network. Do not admit unrelated service/parking or main roads.
const sharedWalkingAccess = new Set(["207474320", "8025656", "1390016226"]);
for (const road of [...data.roads, ...authoredLinks]) {
  if (
    !(
      allowed.has(road.kind) ||
      (sharedWalkingAccess.has(road.id) && road.public)
    ) ||
    ["1530498106", "1530498121"].includes(road.id) ||
    !road.walkable ||
    road.area ||
    road.indoor
  )
    continue;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1],
      b = road.points[i],
      ak = key(a),
      bk = key(b),
      d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (
      !d ||
      d > 150 ||
      crossesBuilding(a, b, buildings) ||
      (!road.bridge && crossesBuilding(a, b, water))
    )
      continue;
    pointMap.set(ak, a);
    pointMap.set(bk, b);
    if (!graph.has(ak)) graph.set(ak, []);
    if (!graph.has(bk)) graph.set(bk, []);
    graph.get(ak).push([bk, d]);
    graph.get(bk).push([ak, d]);
  }
}
// Only the largest connected walking network. Never draw a straight fallback through buildings.
let largest = [];
const seen = new Set();
for (const start of graph.keys()) {
  if (seen.has(start)) continue;
  const group = [start];
  seen.add(start);
  for (let i = 0; i < group.length; i++)
    for (const [n] of graph.get(group[i]))
      if (!seen.has(n)) {
        seen.add(n);
        group.push(n);
      }
  if (group.length > largest.length) largest = group;
}
const project = (lon, lat) => [
  (lon + 2.992) * 111320 * Math.cos((53.404 * Math.PI) / 180),
  -(lat - 53.404) * 111320,
];
function nearest(p) {
  let best = null,
    dist = Infinity;
  for (const id of largest) {
    const q = pointMap.get(id),
      d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < dist) {
      best = id;
      dist = d;
    }
  }
  return { id: best, distance: dist };
}
function route(a, b) {
  const distances = new Map([[a, 0]]),
    prev = new Map(),
    queue = new Set([a]);
  while (queue.size) {
    let u = null,
      best = Infinity;
    for (const n of queue) {
      if (distances.get(n) < best) {
        u = n;
        best = distances.get(n);
      }
    }
    queue.delete(u);
    if (u === b) break;
    for (const [n, d] of graph.get(u) || []) {
      const next = best + d;
      if (next < (distances.get(n) ?? Infinity)) {
        distances.set(n, next);
        prev.set(n, u);
        queue.add(n);
      }
    }
  }
  if (!distances.has(b)) return null;
  const path = [b];
  while (path[0] !== a) path.unshift(prev.get(path[0]));
  return path.map((id) => pointMap.get(id));
}
// Approach the installations without circling the monument or hugging the portico.
const trailAnchors = {
  "the-anooki": [39, -316],
  "flower-power": [7.1, -399.1],
  // View Paradigm from the passing route; avoid an out-and-back spur.
  paradigm: [154.9, 165.1],
  // Follow the outside of Derby Square's circle without crossing the herd.
  "dream-herd": [132.8, -110.9],
};
const segments = [],
  summaries = [],
  gaps = [];
// Take the waterfront approach and cross both dock bridges before returning
// north along the quay to Colour Rush. These are exact walking-network nodes.
const dockWalk = [
  [-242.2, -68.5],
  [-223.1, 48.8],
  [-193.1, 236],
  [-183.9, 265.7],
  [-145.2, 309.9],
  [-117.5, 298.4],
];
for (let i = 1; i < installations.length; i++) {
  const a = installations[i - 1],
    b = installations[i],
    an = nearest(trailAnchors[a.id] ?? project(...a.coordinates)),
    bn = nearest(trailAnchors[b.id] ?? project(...b.coordinates));
  if (an.distance > 100 || bn.distance > 100) {
    gaps.push([a.id, b.id]);
    continue;
  }
  const via = a.id === "unity" && b.id === "colour-rush" ? dockWalk : [];
  const stops = [an.id, ...via.map(key), bn.id];
  const legs = stops.slice(1).map((stop, j) => route(stops[j], stop));
  const path = legs.every(Boolean)
    ? legs.flatMap((leg, j) => (j ? leg.slice(1) : leg))
    : null;
  if (path) {
    segments.push(path);
    summaries.push({
      from: a.id,
      to: b.id,
      metres: Math.round(
        path
          .slice(1)
          .reduce(
            (sum, p, j) =>
              sum + Math.hypot(p[0] - path[j][0], p[1] - path[j][1]),
            0,
          ),
      ),
    });
  } else gaps.push([a.id, b.id]);
}
writeFileSync(
  "public/data/trail.json",
  JSON.stringify({
    status: "suggested-unverified",
    source:
      "OpenStreetMap walking network with an illustrative local connections; access and crossings require site checks",
    segments,
    links: authoredLinks,
    ribbons: segments.map((points) => trailSurface(points, data)),
    gaps,
  }),
);
console.log(
  `${segments.length} mapped connections, ${gaps.length} gaps; ${largest.length} connected walking nodes`,
);

writeFileSync(
  "src/data/trail-distances.json",
  JSON.stringify(summaries, null, 2) + "\n",
);
