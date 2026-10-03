import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  placeStreetLamps,
  LAMP_LIGHT_RADIUS,
} from "../src/lib/street-lamps.ts";
import { nearFootprint } from "../src/lib/attraction-boundary.ts";
import { project } from "../src/lib/geo.ts";
import { installations } from "../src/data/installations.ts";
import type { MapData } from "../src/types.ts";

const data: MapData = JSON.parse(
  readFileSync(new URL("../public/data/map.json", import.meta.url), "utf8"),
);
const centres = installations.map((i) => project(...i.coordinates));
const lamps = placeStreetLamps(data, centres);
test("street lamp pilot fits pavements and keeps light spill outside attraction buffers", () => {
  assert.ok(
    lamps.length >= 40 && lamps.length <= 60,
    `Unexpected pilot density ${lamps.length}`,
  );
  for (const lamp of lamps) {
    const p: [number, number] = [lamp.x, lamp.z];
    for (const centre of centres)
      assert.ok(
        Math.hypot(p[0] - centre[0], p[1] - centre[1]) - LAMP_LIGHT_RADIUS >=
          100,
        "Light spills into an attraction buffer",
      );
    for (const [points, ...holes] of data.surfaces.roads)
      assert.equal(
        nearFootprint(p, { points, holes }, 0.65),
        false,
        "Lamp occupies traffic space",
      );
    for (const building of data.buildings)
      assert.equal(
        nearFootprint(p, building, 1.1),
        false,
        "Lamp too close to a building",
      );
    for (const water of data.water)
      assert.equal(nearFootprint(p, water, 0.6), false, "Lamp in water");
  }
  lamps.forEach((lamp, i) =>
    lamps
      .slice(i + 1)
      .forEach((other) =>
        assert.ok(
          Math.hypot(lamp.x - other.x, lamp.z - other.z) >= 28,
          "Lamps crowd a street corner",
        ),
      ),
  );
  assert.deepEqual(
    placeStreetLamps(data, centres),
    lamps,
    "Positions must not shuffle between visits",
  );
});
