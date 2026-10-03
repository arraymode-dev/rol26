import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { project, unproject, selectPreview } from "../src/lib/geo.ts";
import { installations } from "../src/data/installations.ts";

test("geographic projection preserves metre directions and round-trips coordinates", () => {
  assert.deepEqual(project(-2.992, 53.404), [0, -0]);
  assert.ok(project(-2.991, 53.404)[0] > 60);
  assert.ok(project(-2.992, 53.405)[1] < -110);
  for (const a of installations) {
    const r = unproject(...project(...a.coordinates));
    assert.ok(Math.abs(r[0] - a.coordinates[0]) < 1e-8);
    assert.ok(Math.abs(r[1] - a.coordinates[1]) < 1e-8);
  }
});
test("all thirteen artwork records have unique identities, references and valid coordinates", () => {
  assert.equal(installations.length, 13);
  assert.equal(new Set(installations.map((i) => i.id)).size, 13);
  for (const a of installations) {
    assert.ok(a.coordinates[0] > -3.01 && a.coordinates[0] < -2.97);
    assert.ok(a.coordinates[1] > 53.39 && a.coordinates[1] < 53.42);
    assert.ok(a.source.startsWith("https://www.visitliverpool.com/"));
    assert.ok(a.photos.length);
  }
});
test("catalogue follows the supplied official map numbers and keeps field photos separate from the numbering reference", () => {
  assert.deepEqual(
    installations.map((i) => [i.number, i.id]),
    [
      [1, "the-anooki"],
      [2, "flower-power"],
      [3, "loop"],
      [4, "today-i-love-you"],
      [5, "invisible-cities"],
      [6, "coloured-peonies"],
      [7, "unity"],
      [8, "colour-rush"],
      [9, "the-stars-come-out-at-night"],
      [10, "together"],
      [11, "paradigm"],
      [12, "dream-herd"],
      [13, "pop"],
    ],
  );
  const anooki = installations[0];
  assert.equal(anooki.photos.filter((p) => p.kind === "site").length, 9);
  assert.equal(anooki.photos.filter((p) => p.kind === "artwork").length, 1);
  assert.ok(anooki.photos.every((p) => existsSync(`public${p.src}`)));
  assert.ok(!anooki.photos.some((p) => p.src.endsWith("-1-photo-1.webp")));
  assert.equal(anooki.photos[0].src, "/photos/official/the-anooki.webp");
  assert.equal(anooki.positionStatus, "approximate");
});
test("automatic previews ignore distant and offscreen artworks; retain current choice with hysteresis", () => {
  const a = { id: "a", distance: 210, screenDistance: 0.2, visible: true },
    b = { id: "b", distance: 200, screenDistance: 0.1, visible: true };
  assert.equal(selectPreview([a, b], null), "b");
  assert.equal(selectPreview([a, b], "a"), "a");
  assert.equal(
    selectPreview([{ ...a, distance: 270, screenDistance: 0.5 }], "a"),
    "a",
  );
  assert.equal(
    selectPreview([{ ...a, distance: 270, screenDistance: 0.5 }], null),
    null,
  );
  assert.equal(selectPreview([{ ...a, visible: false }], null), null);
  assert.equal(selectPreview([{ ...a, distance: 310 }], "a"), null);
});
test("prepared geography contains landmarks and docks, with finite coordinates and heights", () => {
  const map = JSON.parse(readFileSync("public/data/map.json", "utf8"));
  assert.ok(map.buildings.length > 500);
  assert.ok(map.trees.length > 200);
  assert.ok(map.water.some((w: any) => w.name === "Royal Albert Dock"));
  for (const b of map.buildings) {
    assert.ok(b.height > 0 && b.height <= 65);
    assert.ok(b.points.length >= 4);
    for (const p of b.points) assert.ok(p.every(Number.isFinite));
  }
  assert.ok(map.buildings.some((b: any) => b.name === "Royal Liver Building"));
});
test("suggested trail follows connected map edges without invented straight-line fallbacks", () => {
  const trail = JSON.parse(readFileSync("public/data/trail.json", "utf8"));
  const map = JSON.parse(readFileSync("public/data/map.json", "utf8"));
  const edges = new Set<string>();
  for (const road of [...map.roads, ...(trail.links ?? [])])
    for (let i = 1; i < road.points.length; i++) {
      edges.add(JSON.stringify([road.points[i - 1], road.points[i]]));
      edges.add(JSON.stringify([road.points[i], road.points[i - 1]]));
    }
  assert.equal(trail.segments.length, 12);
  assert.deepEqual(trail.gaps, []);
  assert.equal(trail.status, "suggested-unverified");
  for (const s of trail.segments)
    for (let i = 1; i < s.length; i++) {
      assert.ok(
        Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]) <= 150,
      );
      assert.ok(edges.has(JSON.stringify([s[i - 1], s[i]])));
    }
});
