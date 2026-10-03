import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { nextTrailArtwork, trailWalk } from "../src/lib/trail-guide.ts";
import { installations } from "../src/data/installations.ts";
import legs from "../src/data/trail-distances.json" with { type: "json" };
const ids = installations.map((i) => i.id);
test("trail starts at first unseen stop and skips collected stops in route order", () => {
  assert.equal(nextTrailArtwork(ids, new Set(), null), ids[0]);
  assert.equal(
    nextTrailArtwork(ids, new Set([ids[1], ids[2]]), ids[0]),
    ids[3],
  );
  assert.equal(nextTrailArtwork(ids, new Set(ids), ids[12]), null);
  assert.equal(nextTrailArtwork(ids, new Set(ids.slice(1)), ids[12]), ids[0]);
});
test("walking estimates follow mapped legs, including reverse travel, with no distance guessed across gaps", () => {
  assert.equal(legs.length, 12);
  const expected = legs[0].metres + legs[1].metres;
  assert.deepEqual(trailWalk(ids, legs, ids[0], ids[2]), {
    metres: expected,
    minutes: Math.ceil(expected / 65),
  });
  assert.deepEqual(
    trailWalk(ids, legs, ids[2], ids[0]),
    trailWalk(ids, legs, ids[0], ids[2]),
  );
  assert.equal(trailWalk(ids, legs.slice(1), ids[0], ids[2]), null);
  assert.equal(trailWalk(ids, legs, null, ids[0]), null);
  assert.equal(trailWalk(ids, legs, ids[0], ids[0]), null);
});

test("generated walking distances remain in sync with the displayed trail", () => {
  const route = JSON.parse(
    readFileSync(new URL("../public/data/trail.json", import.meta.url), "utf8"),
  );
  assert.equal(route.gaps.length, 0);
  assert.equal(route.segments.length, legs.length);
  route.segments.forEach((points: number[][], index: number) => {
    const metres = Math.round(
      points
        .slice(1)
        .reduce(
          (sum, p, j) =>
            sum + Math.hypot(p[0] - points[j][0], p[1] - points[j][1]),
          0,
        ),
    );
    assert.equal(legs[index].metres, metres);
    assert.equal(legs[index].from, ids[index]);
    assert.equal(legs[index].to, ids[index + 1]);
  });
});
