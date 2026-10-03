import test from "node:test";
import assert from "node:assert/strict";
import site from "../src/data/wapping-gate.json" with { type: "json" };
import { insideRing, type Point } from "../src/lib/attraction-boundary.ts";
import {
  TOGETHER_POSITION,
  TOGETHER_HEIGHT_SCALE,
  TOGETHER_BASE,
} from "../src/lib/together-placement.ts";
import { installations } from "../src/data/installations.ts";
import { project } from "../src/lib/geo.ts";

test("the taller Together gate and its buttresses are fully within the pavement", () => {
  const c = Math.cos(site.angle),
    s = Math.sin(site.angle);
  for (let u = -10; u <= 10; u += 0.25)
    for (let v = -3.1; v <= 2; v += 0.25) {
      const point: Point = [
        TOGETHER_POSITION[0] + c * u + s * v,
        TOGETHER_POSITION[1] - s * u + c * v,
      ];
      assert.ok(
        insideRing(point, site.pavement.points as Point[]),
        `Outside pavement: ${point}`,
      );
    }
  assert.ok(TOGETHER_BASE + 9.4 * TOGETHER_HEIGHT_SCALE > 13);
  const actual = project(
    ...installations.find((i) => i.id === "together")!.coordinates,
  );
  assert.ok(
    Math.hypot(
      actual[0] - TOGETHER_POSITION[0],
      actual[1] - TOGETHER_POSITION[1],
    ) < 0.01,
    "marker, wash and camera share the relocated centre",
  );
});
