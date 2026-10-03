import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import C from "clipper-lib";
import {
  prepareSurfaces,
  displayRoad,
  inside,
  bounds,
  crossesBuilding,
  roundRoute,
} from "../scripts/lib/map-surfaces.mjs";
import { installations } from "../src/data/installations.ts";
import { project } from "../src/lib/geo.ts";
const map = JSON.parse(readFileSync("public/data/map.json", "utf8"));
const rectangle = (x: number, z: number, w: number, h: number) => [
  [x, z],
  [x + w, z],
  [x + w, z + h],
  [x, z + h],
  [x, z],
];
const road = (extra = {}) => ({
  id: "test",
  name: "",
  kind: "footway",
  points: [
    [0, 0],
    [10, 0],
    [10, 10],
  ],
  public: true,
  walkable: true,
  ...extra,
});
function intersectionArea(polygons: number[][][][], obstacles: any[]) {
  const c = new C.Clipper(),
    out: any[] = [];
  const ring = (ps: number[][]) =>
    ps.map(([X, Y]) => ({ X: Math.round(X * 1000), Y: Math.round(Y * 1000) }));
  c.AddPaths(
    polygons.flatMap((p) => p.map(ring)),
    C.PolyType.ptSubject,
    true,
  );
  c.AddPaths(
    obstacles.map((o) => {
      let p = ring(o.points);
      if (!C.Clipper.Orientation(p)) p.reverse();
      return p;
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
  return Math.abs(out.reduce((n, p) => n + C.Clipper.Area(p), 0)) / 1e6;
}
test("basemap suppresses sidewalk/crossing/service clutter while preserving park paths and bridges", () => {
  const parks = [{ points: rectangle(-5, -5, 30, 30) }];
  assert.equal(displayRoad(road(), []), false);
  assert.equal(displayRoad(road(), parks), true);
  assert.equal(displayRoad(road({ footway: "sidewalk" }), parks), false);
  assert.equal(displayRoad(road({ footway: "crossing" }), parks), false);
  assert.equal(displayRoad(road({ bridge: true }), []), true);
  assert.equal(displayRoad(road({ public: false, bridge: true }), []), false);
  assert.equal(
    displayRoad(road({ kind: "service", service: "parking_aisle" }), []),
    false,
  );
});
test("joined paths remain continuous at a bend, and pedestrian areas render as areas", () => {
  const data = {
    buildings: [],
    water: [],
    parks: [{ points: rectangle(-5, -5, 30, 30) }],
    roads: [road()],
  };
  const surfaces = prepareSurfaces(data);
  assert.equal(surfaces.paths.length, 1);
  assert.ok(inside([10, 0], surfaces.paths[0][0]));
  const area = prepareSurfaces({
    ...data,
    roads: [road({ area: true, points: rectangle(0, 0, 10, 10) })],
  });
  assert.equal(area.paths.length, 0);
  assert.equal(area.plazas.length, 1);
  assert.ok(inside([5, 5], area.plazas[0][0]));
});
test("all visible prepared road, plaza and path surfaces avoid building interiors", () => {
  const polygons = Object.values(map.surfaces).flat() as number[][][][];
  const area = intersectionArea(polygons, map.buildings);
  assert.ok(area < 0.02, `overlap ${area} m2`);
});
test("all suggested trail edges avoid buildings and only cross water on mapped bridges", () => {
  const trail = JSON.parse(readFileSync("public/data/trail.json", "utf8"));
  const buildings = map.buildings.map((b: any) => ({
    ...b,
    bounds: bounds(b.points),
  }));
  const water = map.water.map((b: any) => ({ ...b, bounds: bounds(b.points) }));
  const key = (a: any, b: any) =>
    JSON.stringify([a, b].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  const bridges = new Set(
    map.roads
      .filter((r: any) => r.bridge)
      .flatMap((r: any) =>
        r.points.slice(1).map((b: any, i: number) => key(r.points[i], b)),
      ),
  );
  for (const s of trail.segments)
    for (let i = 1; i < s.length; i++) {
      assert.equal(crossesBuilding(s[i - 1], s[i], buildings), false);
      if (crossesBuilding(s[i - 1], s[i], water))
        assert.ok(bridges.has(key(s[i - 1], s[i])));
    }
  const area = intersectionArea(
    trail.ribbons.flatMap((leg: any) => leg.flatMap((p: any) => p.polygons)),
    map.buildings,
  );
  assert.ok(area < 0.02, `trail overlap ${area} m2`);
});
test("approximate outdoor catalogue anchors avoid occupied buildings; Dream Herd fits the circular plaza", () => {
  for (const item of installations) {
    const p = project(...item.coordinates);
    const occupied = map.buildings.filter(
      (b: any) => b.height > 2.5 && inside(p, b.points),
    );
    assert.deepEqual(
      occupied.map((b: any) => b.id),
      [],
      item.id,
    );
  }
  const herd = project(
    ...installations.find((i) => i.id === "dream-herd")!.coordinates,
  );
  assert.ok(Math.hypot(herd[0] - 116, herd[1] + 111) < 0.1);
});

test("07 to 08 takes the dockside bridges in order without doubling back", () => {
  const path = JSON.parse(readFileSync("public/data/trail.json", "utf8"))
    .segments[6];
  const nodes = path.map((p: number[]) => p.join(","));
  const gates = nodes.indexOf("-193.1,236");
  const hartley = nodes.indexOf("-145.2,309.9");
  assert.ok(gates > 0 && hartley > gates);
  assert.equal(nodes[gates + 1], "-183.9,265.7");
  assert.equal(nodes[hartley + 1], "-117.5,298.4");
  assert.equal(new Set(nodes).size, nodes.length);
  assert.ok(nodes.includes("-242.2,-68.5"), "leave 07 towards the waterfront");
  assert.ok(!nodes.includes("-123.5,-22.8"), "avoid the detour east of 07");
});

test("03 to 04 enters Old Churchyard and follows the courtyard beside the church", () => {
  const path = JSON.parse(readFileSync("public/data/trail.json", "utf8"))
    .segments[2];
  const entrance = path.findIndex(
    ([x, z]: number[]) => x === -174.4 && z === -365.8,
  );
  assert.ok(entrance > 0, "enter from the Old Churchyard crossing");
  assert.deepEqual(path.slice(entrance), [
    [-174.4, -365.8],
    [-170.8, -358.7],
    [-170.1, -336.6],
    [-169.7, -327.2],
    [-174.8, -326.4],
    [-178.3, -324.4],
    [-182.7, -323],
    [-186.7, -322.7],
  ]);
  assert.ok(
    !path.some(([x]: number[]) => x < -240),
    "avoid the road junction detour",
  );
});

test("04 to 05 crosses directly from the church to Pier Head", () => {
  const path = JSON.parse(readFileSync("public/data/trail.json", "utf8"))
    .segments[3];
  const length = path.reduce(
    (sum: number, p: number[], i: number) =>
      sum + (i ? Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0),
    0,
  );
  assert.ok(length < 280, `04 to 05 is ${length} metres`);
  const exit = path.findIndex(
    ([x, z]: number[]) => x === -195.5 && z === -285.9,
  );
  assert.ok(exit > 0);
  assert.deepEqual(path.slice(exit), [
    [-195.5, -285.9],
    [-270.5, -259.55],
    [-345.5, -233.2],
    [-377.5, -219.8],
  ]);
});

test("route corner rounding stays within the walking corridor and preserves endpoints", () => {
  const rounded = roundRoute([
    [0, 0],
    [10, 0],
    [10, 10],
  ]);
  assert.deepEqual(rounded[0], [0, 0]);
  assert.deepEqual(rounded.at(-1), [10, 10]);
  assert.ok(rounded.length > 3);
  for (const [x, z] of rounded)
    assert.ok(Math.min(Math.abs(z), Math.abs(x - 10)) < 1.1);
});

test("12 continues north to 13 without returning to 11", () => {
  const path = JSON.parse(readFileSync("public/data/trail.json", "utf8"))
    .segments[11];
  assert.ok(path.every((p: number[]) => p[1] < -100));
  assert.ok(path.some(([x, z]: number[]) => x === 184.6 && z === -138.7));
});

test("01 clears the Town Hall and 02 exits without a monument loop", () => {
  const [approach, departure] = JSON.parse(
    readFileSync("public/data/trail.json", "utf8"),
  ).segments;
  const nodes = [...approach, ...departure.slice(1)].map((p: number[]) =>
    p.join(","),
  );
  assert.equal(new Set(nodes).size, nodes.length, "no retraced approach at 02");
  assert.deepEqual(departure.slice(0, 3), [
    [7.1, -399.1],
    [7.8, -423.4],
    [22.9, -462.8],
  ]);
  // Sample the route against the detailed building, including the projecting portico.
  for (let i = 1; i < approach.length; i++)
    for (let t = 0; t <= 1; t += 0.05) {
      const x = approach[i - 1][0] * (1 - t) + approach[i][0] * t - 24;
      const z = approach[i - 1][1] * (1 - t) + approach[i][1] * t + 354;
      const localX = x * Math.cos(0.486) - z * Math.sin(0.486);
      const localZ = x * Math.sin(0.486) + z * Math.cos(0.486);
      assert.ok(Math.abs(localX) > 21.5 || Math.abs(localZ) > 27);
      assert.ok(Math.abs(localX) > 14 || localZ < 19 || localZ > 32);
    }
});

test("11 is viewed from the passing path and 12 follows the outside of the circle", () => {
  const trail = JSON.parse(readFileSync("public/data/trail.json", "utf8"));
  const incoming = trail.segments[9],
    outgoing = trail.segments[10];
  const edges = (ps: number[][]) =>
    ps.slice(1).map((p, i) => [ps[i].join(","), p.join(",")].sort().join("|"));
  const approach = new Set(edges(incoming));
  assert.ok(
    edges(outgoing).every((edge: string) => !approach.has(edge)),
    "11 has an out-and-back spur",
  );
  const circle = [...outgoing, ...trail.segments[11]].filter(
    ([x, z]: number[]) => Math.hypot(x - 116, z + 111) < 30,
  );
  assert.ok(circle.length > 5);
  assert.ok(
    circle.every(([x, z]: number[]) => Math.hypot(x - 116, z + 111) > 15),
    "12 cuts through the herd",
  );
});

test("05 uses the confirmed field position with a nearby connected approach", () => {
  const item = installations.find((i) => i.number === 5)!;
  assert.deepEqual(item.coordinates, [-2.9977405515358697, 53.405812152486924]);
  assert.equal(item.positionStatus, "surveyed");
  const [x, z] = project(...item.coordinates);
  const route = JSON.parse(readFileSync("public/data/trail.json", "utf8"));
  const approach = route.segments[3].at(-1);
  assert.ok(Math.hypot(approach[0] - x, approach[1] - z) < 20);
  assert.deepEqual(approach, route.segments[4][0]);
});

test("09 provisionally uses Anchor Courtyard and its entrance footpath", () => {
  const item = installations.find((i) => i.number === 9)!;
  const [x, z] = project(...item.coordinates);
  assert.ok(Math.abs(x - 88.78794) < 0.01 && Math.abs(z - 488.09214) < 0.01);
  assert.equal(item.positionStatus, "approximate");
  const route = JSON.parse(readFileSync("public/data/trail.json", "utf8"));
  const approach = route.segments[7].at(-1);
  assert.ok(Math.hypot(approach[0] - x, approach[1] - z) < 1);
  assert.deepEqual(route.segments[7].slice(-3), [
    [107.6, 490.3],
    [102.4, 492.4],
    [89.4, 488.2],
  ]);
  assert.deepEqual(approach, route.segments[8][0]);
});
