import { readFileSync, writeFileSync } from "node:fs";
import C from "clipper-lib";
const map = JSON.parse(readFileSync("public/data/map.json", "utf8"));
const park = map.parks.find((p) => p.id === "24626860");
const origin = [155, 160],
  uphill = [0.72, -0.694];
const ring = (ps) =>
  ps.map(([x, z]) => ({ X: Math.round(x * 1000), Y: Math.round(z * 1000) }));
const outer = (ps) => {
  const r = ring(ps);
  if (!C.Clipper.Orientation(r)) r.reverse();
  return r;
};
const clip = (subject, clip) => {
  const c = new C.Clipper(),
    out = new C.PolyTree();
  c.AddPaths(subject, C.PolyType.ptSubject, true);
  c.AddPaths(clip, C.PolyType.ptClip, true);
  c.Execute(
    C.ClipType.ctIntersection,
    out,
    C.PolyFillType.pftNonZero,
    C.PolyFillType.pftNonZero,
  );
  return C.JS.PolyTreeToExPolygons(out).map((p) =>
    [p.outer, ...p.holes].map((r) => r.map((p) => [p.X / 1000, p.Y / 1000])),
  );
};
// A handful of broad planes rise from the Strand to the upper lawn. Heights
// are a visual approximation from the supplied aerial reference, not survey data.
const profile = [
  [-500, 0],
  [12, 0],
  [40, 2.4],
  [70, 7],
  [90, 10],
  [500, 10],
];
const point = (u, v) => [
  origin[0] + uphill[0] * u - uphill[1] * v,
  origin[1] + uphill[1] * u + uphill[0] * v,
];
const layers = {
  grass: [[park.points]],
  paving: clip(
    [
      ...map.surfaces.paths,
      ...map.surfaces.plazas,
      ...map.surfaces.roads,
    ].flatMap((p) => p.map((r, i) => (i ? ring(r) : outer(r)))),
    [outer(park.points)],
  ),
};
const bands = {};
for (const [name, polys] of Object.entries(layers)) {
  bands[name] = [];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1][0],
      b = profile[i][0];
    const strip = outer([
      point(a, -600),
      point(b, -600),
      point(b, 600),
      point(a, 600),
    ]);
    bands[name].push(
      ...clip(
        polys.flatMap((p) => p.map((r, i) => (i ? ring(r) : outer(r)))),
        [strip],
      ),
    );
  }
}
writeFileSync(
  "src/data/chavasse-park.json",
  JSON.stringify(
    { origin, uphill, profile, outline: park.points, ...bands },
    null,
    2,
  ) + "\n",
);
console.log(
  Object.fromEntries(Object.entries(bands).map(([k, p]) => [k, p.length])),
);
