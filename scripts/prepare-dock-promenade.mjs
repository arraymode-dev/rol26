import { readFileSync, writeFileSync } from "node:fs";
import C from "clipper-lib";
const map = JSON.parse(readFileSync("public/data/map.json", "utf8"));
const site = JSON.parse(readFileSync("src/data/wapping-gate.json", "utf8"));
const ring = (ps) => {
  const r = ps.map(([x, z]) => ({
    X: Math.round(x * 1000),
    Y: Math.round(z * 1000),
  }));
  if (!C.Clipper.Orientation(r)) r.reverse();
  return r;
};
const bank = [
  [160, 282.7],
  [166, 296.9],
  [175, 318],
  [186.2, 344.3],
  [198.1, 372.1],
  [205.4, 389.3],
];
const bankX = (z) => {
  let i = 0;
  while (i < bank.length - 2 && bank[i + 1][1] < z) i++;
  const [a, b] = [bank[i], bank[i + 1]];
  return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]);
};
// Roadside planting strip within the mapped promenade, not the carriageway.
const eastX = (z) => {
  const xs = [];
  const ps = site.pavement.points;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i];
    if (a[1] > z !== b[1] > z)
      xs.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
  }
  return Math.max(...xs);
};
const treeMoves = map.trees
  .filter(([x, z]) => z >= 269 && z <= 388 && x > bankX(z) && x < bankX(z) + 30)
  .map((p) => ({ from: p, to: [+(eastX(p[1]) - 3.5).toFixed(2), p[1]] }));
const vergeZ = [
  ...new Set([
    267,
    392,
    ...site.pavement.points.map((p) => p[1]).filter((z) => z > 267 && z < 392),
  ]),
].sort((a, b) => a - b);
const verge = [
  ...vergeZ.map((z) => [eastX(z) - 9, z]),
  ...vergeZ.toReversed().map((z) => [eastX(z) + 1, z]),
];
// South of the bridge, follow the actual east bank of both basins. Stop at
// the southern end of the marked walkway, before Queens Wharf.
// The Wapping Quay warehouse occupies the water's edge: the public walk
// continues on its landward side, between the warehouse and Wapping road.
const south = [
  [257, 491.2],
  [277, 539],
  [302, 590],
  [320, 612],
  [394, 788],
  [406, 818],
  [410, 835],
];
const edge = (w) =>
  south.map(([x, z], i) => {
    const a = south[Math.max(0, i - 1)],
      b = south[Math.min(south.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    return [x + (dz / len) * w, z - (dx / len) * w];
  });
const southern = [...edge(-4), ...edge(4).reverse()];
const bridgeApproach = [
  [239, 459],
  [251, 455],
  [265, 491.2],
  [248, 491.2],
];
const c = new C.Clipper();
c.AddPaths(
  [site.pavement.points, southern, bridgeApproach].map(ring),
  C.PolyType.ptSubject,
  true,
);
const obstacles = [
  verge,
  ...map.water.map((p) => p.points),
  ...map.buildings.map((p) => p.points),
  ...map.surfaces.roads.flatMap((p) => p),
];
c.AddPaths(obstacles.map(ring), C.PolyType.ptClip, true);
const out = new C.PolyTree();
c.Execute(
  C.ClipType.ctDifference,
  out,
  C.PolyFillType.pftNonZero,
  C.PolyFillType.pftNonZero,
);
const polygons = [];
function walk(node) {
  for (const n of node.Childs()) {
    if (!n.IsHole()) {
      const rings = [
        n.Contour(),
        ...n
          .Childs()
          .filter((h) => h.IsHole())
          .map((h) => h.Contour()),
      ];
      polygons.push(rings.map((r) => r.map((p) => [p.X / 1000, p.Y / 1000])));
    }
    walk(n);
  }
}
walk(out);
writeFileSync(
  "src/data/dock-promenade.json",
  JSON.stringify({ polygons, treeMoves }, null, 2) + "\n",
);
console.log(
  `${polygons.length} paving pieces; ${treeMoves.length} trees moved to the roadside verge`,
);
