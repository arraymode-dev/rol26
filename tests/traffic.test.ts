import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseSnapshot,
  visitorShare,
  heatField,
  magma,
  mapPoint,
  MAP,
  worldPixel,
} from "../src/traffic/model.ts";
import { installations } from "../src/data/installations.ts";
const saved = JSON.parse(
  readFileSync(
    new URL("../public/data/heap-traffic.json", import.meta.url),
    "utf8",
  ),
);
const ids = installations.map((a) => a.id);
test("snapshot is complete Production data with valid unique-visitor shares", () => {
  parseSnapshot(saved, ids);
  // Formula checks use fixed inputs so publishing a new snapshot does not
  // incorrectly fail validation against yesterday's counts.
  assert.equal(visitorShare(3, 4), 0.75);
  assert.equal(visitorShare(0, 0), 0);
  assert.throws(() =>
    parseSnapshot({ ...saved, environment: "Development" }, ids),
  );
  assert.throws(() => parseSnapshot({ ...saved, totalVisitors: 1 }, ids));
  assert.throws(() =>
    parseSnapshot({ ...saved, artworks: saved.artworks.slice(1) }, ids),
  );
  assert.throws(() =>
    parseSnapshot(
      {
        ...saved,
        artworks: saved.artworks.map((a: any) => ({ ...a, id: ids[0] })),
      },
      ids,
    ),
  );
});
test("heatmap overlaps preserve peak share rather than summing repeat visitors", () => {
  const point = { x: 20, y: 20, weight: 0.5 };
  const field = heatField([point, point], 40, 40, 5);
  assert.equal(field[20 * 40 + 20], 0.5);
  assert.ok(field[20 * 40 + 25] < 0.5);
  assert.equal(Math.max(...heatField([{ ...point, weight: 0 }], 40, 40, 5)), 0);
  assert.deepEqual(magma(0), [0, 0, 4]);
  assert.deepEqual(magma(1), [252, 253, 191]);
});
test("Mercator aligns with OSM tile origin and keeps all locations inside fixed bounds", () => {
  assert.deepEqual(worldPixel(0, 0, 0), [128, 128]);
  for (const a of installations) {
    const [x, y] = mapPoint(a.coordinates);
    assert.ok(
      x > 20 && x < MAP.width - 20 && y > 20 && y < MAP.height - 20,
      a.id,
    );
  }
});

test("nearby footprints merge smoothly without increasing shares above their peaks", () => {
  const points = [
    { x: 20, y: 30, weight: 0.5 },
    { x: 40, y: 30, weight: 0.5 },
  ];
  const field = heatField(points, 80, 60, 10);
  const solo = heatField([points[0]], 80, 60, 10);
  const middle = 30 * 80 + 30;
  assert.ok(
    field[middle] > solo[middle] * 1.3,
    "nearby centres form a connecting shoulder",
  );
  assert.ok(Math.max(...field) <= 0.500001, "no summed visitor inflation");
  assert.ok(
    Math.abs(field[middle - 1] - field[middle + 1]) < 0.000001,
    "symmetric seam",
  );
  assert.ok(
    Math.abs(field[middle] - field[middle - 1]) < 0.002,
    "smooth centre join",
  );
  const far = heatField(
    [
      { x: 10, y: 30, weight: 0.5 },
      { x: 100, y: 30, weight: 0.5 },
    ],
    120,
    60,
    10,
  );
  assert.equal(far[30 * 120 + 55], 0, "distant clusters remain disconnected");
  assert.deepEqual(
    heatField([...points, { x: 30, y: 30, weight: 0 }], 80, 60, 10),
    field,
  );
});
