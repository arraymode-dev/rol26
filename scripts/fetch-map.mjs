import { mkdirSync, writeFileSync } from "node:fs";
const url =
  "https://api.openstreetmap.org/api/0.6/map?bbox=-3.004,53.394,-2.980,53.412";
const response = await fetch(url);
if (!response.ok) throw new Error(`OSM request failed: ${response.status}`);
const xml = await response.text();
if (!xml.includes("<osm")) throw new Error("Expected OSM XML");
mkdirSync("data/raw", { recursive: true });
writeFileSync("data/raw/liverpool.osm", xml);
console.log("Saved source OSM extract. Run npm run data:prepare.");
