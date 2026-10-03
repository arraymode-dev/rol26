import { prepareSurfaces } from "./lib/map-surfaces.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const xml = readFileSync("data/raw/liverpool.osm", "utf8");
const project = (lon, lat) => [
  Math.round((lon + 2.992) * 111320 * Math.cos((53.404 * Math.PI) / 180) * 10) /
    10,
  Math.round(-(lat - 53.404) * 111320 * 10) / 10,
];
const decode = (s) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
const attr = (s) =>
  Object.fromEntries(
    [...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]),
  );
const tags = (s) =>
  Object.fromEntries(
    [...s.matchAll(/<tag ([^>]+)\/>/g)].map((m) => {
      const a = attr(m[1]);
      return [a.k, a.v];
    }),
  );
const nodes = new Map();
const trees = [];
for (const m of xml.matchAll(/<node ([^>]+?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
  const a = attr(m[1]);
  const p = project(+a.lon, +a.lat);
  nodes.set(a.id, p);
  if (tags(m[2] || "").natural === "tree") trees.push(p);
}
const data = {
  source: "© OpenStreetMap contributors · ODbL 1.0",
  preparedAt: new Date().toISOString(),
  buildings: [],
  roads: [],
  water: [],
  parks: [],
  trees,
  coast: [],
};
const knownHeights = { 24611033: 51, 24611026: 34, 60261716: 28 };
// This small feature in Salthouse Dock is not a 13 m building volume.
const omittedBuildingVolumes = new Set(["269230393"]);
for (const m of xml.matchAll(/<way ([^>]+)>([\s\S]*?)<\/way>/g)) {
  const a = attr(m[1]),
    t = tags(m[2]),
    points = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)]
      .map((n) => nodes.get(n[1]))
      .filter(Boolean);
  if (points.length < 2) continue;
  const feature = { id: a.id, name: t.name || "", kind: "", points };
  const closed =
    points.length > 3 &&
    points[0][0] === points.at(-1)[0] &&
    points[0][1] === points.at(-1)[1];
  const near = points.some(
    (p) => Math.abs(p[0]) < 1050 && Math.abs(p[1]) < 1250,
  );
  if (!near) continue;
  if (t.building && closed && !omittedBuildingVolumes.has(a.id)) {
    feature.kind = t.building;
    feature.height =
      knownHeights[a.id] ||
      Math.min(65, parseFloat(t.height) || (+t["building:levels"] || 4) * 3.3);
    data.buildings.push(feature);
  }
  if (
    t.highway &&
    !["construction", "proposed", "motorway", "motorway_link"].includes(
      t.highway,
    ) &&
    (!t.tunnel || t.tunnel === "no") &&
    t.indoor !== "yes" &&
    t.highway !== "corridor" &&
    !(+t.layer < 0)
  ) {
    feature.kind = t.highway;
    data.roads.push({
      ...feature,
      area: t.area === "yes" && closed,
      public: !["no", "private", "customers", "delivery"].includes(t.access),
      indoor: t.indoor === "yes",
      footway: t.footway || "",
      service: t.service || "",
      bridge: !!t.bridge && t.bridge !== "no",
      walkable:
        !["no", "private", "customers", "delivery"].includes(t.access) &&
        !["no", "private"].includes(t.foot),
    });
  }
  if ((t.natural === "water" || t.water) && closed) {
    feature.kind = "water";
    data.water.push(feature);
  }
  if (
    (["park", "garden"].includes(t.leisure) ||
      ["grass", "recreation_ground"].includes(t.landuse)) &&
    closed
  ) {
    feature.kind = "park";
    data.parks.push(feature);
  }
  if (t.natural === "coastline")
    data.coast.push(...points.filter((p) => Math.abs(p[1]) < 1800));
}
// This building is a multipolygon relation, absent from the tagged-way pass.
data.buildings.push(
  JSON.parse(readFileSync("src/data/port-of-liverpool.json", "utf8")),
);
data.surfaces = prepareSurfaces(data);
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/map.json", JSON.stringify(data));
console.log(
  Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, v.length]),
  ),
);
