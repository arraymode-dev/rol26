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
  const data = parseSnapshot(saved, ids);
  assert.equal(
    visitorShare(
      data.artworks.find((a) => a.id === "invisible-cities")!.seen,
      data.totalVisitors,
    ),
    0.75,
  );
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
